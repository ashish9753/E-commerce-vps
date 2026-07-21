import { useNavigate, useLocation } from 'react-router-dom';
import { Heart, ShoppingCart } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatPriceShort, stars } from '../../utils/formatters';
import { loginNavState } from '../../utils/authRedirect';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const location = useLocation();
  // After signing in, bring the shopper back to the page they were browsing.
  const loginState = () => loginNavState(location);
  const { addToCart } = useCart();
  const { toggle, isWished } = useWishlist();
  const { user } = useAuth();
  const toast = useToast();

  const productId = product._id || product.id;
  const wished = isWished(productId);
  const image = product.images?.[0];

  const handleAddToCart = async (e) => {
    e.stopPropagation();
    if (!user) { toast('Please sign in to add items to cart', 'error'); navigate('/login', loginState()); return; }
    // Products with colors require the customer to pick one — send them to the
    // product page to choose instead of adding a color-less line.
    if (product.colors?.length) { navigate(`/product/${productId}`); return; }
    const result = await addToCart(productId, 1);
    if (result?.success === false) toast(result.error, 'error');
    else toast(`${product.name} added to cart`);
  };

  const handleWish = async (e) => {
    e.stopPropagation();
    if (!user) { toast('Please sign in to save items', 'error'); navigate('/login', loginState()); return; }
    await toggle(product);
    toast(wished ? 'Removed from wishlist' : 'Added to wishlist');
  };

  return (
    <div className="group cursor-pointer" onClick={() => navigate(`/product/${productId}`)}>
      {/* Image area */}
      <div className="relative aspect-square bg-surface rounded-2xl flex items-center justify-center overflow-hidden transition-colors duration-200 group-hover:bg-surface-2">
        {product.badge && (
          <span className={`absolute top-3 left-3 text-[10px] font-bold px-2.25 py-1.25 rounded-full uppercase tracking-[0.04em] z-10 ${product.badge === 'sale' ? 'bg-accent text-white' : 'bg-ink text-white'}`}>
            {product.badge === 'sale' ? `-${product.off}%` : product.badge === 'featured' ? 'Hot' : 'New'}
          </span>
        )}
        {image ? (
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <span className="text-[90px] leading-none transition-transform duration-300 group-hover:scale-108">🛍️</span>
        )}
        <button
          className={`absolute top-3 right-3 w-8.5 h-8.5 rounded-full bg-white flex items-center justify-center shadow-sm transition-all duration-150 border-0 cursor-pointer z-10 ${wished ? 'text-accent' : 'text-mute hover:text-accent'}`}
          onClick={handleWish}
          aria-label="Add to wishlist"
        >
          <Heart size={16} fill={wished ? 'currentColor' : 'none'} />
        </button>
        <button
          className="absolute left-3 right-3 bottom-3 h-9 rounded-[10px] bg-ink text-white text-xs font-semibold flex items-center justify-center gap-1.5 opacity-0 translate-y-2 transition-all duration-250 group-hover:opacity-100 group-hover:translate-y-0 border-0 cursor-pointer w-[calc(100%-24px)] z-10"
          onClick={handleAddToCart}
        >
          <ShoppingCart size={13} /> Add to cart
        </button>
      </div>

      {/* Meta */}
      <div className="pt-3.5 px-0.5">
        <div className="text-[11px] text-soft font-semibold tracking-wider uppercase">{product.brand}</div>
        <div className="text-sm font-semibold mt-1 leading-[1.35] line-clamp-2">{product.name}</div>
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-mute">
          <span className="text-[#F5A623] tracking-[-1px]">{stars(product.rating)}</span>
          {product.rating} · {(product.reviews || 0).toLocaleString()}
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-base font-bold tabular-nums">{formatPriceShort(product.price)}</span>
          {product.off > 0 && (
            <>
              <span className="text-xs text-soft line-through tabular-nums">{formatPriceShort(product.was)}</span>
              <span className="text-[11px] text-ok font-bold">{product.off}% off</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
