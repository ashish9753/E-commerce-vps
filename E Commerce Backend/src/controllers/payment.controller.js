import QRCode from "qrcode";
import Order from "../models/order.model.js";
import Payment from "../models/payment.model.js";
import Employee from "../models/employee.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { notify, notifyAdmins } from "../utils/notify.js";
import fonepayService, { buildReferenceLabel } from "../services/fonepay.service.js";
import { watchFonepayPayment } from "../services/fonepayWatcher.js";

/**
 * Fonepay Checkout Intent flow (automatic, no screenshots).
 *
 *   1. POST /payments/fonepay/:orderId/qr   → generate a single-use dynamic QR
 *   2. customer scans + pays from any banking / wallet app
 *   3. GET  /payments/fonepay/:orderId/status → live status; settles the order
 *      the moment Fonepay reports success (also driven by the WebSocket watcher)
 *
 * `purpose` distinguishes the two amounts an order can collect via Fonepay:
 *   • "full"    → the whole ONLINE order amount   → paymentStatus PAID
 *   • "booking" → the COD non-refundable advance  → codBookingStatus PAID
 */

const PURPOSES = ["full", "booking"];

const txnFieldFor = (purpose) => (purpose === "booking" ? "fonepayBooking" : "fonepayPayment");

// Amount this purpose collects, plus a guard that the order is in a state where
// that payment still makes sense.
const resolvePurpose = (order, purpose) => {
  if (purpose === "booking") {
    if (order.paymentMethod !== "COD") throw new ApiError(400, "This order is not a COD order");
    if (!(order.codBookingAmount > 0)) throw new ApiError(400, "This order has no booking advance to pay");
    if (order.codBookingStatus === "PAID") throw new ApiError(400, "Booking advance is already paid");
    return order.codBookingAmount;
  }
  // full
  if (order.paymentMethod !== "ONLINE") throw new ApiError(400, "This order is not an online-payment order");
  if (order.paymentStatus === "PAID") throw new ApiError(400, "Order is already paid");
  return order.totalPrice;
};

/**
 * Generate (or re-generate) a dynamic Fonepay QR for an order.
 * POST /payments/fonepay/:orderId/qr   body: { purpose: "full" | "booking" }
 */
export const createFonepayQr = async (req, res, next) => {
  try {
    if (!fonepayService.isConfigured()) {
      throw new ApiError(503, "Online payment is temporarily unavailable. Please try again later.");
    }
    const purpose = String(req.body?.purpose || "full").toLowerCase();
    if (!PURPOSES.includes(purpose)) throw new ApiError(400, "purpose must be 'full' or 'booking'");

    const order = await Order.findById(req.params.orderId);
    if (!order) throw new ApiError(404, "Order not found");
    if (order.user.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "This order does not belong to you");
    }
    if (["CANCELLED", "RETURNED"].includes(order.orderStatus)) {
      throw new ApiError(400, "Cannot pay for this order");
    }

    const amount = resolvePurpose(order, purpose);
    const referenceLabel = buildReferenceLabel(purpose === "booking" ? "BOOKING" : "FULL");

    const qr = await fonepayService.generateIntentQr({
      amount,
      billId: order.orderNumber,
      referenceLabel,
    });

    // Render the QR payload to a scannable PNG data URL so the frontend just
    // shows an <img> — no client-side QR dependency needed.
    const qrImage = await QRCode.toDataURL(qr.qrString, { width: 320, margin: 1, errorCorrectionLevel: "M" });

    const field = txnFieldFor(purpose);
    order[field] = {
      prn:          qr.prn,
      terminalId:   qr.terminalId,
      amount,
      qrString:     qr.qrString,
      websocketUrl: qr.websocketUrl,
      status:       "PENDING",
      generatedAt:  new Date(),
    };
    await order.save();

    // Best-effort live settlement via Fonepay's WebSocket. Polling the status
    // endpoint remains the reliable fallback, so any watcher failure is silent.
    if (qr.websocketUrl) {
      watchFonepayPayment({ orderId: order._id.toString(), purpose, prn: qr.prn, websocketUrl: qr.websocketUrl });
    }

    res.json(new ApiResponse(200, {
      purpose,
      amount,
      prn: qr.prn,
      qrImage,             // data:image/png;base64,...
      qrString: qr.qrString,
      websocketUrl: qr.websocketUrl,
      qrDisplayName: qr.qrDisplayName,
    }, "Scan the QR to complete your payment"));
  } catch (err) {
    next(err);
  }
};

