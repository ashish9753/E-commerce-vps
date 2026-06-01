import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true },
    image: String,
    description: String,
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    isActive: { type: Boolean, default: true },
    // Manual home-page ordering. -1 = no priority (sorted after pinned
    // categories, then alphabetically). A non-negative number pins the slot and
    // must be unique across categories.
    priority: { type: Number, default: -1 },
  },
  { timestamps: true }
);

export default mongoose.model("Category", categorySchema);
