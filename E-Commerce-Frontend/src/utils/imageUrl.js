// Helpers for accepting external image links (instead of file uploads).
//
// Users often paste a Google Drive *share* link — which points at Drive's
// viewer page, not the raw image — so <img src> can't render it. We rewrite
// those to the lh3.googleusercontent.com/d/<id> form, which embeds directly.
// (Still subject to Drive's rate limits, but it's the most reliable shape.)

export function isHttpUrl(s) {
  if (!s || typeof s !== 'string') return false;
  try {
    const u = new URL(s.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Convert known "viewer page" links into direct, embeddable image URLs.
// Currently handles Google Drive; returns other URLs unchanged.
export function toDirectImageUrl(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  const url = raw.trim();

  if (/(?:drive|docs)\.google\.com/.test(url)) {
    const m = url.match(/\/file\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
    if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  }

  return url;
}
