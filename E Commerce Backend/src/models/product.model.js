import mongoose from "mongoose";

// A color/variant of a product. Each carries its own image, price and stock.
// When a product has colors, the top-level `stock` is kept in sync as the sum
// of the colors' stock (see the pre-save hook below).
const colorSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  image:         { type: String, default: "" },
  price:         { type: Number, min: 0 },
  discountPrice: { type: Number, min: 0 },
  stock:         { type: Number, default: 0, min: 0 },
}, { _id: false });

const productSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: { type: String, required: true },
    shortDescription: String,
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    brand: String,
    sku: { type: String, unique: true, sparse: true },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    sold: { type: Number, default: 0 },
    images: [String],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    tags: [String],
    colors: { type: [colorSchema], default: [] },
    specifications: { type: Map, of: String },
    isFeatured:    { type: Boolean, default: false },
    isPublished:   { type: Boolean, default: true },
    isDeleted:     { type: Boolean, default: false },
    returnable:    { type: Boolean, default: true },
    returnWindow:  { type: Number, enum: [7, 10], default: 7 },
  },
  { timestamps: true }
);

// Keep the top-level stock as the sum of color stocks so all existing stock
// checks ("X left", low-stock alerts, list filters) keep working unchanged.
productSchema.pre("save", function (next) {
  if (Array.isArray(this.colors) && this.colors.length > 0) {
    this.stock = this.colors.reduce((sum, c) => sum + (Number(c.stock) || 0), 0);
  }
  next();
});

productSchema.index({ title: "text", description: "text", tags: "text" });
productSchema.index({ category: 1, isDeleted: 1, isPublished: 1 });
productSchema.index({ price: 1 });

export default mongoose.model("Product", productSchema);
