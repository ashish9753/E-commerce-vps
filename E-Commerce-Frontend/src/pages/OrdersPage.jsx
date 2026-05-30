import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrderContext';
import { useToast } from '../context/ToastContext';
import { reviewsApi } from '../api/reviews';
import { paymentsApi } from '../api/payments';
import { ordersApi } from '../api/orders';
import client, { getErrorMessage } from '../api/client';
import { formatPriceShort, formatDate } from '../utils/formatters';
import SupportIcon from '../components/icons/SupportIcon';
import { generateInvoice } from '../utils/generateInvoice';

// Unpaid online orders auto-cancel after this many minutes (matches backend
// PENDING_ORDER_TIMEOUT_MIN). Kept here as a UI fallback if /config call fails.
const DEFAULT_PAYMENT_TIMEOUT_MIN = 30;

function loadRazorpayScript() {
  return new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function PendingPaymentBanner({ order, timeoutMin, onPaid, onCancelled }) {
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [remainingMs, setRemainingMs] = useState(() => {
    const expiresAt = new Date(order.createdAt).getTime() + timeoutMin * 60_000;
    return Math.max(0, expiresAt - Date.now());
  });

  useEffect(() => {
    const id = setInterval(() => {
      const expiresAt = new Date(order.createdAt).getTime() + timeoutMin * 60_000;
      setRemainingMs(Math.max(0, expiresAt - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [order.createdAt, timeoutMin]);

  const expired = remainingMs <= 0;
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  const countdown = expired
    ? 'Expired — refresh to see cancellation'
    : `${minutes}m ${String(seconds).padStart(2, '0')}s`;

  const handleCancel = async () => {
    if (!window.confirm(`Cancel order ${order.orderNumber}? Items will be released back to stock.`)) return;
    setCancelling(true);
    try {
      await ordersApi.cancel(order._id, { reason: 'Cancelled by customer before payment' });
      toast('Order cancelled.');
      onCancelled?.();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handlePay = async () => {
    if (expired) { toast('This order has expired. Please place it again.', 'error'); return; }
    setPaying(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        toast('Could not load payment gateway. Check your internet connection.', 'error');
        return;
      }
      const { data } = await paymentsApi.createRazorpayOrder({ orderId: order._id });
      const rzpData = data.data;
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: rzpData.keyId,
          amount: rzpData.amount,
          currency: rzpData.currency,
          order_id: rzpData.razorpayOrderId,
          name: 'TradeEngine',
          description: `Order ${order.orderNumber}`,
          theme: { color: '#FF9900' },
          handler: async (response) => {
            try {
              await paymentsApi.verifyPayment({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                orderId: order._id,
              });
              resolve();
            } catch (err) { reject(new Error(getErrorMessage(err))); }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
        });
        rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || 'Payment failed')));
        rzp.open();
      });
      toast('Payment successful! Order confirmed.');
      onPaid?.();
    } catch (err) {
      if (err.message === 'Payment cancelled') {
        toast(`Payment cancelled. You can retry — order auto-cancels in ${countdown}.`, 'warn');
      } else {
        toast(err.message || 'Payment failed. Please try again.', 'error');
      }
    } finally {
      setPaying(false);
    }
  };

  return (
    <div style={{
      borderTop: '1px solid #fde68a',
      background: expired ? '#fef2f2' : '#fffbeb',
      padding: '12px 20px',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: expired ? '#dc2626' : '#92400e' }}>
          {expired ? '⏱ Payment window expired' : '⚠ Payment pending — complete to confirm order'}
        </div>
        <div style={{ fontSize: 12, color: expired ? '#b91c1c' : '#78350f', marginTop: 2 }}>
          {expired
            ? 'This order will be auto-cancelled and stock released.'
            : <>Auto-cancels in <strong>{countdown}</strong> if not paid.</>}
        </div>
      </div>
      <button onClick={handlePay} disabled={paying || cancelling || expired}
        style={{
          padding: '8px 18px', borderRadius: 6, fontWeight: 700, fontSize: 13,
          border: '1px solid', cursor: (paying || cancelling || expired) ? 'not-allowed' : 'pointer',
          background: expired ? '#e5e7eb' : '#FFD814',
          borderColor: expired ? '#d1d5db' : '#FBA131',
          color: expired ? '#9ca3af' : '#000',
          opacity: paying ? 0.7 : 1,
        }}>
        {paying ? 'Opening payment…' : expired ? 'Expired' : `Pay ${formatPriceShort(order.totalPrice)} now`}
      </button>
      <button onClick={handleCancel} disabled={paying || cancelling}
        style={{
          padding: '8px 14px', borderRadius: 6, fontWeight: 700, fontSize: 13,
          border: '1px solid #fecaca', cursor: (paying || cancelling) ? 'not-allowed' : 'pointer',
          background: 'white', color: '#dc2626',
          opacity: cancelling ? 0.7 : 1,
        }}>
        {cancelling ? 'Cancelling…' : 'Cancel order'}
      </button>
    </div>
  );
}

function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display:'flex', gap:4 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          style={{ fontSize:32, cursor:'pointer', color: n <= (hovered || value) ? '#FFA41C' : '#ddd', transition:'color .1s' }}>
          ★
        </span>
      ))}
    </div>
  );
}

