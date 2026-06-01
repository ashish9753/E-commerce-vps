import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatPriceShort } from '../utils/formatters';
import FreebieDetailsModal from '../components/FreebieDetailsModal';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, updateQty, removeFromCart, removeFromCartNow, subtotal, discountAmount, deliveryCharge, total, finalPrice, applyCoupon, removeCoupon, cart, loading, syncCart, freebie, freeShipping } = useCart();
  const { toggle } = useWishlist();
  const { user } = useAuth();
  const toast = useToast();
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stockIssues, setStockIssues] = useState([]);
  const [freebieModal, setFreebieModal] = useState(false);

  if (!user) {
    return (
      <div className="wrap py-20 text-center">
        <div className="text-[80px]">🛒</div>
        <h3 className="text-2xl font-bold mt-4 mb-2">Sign in to view your cart</h3>
        <p className="text-mute mb-6">Your cart syncs across devices when you're signed in.</p>
        <button className="btn btn-primary" onClick={() => navigate('/login')}>Sign In</button>
      </div>
    );
  }

  if (loading) return (
    <div className="wrap py-20 text-center"><div className="spinner mx-auto" style={{ width: 40, height: 40 }} /></div>
  );

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    const result = await applyCoupon(couponCode.trim().toUpperCase());
    setCouponLoading(false);
    if (result.success) {
      toast(result.freebie
        ? `Free gift unlocked: ${result.freebie.title}`
        : result.freeShipping
          ? `Free shipping unlocked!`
          : `Coupon applied! You saved ${formatPriceShort(result.discount)}`);
    } else toast(result.error, 'error');
  };

  const handleRemoveCoupon = async () => {
    await removeCoupon();
    setCouponCode('');
    toast('Coupon removed');
  };

  const handleSaveForLater = async (item) => {
    const product = item.product;
    await toggle(product);
    await removeFromCartNow(product._id, item.color); // must persist immediately
    toast('Moved to wishlist');
  };

  const handleProceedToCheckout = async () => {
    setSyncing(true);
    setStockIssues([]);
    const freshItems = await syncCart();
    setSyncing(false);

    const issues = freshItems.filter(i => {
      const p = i.product;
      const stock = (i.color && p?.colors?.length)
        ? (p.colors.find(c => c.name === i.color)?.stock ?? 0)
        : (p?.stock ?? Infinity);
      return i.quantity > stock;
    });

    if (issues.length > 0) {
      setStockIssues(issues.map(i => i.product?._id || i.product));
      toast(`Some items exceed available stock — quantities adjusted.`, 'warn');
      return;
    }

    navigate('/checkout');
  };

  const hasCoupon = discountAmount > 0 || !!freebie || freeShipping;

  if (items.length === 0) return (
    <div className="wrap py-20 text-center">
      <div className="text-[80px]">🛒</div>
      <h3 className="text-2xl font-bold mt-4 mb-2">Your cart is empty</h3>
      <p className="text-mute mb-6">Looks like you haven't added anything yet.</p>
      <button className="btn btn-primary" onClick={() => navigate('/products')}>Start Shopping</button>
    </div>
  );

  return (
    <div className="wrap pt-6">
      <h1 className="font-serif text-[44px] leading-[1.05] tracking-tight font-normal mb-8 max-sm:text-[26px] max-sm:mb-5">Shopping Cart ({items.length})</h1>
      <div className="grid grid-cols-[1fr_380px] gap-9 pb-20 max-md:grid-cols-1">
        {/* Items */}
        <div>
          {items.map(item => {
            const product = item.product || {};
            // For a colored line, the swatch image + available stock come from
            // the chosen color; fall back to the product otherwise.
            const colorObj = item.color && product.colors?.length
              ? product.colors.find(c => c.name === item.color)
              : null;
            const image = colorObj?.image || product.images?.[0];
            const title = product.title || product.name || 'Product';
            const brand = product.brand || '';
            const itemPrice = item.price || product.discountPrice || product.price || 0;
            const lineStock = product.colors?.length ? (colorObj?.stock ?? 0) : (product.stock ?? Infinity);
            const hasIssue = stockIssues.includes(product._id);

            return (
              <div key={item._id || product._id} className={`grid grid-cols-[120px_1fr_auto] gap-5 p-5 border rounded-[14px] mb-3 items-start bg-white max-sm:grid-cols-[80px_1fr] max-sm:gap-3 max-sm:p-3 ${hasIssue ? 'border-red-300' : 'border-line'}`}>
                <div className="w-30 h-30 bg-surface rounded-[10px] flex items-center justify-center overflow-hidden max-sm:w-20 max-sm:h-20 cursor-pointer"
                  onClick={() => product._id && navigate(`/product/${product._id}`)}>
                  {image ? (
                    <img src={image} alt={title} className="w-full h-full object-contain p-2" />
                  ) : (
                    <span className="text-[54px] max-sm:text-[36px]">🛍️</span>
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] text-soft font-semibold tracking-wider uppercase">{brand}</div>
                      <div className="text-base font-bold tracking-tight mt-1 leading-snug cursor-pointer hover:text-accent hover:underline transition-colors"
                        onClick={() => product._id && navigate(`/product/${product._id}`)}>{title}</div>
                      {item.color && (
                        <div className="text-xs text-mute mt-1 flex items-center gap-1.5">
                          {colorObj?.image && <img src={colorObj.image} alt="" className="w-4 h-4 rounded-full object-cover border border-line" />}
                          Color: <span className="font-semibold text-ink">{item.color}</span>
                        </div>
                      )}
                    </div>
                    <div className="sm:hidden text-base font-bold tracking-tight shrink-0 mt-0.5">{formatPriceShort(itemPrice * item.quantity)}</div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-2 mt-3 text-xs items-center">
                    <div className="flex items-center border-[1.5px] border-line-2 rounded-full h-9">
                      <button className="w-10.5 h-9 text-lg bg-transparent border-0 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-mute hover:enabled:text-ink cursor-pointer" disabled={item.quantity <= 1} onClick={() => { updateQty(product._id, item.color, item.quantity - 1); setStockIssues([]); }}>−</button>
                      <span className="w-8 text-center font-bold">{item.quantity}</span>
                      <button
                        className="w-10.5 h-9 text-lg bg-transparent border-0 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-mute hover:enabled:text-ink cursor-pointer"
                        onClick={() => { updateQty(product._id, item.color, item.quantity + 1); setStockIssues([]); }}
                        disabled={item.quantity >= lineStock}
                        title={item.quantity >= lineStock ? `Only ${lineStock} available` : ''}
                      >+</button>
                    </div>
                    <button className="text-mute font-semibold flex items-center gap-1.25 bg-transparent border-0 cursor-pointer hover:text-accent" onClick={() => handleSaveForLater(item)}>
                      <Heart size={13} /> Save for later
                    </button>
                    <button className="text-mute font-semibold flex items-center gap-1.25 bg-transparent border-0 cursor-pointer hover:text-accent" onClick={() => { removeFromCart(product._id, item.color); setStockIssues([]); toast('Item removed'); }}>
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                  {hasIssue && (() => {
                    const stock = lineStock === Infinity ? 0 : lineStock;
                    return (
                      <div className="mt-2.5 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <span className="font-bold">Only {stock} available.</span>
                        <span>Please reduce quantity.</span>
                        <button
                          className="ml-auto font-bold underline bg-transparent border-0 cursor-pointer text-red-600"
                          onClick={() => { updateQty(product._id, item.color, stock); setStockIssues(p => p.filter(id => id !== product._id)); }}
                        >Fix</button>
                      </div>
                    );
                  })()}
                </div>
                <div className="text-right max-sm:hidden">
                  <div className="text-xl font-bold tracking-tight">{formatPriceShort(itemPrice * item.quantity)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="sticky top-32.5 self-start border border-line rounded-2xl p-6 bg-white max-sm:p-4 max-md:static">
          <div className="text-[11px] font-bold tracking-widest uppercase text-mute mb-4.5">Order Summary</div>
          {[
            { label: `Subtotal (${items.reduce((s, i) => s + i.quantity, 0)} items)`, val: formatPriceShort(subtotal) },
            ...(discountAmount > 0 ? [{ label: 'Coupon discount', val: `−${formatPriceShort(discountAmount)}`, ok: true }] : []),
            { label: 'Delivery', val: deliveryCharge === 0 ? (freeShipping ? 'FREE (coupon)' : 'FREE') : formatPriceShort(deliveryCharge), ok: freeShipping },
          ].map(r => (
            <div key={r.label} className="flex justify-between py-2.5 text-sm text-mute border-b border-dashed border-line">
              <span>{r.label}</span>
              <b className={r.ok ? 'text-ok font-semibold' : 'text-ink font-semibold'}>{r.val}</b>
            </div>
          ))}
          <div className="flex justify-between items-baseline pt-4 mt-1.5">
            <span className="font-bold">Total</span>
            <span className="font-serif text-[36px] leading-none max-sm:text-[28px]">{formatPriceShort(total)}</span>
          </div>

          {!hasCoupon ? (
            <div className="flex gap-2 my-4 p-3.5 bg-surface rounded-xl">
              <input
                className="input h-9 flex-1 bg-white"
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
              />
              <button onClick={handleApplyCoupon} disabled={couponLoading} className="h-9 px-3.5 bg-ink text-white rounded-lg text-xs font-bold border-0 cursor-pointer shrink-0">
                {couponLoading ? '...' : 'Apply'}
              </button>
            </div>
          ) : (
            <div className="bg-ok-tint border border-dashed border-ok text-ok text-xs font-semibold px-3.5 py-2.5 rounded-[10px] flex justify-between items-center mt-4">
              <span>
                {freebie       ? '🎁 Coupon applied · Free gift unlocked'
                 : freeShipping ? '🚚 Coupon applied · Free shipping'
                 :                `✓ Coupon applied · saved ${formatPriceShort(discountAmount)}`}
              </span>
              <button onClick={handleRemoveCoupon} className="bg-transparent border-0 cursor-pointer text-ok font-bold">Remove</button>
            </div>
          )}

          {freebie && (
            <div className="mt-3 border border-dashed border-accent rounded-xl p-3 bg-accent/5 flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-white border border-line flex items-center justify-center overflow-hidden shrink-0">
                {freebie.image
                  ? <img src={freebie.image} alt={freebie.title} className="w-full h-full object-contain p-1" />
                  : <span className="text-2xl">🎁</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold tracking-widest uppercase text-accent">+ FREE</div>
                <div className="text-sm font-bold leading-tight truncate">{freebie.title}</div>
                <div className="text-[11px] text-mute mt-0.5">Added at checkout · Qty {freebie.quantity}</div>
              </div>
              <button
                type="button"
                onClick={() => freebie._id && setFreebieModal(true)}
                title="View full product details"
                aria-label="View free gift details"
                className="shrink-0 w-7 h-7 rounded-full border border-accent bg-white text-accent font-serif font-bold text-sm cursor-pointer flex items-center justify-center hover:bg-accent hover:text-white transition-colors"
              >
                i
              </button>
            </div>
          )}

          {stockIssues.length > 0 && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3 text-center font-semibold">
              Some items exceed available stock — please fix quantities above.
            </div>
          )}

          <button
            className="btn btn-accent w-full h-13 mt-2.5 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleProceedToCheckout}
            disabled={syncing || stockIssues.length > 0}
          >
            {syncing ? 'Checking availability…' : 'Proceed to Checkout →'}
          </button>
          <div className="flex items-center justify-center gap-1.5 mt-3.5 text-xs text-mute">🔒 Secure checkout · SSL encrypted</div>
        </div>
      </div>

      {freebieModal && freebie?._id && (
        <FreebieDetailsModal
          productId={freebie._id}
          quantity={freebie.quantity || 1}
          onClose={() => setFreebieModal(false)}
        />
      )}
    </div>
  );
}
