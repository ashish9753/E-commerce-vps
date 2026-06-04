import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrderContext';
import { useToast } from '../context/ToastContext';
import { usersApi } from '../api/users';
import { settingsApi } from '../api/settings';
import { paymentsApi } from '../api/payments';
import { deliveryAreasApi } from '../api/deliveryAreas';
import { upayaApi } from '../api/upaya';
import { couponsApi } from '../api/coupons';
import { formatPriceShort } from '../utils/formatters';
import { cleanPhone, isValidPhone } from '../utils/validators';
import { getErrorMessage } from '../api/client';

/* ── tiny helpers ── */
const Inp = ({ label, value, onChange, placeholder, half }) => (
  <div style={{ flex: half ? '1 1 45%' : '1 1 100%', minWidth: 0 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 5 }}>{label}</label>
    <input value={value} onChange={onChange} placeholder={placeholder}
      style={{ width: '100%', height: 38, border: '1px solid #a0a0a0', borderRadius: 4, padding: '0 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
      onFocus={e => e.target.style.borderColor = '#e77600'}
      onBlur={e => e.target.style.borderColor = '#a0a0a0'} />
  </div>
);

/* ── Address form ── */
function AddressForm({ onSave, onCancel, initial = {} }) {
  const [form, setForm] = useState({
    fullName: initial.fullName || '', phone: initial.phone || '',
    pincode:  initial.pincode  || '', state: initial.state  || '',
    city:     initial.city     || '', houseNo: initial.houseNo || '',
    area:     initial.area     || '', landmark: initial.landmark || '',
    upayaLocationId: initial.upayaLocationId || null,
    upayaAreaId:     initial.upayaAreaId || null,
  });
  const set = (k, v) => {
    const value = k === 'phone' ? cleanPhone(v) : v;
    setForm(f => ({ ...f, [k]: value }));
  };

  // Upaya-managed serviceable cities. We use a dropdown so users can only pick
  // a deliverable location → automatic dispatch on order placement.
  const [upayaLocations, setUpayaLocations] = useState([]);
  const [upayaLoading,   setUpayaLoading]   = useState(true);
  useEffect(() => {
    upayaApi.getLocations()
      .then(({ data }) => setUpayaLocations(data.data?.locations || []))
      .catch(() => setUpayaLocations([]))
      .finally(() => setUpayaLoading(false));
  }, []);

  // Typable city autocomplete — input + datalist so the user can either
  // scroll the list or start typing to filter. Resolves typed text back to
  // a locationId; when nothing matches we clear the captured ids so the
  // form fails validation until they pick a real Upaya city.
  const handleCityInput = (e) => {
    const text = e.target.value;
    const match = upayaLocations.find(
      l => (l.locationName || l.city || '').toLowerCase() === text.toLowerCase()
    );
    if (match) {
      setForm(f => ({
        ...f,
        city: match.locationName || match.city || '',
        upayaLocationId: Number(match.locationId),
        upayaAreaId:     match.areaId != null ? Number(match.areaId) : Number(match.locationId),
      }));
    } else {
      setForm(f => ({ ...f, city: text, upayaLocationId: null, upayaAreaId: null }));
    }
  };

  const phoneValid = isValidPhone(form.phone);
  // Pincode is optional now (Nepal-first store)
  const valid = form.fullName && phoneValid && form.city && form.state && form.upayaLocationId;

  return (
    <div style={{ border: '1px solid #e77600', borderRadius: 6, padding: '18px 20px', background: '#fffdf5', marginTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: '#333' }}>Add a new address</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <Inp label="Full Name *" value={form.fullName} onChange={e=>set('fullName',e.target.value)} placeholder="Your full name" half />
        <div style={{ flex: '1 1 45%', minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 5 }}>Mobile Number *</label>
          <input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="10-digit mobile number" inputMode="numeric"
            style={{ width: '100%', height: 38, border: `1px solid ${form.phone && !phoneValid ? '#dc2626' : '#a0a0a0'}`, borderRadius: 4, padding: '0 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          {form.phone && !phoneValid && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>Phone number must be exactly 10 digits</div>}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: '1 1 45%', minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 5 }}>
            City / Delivery Location * <span style={{ color: '#007185', fontWeight: 400 }}>(from Upaya)</span>
          </label>
          <input
            list="checkout-upaya-locations"
            value={form.city}
            onChange={handleCityInput}
            disabled={upayaLoading || !upayaLocations.length}
            placeholder={upayaLoading ? 'Loading serviceable cities…'
              : upayaLocations.length ? 'Type or select your city'
              : 'Delivery service unavailable'}
            autoComplete="off"
            style={{ width: '100%', height: 38, border: '1px solid #a0a0a0', borderRadius: 4, padding: '0 10px', fontSize: 13, outline: 'none', background: 'white', boxSizing: 'border-box' }}
          />
          <datalist id="checkout-upaya-locations">
            {upayaLocations.map(l => (
              <option key={l.locationId} value={l.locationName}>
                {l.address || ''}
              </option>
            ))}
          </datalist>
          {form.city && !form.upayaLocationId && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>Pick a city from the list (type to search).</div>
          )}
          {!upayaLoading && !upayaLocations.length && (
            <div style={{ fontSize: 11, color: '#b12704', marginTop: 3 }}>Couldn't load delivery locations. Try refreshing the page.</div>
          )}
        </div>
        <Inp label="State *" value={form.state} onChange={e=>set('state',e.target.value)} placeholder="Province / State" half />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <Inp label="House / Flat No." value={form.houseNo} onChange={e=>set('houseNo',e.target.value)} placeholder="House No., Building" half />
        <Inp label="Pincode (optional)" value={form.pincode} onChange={e=>set('pincode',e.target.value)} placeholder="Optional" half />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Inp label="Area / Colony / Locality" value={form.area} onChange={e=>set('area',e.target.value)} placeholder="Street, Locality" half />
        <Inp label="Landmark (optional)" value={form.landmark} onChange={e=>set('landmark',e.target.value)} placeholder="Near..." half />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => valid && onSave(form)} disabled={!valid}
          style={{ padding: '9px 20px', background: valid ? '#FFD814' : '#f0f0f0', border: '1px solid', borderColor: valid ? '#FBA131' : '#ccc',
            borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: valid ? 'pointer' : 'not-allowed', color: '#111' }}>
          Add this address
        </button>
        {onCancel && (
          <button onClick={onCancel}
            style={{ padding: '9px 18px', background: 'white', border: '1px solid #ccc', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: '#555' }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Order summary sidebar ── */
function OrderSummary({ items, subtotal, deliveryCharge, discountAmount, total, onPlace, loading, canPlace, step, codBookingAmount, bookingConfirmed, paymentMethod, freeShipping, freebie }) {
  // `total` is the order grand total — also used by the COD-booking breakdown
  // below to compute "Pay on delivery" = total − booking. Kept as a local alias
  // so the markup reads clearly; the parent doesn't pass `checkoutTotal`.
  const checkoutTotal = total;
  return (
    <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden', position: 'sticky', top: 20 }}>
      {step === 3 && (
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #ddd' }}>
          <button onClick={onPlace} disabled={loading || !canPlace}
            style={{ width: '100%', padding: '10px 0', background: '#FFD814', border: '1px solid #FBA131', borderRadius: 6,
              fontWeight: 700, fontSize: 15, cursor: canPlace ? 'pointer' : 'not-allowed', opacity: loading ? 0.7 : 1 }}>
            {loading ? (paymentMethod === 'RAZORPAY' ? 'Opening payment…' : 'Placing order…') : 'Place your order'}
          </button>
          <div style={{ fontSize: 11, color: '#555', marginTop: 8, lineHeight: 1.5 }}>
            By placing your order, you agree to our <span style={{ color: '#007185' }}>Privacy Policy</span> and <span style={{ color: '#007185' }}>Conditions of Use</span>.
          </div>
        </div>
      )}

      <div style={{ padding: '16px 18px', borderBottom: '1px solid #ddd' }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#B12704', marginBottom: 14 }}>
          Order Summary
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Items ({items.length}):</span>
            <span>{formatPriceShort(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#007600' }}>
              <span>Discount:</span>
              <span>−{formatPriceShort(discountAmount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Delivery:</span>
            <span style={{ color: deliveryCharge === 0 ? '#007600' : undefined }}>
              {deliveryCharge === 0
                ? (freeShipping ? 'FREE (coupon)' : 'FREE')
                : formatPriceShort(deliveryCharge)}
            </span>
          </div>
          <div style={{ borderTop: '1px solid #ddd', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 17, color: '#B12704' }}>
            <span>Order Total:</span>
            <span style={{ textDecoration: paymentMethod === 'COD' && bookingConfirmed && codBookingAmount > 0 ? 'line-through' : 'none', opacity: paymentMethod === 'COD' && bookingConfirmed && codBookingAmount > 0 ? 0.45 : 1 }}>
              {formatPriceShort(total)}
            </span>
          </div>

          {paymentMethod === 'COD' && codBookingAmount > 0 && (
            <div style={{ borderTop: '1px dashed #fde68a', paddingTop: 10, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {bookingConfirmed ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
                    <span>✓ Booking paid (Razorpay):</span>
                    <span>−{formatPriceShort(codBookingAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 16, color: '#0f172a', borderTop: '2px solid #e5e7eb', paddingTop: 8, marginTop: 2 }}>
                    <span>Pay on Delivery:</span>
                    <span>{formatPriceShort(checkoutTotal - codBookingAmount)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Cash at doorstep · Booking non-refundable</div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#b45309', fontWeight: 700 }}>
                    <span>⚡ Booking (pay now):</span>
                    <span>{formatPriceShort(codBookingAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555' }}>
                    <span>Pay on delivery:</span>
                    <span>{formatPriceShort(checkoutTotal - codBookingAmount)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>* Booking amount is non-refundable</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '14px 18px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: '#333' }}>
          Items in your order:
        </div>
        {items.map(item => {
          const product  = item.product || {};
          const colorObj = item.color && product.colors?.length ? product.colors.find(c => c.name === item.color) : null;
          const image    = colorObj?.image || product.images?.[0];
          const title    = product.title || product.name || 'Product';
          const price    = item.price || product.discountPrice || product.price || 0;
          return (
            <div key={item._id || product._id} style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 56, height: 56, border: '1px solid #ddd', borderRadius: 4, background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {image ? <img src={image} alt={title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 24 }}>🛍️</span>}
                </div>
                <div style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#555', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.quantity}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, marginBottom: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {title}
                </div>
                {item.color && <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Color: <b style={{ color:'#333' }}>{item.color}</b></div>}
                <div style={{ fontSize: 13, fontWeight: 700 }}>{formatPriceShort(price * item.quantity)}</div>
              </div>
            </div>
          );
        })}

        {freebie && (
          <div style={{
            display: 'flex', gap: 10, marginTop: 4, paddingTop: 12,
            borderTop: '1px dashed #bbf7d0', alignItems: 'flex-start',
            background: '#f0fdf4', borderRadius: 6, padding: 10,
          }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 56, height: 56, border: '1px solid #bbf7d0', borderRadius: 4, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {freebie.image
                  ? <img src={freebie.image} alt={freebie.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 24 }}>🎁</span>}
              </div>
              <div style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#15803d', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {freebie.quantity || 1}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#15803d', marginBottom: 2 }}>
                + FREE GIFT
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, marginBottom: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {freebie.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>FREE</span>
                {freebie.price > 0 && (
                  <span style={{ fontSize: 11, color: '#888', textDecoration: 'line-through' }}>
                    {formatPriceShort(freebie.price * (freebie.quantity || 1))}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── load Razorpay checkout.js once ── */
function loadRazorpayScript() {
  return new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/* ══════════════════ Main page ══════════════════ */
export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const buyNow   = location.state?.buyNow || null;          // set when coming from "Buy Now"
  const { items, subtotal, total, deliveryCharge, discountAmount, clearCart, cart, freeShipping, freebie } = useCart();

  // For Buy Now, the coupon may come from either the PDP "Have a coupon?"
  // (passed via navigation state) or the user's cart-level coupon. We ask the
  // backend to compute the actual discount for this single product — the
  // server is the source of truth for coupon math.
  const [buyNowDiscount, setBuyNowDiscount]         = useState(0);
  const [buyNowFreeShipping, setBuyNowFreeShipping] = useState(false);
  const [buyNowFreebie, setBuyNowFreebie]           = useState(null);
  const buyNowCouponCode = buyNow ? (buyNow.couponCode || cart?.coupon?.code || null) : null;
  useEffect(() => {
    if (!buyNow || !buyNowCouponCode) {
      setBuyNowDiscount(0);
      setBuyNowFreeShipping(false);
      setBuyNowFreebie(null);
      return;
    }
    let cancelled = false;
    couponsApi.validate({
      code: buyNowCouponCode,
      directItem: { productId: buyNow.productId, quantity: buyNow.quantity, color: buyNow.color || '' },
    })
      .then(({ data }) => {
        if (cancelled) return;
        setBuyNowDiscount(Number(data?.data?.discount) || 0);
        setBuyNowFreeShipping(!!data?.data?.freeShipping);
        setBuyNowFreebie(data?.data?.freebie || null);
      })
      .catch(() => {
        if (cancelled) return;
        setBuyNowDiscount(0);
        setBuyNowFreeShipping(false);
        setBuyNowFreebie(null);
      });
    return () => { cancelled = true; };
  }, [buyNow, buyNowCouponCode, buyNow?.productId, buyNow?.quantity]);

  const { user } = useAuth();
  const { placeOrder } = useOrders();
  const toast = useToast();

  const [step, setStep]                       = useState(1);
  const [addresses, setAddresses]             = useState([]);
  const [selectedAddressId, setSelectedId]    = useState(null);
  const [showAddForm, setShowAddForm]          = useState(false);
  const [editingAddrId, setEditingAddrId]      = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [addrLoading, setAddrLoading]         = useState(true);
  const [codCfg, setCodCfg]                   = useState(null);
  const [bookingPaymentId, setBookingPaymentId] = useState('');
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [bookingLoading, setBookingLoading]     = useState(false);
  const [paymentMethod, setPaymentMethod]       = useState('COD');
  const [deliveryCheck, setDeliveryCheck]       = useState(null); // { available, city, deliveryCharge } | null
  const [deliveryChecking, setDeliveryChecking] = useState(false);
  const [orderSubmitted, setOrderSubmitted]     = useState(false);

  // Buy-now: synthetic display items + totals (bypasses cart entirely)
  const checkoutItems    = buyNow
    ? [{ _id: 'buy-now', product: { _id: buyNow.productId, title: buyNow.title, images: buyNow.image ? [buyNow.image] : [] }, quantity: buyNow.quantity, price: buyNow.price, color: buyNow.color || '' }]
    : items;
  const checkoutSubtotal = buyNow ? buyNow.price * buyNow.quantity : subtotal;
  // Resolve the actual delivery charge in priority order:
  //   1. FREE_SHIPPING coupon (cart-level OR buy-now) overrides everything → 0
  //   2. The address-level deliveryCheck (custom DeliveryArea or Upaya rate)
  //   3. The cart context's default / Buy-Now threshold fallback
  const effectiveFreeShipping = freeShipping || buyNowFreeShipping;
  const effectiveFreebie      = buyNow ? buyNowFreebie : freebie;
  const cartLevelDelivery = buyNow ? (checkoutSubtotal >= 5000 ? 0 : 120) : deliveryCharge;
  const addressDelivery   = deliveryCheck?.available && typeof deliveryCheck.deliveryCharge === 'number'
    ? deliveryCheck.deliveryCharge
    : null;
  const checkoutDelivery  = effectiveFreeShipping ? 0
    : addressDelivery !== null ? addressDelivery
    : cartLevelDelivery;
  const checkoutDiscount = buyNow ? buyNowDiscount : discountAmount;
  const checkoutTotal    = buyNow
    ? Math.max(0, checkoutSubtotal + checkoutDelivery - buyNowDiscount)
    : Math.max(0, checkoutSubtotal + checkoutDelivery - checkoutDiscount);
  // Extra payload fields forwarded to every placeOrder call when buy-now
  const buyNowExtra      = buyNow
    ? { useCart: false, directItem: { productId: buyNow.productId, quantity: buyNow.quantity, color: buyNow.color || '' }, couponCode: buyNowCouponCode || undefined }
    : {};

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    usersApi.getProfile()
      .then(({ data }) => {
        const addrs = data.data?.user?.addresses || [];
        setAddresses(addrs);
        if (addrs.length > 0) setSelectedId(addrs[0]._id);
        else setShowAddForm(true);
      })
      .catch(() => {})
      .finally(() => setAddrLoading(false));
    settingsApi.getCodSettings()
      .then(r => {
        const s = r.data?.data?.codSettings;
        setCodCfg(s);
        const enabled = s ? (s.codEnabled ?? s.enabled ?? true) : true;
        const min = s?.minOrderAmount || 0;
        const max = s?.maxOrderAmount || 0;
        const tooLow  = min > 0 && checkoutTotal < min;
        const tooHigh = max > 0 && checkoutTotal > max;
        if (!enabled || tooLow || tooHigh) setPaymentMethod('RAZORPAY');
      })
      .catch(() => {});
    loadRazorpayScript();
  }, [user, navigate]);

  const codAvailable = codCfg
    ? (codCfg.codEnabled ?? codCfg.enabled ?? true)
    : true;

  // COD-only order limits
  const minOrderAmt = codCfg?.minOrderAmount || 0;
  const maxOrderAmt = codCfg?.maxOrderAmount || 0;
  const codTooLow  = minOrderAmt > 0 && checkoutTotal < minOrderAmt;
  const codTooHigh = maxOrderAmt > 0 && checkoutTotal > maxOrderAmt;
  const orderAmountBlocked = paymentMethod === 'COD' && (codTooLow || codTooHigh);

  const codBookingRequired = codAvailable && !orderAmountBlocked && codCfg?.bookingEnabled;
  const codBookingAmount = codBookingRequired
    ? (codCfg.bookingType === 'percent'
        ? Math.round((checkoutTotal * codCfg.bookingValue) / 100)
        : codCfg.bookingValue)
    : 0;

  // Upaya-first delivery check. Address picked from Upaya's location dropdown
  // gets a live rate from Upaya. Legacy addresses (no upayaLocationId) fall
  // back to the manual city lookup so existing customers still work.
  const checkDelivery = async (addr) => {
    if (!addr) {
      setDeliveryCheck({ available: false, reason: 'no_address', message: 'Please select an address.' });
      return;
    }
    setDeliveryChecking(true);
    try {
      if (addr.upayaLocationId) {
        const { data } = await upayaApi.getRate({
          location_id: addr.upayaLocationId,
          initial_weight: 1,
          service_type_id: 3,
          order_type: 'delivery_order',
        });
        const rate = data.data?.rate || {};
        const charge = Number(rate.total ?? rate.amount ?? rate.rate ?? rate.deliveryCharge ?? 0);
        setDeliveryCheck({ available: true, city: addr.city, deliveryCharge: charge, source: 'upaya' });
      } else if (addr.city && addr.city.trim()) {
        const { data } = await deliveryAreasApi.check(addr.city.trim());
        const fallback = data.data;
        setDeliveryCheck(fallback?.available
          ? fallback
          : { available: false, reason: 'no_upaya_location', message: 'Please edit this address and pick a city from the delivery list.' });
      } else {
        setDeliveryCheck({ available: false, reason: 'no_city', message: 'This address has no city. Please edit it.' });
      }
    } catch (err) {
      setDeliveryCheck({
        available: false,
        reason: 'check_failed',
        message: getErrorMessage(err) || 'Could not check delivery availability. Please try again.',
      });
    } finally {
      setDeliveryChecking(false);
    }
  };

  // Check delivery whenever selected address changes
  useEffect(() => {
    const addr = addresses.find(a => a._id === selectedAddressId);
    if (addr) checkDelivery(addr);
    else setDeliveryCheck(null);
  }, [selectedAddressId, addresses]);

  // Empty-cart redirect — MUST be after all hooks above so the hook count is
  // consistent across renders (Rules of Hooks).
  if (!buyNow && items.length === 0 && !orderSubmitted) { navigate('/cart'); return null; }

  const handleSaveAddress = async (formData) => {
    try {
      const { data } = await usersApi.addAddress(formData);
      const addrs = data.data?.addresses || data.data?.user?.addresses || [];
      setAddresses(addrs);
      const newest = addrs[addrs.length - 1];
      if (newest) setSelectedId(newest._id);
      setShowAddForm(false);
      toast('Address saved!');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  const handleUpdateAddress = async (id, formData) => {
    try {
      const { data } = await usersApi.updateAddress(id, formData);
      const addrs = data.data?.addresses || data.data?.user?.addresses || [];
      setAddresses(addrs);
      setEditingAddrId(null);
      toast('Address updated!');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  const openRazorpayModal = (rzpOrderData, orderId) => {
    return new Promise((resolve, reject) => {
      const options = {
        key: rzpOrderData.keyId,
        amount: rzpOrderData.amount,
        currency: rzpOrderData.currency,
        order_id: rzpOrderData.razorpayOrderId,
        name: 'TradeEngine',
        description: 'Order Payment',
        theme: { color: '#FF9900' },
        handler: async (response) => {
          try {
            const { data } = await paymentsApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderId,
            });
            resolve(data);
          } catch (err) {
            reject(new Error(getErrorMessage(err)));
          }
        },
        modal: {
          ondismiss: () => reject(new Error('Payment cancelled')),
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        reject(new Error(response.error?.description || 'Payment failed'));
      });
      rzp.open();
    });
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) { toast('Please select a delivery address', 'error'); return; }
    if (paymentMethod === 'COD' && codBookingRequired && !bookingConfirmed) {
      toast('Please complete the booking payment first', 'error'); return;
    }

    setLoading(true);

    if (paymentMethod === 'RAZORPAY') {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        toast('Could not load payment gateway. Please check your internet connection.', 'error');
        setLoading(false);
        return;
      }

      // Step 1: Create the order in DB
      const result = await placeOrder({
        shippingAddressId: selectedAddressId,
        paymentMethod: 'ONLINE',
        ...buyNowExtra,
      });

      if (!result.success) {
        toast(result.error, 'error');
        setLoading(false);
        return;
      }

      const orderId = result.order._id;

      // Step 2: Create Razorpay order on backend
      let rzpOrderData;
      try {
        const { data } = await paymentsApi.createRazorpayOrder({ orderId });
        rzpOrderData = data.data;
      } catch (err) {
        toast(getErrorMessage(err), 'error');
        setLoading(false);
        return;
      }

      // Step 3: Open Razorpay modal
      try {
        await openRazorpayModal(rzpOrderData, orderId);
        setOrderSubmitted(true);
        if (!buyNow) await clearCart();
        toast('Payment successful! Order confirmed.');
        navigate('/orders');
      } catch (err) {
        if (err.message === 'Payment cancelled') {
          toast('Payment was cancelled. Your order is pending — you can pay from My Orders.', 'warn');
          navigate('/orders');
        } else {
          toast(err.message || 'Payment failed. Try again from My Orders.', 'error');
          navigate('/orders');
        }
      }
      setLoading(false);
      return;
    }

    // COD flow
    const result = await placeOrder({
      shippingAddressId: selectedAddressId,
      paymentMethod: 'COD',
      codBookingUtr: bookingConfirmed ? bookingPaymentId : '',
      ...buyNowExtra,
    });
    setLoading(false);
    if (result.success) {
      setOrderSubmitted(true);
      if (!buyNow) await clearCart();
      toast('Order placed successfully!');
      navigate('/orders');
    } else {
      toast(result.error, 'error');
    }
  };

  const selectedAddress = addresses.find(a => a._id === selectedAddressId);

  const STEPS = [
    { n: 1, label: 'Delivery' },
    { n: 2, label: 'Payment' },
    { n: 3, label: 'Review' },
  ];

  return (
    <div style={{ background: '#f0f2f2', minHeight: '100vh' }}>
      {/* Checkout header */}
      <div style={{ background: '#131921', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 20, borderBottom: '1px solid #3a4553' }}>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => navigate('/')}>
          <img src="/LOGO.png" alt="TradeEngine" style={{ height: 44, width: 'auto', display: 'block' }} />
        </div>
        <div style={{ color: '#aaa', fontSize: 18, fontWeight: 300 }}>|</div>
        <div style={{ color: '#ddd', fontSize: 16, fontWeight: 600 }}>Checkout</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: '#aaa', fontSize: 12 }}>
          🔒 Secure checkout
        </div>
      </div>

      <div className="r-checkout-layout">

        {/* Left column */}
        <div>
          {/* Step progress bar */}
          <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 6, padding: '16px 24px', marginBottom: 16, display: 'flex', alignItems: 'center' }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: s.n < step ? 'pointer' : 'default' }}
                  onClick={() => { if (s.n < step) setStep(s.n); }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                    background: step === s.n ? '#FF9900' : s.n < step ? '#22c55e' : '#e5e7eb',
                    color: step === s.n || s.n < step ? 'white' : '#9ca3af' }}>
                    {s.n < step ? '✓' : s.n}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: step === s.n ? 700 : 500,
                    color: step === s.n ? '#FF9900' : s.n < step ? '#22c55e' : '#9ca3af' }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: s.n < step ? '#22c55e' : '#e5e7eb', margin: '0 12px' }} />
                )}
              </div>
            ))}
          </div>

          {/* ── Step 1: Delivery Address ── */}
          {step === 1 && (
            <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ background: '#232F3E', padding: '12px 20px' }}>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Step 1: Choose a shipping address</div>
              </div>
              <div style={{ padding: 20 }}>
                {addrLoading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading addresses…</div>
                ) : (
                  <>
                    {addresses.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 12 }}>Your saved addresses:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {addresses.map(addr => (
                            <div key={addr._id}>
                              {editingAddrId === addr._id ? (
                                <AddressForm
                                  initial={addr}
                                  onSave={d => handleUpdateAddress(addr._id, d)}
                                  onCancel={() => setEditingAddrId(null)}
                                />
                              ) : (
                                <div onClick={() => { setSelectedId(addr._id); setShowAddForm(false); setEditingAddrId(null); }}
                                  style={{ display: 'flex', gap: 12, padding: '14px 16px', border: `2px solid ${selectedAddressId === addr._id ? '#FF9900' : '#ddd'}`,
                                    borderRadius: 6, cursor: 'pointer', background: selectedAddressId === addr._id ? '#fffbf0' : 'white',
                                    transition: 'all .15s' }}>
                                  <div style={{ marginTop: 2, flexShrink: 0 }}>
                                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selectedAddressId === addr._id ? '#FF9900' : '#ccc'}`,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {selectedAddressId === addr._id && <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF9900' }} />}
                                    </div>
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>{addr.fullName}</div>
                                    <div style={{ fontSize: 13, color: '#555', marginTop: 3, lineHeight: 1.5 }}>
                                      {addr.houseNo && `${addr.houseNo}, `}{addr.area && `${addr.area}, `}
                                      {addr.city}, {addr.state} {addr.pincode}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>📱 {addr.phone}</div>
                                    {addr.landmark && <div style={{ fontSize: 12, color: '#888' }}>Near: {addr.landmark}</div>}
                                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                                      {selectedAddressId === addr._id && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#007600', background: '#f0fff4', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 4 }}>
                                          ✓ Deliver to this address
                                        </span>
                                      )}
                                      <button onClick={e => { e.stopPropagation(); setEditingAddrId(addr._id); setShowAddForm(false); }}
                                        style={{ fontSize: 11, fontWeight: 600, color: '#007185', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                                        Edit
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!showAddForm ? (
                      <button onClick={() => { setShowAddForm(true); setSelectedId(null); }}
                        style={{ width: '100%', padding: '11px', border: '1px solid #aaa', borderRadius: 6, background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555', textAlign: 'center' }}>
                        + Add a new address
                      </button>
                    ) : (
                      <AddressForm
                        onSave={handleSaveAddress}
                        onCancel={addresses.length > 0 ? () => { setShowAddForm(false); setSelectedId(addresses[0]._id); } : undefined}
                      />
                    )}

                    {/* Delivery availability check result */}
                    {selectedAddressId && !showAddForm && (
                      <div style={{ marginTop: 16 }}>
                        {deliveryChecking ? (
                          <div style={{ padding: '10px 14px', background: '#f3f4f6', borderRadius: 6, fontSize: 13, color: '#555' }}>
                            Checking delivery availability...
                          </div>
                        ) : deliveryCheck ? (
                          deliveryCheck.available ? (
                            <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, fontSize: 13 }}>
                              <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: 2 }}>
                                ✓ Delivery available{deliveryCheck.city ? ` in ${deliveryCheck.city}` : ''}
                              </div>
                              <div style={{ color: '#15803d' }}>
                                {deliveryCheck.deliveryCharge === 0 ? 'Free delivery to this area' : `Delivery charge: Rs. ${deliveryCheck.deliveryCharge}`}
                              </div>
                            </div>
                          ) : (
                            <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 6 }}>
                              <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 14, marginBottom: 4 }}>
                                {deliveryCheck.reason === 'no_city' ? '⚠ Missing city'
                                  : deliveryCheck.reason === 'no_upaya_location' ? '⚠ Pick a delivery city'
                                  : deliveryCheck.reason === 'check_failed' ? '⚠ Could not verify delivery'
                                  : '🚫 Delivery not available in this area'}
                              </div>
                              <div style={{ fontSize: 13, color: '#b91c1c' }}>
                                {deliveryCheck.message || (
                                  <>We currently do not deliver to <strong>{addresses.find(a => a._id === selectedAddressId)?.city || 'this location'}</strong>. Please use a different address or contact support.</>
                                )}
                              </div>
                              {(deliveryCheck.reason === 'no_city' || deliveryCheck.reason === 'no_upaya_location') && (
                                <button
                                  onClick={() => { setEditingAddrId(selectedAddressId); setShowAddForm(false); }}
                                  style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#dc2626', background: 'white', border: '1px solid #fca5a5', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}>
                                  Edit this address →
                                </button>
                              )}
                            </div>
                          )
                        ) : null}
                      </div>
                    )}

                    {selectedAddressId && !showAddForm && (
                      <button
                        onClick={() => {
                          if (deliveryChecking) {
                            toast('Still checking delivery — please wait a moment.', 'warn');
                            return;
                          }
                          if (deliveryCheck === null) {
                            toast('Could not verify delivery. Please reload the page.', 'error');
                            return;
                          }
                          if (!deliveryCheck.available) {
                            toast(deliveryCheck.message || 'Delivery is not available at this address.', 'error');
                            return;
                          }
                          setStep(2);
                        }}
                        disabled={deliveryChecking}
                        style={{
                          marginTop: 16, width: '100%', padding: '12px',
                          background: (deliveryCheck?.available === true && !deliveryChecking) ? '#FFD814' : '#e5e7eb',
                          border: `1px solid ${(deliveryCheck?.available === true && !deliveryChecking) ? '#FBA131' : '#d1d5db'}`,
                          borderRadius: 6, fontWeight: 700, fontSize: 15,
                          cursor: deliveryChecking ? 'wait' : (deliveryCheck?.available === true ? 'pointer' : 'pointer'),
                          color: (deliveryCheck?.available === true && !deliveryChecking) ? '#000' : '#6b7280',
                        }}>
                        {deliveryChecking
                          ? 'Checking delivery...'
                          : deliveryCheck?.available === true
                            ? 'Use this address'
                            : deliveryCheck?.reason === 'no_city'
                              ? 'Fix the address to continue'
                              : 'Delivery not available — choose another address'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Payment ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Order amount block banner */}
              {orderAmountBlocked && (
                <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 8, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>🚫</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#dc2626' }}>Order cannot be placed</div>
                    {codTooLow && (
                      <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 3 }}>
                        COD requires a minimum order of <strong>Rs. {minOrderAmt.toLocaleString('en-IN')}</strong>. Your total is Rs. {checkoutTotal.toLocaleString('en-IN')}. Add more items or pay online.
                      </div>
                    )}
                    {codTooHigh && (
                      <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 3 }}>
                        COD is not available for orders above <strong>Rs. {maxOrderAmt.toLocaleString('en-IN')}</strong>. Your total is Rs. {checkoutTotal.toLocaleString('en-IN')}. Please pay online instead.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ background: '#232F3E', padding: '12px 20px' }}>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Step 2: Payment method</div>
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* Razorpay option */}
                  <div onClick={() => setPaymentMethod('RAZORPAY')}
                    style={{ border: `2px solid ${paymentMethod === 'RAZORPAY' ? '#3b82f6' : '#ddd'}`, borderRadius: 6, padding: '16px 18px',
                      background: paymentMethod === 'RAZORPAY' ? '#eff6ff' : 'white', display: 'flex', gap: 14, alignItems: 'center', cursor: 'pointer', transition: 'all .15s' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 8, background: '#072654', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      <span style={{ color: '#3395FF', fontWeight: 900, fontSize: 11, letterSpacing: '-0.5px' }}>R₹Pay</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>Pay Online (Razorpay)</div>
                      <div style={{ fontSize: 13, color: '#555', marginTop: 3 }}>
                        UPI · Cards · Net Banking · Wallets — instant confirmation
                      </div>
                      <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 4 }}>
                        ✓ Secure · Instant refund on cancellation
                      </div>
                    </div>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${paymentMethod === 'RAZORPAY' ? '#3b82f6' : '#ccc'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {paymentMethod === 'RAZORPAY' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />}
                    </div>
                  </div>

                  {/* COD option */}
                  {(() => {
                    const codDisabled = !codAvailable;
                    const codLimited  = codTooLow || codTooHigh;
                    const codBlocked  = codDisabled || codLimited;
                    return codBlocked ? (
                      <div style={{ border: '2px solid #e5e7eb', borderRadius: 6, padding: '14px 18px', background: '#f9fafb', display: 'flex', gap: 14, alignItems: 'center', opacity: 0.65 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 8, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>💵</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#6b7280' }}>Cash on Delivery (COD)</div>
                          <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, marginTop: 3 }}>
                            {codDisabled
                              ? '✗ COD is currently unavailable for this store.'
                              : codTooLow
                                ? `✗ Minimum COD order is Rs. ${minOrderAmt.toLocaleString('en-IN')}`
                                : `✗ COD not available above Rs. ${maxOrderAmt.toLocaleString('en-IN')}`}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => setPaymentMethod('COD')}
                        style={{ border: `2px solid ${paymentMethod === 'COD' ? '#FF9900' : '#ddd'}`, borderRadius: 6, padding: '16px 18px',
                          background: paymentMethod === 'COD' ? '#fffbf0' : 'white', display: 'flex', gap: 14, alignItems: 'center', cursor: 'pointer', transition: 'all .15s' }}>
                        <div style={{ width: 48, height: 48, borderRadius: 8, background: '#FF9900', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>💵</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>Cash on Delivery (COD)</div>
                          <div style={{ fontSize: 13, color: '#555', marginTop: 3 }}>Pay the remaining amount in cash when your order is delivered.</div>
                          {codBookingRequired ? (
                            <div style={{ fontSize: 12, color: '#c2410c', fontWeight: 700, marginTop: 4 }}>
                              ⚠ Booking amount of {formatPriceShort(codBookingAmount)} required via UPI (non-refundable)
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: '#007600', fontWeight: 600, marginTop: 4 }}>✓ No advance payment needed</div>
                          )}
                        </div>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${paymentMethod === 'COD' ? '#FF9900' : '#ccc'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {paymentMethod === 'COD' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF9900' }} />}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Razorpay booking block — only for COD when booking required */}
              {paymentMethod === 'COD' && codBookingRequired && (
                <div style={{ background: 'white', border: `2px solid ${bookingConfirmed ? '#16a34a' : '#f59e0b'}`, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ background: bookingConfirmed ? '#16a34a' : '#f59e0b', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{bookingConfirmed ? '✅' : '⚡'}</span>
                    <div>
                      <div style={{ color: 'white', fontWeight: 800, fontSize: 15 }}>
                        {bookingConfirmed ? 'Booking Amount Paid' : 'Pay Booking Amount'}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 12 }}>Non-refundable · Required to confirm your COD order</div>
                    </div>
                  </div>

                  <div style={{ padding: '20px 24px' }}>
                    {/* Amount split */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, padding: '16px', background: '#fefce8', borderRadius: 8, border: '1px solid #fde68a' }}>
                      <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.06em' }}>Pay Now (Razorpay)</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#b45309' }}>{formatPriceShort(codBookingAmount)}</div>
                        <div style={{ fontSize: 11, color: '#92400e' }}>Non-refundable booking</div>
                      </div>
                      <div style={{ width: 1, height: 60, background: '#fde68a', flexShrink: 0 }} />
                      <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.06em' }}>Pay on Delivery</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a' }}>{formatPriceShort(checkoutTotal - codBookingAmount)}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Cash at doorstep</div>
                      </div>
                    </div>

                    {!bookingConfirmed ? (
                      <button
                        disabled={bookingLoading}
                        onClick={async () => {
                          const scriptLoaded = await loadRazorpayScript();
                          if (!scriptLoaded || !window.Razorpay) {
                            toast('Could not load payment gateway', 'error'); return;
                          }
                          setBookingLoading(true);
                          try {
                            const { data } = await paymentsApi.createBookingOrder({ amount: codBookingAmount });
                            const rzpData = data.data;
                            const rzp = new window.Razorpay({
                              key: rzpData.keyId,
                              amount: rzpData.amount,
                              currency: rzpData.currency,
                              order_id: rzpData.razorpayOrderId,
                              name: 'TradeEngine',
                              description: `COD Booking — ${formatPriceShort(codBookingAmount)}`,
                              theme: { color: '#f59e0b' },
                              handler: async (response) => {
                                const payId = response.razorpay_payment_id;
                                setBookingPaymentId(payId);
                                setBookingConfirmed(true);
                                setBookingLoading(false);
                                toast('Booking payment successful! Placing your order…');
                                // Auto-place the COD order immediately
                                setLoading(true);
                                const result = await placeOrder({
                                  shippingAddressId: selectedAddressId,
                                  paymentMethod: 'COD',
                                  codBookingUtr: payId,
                                  ...buyNowExtra,
                                });
                                setLoading(false);
                                if (result.success) {
                                  setOrderSubmitted(true);
                                  if (!buyNow) await clearCart();
                                  toast('Order placed successfully!');
                                  navigate('/orders');
                                } else {
                                  toast(result.error || 'Failed to place order. Please try from Review step.', 'error');
                                }
                              },
                              modal: { ondismiss: () => setBookingLoading(false) },
                            });
                            rzp.on('payment.failed', () => {
                              toast('Booking payment failed. Please try again.', 'error');
                              setBookingLoading(false);
                            });
                            rzp.open();
                          } catch (err) {
                            toast(getErrorMessage(err), 'error');
                          } finally {
                            setBookingLoading(false);
                          }
                        }}
                        style={{ width: '100%', padding: '14px', background: bookingLoading ? '#d1d5db' : '#072654',
                          color: 'white', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 15,
                          cursor: bookingLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <span style={{ color: '#3395FF', fontWeight: 900, fontSize: 14 }}>R₹</span>
                        {bookingLoading ? 'Opening payment…' : `Pay ${formatPriceShort(codBookingAmount)} via Razorpay`}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, flexShrink: 0 }}>✓</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#166534' }}>Booking Payment Confirmed</div>
                          <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>Payment ID: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{bookingPaymentId}</span></div>
                        </div>
                        <button onClick={() => { setBookingConfirmed(false); setBookingPaymentId(''); }}
                          style={{ fontSize: 12, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(1)}
                  style={{ padding: '11px 22px', border: '1px solid #aaa', borderRadius: 6, background: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#555' }}>
                  ← Back
                </button>
                <button onClick={() => {
                  if (orderAmountBlocked) {
                    toast(codTooLow ? `COD minimum is Rs. ${minOrderAmt}` : `COD maximum is Rs. ${maxOrderAmt}`, 'error'); return;
                  }
                  if (paymentMethod === 'COD' && codBookingRequired && !bookingConfirmed) {
                    toast('Please complete the booking payment first', 'error'); return;
                  }
                  setStep(3);
                }}
                  disabled={orderAmountBlocked}
                  style={{ flex: 1, padding: '12px', background: orderAmountBlocked ? '#e5e7eb' : '#FFD814', border: `1px solid ${orderAmountBlocked ? '#d1d5db' : '#FBA131'}`, borderRadius: 6, fontWeight: 700, fontSize: 15, cursor: orderAmountBlocked ? 'not-allowed' : 'pointer', color: orderAmountBlocked ? '#9ca3af' : '#000' }}>
                  {orderAmountBlocked ? 'Cannot proceed — check order limits' : 'Review your order →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Review & Place ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ background: '#232F3E', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Review your order</div>
                </div>

                {/* Delivery summary */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0f9f4', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📦</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Delivering to</div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedAddress?.fullName}</div>
                    <div style={{ fontSize: 13, color: '#555', marginTop: 2, lineHeight: 1.6 }}>
                      {selectedAddress?.houseNo && `${selectedAddress.houseNo}, `}
                      {selectedAddress?.area && `${selectedAddress.area}, `}
                      {selectedAddress?.city}, {selectedAddress?.state} – {selectedAddress?.pincode}
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>📱 {selectedAddress?.phone}</div>
                  </div>
                  <button onClick={() => setStep(1)}
                    style={{ fontSize: 13, color: '#007185', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
                    Change
                  </button>
                </div>

                {/* Payment summary */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%',
                    background: paymentMethod === 'RAZORPAY' ? '#eff6ff' : '#fff8f0',
                    border: `2px solid ${paymentMethod === 'RAZORPAY' ? '#3b82f6' : '#FF9900'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {paymentMethod === 'RAZORPAY' ? '💳' : '💵'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Payment method</div>
                    {paymentMethod === 'RAZORPAY' ? (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Razorpay (Online Payment)</div>
                        <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 2, fontWeight: 600 }}>
                          UPI / Card / Net Banking · {formatPriceShort(checkoutTotal)} due now
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Cash on Delivery</div>
                        {codBookingRequired && bookingConfirmed ? (
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Booking {formatPriceShort(codBookingAmount)} paid via Razorpay</span>
                            <span style={{ color: '#555', marginLeft: 6 }}>· {formatPriceShort(checkoutTotal - codBookingAmount)} on delivery</span>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: '#007600', marginTop: 2 }}>Pay when delivered · No advance payment needed</div>
                        )}
                      </>
                    )}
                  </div>
                  <button onClick={() => setStep(2)}
                    style={{ fontSize: 13, color: '#007185', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
                    Change
                  </button>
                </div>

                {/* Items */}
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 14 }}>Items ordered:</div>
                  {checkoutItems.map(item => {
                    const product = item.product || {};
                    const colorObj = item.color && product.colors?.length ? product.colors.find(c => c.name === item.color) : null;
                    const image   = colorObj?.image || product.images?.[0];
                    const title   = product.title || product.name || 'Product';
                    const price   = item.price || product.discountPrice || product.price || 0;
                    return (
                      <div key={item._id || product._id} style={{ display: 'flex', gap: 14, paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ width: 72, height: 72, border: '1px solid #ddd', borderRadius: 4, overflow: 'hidden', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {image ? <img src={image} alt={title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 32 }}>🛍️</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{title}</div>
                          <div style={{ fontSize: 12, color: '#007600', fontWeight: 600 }}>In Stock</div>
                          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Qty: {item.quantity}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>{formatPriceShort(price * item.quantity)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Place order (bottom) */}
              <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 6, padding: '18px 20px' }}>
                <button onClick={handlePlaceOrder} disabled={loading}
                  style={{ width: '100%', padding: '13px', background: '#FFD814', border: '1px solid #FBA131', borderRadius: 6,
                    fontWeight: 800, fontSize: 16, cursor: 'pointer', opacity: loading ? 0.7 : 1, marginBottom: 10 }}>
                  {loading
                    ? (paymentMethod === 'RAZORPAY' ? 'Opening payment gateway…' : 'Placing your order…')
                    : (paymentMethod === 'RAZORPAY'
                        ? `Pay ${formatPriceShort(checkoutTotal)} via Razorpay`
                        : `Place your order · ${formatPriceShort(checkoutTotal)}`)}
                </button>
                <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6, textAlign: 'center' }}>
                  By placing your order, you agree to our{' '}
                  <span style={{ color: '#007185', cursor: 'pointer' }}>Privacy Policy</span> and{' '}
                  <span style={{ color: '#007185', cursor: 'pointer' }}>Conditions of Use</span>.
                </div>
              </div>

              <button onClick={() => setStep(2)}
                style={{ background: 'none', border: 'none', color: '#007185', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                ← Change payment method
              </button>
            </div>
          )}
        </div>

        {/* Right column — Order Summary */}
        <OrderSummary
          items={checkoutItems}
          subtotal={checkoutSubtotal}
          deliveryCharge={checkoutDelivery}
          discountAmount={checkoutDiscount}
          total={checkoutTotal}
          onPlace={handlePlaceOrder}
          loading={loading}
          canPlace={!!selectedAddressId}
          step={step}
          codBookingAmount={codBookingAmount}
          bookingConfirmed={bookingConfirmed}
          paymentMethod={paymentMethod}
          freeShipping={effectiveFreeShipping}
          freebie={effectiveFreebie}
        />
      </div>
    </div>
  );
}
