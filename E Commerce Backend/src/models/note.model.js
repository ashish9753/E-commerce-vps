import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    content: { type: String, required: true, trim: true, maxlength: 10000 },
  },
  { timestamps: true }
);

export default mongoose.model("Note", noteSchema);
