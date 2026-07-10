import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  title: String,
  image: String,
  quantity: Number,
  price: Number,
  // Selected color/variant for this line (empty for color-less products).
  color: { type: String, default: "" },
  colorImage: { type: String, default: "" },
  // True when this line was added by a FREEBIE coupon (price will be 0).
  isFreebie: { type: Boolean, default: false },
  // Per-unit retail value of a freebie line (what the customer would have paid).
  // Recorded so invoices/receipts can show how much the gift was worth.
  freebieValue: { type: Number, default: 0 },
}, { _id: false });

// One Fonepay Intent-QR transaction. Used twice on an order: once for the full
// ONLINE payment (`fonepayPayment`) and once for the COD booking advance
// (`fonepayBooking`). `prn`/`referenceLabel` is the unique key we use to query
// Fonepay's status API and reconcile the live WebSocket push.
const fonepayTxnSchema = new mongoose.Schema({
  prn:          { type: String, default: "" }, // referenceLabel sent to Fonepay
  terminalId:   { type: String, default: "" },
  amount:       { type: Number, default: 0 },
  qrString:     { type: String, default: "" }, // raw QR payload (for re-render)
  websocketUrl: { type: String, default: "" }, // live status socket from Fonepay
  status:       { type: String, enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING" },
  traceId:      { type: String, default: "" }, // Fonepay trace id on success
  message:      { type: String, default: "" }, // gateway status message
  generatedAt:  { type: Date, default: null },
  paidAt:       { type: Date, default: null },
}, { _id: false });

const shippingAddressSchema = new mongoose.Schema({
  fullName: String,
  phone: String,
  pincode: String,
  state: String,
  city: String,
  houseNo: String,
  area: String,
  landmark: String,
  // Upaya delivery references — set when the address is picked from the
  // Upaya location list so we can dispatch automatically.
  upayaLocationId: { type: Number, default: null },
  upayaAreaId:     { type: Number, default: null },
}, { _id: false });

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderNumber: { type: String, unique: true },
    orderItems: [orderItemSchema],
    shippingAddress: shippingAddressSchema,
    // DELIVERY = shipped to the customer (Upaya); PICKUP = customer collects
    // from the shop (no delivery charge, never dispatched to Upaya).
    fulfillmentType: { type: String, enum: ["DELIVERY", "PICKUP"], default: "DELIVERY" },
    paymentMethod: { type: String, enum: ["COD", "ONLINE"], required: true },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    orderStatus: {
      type: String,
      enum: ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"],
      default: "PLACED",
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],
    cancellationReason: String,
    refundStatus: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "REJECTED", "NOT_APPLICABLE"],
      default: "NOT_APPLICABLE",
    },
    refundAmount: { type: Number, default: 0 },
    refundReason: String,
    itemsPrice: Number,
    shippingPrice: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalPrice: Number,
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
    trackingId: String,
    estimatedDeliveryDate: Date,
    deliveredAt: Date,
    paidAt: Date,
    codBookingAmount:  { type: Number, default: 0 },
    codBookingStatus:  { type: String, enum: ["NOT_REQUIRED", "PENDING", "PAID", "REJECTED"], default: "NOT_REQUIRED" },
    // Fonepay Checkout Intent gateway
    // Customer pays by scanning a single-use dynamic Fonepay QR. The gateway
    // confirms the payment automatically (live WebSocket + status API) — no
    // screenshots, no manual verification.
    //   • fonepayPayment → full ONLINE order amount → order.paymentStatus PAID
    //   • fonepayBooking → COD non-refundable advance → order.codBookingStatus PAID
    fonepayPayment: { type: fonepayTxnSchema, default: undefined },
    fonepayBooking: { type: fonepayTxnSchema, default: undefined },
    cancellationRefundMethod: { type: String, enum: ['bank_transfer', 'upi'] },
    cancellationBankDetails:  { type: mongoose.Schema.Types.Mixed, default: {} },
    cancellationRefundProof:  [{
      url:        { type: String, required: true },
      publicId:   String,
      uploadedBy: { type: String, enum: ['employee', 'admin'], default: 'admin' },
      uploadedAt: { type: Date, default: Date.now },
    }],
    // Halfway-mark payment reminder for unpaid ONLINE orders. Tracked so the
    // sweeper sends exactly one reminder per order before auto-cancellation.
    paymentReminderSentAt: { type: Date, default: null },
    // Upaya integration
    upayaOrderRef:   { type: String, default: null }, // reference returned by Upaya add-order
    upayaTrackingId: { type: String, default: null }, // tracking id (often same as order ref)
    upayaSyncStatus: {
      type: String,
      enum: ["NOT_SENT", "PENDING", "SYNCED", "FAILED", "SKIPPED"],
      default: "NOT_SENT",
    },
    upayaError:      { type: String, default: null },
    upayaSyncedAt:   { type: Date, default: null },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });

orderSchema.pre("save", function (next) {
  if (!this.orderNumber) {
    this.orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }
  next();
});

export default mongoose.model("Order", orderSchema);