/**
 * Mark a Fonepay payment settled. Idempotent and safe to call from both the
 * polling status endpoint and the WebSocket watcher — the first successful
 * call wins, later calls are no-ops. Verifies the gateway-reported amount
 * matches what we asked for before crediting anything.
 *
 * Returns the (possibly already-)settled status string: SUCCESS | PENDING | FAILED.
 */
export const settleFonepayPayment = async (orderId, purpose) => {
  const order = await Order.findById(orderId);
  if (!order) return { status: "FAILED", reason: "order_not_found" };

  const field = txnFieldFor(purpose);
  const txn = order[field];

  // Already settled? short-circuit.
  if (purpose === "full" && order.paymentStatus === "PAID") return { status: "SUCCESS", order };
  if (purpose === "booking" && order.codBookingStatus === "PAID") return { status: "SUCCESS", order };
  if (!txn?.prn) return { status: "PENDING", reason: "no_qr_generated", order };

  // Ask Fonepay for the authoritative status (doc §9.6).
  let status;
  try {
    status = await fonepayService.getPaymentStatus({ referenceLabel: txn.prn });
  } catch {
    return { status: "PENDING", reason: "status_check_failed", order };
  }

  if (status.paymentStatus === "success") {
    // Defend against amount tampering — confirm the paid amount matches.
    const paid = Number(status.totalTransactionAmount ?? status.requestedAmount);
    if (Number.isFinite(paid) && Math.abs(paid - txn.amount) > 0.5) {
      txn.status = "FAILED";
      txn.message = `Amount mismatch: expected ${txn.amount}, got ${paid}`;
      await order.save();
      return { status: "FAILED", reason: "amount_mismatch", order };
    }

    const traceId = String(status.fonepayTraceId || "");
    const message = status.paymentMessage || "Payment success";
    const now = new Date();
    const txnSet = {
      [`${field}.status`]:  "SUCCESS",
      [`${field}.traceId`]: traceId,
      [`${field}.message`]: message,
      [`${field}.paidAt`]:  now,
    };

    // Atomically claim the settlement so the WebSocket watcher and the status
    // poll can't both credit the order (duplicate notifications / Payment docs).
    // Only the update that actually flips the status from "not paid" wins.
    const claimFilter = purpose === "full"
      ? { _id: order._id, paymentStatus: { $ne: "PAID" } }
      : { _id: order._id, codBookingStatus: { $ne: "PAID" } };
    const claimUpdate = purpose === "full"
      ? { $set: { paymentStatus: "PAID", paidAt: now, ...txnSet } }
      : { $set: { codBookingStatus: "PAID", ...txnSet } };

    const claimed = await Order.findOneAndUpdate(claimFilter, claimUpdate, { new: true });
    if (!claimed) {
      // Lost the race — already settled by the other path. No double side effects.
      return { status: "SUCCESS", order };
    }

    // Record a Payment document for accounting / audit.
    await Payment.create({
      order: claimed._id,
      user: claimed.user,
      paymentGateway: "FONEPAY",
      fonepayPrn: txn.prn,
      fonepayTraceId: traceId,
      fonepayTerminalId: txn.terminalId,
      transactionId: traceId,
      paymentStatus: "SUCCESS",
      amount: txn.amount,
      currency: "NPR",
      paidAt: now,
    }).catch(() => {});

    await afterPaymentSettled(claimed, purpose);
    return { status: "SUCCESS", order: claimed };
  }

  if (status.paymentStatus === "failed") {
    txn.status = "FAILED";
    txn.message = status.paymentMessage || "Payment failed";
    await order.save();
    return { status: "FAILED", reason: "gateway_failed", order };
  }

  return { status: "PENDING", order };
};

