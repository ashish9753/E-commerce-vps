import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
    images: [String],
    isVerifiedPurchase: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Non-unique: a customer may leave more than one review for the same product.
reviewSchema.index({ user: 1, product: 1 });

export default mongoose.model("Review", reviewSchema);
