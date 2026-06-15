import { useState, useRef } from 'react';
import { formatPriceShort } from '../utils/formatters';

/**
 * FonePay manual-payment panel.
 *
 * Shows the store's static FonePay QR, the amount to pay, and a file picker so
 * the customer can attach a screenshot of their successful transaction. The
 * selected File is lifted up via `onFile` — the parent decides when to upload
 * it (during checkout after the order is created, or directly from My Orders).
 *
 * Image lives at /public/fonePay1.jpeg.
 */
const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024; // original file cap before compression

// Screenshots from phones / ChatGPT can be several MB and get rejected by a
// reverse proxy (HTTP 413) before reaching the API. We downscale + re-encode to
// JPEG in the browser so the upload is reliably small. Cloudinary downsizes
// server-side anyway, so no quality is lost for verification purposes.
const MAX_DIM = 1600;
const JPEG_QUALITY = 0.82;

async function compressImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const scale = Math.min(1, MAX_DIM / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY));
    bitmap.close?.();
    if (!blob || blob.size >= file.size) return file; // keep original if no gain
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'payment';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file; // fall back to original on any decode/encode failure
  }
}

export default function FonePayUploader({ amount, file, onFile, accent = '#FF9900', onError }) {
  const [preview, setPreview] = useState(null);
  const [working, setWorking] = useState(false);
  const inputRef = useRef(null);

  const pick = async (e) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    if (!ACCEPTED.includes(raw.type)) {
      onError?.('Please upload a JPG, PNG or WebP image.');
      return;
    }
    if (raw.size > MAX_BYTES) {
      onError?.('Screenshot is too large (max 10 MB).');
      return;
    }
    setWorking(true);
    const f = await compressImage(raw);
    setWorking(false);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
    onFile(f);
  };

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    onFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* QR + instructions */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ width: 180, flexShrink: 0, border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: 'white', textAlign: 'center' }}>
          <img src="/fonePay1.jpeg" alt="FonePay QR" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 6 }} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em' }}>Scan & pay via FonePay</div>
          {amount > 0 && (
            <div style={{ fontSize: 28, fontWeight: 900, color: accent, margin: '2px 0 8px' }}>{formatPriceShort(amount)}</div>
          )}
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#444', lineHeight: 1.7 }}>
            <li>Open any FonePay / mobile banking app and scan the QR.</li>
            <li>Pay the exact amount shown above.</li>
            <li>Take a screenshot of the success screen.</li>
            <li>Upload it below and confirm your order.</li>
          </ol>
        </div>
      </div>

      {/* Uploader */}
      {!file ? (
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          border: `2px dashed ${accent}`, borderRadius: 10, padding: '22px 16px', cursor: 'pointer',
          background: '#fffdf7', textAlign: 'center',
        }}>
          <span style={{ fontSize: 28 }}>{working ? '⏳' : '📎'}</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#333' }}>{working ? 'Processing image…' : 'Upload payment screenshot'}</span>
          <span style={{ fontSize: 12, color: '#888' }}>JPG, PNG or WebP · up to 10 MB</span>
          <input ref={inputRef} type="file" accept="image/*" onChange={pick} disabled={working} style={{ display: 'none' }} />
        </label>
      ) : (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 10, padding: 12 }}>
          {preview && <img src={preview} alt="Payment screenshot" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#166534' }}>✓ Screenshot attached</div>
            <div style={{ fontSize: 12, color: '#166534', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
          </div>
          <button type="button" onClick={clear}
            style={{ fontSize: 12, color: '#15803d', background: 'white', border: '1px solid #bbf7d0', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}>
            Replace
          </button>
        </div>
      )}
    </div>
  );
}