// Notifications + staff alerts once a payment is confirmed. Mirrors what the
// old manual "accept" path did, minus the human in the loop.
const afterPaymentSettled = async (order, purpose) => {
  if (purpose === "booking") {
    await notify({
      userId:  order.user,
      title:   "Booking Confirmed ✅",
      message: `Your booking advance for order #${order.orderNumber} has been received. Your COD order is confirmed.`,
      type:    "PAYMENT",
      link:    "/orders",
    });
    return;
  }

  // Full online payment — confirm to customer + alert staff this is a live order.
  await notify({
    userId:  order.user,
    title:   "Payment Successful ✅",
    message: `Your payment for order #${order.orderNumber} was successful. Your order is now confirmed.`,
    type:    "PAYMENT",
    link:    "/orders",
  });

  setImmediate(async () => {
    try {
      const allEmployees = await Employee.find({}).select("user").lean();
      for (const emp of allEmployees) {
        if (emp.user) {
          await notify({
            userId:  emp.user,
            title:   "New Order Received! 📦",
            message: `Order #${order.orderNumber} payment received via Fonepay. Please confirm and process it.`,
            type:    "ORDER",
            link:    "/employee",
          });
        }
      }
      await notifyAdmins({
        title:   "Payment Received 💳",
        message: `Order #${order.orderNumber} (Rs. ${order.totalPrice}) — Fonepay payment confirmed.`,
        type:    "PAYMENT",
        link:    "/admin",
      });
    } catch { /* non-critical */ }
  });
};

/**
 * Live payment status for an order. Polled by the frontend while the QR is on
 * screen; performs an on-demand settlement so the order flips to PAID as soon
 * as Fonepay confirms — even if the WebSocket push was missed.
 * GET /payments/fonepay/:orderId/status?purpose=full|booking
 */
export const getFonepayStatus = async (req, res, next) => {
  try {
    const purpose = String(req.query?.purpose || "full").toLowerCase();
    if (!PURPOSES.includes(purpose)) throw new ApiError(400, "purpose must be 'full' or 'booking'");

    const order = await Order.findById(req.params.orderId).select(
      "user paymentMethod paymentStatus totalPrice orderNumber codBookingAmount codBookingStatus fonepayPayment fonepayBooking"
    );
    if (!order) throw new ApiError(404, "Order not found");
    const isStaff = req.user.role === "admin" || req.user.role === "employee";
    if (!isStaff && order.user.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "Access denied");
    }

    const result = await settleFonepayPayment(order._id, purpose);
    const fresh = result.order || order;
    const txn = fresh[txnFieldFor(purpose)];

    res.json(new ApiResponse(200, {
      purpose,
      status: result.status,                  // SUCCESS | PENDING | FAILED
      paymentStatus: fresh.paymentStatus,
      codBookingStatus: fresh.codBookingStatus,
      message: txn?.message || "",
      prn: txn?.prn || null,
    }));
  } catch (err) {
    next(err);
  }
};

/** Read the payment info for an order (owner or staff). */
export const getPaymentByOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .select("user paymentMethod paymentStatus codBookingAmount codBookingStatus fonepayPayment fonepayBooking totalPrice orderNumber");
    if (!order) throw new ApiError(404, "Order not found");
    const isStaff = req.user.role === "admin" || req.user.role === "employee";
    if (!isStaff && order.user.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "Access denied");
    }
    res.json(new ApiResponse(200, { order }));
  } catch (err) {
    next(err);
  }
};

/** Banks available for the (mobile) intent flow — optional helper. */
export const getFonepayBanks = async (req, res, next) => {
  try {
    const banks = await fonepayService.getBankList({ mobileNo: req.query?.mobileNo });
    res.json(new ApiResponse(200, { banks }));
  } catch (err) {
    next(err);
  }
};
