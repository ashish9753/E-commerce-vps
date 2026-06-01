// Detect the platform/type of a media link and derive a thumbnail where we can.
// Reuses toDirectImageUrl for Google Drive so we never duplicate the Drive id
// parsing. For platforms that don't expose a thumbnail (Instagram/Facebook/
// TikTok/raw video), the admin supplies one — we return "" here.

import { toDirectImageUrl } from "./imageUrl.utils.js";

const youtubeId = (url) => {
  const m =
    url.match(/[?&]v=([\w-]{6,})/) ||        // watch?v=ID
    url.match(/youtu\.be\/([\w-]{6,})/) ||   // youtu.be/ID
    url.match(/\/shorts\/([\w-]{6,})/) ||    // /shorts/ID
    url.match(/\/embed\/([\w-]{6,})/);       // /embed/ID
  return m ? m[1] : null;
};

export const detectMedia = (rawUrl) => {
  const url = (rawUrl || "").trim();
  if (!url) return { type: "link", thumbnail: "" };
  const lower = url.toLowerCase();

  // YouTube — thumbnail is derivable from the video id.
  if (/(?:youtube\.com|youtu\.be)/.test(lower)) {
    const id = youtubeId(url);
    return { type: "youtube", thumbnail: id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "" };
  }
  // Google Drive / Docs — reuse the existing direct-image rewrite.
  if (/(?:drive|docs)\.google\.com/.test(lower)) {
    return { type: "drive", thumbnail: toDirectImageUrl(url) };
  }
  // Direct image file.
  if (/\.(png|jpe?g|webp|gif|avif)(\?|#|$)/.test(lower)) {
    return { type: "image", thumbnail: url };
  }
  // Direct video file (admin can still add a custom thumbnail).
  if (/\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/.test(lower)) {
    return { type: "video", thumbnail: "" };
  }
  if (/instagram\.com/.test(lower)) return { type: "instagram", thumbnail: "" };
  if (/(?:facebook\.com|fb\.watch)/.test(lower)) return { type: "facebook", thumbnail: "" };
  if (/tiktok\.com/.test(lower)) return { type: "tiktok", thumbnail: "" };

  return { type: "link", thumbnail: "" };
};
