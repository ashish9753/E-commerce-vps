import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { normalizeProduct } from '../utils/normalizers';
import { formatPriceShort, stars } from '../utils/formatters';

export default function WishlistPage() {
  const navigate  = useNavigate();
  const { items, remove } = useWishlist();
  const { addToCart }     = useCart();
  const { user }          = useAuth();
  const toast             = useToast();

  if (!user) {
    return (
      <div style={{ background:'#f0f2f2', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:64, marginBottom:16 }}>❤️</div>
          <h3 style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>Sign in to view your wishlist</h3>
          <button onClick={() => navigate('/login')}
            style={{ padding:'10px 28px', borderRadius:8, background:'#FF5A1F', color:'white', border:'none', fontWeight:700, fontSize:14, cursor:'pointer' }}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const moveToCart = async (item) => {
    const productId = item._id || item;
    const result = await addToCart(productId, 1);
    if (result?.success === false) { toast(result.error, 'error'); return; }
    await remove(productId);
    toast('Moved to cart!');
  };

  const normalizedItems = items
    .map(item => typeof item === 'object' && item._id ? normalizeProduct(item) : null)
    .filter(Boolean);

  return (
    <div style={{ background:'#f0f2f2', minHeight:'100vh', padding:'24px 0 60px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 16px' }}>

        {/* Header */}
        <div style={{ background:'white', borderRadius:8, padding:'20px 24px', marginBottom:16, border:'1px solid #ddd', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ margin:0, fontSize:24, fontWeight:700 }}>Your Wishlist</h1>
            <p style={{ margin:'4px 0 0', fontSize:13, color:'#666' }}>
              {normalizedItems.length} saved item{normalizedItems.length !== 1 ? 's' : ''}
            </p>
          </div>
          {normalizedItems.length > 0 && (
            <button onClick={() => navigate('/products')}
              style={{ fontSize:13, color:'#007185', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
              Continue Shopping →
            </button>
          )}
        </div>

        {normalizedItems.length === 0 ? (
          <div style={{ background:'white', borderRadius:8, border:'1px solid #ddd', padding:'60px 24px', textAlign:'center' }}>
            <div style={{ fontSize:64, marginBottom:16 }}>❤️</div>
            <h3 style={{ fontSize:20, fontWeight:700, margin:'0 0 8px' }}>Your wishlist is empty</h3>
            <p style={{ color:'#666', fontSize:14, marginBottom:20 }}>Save items you love and find them here anytime.</p>
            <button onClick={() => navigate('/products')}
              style={{ padding:'10px 28px', borderRadius:8, background:'#FF5A1F', color:'white', border:'none', fontWeight:700, fontSize:14, cursor:'pointer' }}>
              Discover Products
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {normalizedItems.map(item => {
              const image = item.images?.[0];
              const inStock = item.stock > 0;
              return (
                <div key={item._id} style={{ background:'white', border:'1px solid #ddd', borderRadius:8, padding:'16px 20px', display:'flex', gap:20, alignItems:'flex-start' }}>

                  {/* Image */}
                  <div onClick={() => navigate(`/product/${item._id}`)}
                    style={{ width:140, height:140, flexShrink:0, border:'1px solid #eee', borderRadius:6, overflow:'hidden', background:'#fafafa', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                    {image
                      ? <img src={image} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'contain', padding:8 }} />
                      : <span style={{ fontSize:48 }}>🛍️</span>
                    }
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    {item.brand && (
                      <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>
                        {item.brand}
                      </div>
                    )}
                    <div onClick={() => navigate(`/product/${item._id}`)}
                      style={{ fontSize:16, fontWeight:600, color:'#0F1111', marginBottom:6, cursor:'pointer', lineHeight:1.4 }}
                      className="hover:text-[#007185]">
                      {item.name}
                    </div>

                    {/* Stars */}
                    {item.rating > 0 && (
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                        <span style={{ color:'#F5A623', fontSize:14 }}>{stars(item.rating)}</span>
                        <span style={{ fontSize:12, color:'#007185' }}>{Number(item.rating).toFixed(1)}</span>
                      </div>
                    )}

                    {/* Price */}
                    <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:8 }}>
                      <span style={{ fontSize:20, fontWeight:700, color:'#B12704' }}>
                        {formatPriceShort(item.price)}
                      </span>
                      {item.off > 0 && (
                        <>
                          <span style={{ fontSize:13, color:'#888', textDecoration:'line-through' }}>{formatPriceShort(item.was)}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:'#cc0c39' }}>({item.off}% off)</span>
                        </>
                      )}
                    </div>

                    {/* Stock status */}
                    <div style={{ fontSize:13, fontWeight:600, color: inStock ? '#007600' : '#cc0c39', marginBottom:12 }}>
                      {inStock ? `In Stock${item.stock <= 5 ? ` — Only ${item.stock} left` : ''}` : 'Out of Stock'}
                    </div>

                    {/* Return policy */}
                    {item.returnable === false ? (
                      <div style={{ fontSize:11, color:'#dc2626', marginBottom:12 }}>🚫 Non-returnable</div>
                    ) : (
                      <div style={{ fontSize:11, color:'#555', marginBottom:12 }}>↩️ {item.returnWindow || 7}-day return policy</div>
                    )}

                    {/* Actions */}
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                      <button onClick={() => moveToCart(item)} disabled={!inStock}
                        style={{ padding:'9px 20px', borderRadius:20, background: inStock ? '#FFD814' : '#e0e0e0',
                          border:'1px solid', borderColor: inStock ? '#FBA131' : '#ccc',
                          fontWeight:700, fontSize:13, cursor: inStock ? 'pointer' : 'not-allowed', color:'#0F1111', whiteSpace:'nowrap' }}>
                        🛒 Add to Cart
                      </button>
                      <button onClick={() => navigate(`/product/${item._id}`)}
                        style={{ padding:'9px 20px', borderRadius:20, background:'white', border:'1px solid #D5D9D9',
                          fontWeight:600, fontSize:13, cursor:'pointer', color:'#0F1111' }}>
                        View Product
                      </button>
                      <button onClick={() => { remove(item._id); toast('Removed from wishlist'); }}
                        style={{ padding:'9px 16px', borderRadius:20, background:'none', border:'none',
                          fontSize:13, color:'#cc0c39', cursor:'pointer', fontWeight:600 }}>
                        🗑 Delete
                      </button>
                    </div>
                  </div>

                  {/* Right side — discount badge */}
                  {item.off >= 10 && (
                    <div style={{ flexShrink:0, textAlign:'center' }}>
                      <div style={{ background:'#cc0c39', color:'white', borderRadius:4, padding:'4px 10px', fontSize:12, fontWeight:700 }}>
                        {item.off}% OFF
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
