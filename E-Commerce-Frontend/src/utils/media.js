// Frontend mirror of the backend media link detection (utils/media.utils.js).
// Used by the dashboard preview and (as a fallback) the storefront strip so a
// thumbnail can be derived even before the server-stored one arrives.

import { toDirectImageUrl } from './imageUrl';

const youtubeId = (url) => {
  const m =
    url.match(/[?&]v=([\w-]{6,})/) ||
    url.match(/youtu\.be\/([\w-]{6,})/) ||
    url.match(/\/shorts\/([\w-]{6,})/) ||
    url.match(/\/embed\/([\w-]{6,})/);
  return m ? m[1] : null;
};

export function detectMedia(rawUrl) {
  const url = (rawUrl || '').trim();
  if (!url) return { type: 'link', thumbnail: '' };
  const lower = url.toLowerCase();

  if (/(?:youtube\.com|youtu\.be)/.test(lower)) {
    const id = youtubeId(url);
    return { type: 'youtube', thumbnail: id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '' };
  }
  if (/(?:drive|docs)\.google\.com/.test(lower)) {
    return { type: 'drive', thumbnail: toDirectImageUrl(url) };
  }
  if (/\.(png|jpe?g|webp|gif|avif)(\?|#|$)/.test(lower)) {
    return { type: 'image', thumbnail: url };
  }
  if (/\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/.test(lower)) {
    return { type: 'video', thumbnail: '' };
  }
  if (/instagram\.com/.test(lower)) return { type: 'instagram', thumbnail: '' };
  if (/(?:facebook\.com|fb\.watch)/.test(lower)) return { type: 'facebook', thumbnail: '' };
  if (/tiktok\.com/.test(lower)) return { type: 'tiktok', thumbnail: '' };
  return { type: 'link', thumbnail: '' };
}

// Best thumbnail for a stored item: prefer the saved/admin value, else derive.
export function mediaThumbnail(item) {
  if (!item) return '';
  if (item.thumbnail) return toDirectImageUrl(item.thumbnail);
  return detectMedia(item.url).thumbnail;
}

// Per-platform presentation (icon glyph + brand color) for badges and the
// fallback card shown when there's no thumbnail.
export const PLATFORM = {
  youtube:   { label: 'YouTube',   color: '#FF0000', icon: '▶' },
  instagram: { label: 'Instagram', color: '#E1306C', icon: '◈' },
  facebook:  { label: 'Facebook',  color: '#1877F2', icon: 'f' },
  tiktok:    { label: 'TikTok',    color: '#000000', icon: '♪' },
  drive:     { label: 'Drive',     color: '#1FA463', icon: '▲' },
  image:     { label: 'Photo',     color: '#6b7280', icon: '🖼' },
  video:     { label: 'Video',     color: '#7c3aed', icon: '▶' },
  link:      { label: 'Link',      color: '#6b7280', icon: '🔗' },
};

// Whether a tile should show the ▶ play badge.
export const isVideoType = (type) => type === 'video' || type === 'youtube' || type === 'tiktok';
