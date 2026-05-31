// Helpers for accepting external image links instead of file uploads
// (keeps the asset off our Cloudinary account — saves storage + cost).

export const isValidImageUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

// Google Drive *share* links point at Drive's viewer page, not the raw image,
// so they can't be rendered in an <img>. Rewrite them to the directly
// embeddable lh3.googleusercontent.com/d/<id> form. Other URLs pass through.
export const toDirectImageUrl = (raw) => {
  if (!raw || typeof raw !== "string") return raw;
  const url = raw.trim();
  if (/(?:drive|docs)\.google\.com/.test(url)) {
    const m = url.match(/\/file\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
    if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  }
  return url;
};

// Normalize one value or an array of values from FormData into a clean list
// of valid, directly-embeddable image URLs.
export const normalizeImageUrls = (raw) => {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map((u) => (typeof u === "string" ? toDirectImageUrl(u.trim()) : ""))
    .filter(isValidImageUrl);
};
