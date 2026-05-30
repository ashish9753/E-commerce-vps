import { useEffect, useState } from 'react';
import { productsApi } from '../api/products';
import { normalizeProduct } from '../utils/normalizers';

// Inline modal — shows the full details of a freebie product without leaving
// the current page. Backdrop click + Esc + the × button all close it.
export default function FreebieDetailsModal({ productId, quantity = 1, onClose }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!productId) return;
    let alive = true;
    setLoading(true);
    productsApi.getById(productId)
      .then(({ data }) => {
        if (!alive) return;
        const raw = data?.data?.product || data?.data || data;
        setProduct(raw ? normalizeProduct(raw) : null);
      })
      .catch(() => alive && setError('Could not load product details'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [productId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    // Lock body scroll while the modal is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
  const image = product?.images?.[0];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          background: '#fff', borderRadius: 14, maxWidth: 560, width: '100%',
          maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.3)',
        }}
      >
        {/* Header bar */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #eee',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#f0fdf4',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '.12em',
              textTransform: 'uppercase', color: '#15803d',
              background: '#dcfce7', border: '1px solid #86efac',
              padding: '3px 8px', borderRadius: 99,
            }}>
              🎁 Free Gift
            </span>
            <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>
              Qty {quantity} · Added at checkout
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
              color: '#888', lineHeight: 1, padding: 4,
            }}
          >×</button>
        </div>

        {/* Body */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Loading…</div>
        ) : error || !product ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>
            {error || 'Product not available'}
          </div>
        ) : (
          <div style={{ padding: 18 }}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
              <div style={{
                width: 140, height: 140, flexShrink: 0,
                background: '#f3f4f6', borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {image
                  ? <img src={image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                  : <span style={{ fontSize: 44 }}>🎁</span>}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                {product.brand && (
                  <div style={{ fontSize: 11, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    {product.brand}
                  </div>
                )}
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0F1111', lineHeight: 1.25, marginTop: 4 }}>
                  {product.name}
                </div>
                {product.category && (
                  <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                    Category: <b style={{ color: '#333' }}>{product.category}</b>
                  </div>
                )}
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#15803d' }}>FREE</span>
                  {product.price > 0 && (
                    <span style={{ fontSize: 13, color: '#888', textDecoration: 'line-through' }}>
                      {fmt(product.was || product.price)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {product.description && (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 14, marginBottom: 6 }}>
                  About this product
                </div>
                <div style={{ fontSize: 13, color: '#333', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                  {product.description}
                </div>
              </>
            )}

            {Array.isArray(product.specs) && product.specs.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 18, marginBottom: 6 }}>
                  Specifications
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {product.specs.map((s, i) => (
                      <tr key={i}>
                        <td style={{ padding: '6px 10px 6px 0', color: '#666', fontWeight: 600, verticalAlign: 'top', width: '40%' }}>{s.k}</td>
                        <td style={{ padding: '6px 0', color: '#0F1111' }}>{s.v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        <div style={{ padding: '12px 18px', borderTop: '1px solid #eee', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: '#0F1111', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
