import Order from "../models/order.model.js";
import Employee from "../models/employee.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { notify, notifyAdmins } from "../utils/notify.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary.utils.js";

/**
 * FonePay manual-payment flow.
 *
 * There is no online gateway. Customers scan a static FonePay QR, pay from
 * their own banking/wallet app, then upload a screenshot of the successful
 * transaction. Admin/employee verify the screenshot and either accept the
 * payment (order → PAID) or reject it (fake / not received).
 *
 * The same upload + review pair handles two cases, branching on the order's
 * paymentMethod:
 *   • ONLINE  → the full order amount (paymentProof / paymentReviewStatus)
 *   • COD     → the non-refundable booking advance (codBookingScreenshot /
 *               codBookingStatus)
 */

const notifyStaffNewPayment = async (order, kind) => {
  // Tell every employee + all admins that a payment screenshot is waiting to
  // be verified. Best-effort — never blocks the customer response.
  setImmediate(async () => {
    try {
      const allEmployees = await Employee.find({}).select("user").lean();
      for (const emp of allEmployees) {
        if (emp.user) {
          await notify({
            userId:  emp.user,
            title:   "Payment Awaiting Verification 🧾",
            message: `Order #${order.orderNumber}${kind === "booking" ? " (COD booking)" : ""} has a payment screenshot to verify.`,
            type:    "PAYMENT",
            link:    "/employee",
          });
        }
      }
      await notifyAdmins({
        title:   "Payment Awaiting Verification 🧾",
        message: `Order #${order.orderNumber}${kind === "booking" ? " (COD booking)" : ""} — customer uploaded a FonePay screenshot. Please verify.`,
        type:    "PAYMENT",
        link:    "/admin",
      });
    } catch { /* non-critical */ }
  });
};

/**
 * Customer uploads a FonePay payment screenshot for one of their orders.
 * POST /payments/proof/:orderId  (multipart, field "screenshot")
 */
export const submitPaymentProof = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) throw new ApiError(404, "Order not found");
    if (order.user.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "This order does not belong to you");
    }
    if (!req.file) throw new ApiError(400, "Payment screenshot is required");
    if (["CANCELLED", "RETURNED"].includes(order.orderStatus)) {
      throw new ApiError(400, "Cannot submit payment for this order");
    }

    const result = await uploadToCloudinary(req.file.buffer, "orders/payment-proof");
    const proof = {
      url:        result.secure_url,
      publicId:   result.public_id,
      uploadedAt: new Date(),
    };

    if (order.paymentMethod === "ONLINE") {
      if (order.paymentStatus === "PAID") throw new ApiError(400, "Order is already paid");
      // Replace any previous (e.g. rejected) screenshot.
      if (order.paymentProof?.publicId) {
        deleteFromCloudinary(order.paymentProof.publicId).catch(() => {});
      }
      order.paymentProof        = proof;
      order.paymentReviewStatus = "PENDING_REVIEW";
      order.paymentReviewNote   = "";
      order.paymentReviewedAt   = null;
      await order.save();
      await notifyStaffNewPayment(order, "online");
      return res.json(new ApiResponse(200, { order }, "Payment screenshot submitted — awaiting verification"));
    }

    // COD booking advance
    if (order.codBookingAmount <= 0) {
      throw new ApiError(400, "This order has no booking advance to pay");
    }
    if (order.codBookingStatus === "PAID") throw new ApiError(400, "Booking advance is already verified");
    if (order.codBookingScreenshot?.publicId) {
      deleteFromCloudinary(order.codBookingScreenshot.publicId).catch(() => {});
    }
    order.codBookingScreenshot = proof;
    order.codBookingStatus     = "PENDING";
    await order.save();
    await notifyStaffNewPayment(order, "booking");
    res.json(new ApiResponse(200, { order }, "Booking screenshot submitted — awaiting verification"));
  } catch (err) {
    next(err);
  }
};

/**
 * Admin/employee accepts or rejects a customer's payment screenshot.
 * PATCH /payments/:orderId/review   body: { action: "accept"|"reject", note }
 */
