import { useNavigate } from 'react-router-dom';

const fmtRs = n => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;

function CompactProductCard({ product }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/product/${product._id || product.id}`)}
      style={{ width: 160, flexShrink: 0, cursor: 'pointer', padding: '8px 8px 12px', borderRadius: 6, background: 'white', transition: 'box-shadow .15s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px #0000001a'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
      <div style={{ width: '100%', height: 160, background: '#f8fafc', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        {product.images?.[0]
          ? <img src={product.images[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span style={{ fontSize: 56 }}>🛍️</span>}
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a', lineHeight: 1.4, marginBottom: 4,
        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {product.name}
      </div>
      {product.rating > 0 && (
        <div style={{ fontSize: 11, color: '#c45500', marginBottom: 3 }}>
          {'★'.repeat(Math.round(product.rating))} <span style={{ color: '#888' }}>({product.numReviews || 0})</span>
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{fmtRs(product.price)}</div>
      {product.originalPrice > product.price && (
        <div style={{ fontSize: 11, color: '#888' }}>
          <s>{fmtRs(product.originalPrice)}</s>
          <span style={{ color: '#cc0c39', fontWeight: 700, marginLeft: 4 }}>
            -{Math.round((1 - product.price / product.originalPrice) * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}

export default function ProductSection({ title, subtitle, products, viewAllLink }) {
  const navigate = useNavigate();
  return (
    <div style={{ background: 'white', borderRadius: 8, padding: '16px 20px', boxShadow: '0 1px 3px #0000000d', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#0f172a' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <button onClick={() => navigate(viewAllLink || '/products')}
          style={{ fontSize: 13, color: '#007185', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
          See all →
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
        {products.map(p => <CompactProductCard key={p._id || p.id} product={p} />)}
      </div>
    </div>
  );
}
