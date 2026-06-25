import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    paymentGateway: { type: String, enum: ["FONEPAY", "COD"] },
    // Fonepay Intent-QR references
    fonepayPrn:        String, // referenceLabel / payment reference number
    fonepayTraceId:    String, // Fonepay transaction trace id
    fonepayTerminalId: String,
    transactionId: String,
    paymentStatus: {
      type: String,
      enum: ["SUCCESS", "FAILED", "PENDING", "REFUNDED"],
      default: "PENDING",
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "NPR" },
    paidAt: Date,
    failureReason: String,
    refundId: String,
    refundAmount: Number,
    refundedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