function ReviewModal({ item, orderId, onClose, onDone }) {
  const [rating, setRating]   = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const labels = ['','Terrible','Poor','Okay','Good','Excellent'];

  const submit = async () => {
    if (!rating) { setError('Please select a star rating.'); return; }
    setSaving(true); setError('');
    try {
      await reviewsApi.create({
        productId: item.product?._id || item.product,
        orderId,
        rating,
        comment,
      });
      setDone(true);
      setTimeout(() => { onDone(); onClose(); }, 1200);
    } catch(e) {
      setError(e?.response?.data?.message || 'Failed to submit review.');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:480, boxShadow:'0 20px 60px #0003', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ background:'#131921', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ color:'white', fontWeight:700, fontSize:15 }}>Write a Review</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#aaa', fontSize:20, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>

        {done ? (
          <div style={{ padding:40, textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
            <div style={{ fontWeight:700, fontSize:16 }}>Review submitted!</div>
            <div style={{ color:'#888', marginTop:6, fontSize:13 }}>Thank you for your feedback.</div>
          </div>
        ) : (
          <div style={{ padding:24 }}>
            {/* Product */}
            <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20, padding:'12px 14px', background:'#f8fafc', borderRadius:10 }}>
              <div style={{ width:52, height:52, border:'1px solid #eee', borderRadius:8, overflow:'hidden', flexShrink:0, background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {item.image ? <img src={item.image} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} /> : <span style={{ fontSize:24 }}>📦</span>}
              </div>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>{item.title}</div>
                <div style={{ fontSize:12, color:'#888', marginTop:2 }}>Qty: {item.quantity} · {formatPriceShort(item.price)} each</div>
              </div>
            </div>

            {/* Stars */}
            <div style={{ marginBottom:16, textAlign:'center' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#555', marginBottom:8, textTransform:'uppercase', letterSpacing:'.05em' }}>Your Rating</div>
              <StarPicker value={rating} onChange={setRating} />
              {rating > 0 && <div style={{ fontSize:13, fontWeight:700, color:'#FFA41C', marginTop:6 }}>{labels[rating]}</div>}
            </div>

            {/* Comment */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#555', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>Your Review (optional)</div>
              <textarea rows={4} value={comment} onChange={e=>setComment(e.target.value)}
                placeholder="What did you like or dislike? How was the quality?"
                style={{ width:'100%', border:'1px solid #ddd', borderRadius:8, padding:'10px 12px', fontSize:13, resize:'none', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
              <div style={{ fontSize:11, color:'#aaa', textAlign:'right', marginTop:2 }}>{comment.length}/500</div>
            </div>

            {error && <div style={{ color:'#dc2626', fontSize:13, fontWeight:600, marginBottom:12, padding:'8px 12px', background:'#fef2f2', borderRadius:8 }}>{error}</div>}

            <button onClick={submit} disabled={saving || !rating}
              style={{ width:'100%', padding:'12px', borderRadius:10, background: rating ? '#FF5A1F' : '#ddd', color:'white', border:'none', fontWeight:700, fontSize:14, cursor: rating ? 'pointer' : 'not-allowed', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Submitting…' : 'Submit Review'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RefundProofModal({ proof, onClose }) {
  const [idx, setIdx] = useState(0);
  if (!proof?.length) return null;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'white', borderRadius:12, padding:24, maxWidth:500, width:'100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:15 }}>🧾 Refund Proof</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#888', lineHeight:1 }}>×</button>
        </div>
        <img src={proof[idx].url} alt={`Proof ${idx + 1}`}
          style={{ width:'100%', maxHeight:340, objectFit:'contain', borderRadius:8, border:'1px solid #ddd', display:'block' }} />
        {proof.length > 1 && (
          <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'center', flexWrap:'wrap' }}>
            {proof.map((p, i) => (
              <img key={i} src={p.url} alt="" onClick={() => setIdx(i)}
                style={{ width:52, height:52, objectFit:'cover', borderRadius:6, border: i===idx ? '2px solid #FF5A1F' : '2px solid #ddd', cursor:'pointer' }} />
            ))}
          </div>
        )}
        <div style={{ fontSize:11, color:'#aaa', marginTop:10, textAlign:'center' }}>
          {proof.length} screenshot{proof.length !== 1 ? 's' : ''} uploaded by our team as refund proof
        </div>
      </div>
    </div>
  );
}

const STATUS_META = {
  PLACED:           { label: 'Order Placed',       color: '#f59e0b', bg: '#fef3c7' },
  CONFIRMED:        { label: 'Confirmed',           color: '#3b82f6', bg: '#dbeafe' },
  PACKED:           { label: 'Packed',              color: '#8b5cf6', bg: '#ede9fe' },
  SHIPPED:          { label: 'Shipped',             color: '#06b6d4', bg: '#cffafe' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery',    color: '#FF5A1F', bg: '#ffedd5' },
  DELIVERED:        { label: 'Delivered',           color: '#16a34a', bg: '#dcfce7' },
  CANCELLED:        { label: 'Cancelled',           color: '#dc2626', bg: '#fee2e2' },
  RETURNED:         { label: 'Returned',            color: '#6b7280', bg: '#f3f4f6' },
};

const FILTERS = ['All Orders', 'Pending Payment', 'Active', 'Delivered', 'Cancelled', 'Returns'];

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.PLACED;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700,
      padding:'4px 10px', borderRadius:99, background:m.bg, color:m.color }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:m.color }} />
      {m.label}
    </span>
  );
}

export default function OrdersPage() {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const { getMyOrders } = useOrders();
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('All Orders');
  const [search, setSearch]       = useState('');
  const [reviewTarget, setReview] = useState(null); // { item, orderId }
  const [proofModal, setProofModal] = useState(null); // proof array to display
  const [paymentTimeoutMin, setPaymentTimeoutMin] = useState(DEFAULT_PAYMENT_TIMEOUT_MIN);

  const reloadOrders = () => getMyOrders({ limit: 50 }).then(r => {
    if (r.success) setOrders(r.data || r.orders || []);
  });

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    reloadOrders().finally(() => setLoading(false));
    // Pull live timeout from backend so the countdown matches the sweep schedule.
    // Uses the shared axios client → inherits the configured base URL and the
    // 401-refresh interceptor. (Previously a raw fetch tied to /api/v1, which
    // only worked behind the dev proxy.)
    // Non-critical — silently fall back to the default if it fails.
    client.get('/config/order-timeout', { skipErrorToast: true })
      .then(({ data }) => { if (data?.data?.timeoutMinutes) setPaymentTimeoutMin(data.data.timeoutMinutes); })
      .catch(() => {});
  }, [user]);

  if (!user) return null;

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchQ = !q || o.orderNumber?.toLowerCase().includes(q) ||
      o._id?.toLowerCase().includes(q) ||
      o.orderItems?.some(i => i.title?.toLowerCase().includes(q));
    const s = o.orderStatus;
    const isPendingPayment = o.paymentMethod === 'ONLINE' && o.paymentStatus === 'PENDING' && s === 'PLACED';
    const matchF =
      filter === 'All Orders'      ? true :
      filter === 'Pending Payment' ? isPendingPayment :
      filter === 'Active'          ? ['PLACED','CONFIRMED','PACKED','SHIPPED','OUT_FOR_DELIVERY'].includes(s) :
      filter === 'Delivered'       ? s === 'DELIVERED' :
      filter === 'Cancelled'       ? s === 'CANCELLED' :
      filter === 'Returns'         ? s === 'RETURNED'  : true;
    return matchQ && matchF;
  });

  return (
    <div style={{ background:'#f0f2f2', minHeight:'100vh', padding:'24px 0 60px' }}>
      {reviewTarget && (
        <ReviewModal
          item={reviewTarget.item}
          orderId={reviewTarget.orderId}
          onClose={() => setReview(null)}
          onDone={() => setReview(null)}
        />
      )}
      {proofModal && <RefundProofModal proof={proofModal} onClose={() => setProofModal(null)} />}
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'0 16px' }}>

        {/* Header */}
        <div style={{ background:'white', borderRadius:8, padding:'20px 24px', marginBottom:16, border:'1px solid #ddd' }}>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Your Orders</h1>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'#666' }}>{orders.length} order{orders.length!==1?'s':''} total</p>
        </div>

        {/* Filter + Search */}
        <div style={{ background:'white', borderRadius:8, border:'1px solid #ddd', marginBottom:16, overflow:'hidden' }}>
          <div className="ord-filter-row">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding:'14px 16px', border:'none', background:'none', fontWeight:filter===f?700:500,
                  fontSize:13, cursor:'pointer', color:filter===f?'#c45500':'#444',
                  borderBottom:filter===f?'2px solid #c45500':'2px solid transparent',
                  marginBottom:-1, transition:'all .15s', whiteSpace:'nowrap' }}>
                {f}
              </button>
            ))}
            <div className="ord-search-wrap">
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search orders…"
                style={{ height:34, border:'1px solid #ccc', borderRadius:6, padding:'0 12px', fontSize:13, outline:'none', width:220 }} />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ background:'white',borderRadius:8,border:'1px solid #ddd',padding:60,textAlign:'center',color:'#888' }}>
            <div className="spinner" style={{ width:32,height:32,margin:'0 auto 12px' }} />
            Loading your orders…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background:'white',borderRadius:8,border:'1px solid #ddd',padding:'60px 24px',textAlign:'center' }}>
            <div style={{ fontSize:56,marginBottom:16 }}>📦</div>
            <div style={{ fontSize:18,fontWeight:700,marginBottom:8 }}>No orders found</div>
            <div style={{ color:'#888',marginBottom:24 }}>
              {search ? 'Try a different search term' : 'Looks like you haven\'t placed any orders yet'}
            </div>
            <button onClick={()=>navigate('/products')}
              style={{ background:'#FFD814',border:'1px solid #FBA131',borderRadius:20,padding:'8px 24px',fontWeight:700,fontSize:14,cursor:'pointer' }}>
              Start Shopping
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {filtered.map(order => {
              const status = order.orderStatus || 'PLACED';
              const isDelivered = status === 'DELIVERED';
              const isCancelled = status === 'CANCELLED';
              const isActive = ['PLACED','CONFIRMED','PACKED','SHIPPED','OUT_FOR_DELIVERY'].includes(status);
              const needsPayment = order.paymentMethod === 'ONLINE'
                && order.paymentStatus === 'PENDING'
                && !isCancelled
                && status === 'PLACED';

              return (
                <div key={order._id} style={{ background:'white', borderRadius:8, border:'1px solid #ddd', overflow:'hidden' }}>
                  {/* Order header - Amazon style grey bar */}
                  <div className="ord-order-header" style={{ background:'#f0f2f2', padding:'12px 20px', display:'flex', alignItems:'center', gap:32, flexWrap:'wrap', borderBottom:'1px solid #ddd' }}>
                    <div>
                      <div style={{ fontSize:10,fontWeight:700,color:'#888',letterSpacing:'.06em',textTransform:'uppercase' }}>Order Placed</div>
                      <div style={{ fontSize:13,fontWeight:600,marginTop:2 }}>{formatDate(order.createdAt)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:10,fontWeight:700,color:'#888',letterSpacing:'.06em',textTransform:'uppercase' }}>Total</div>
                      <div style={{ fontSize:13,fontWeight:700,marginTop:2 }}>{formatPriceShort(order.totalPrice)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:10,fontWeight:700,color:'#888',letterSpacing:'.06em',textTransform:'uppercase' }}>Ship To</div>
                      <div style={{ fontSize:13,fontWeight:600,marginTop:2 }}>{order.shippingAddress?.fullName || '—'}</div>
                    </div>
                    <div style={{ marginLeft:'auto', textAlign:'right' }}>
                      <div style={{ fontSize:10,fontWeight:700,color:'#888',letterSpacing:'.06em',textTransform:'uppercase' }}>
                        Order # {order.orderNumber || order._id?.slice(-8).toUpperCase()}
                      </div>
                      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
                        <button onClick={()=>navigate(`/track?id=${order._id}`)}
                          style={{ fontSize:12,color:'#007185',background:'none',border:'none',cursor:'pointer',fontWeight:600 }}>
                          View order details →
                        </button>
                        <button onClick={() => generateInvoice(order, user)}
                          style={{ fontSize:12,color:'#c45500',background:'none',border:'none',cursor:'pointer',fontWeight:600 }}>
                          📄 Download Invoice
                        </button>
                      </div>
                    </div>
                  </div>

                  {needsPayment && (
                    <PendingPaymentBanner
                      order={order}
                      timeoutMin={paymentTimeoutMin}
                      onPaid={reloadOrders}
                      onCancelled={reloadOrders}
                    />
                  )}

                  {/* Status bar */}
                  <div style={{ padding:'14px 20px', borderBottom:'1px solid #eee', display:'flex', alignItems:'center', gap:12 }}>
                    <StatusBadge status={status} />
                    {isDelivered && order.deliveredAt && (
                      <span style={{ fontSize:13,color:'#007600',fontWeight:600 }}>
                        Delivered on {formatDate(order.deliveredAt)}
                      </span>
                    )}
                    {isActive && (
                      <span style={{ fontSize:13,color:'#007185',fontWeight:600 }}>
                        Est. delivery: {order.estimatedDeliveryDate ? formatDate(order.estimatedDeliveryDate) : '3-5 business days'}
                      </span>
                    )}
                    {isCancelled && order.cancellationReason && (
                      <span style={{ fontSize:13,color:'#888' }}>Reason: {order.cancellationReason}</span>
                    )}
                    {order.trackingId && (
                      <span style={{ fontSize:12,color:'#888',marginLeft:'auto' }}>Tracking: <strong>{order.trackingId}</strong></span>
                    )}
                  </div>

                  {/* Order items */}
                  <div style={{ padding:'16px 20px' }}>
                    {(order.orderItems || []).map((item, i) => (
                      <div key={i} className="ord-item" style={{ display:'flex', gap:16, padding:'12px 0', borderBottom:i<order.orderItems.length-1?'1px solid #f0f0f0':'none', alignItems:'flex-start' }}>
                        {/* Image */}
                        <div style={{ width:80, height:80, border:'1px solid #ddd', borderRadius:6, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#fafafa' }}>
                          {item.image
                            ? <img src={item.image} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                            : <span style={{ fontSize:32 }}>🛍️</span>
                          }
                        </div>

                        {/* Details */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:600, fontSize:14, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>
                            Qty: {item.quantity} · {formatPriceShort(item.price)} each
                          </div>
                          <div style={{ fontSize:14, fontWeight:700 }}>
                            {formatPriceShort(item.price * item.quantity)}
                          </div>
                        </div>

                        {/* Actions per item */}
                        {(() => {
                          const prod = item.product || {};
                          const isReturnable = prod.returnable !== false;
                          const returnWindow = prod.returnWindow || 7;
                          const deliveredAt = order.deliveredAt || order.updatedAt;
                          const daysElapsed = deliveredAt ? Math.floor((Date.now() - new Date(deliveredAt).getTime()) / 86400000) : 0;
                          const windowExpired = daysElapsed > returnWindow;
                          const canReturn = isDelivered && isReturnable && !windowExpired;
                          return (
                            <div className="ord-item-actions" style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0, alignItems:'stretch' }}>
                              <button onClick={()=>navigate(`/track?id=${order._id}`)}
                                style={{ fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:20,border:'1px solid #D5D9D9',background:'linear-gradient(to bottom, #f7f8fa, #e7e9ec)',cursor:'pointer',whiteSpace:'nowrap' }}>
                                Track Package
                              </button>
                              {isDelivered && !isReturnable && (
                                <span style={{ fontSize:11,fontWeight:600,padding:'6px 10px',borderRadius:20,background:'#fef2f2',color:'#dc2626',textAlign:'center',border:'1px solid #fecaca' }}>
                                  🚫 Non-returnable
                                </span>
                              )}
                              {isDelivered && isReturnable && windowExpired && (
                                <span style={{ fontSize:11,fontWeight:600,padding:'6px 10px',borderRadius:20,background:'#fef2f2',color:'#dc2626',textAlign:'center',border:'1px solid #fecaca' }}>
                                  Window expired
                                </span>
                              )}
                              {canReturn && (
                                <button onClick={()=>navigate(`/returns?orderId=${order._id}`)}
                                  style={{ fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:20,border:'1px solid #D5D9D9',background:'linear-gradient(to bottom, #f7f8fa, #e7e9ec)',cursor:'pointer' }}>
                                  Return / Refund
                                </button>
                              )}
                              {isDelivered && (
                                <button onClick={() => setReview({ item, orderId: order._id })}
                                  style={{ fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:20,border:'1px solid #FF5A1F',background:'linear-gradient(to bottom,#fff8f5,#ffe8d6)',color:'#FF5A1F',cursor:'pointer' }}>
                                  ✍️ Review
                                </button>
                              )}
                              <button onClick={()=>navigate(`/product/${prod._id||item.product}`)}
                                style={{ fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:20,border:'1px solid #D5D9D9',background:'linear-gradient(to bottom, #f7f8fa, #e7e9ec)',cursor:'pointer' }}>
                                Buy Again
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div style={{ borderTop:'1px solid #eee', padding:'12px 20px', display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontSize:12, color:'#888' }}>
                      Payment: <strong style={{ color:'#333' }}>{order.paymentMethod}</strong>
                      {' · '}
                      <strong style={{ color: order.paymentStatus==='PAID'?'#007600':'#c7a200' }}>{order.paymentStatus}</strong>
                    </span>
                    <div style={{ marginLeft:'auto', display:'flex', gap:8, flexWrap:'wrap' }}>
                      <button onClick={()=>navigate(`/track?id=${order._id}`)}
                        style={{ fontSize:12,fontWeight:600,padding:'6px 16px',borderRadius:20,border:'1px solid #D5D9D9',background:'linear-gradient(to bottom,#f7f8fa,#e7e9ec)',cursor:'pointer' }}>
                        Order Details
                      </button>
                      <button onClick={() => generateInvoice(order, user)}
                        style={{ fontSize:12,fontWeight:600,padding:'6px 16px',borderRadius:20,border:'1px solid #c45500',background:'linear-gradient(to bottom,#fffbf5,#faebd0)',color:'#c45500',cursor:'pointer' }}>
                        📄 Invoice
                      </button>
                      {isDelivered && order.orderItems?.length > 0 && (
                        <button
                          onClick={() => setReview({ item: order.orderItems[0], orderId: order._id })}
                          style={{ fontSize:12,fontWeight:600,padding:'6px 16px',borderRadius:20,border:'1px solid #FF5A1F',background:'linear-gradient(to bottom,#fff8f5,#ffe8d6)',color:'#FF5A1F',cursor:'pointer' }}>
                          ✍️ Write a Review
                        </button>
                      )}
                      {isCancelled && order.cancellationRefundProof?.length > 0 && (
                        <button onClick={() => setProofModal(order.cancellationRefundProof)}
                          style={{ fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:20,border:'1px solid #0369a1',background:'linear-gradient(to bottom,#f0f9ff,#dbeafe)',color:'#0369a1',cursor:'pointer',display:'flex',alignItems:'center',gap:5 }}>
                          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M1 12C1 12 5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                          Refund Proof
                        </button>
                      )}
                      <button onClick={() => navigate(`/support?orderId=${order._id}`)}
                        style={{ fontSize:12,fontWeight:600,padding:'6px 16px',borderRadius:20,border:'1px solid #007185',background:'linear-gradient(to bottom,#f0f9fb,#d9f2f5)',color:'#007185',cursor:'pointer' }}>
                        <SupportIcon size={13} color="#007185" /> Get Help
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
