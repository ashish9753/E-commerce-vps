import { useNavigate } from 'react-router-dom';
import { useCompare } from '../context/CompareContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatPriceShort, stars } from '../utils/formatters';

export default function ComparePage() {
  const navigate = useNavigate();
  const { items, remove, clear } = useCompare();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const toast = useToast();

  if (items.length === 0) return (
    <div className="wrap">
      <div className="empty-state">
        <div className="emo">⚖️</div>
        <h3>Nothing to compare</h3>
        <p>Add products to compare by clicking the Compare button on product cards.</p>
        <button className="btn btn-primary" onClick={() => navigate('/products')}>Browse Products</button>
      </div>
    </div>
  );

  const allKeys = [...new Set(items.flatMap(p => (p.specs || []).map(s => s.k)))];

  const handleAddToCart = async (p) => {
    if (!user) { toast('Please sign in to add items to cart', 'error'); navigate('/login'); return; }
    if (p.colors?.length) { navigate(`/product/${p._id || p.id}`); return; }
    const result = await addToCart(p._id || p.id, 1);
    if (result?.success === false) toast(result.error, 'error');
    else toast(`${p.name} added to cart`);
  };

  return (
    <div className="wrap" style={{ paddingTop: 24, paddingBottom: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div className="page-title" style={{ marginBottom: 0 }}>Compare Products</div>
        <button className="btn btn-ghost btn-sm" onClick={clear}>Clear All</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="compare-table">
          <thead>
            <tr>
              <th style={{ width: 180 }}>Feature</th>
              {items.map(p => {
                const pid = p._id || p.id;
                const image = p.images?.[0];
                return (
                  <th key={pid} style={{ textAlign: 'center', minWidth: 220 }}>
                    <div style={{ width: 64, height: 64, margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {image ? <img src={image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 40 }}>🛍️</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', textTransform: 'none', letterSpacing: 0 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 400, marginTop: 4 }}>{p.brand}</div>
                    <button className="btn btn-ghost btn-xs" style={{ marginTop: 8 }} onClick={() => remove(pid)}>Remove</button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Price</td>
              {items.map(p => (
                <td key={p._id || p.id} style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{formatPriceShort(p.price)}</div>
                  {p.off > 0 && (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--soft)', textDecoration: 'line-through' }}>{formatPriceShort(p.was)}</div>
                      <span style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 700 }}>{p.off}% off</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td>Rating</td>
              {items.map(p => (
                <td key={p._id || p.id} style={{ textAlign: 'center' }}>
                  <span style={{ color: '#F5A623' }}>{stars(p.rating)}</span>
                  <div style={{ fontSize: 12, color: 'var(--mute)' }}>{p.rating} ({(p.reviews || 0).toLocaleString()})</div>
                </td>
              ))}
            </tr>
            <tr>
              <td>Stock</td>
              {items.map(p => (
                <td key={p._id || p.id} style={{ textAlign: 'center' }}>
                  <span style={{ color: p.stock > 0 ? 'var(--ok)' : 'var(--bad)', fontWeight: 600 }}>
                    {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                  </span>
                </td>
              ))}
            </tr>
            {allKeys.map(k => (
              <tr key={k}>
                <td>{k}</td>
                {items.map(p => {
                  const spec = (p.specs || []).find(s => s.k === k);
                  return <td key={p._id || p.id} style={{ textAlign: 'center', fontWeight: 600 }}>{spec ? spec.v : '—'}</td>;
                })}
              </tr>
            ))}
            <tr>
              <td>Action</td>
              {items.map(p => (
                <td key={p._id || p.id} style={{ textAlign: 'center' }}>
                  <button className="btn btn-accent btn-sm" disabled={p.stock === 0} onClick={() => handleAddToCart(p)}>
                    {p.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
