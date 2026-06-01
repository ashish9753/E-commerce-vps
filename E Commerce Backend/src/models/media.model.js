import mongoose from "mongoose";

// "Highlights" / social-feed items shown above the footer site-wide. Content is
// added by LINK only (Drive, Instagram, Facebook, TikTok, YouTube, or any direct
// image/video URL). Each item renders as a thumbnail; clicking opens `url` in a
// new tab. No file uploads, no inline embeds.
const mediaSchema = new mongoose.Schema(
  {
    title:     { type: String, default: "" },   // optional caption
    url:       { type: String, required: true }, // the source link, opened on click
    thumbnail: { type: String, default: "" },    // optional/derived preview image
    type: {
      type: String,
      enum: ["image", "video", "youtube", "instagram", "facebook", "tiktok", "drive", "link"],
      default: "link",
    },
    isActive:  { type: Boolean, default: true },
    position:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Media", mediaSchema);
