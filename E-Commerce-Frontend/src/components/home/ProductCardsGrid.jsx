import { useNavigate } from 'react-router-dom';

const PANELS = [
  { title: 'Top Deals', link: '/products?sort=discount', cat: null },
  { title: 'New Arrivals', link: '/products?sort=newest', cat: null },
  { title: 'Best Sellers', link: '/products', cat: null },
  { title: 'Explore More', link: '/products', cat: null },
];

function MiniProductCard({ product, onClick }) {
  return (
    <div onClick={onClick} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ width: '100%', aspectRatio: '1', background: '#f4f6f8', borderRadius: 4, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {product.images?.[0]
          ? <img src={product.images[0]} alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span style={{ fontSize: 32 }}>🛍️</span>}
      </div>
      <div style={{ fontSize: 11, color: '#0f172a', lineHeight: 1.3, width: '100%', textAlign: 'left',
        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {product.name}
      </div>
    </div>
  );
}

function Panel({ title, products, link }) {
  const navigate = useNavigate();
  const items = products.slice(0, 4);
  if (items.length === 0) return null;

  return (
    <div style={{ background: 'white', borderRadius: 8, padding: '16px 14px 14px', boxShadow: '0 1px 3px #0000000d',
      display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
        {items.map(p => (
          <MiniProductCard
            key={p._id || p.id}
            product={p}
            onClick={() => navigate(`/product/${p._id || p.id}`)}
          />
        ))}
      </div>
      <button onClick={() => navigate(link)}
        style={{ marginTop: 14, background: 'none', border: 'none', color: '#007185', fontSize: 13,
          fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
        See more →
      </button>
    </div>
  );
}

export default function ProductCardsGrid({ featured, newest, topRated, deals }) {
  const groups = [
    { title: 'Featured Picks', products: featured || [], link: '/products' },
    { title: 'New Arrivals', products: newest || [], link: '/products?sort=newest' },
    { title: 'Top Rated', products: topRated || [], link: '/products?sort=rating' },
    { title: 'Most Popular', products: deals || [], link: '/products?sort=popular' },
  ].filter(g => g.products.length > 0);

  if (groups.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(groups.length, 4)}, 1fr)`, gap: 12, marginBottom: 12 }}>
      {groups.map(g => <Panel key={g.title} title={g.title} products={g.products} link={g.link} />)}
    </div>
  );
}
