import mongoose from "mongoose";

const brandSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, unique: true, trim: true },
    slug:     { type: String, unique: true },
    logo:     String,
    isActive: { type: Boolean, default: true },
    // Manual home-page ordering. -1 = no priority (sorted after pinned brands,
    // then alphabetically). A non-negative number pins the slot and must be
    // unique across brands so two never claim the same position.
    priority: { type: Number, default: -1 },
  },
  { timestamps: true }
);

export default mongoose.model("Brand", brandSchema);