export const reviewPayment = async (req, res, next) => {
  try {
    const { action, note } = req.body;
    if (!["accept", "reject"].includes(action)) {
      throw new ApiError(400, "action must be 'accept' or 'reject'");
    }
    const order = await Order.findById(req.params.orderId);
    if (!order) throw new ApiError(404, "Order not found");

    const reviewNote = typeof note === "string" ? note.trim().slice(0, 500) : "";

    if (order.paymentMethod === "ONLINE") {
      if (!order.paymentProof?.url) throw new ApiError(400, "No payment screenshot to review");
      if (order.paymentStatus === "PAID") throw new ApiError(400, "Order is already paid");

      if (action === "accept") {
        order.paymentStatus       = "PAID";
        order.paidAt              = new Date();
        order.paymentReviewStatus = "VERIFIED";
        order.paymentReviewNote   = reviewNote;
        order.paymentReviewedAt   = new Date();
        await order.save();

        // Now that payment is confirmed, notify staff this is a live order
        setImmediate(async () => {
          try {
            const allEmployees = await Employee.find({}).select("user").lean();
            for (const emp of allEmployees) {
              if (emp.user) {
                await notify({
                  userId:  emp.user,
                  title:   "New Order Received! 📦",
                  message: `Order #${order.orderNumber} payment verified. Please confirm and process it.`,
                  type:    "ORDER",
                  link:    "/employee",
                });
              }
            }
            await notifyAdmins({
              title:   "Payment Verified 💳",
              message: `Order #${order.orderNumber} (Rs. ${order.totalPrice}) — FonePay payment verified.`,
              type:    "PAYMENT",
              link:    "/admin",
            });
          } catch { /* non-critical */ }
        });

        await notify({
          userId:  order.user,
          title:   "Payment Verified ✅",
          message: `Your payment for order #${order.orderNumber} has been verified. Your order is now confirmed.`,
          type:    "PAYMENT",
          link:    "/orders",
        });
        return res.json(new ApiResponse(200, { order }, "Payment verified"));
      }

      // reject
      order.paymentReviewStatus = "REJECTED";
      order.paymentReviewNote   = reviewNote || "Payment could not be verified";
      order.paymentReviewedAt   = new Date();
      await order.save();
      await notify({
        userId:  order.user,
        title:   "Payment Not Verified ⚠️",
        message: `Your payment for order #${order.orderNumber} could not be verified${reviewNote ? `: ${reviewNote}` : ""}. Please re-upload a valid payment screenshot from My Orders.`,
        type:    "PAYMENT",
        link:    "/orders",
      });
      return res.json(new ApiResponse(200, { order }, "Payment rejected"));
    }

    // COD booking advance review
    if (!order.codBookingScreenshot?.url) throw new ApiError(400, "No booking screenshot to review");
    if (order.codBookingStatus === "PAID") throw new ApiError(400, "Booking advance already verified");

    if (action === "accept") {
      order.codBookingStatus  = "PAID";
      order.paymentReviewNote = reviewNote;
      await order.save();
      await notify({
        userId:  order.user,
        title:   "Booking Verified ✅",
        message: `Your booking advance for order #${order.orderNumber} has been verified.`,
        type:    "PAYMENT",
        link:    "/orders",
      });
      return res.json(new ApiResponse(200, { order }, "Booking verified"));
    }

    order.codBookingStatus  = "REJECTED";
    order.paymentReviewNote = reviewNote || "Booking payment could not be verified";
    await order.save();
    await notify({
      userId:  order.user,
      title:   "Booking Not Verified ⚠️",
      message: `Your booking advance for order #${order.orderNumber} could not be verified${reviewNote ? `: ${reviewNote}` : ""}. Please re-upload a valid screenshot from My Orders.`,
      type:    "PAYMENT",
      link:    "/orders",
    });
    res.json(new ApiResponse(200, { order }, "Booking rejected"));
  } catch (err) {
    next(err);
  }
};

/** Read the payment/proof info for an order (owner or staff). */
export const getPaymentByOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .select("user paymentMethod paymentStatus paymentProof paymentReviewStatus paymentReviewNote codBookingAmount codBookingStatus codBookingScreenshot totalPrice orderNumber");
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
