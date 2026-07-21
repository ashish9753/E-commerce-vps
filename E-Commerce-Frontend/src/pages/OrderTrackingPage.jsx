import { useSearchParams, useNavigate } from 'react-router-dom';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/users';
import { upayaApi } from '../api/upaya';
import { formatPriceShort, formatDate } from '../utils/formatters';
import { useState, useEffect } from 'react';
import { ClipboardList, BadgeCheck, Package, Truck, MapPin, CheckCircle2 } from 'lucide-react';
import { loginNavState } from '../utils/authRedirect';

const STEPS = [
  { key:'PLACED',           label:'Order Placed',     sublabel:'Order received',           Icon: ClipboardList },
  { key:'CONFIRMED',        label:'Confirmed',        sublabel:'Seller confirmed',          Icon: BadgeCheck    },
  { key:'PACKED',           label:'Ready to Ship',    sublabel:'Handed to Upaya',           Icon: Package       },
  { key:'SHIPPED',          label:'Picked Up',        sublabel:'Upaya en route',            Icon: Truck         },
  { key:'OUT_FOR_DELIVERY', label:'Out for Delivery', sublabel:'Courier is nearby',         Icon: MapPin        },
  { key:'DELIVERED',        label:'Delivered',        sublabel:'Package delivered',         Icon: CheckCircle2  },
];

const STATUS_COLOR = {
  PLACED:'#f59e0b', CONFIRMED:'#3b82f6', PACKED:'#8b5cf6',
  SHIPPED:'#06b6d4', OUT_FOR_DELIVERY:'#FF5A1F',
  DELIVERED:'#16a34a', CANCELLED:'#dc2626', RETURNED:'#6b7280',
};

function ProgressTracker({ currentStatus }) {
  const stepIdx = STEPS.findIndex(s => s.key === currentStatus);
  const progress = stepIdx < 0 ? 0 : (stepIdx / (STEPS.length - 1)) * 100;

  return (
    <div style={{ padding:'28px 24px 24px', background:'white', border:'1px solid #e5e7eb', borderRadius:12, marginBottom:16, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
      {/* Progress bar */}
      <div style={{ position:'relative', marginBottom:8 }}>
        {/* Track line */}
        <div style={{ position:'absolute', top:22, left:'calc(100%/12)', right:'calc(100%/12)', height:3, background:'#e5e7eb', borderRadius:99, zIndex:0 }} />
        {/* Filled line */}
        <div style={{
          position:'absolute', top:22, left:'calc(100%/12)',
          width:`calc(${progress}% * (10/12))`,
          height:3, background:'linear-gradient(90deg,#16a34a,#22c55e)', borderRadius:99, zIndex:1,
          transition:'width .7s cubic-bezier(.4,0,.2,1)'
        }} />

        {/* Steps */}
        <div style={{ display:'flex', position:'relative', zIndex:2 }}>
          {STEPS.map((step, i) => {
            const done   = i < stepIdx;
            const active = i === stepIdx;
            const IconEl = step.Icon;
            return (
              <div key={step.key} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                {/* Circle */}
                <div style={{
                  width:44, height:44, borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all .3s',
                  background: done ? '#16a34a' : active ? '#FF5A1F' : '#f3f4f6',
                  border: done ? '2.5px solid #16a34a' : active ? '2.5px solid #FF5A1F' : '2.5px solid #d1d5db',
                  boxShadow: active ? '0 0 0 5px rgba(255,90,31,.15)' : done ? '0 0 0 3px rgba(22,163,74,.1)' : 'none',
                  color: (done || active) ? 'white' : '#9ca3af',
                }}>
                  {done
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <IconEl size={18} strokeWidth={2} />
                  }
                </div>

                {/* Labels */}
                <div style={{ textAlign:'center' }}>
                  <div style={{
                    fontSize:12, fontWeight: active ? 800 : done ? 600 : 500,
                    color: active ? '#FF5A1F' : done ? '#16a34a' : '#9ca3af',
                    lineHeight:1.3, whiteSpace:'nowrap',
                  }}>
                    {step.label}
                  </div>
                  <div style={{
                    fontSize:10, marginTop:2, whiteSpace:'nowrap',
                    color: active ? '#f97316' : done ? '#4ade80' : '#d1d5db',
                    fontWeight: active ? 600 : 400,
                  }}>
                    {step.sublabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getOrderById, cancelOrder } = useOrders();
  const [trackId, setTrackId]     = useState(searchParams.get('id') || '');
  const [order, setOrder]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [searched, setSearched]   = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Cancel modal state
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelRefundMethod, setCancelRefundMethod] = useState('bank_transfer');
  const [cancelBankDetails, setCancelBankDetails] = useState({});
  const [cancelAccountConfirm, setCancelAccountConfirm] = useState('');
  const [cancelAccountMismatch, setCancelAccountMismatch] = useState(false);
  const [cancelUpiConfirm, setCancelUpiConfirm] = useState('');
  const [cancelUpiMismatch, setCancelUpiMismatch] = useState(false);
  const [savedRefund, setSavedRefund] = useState({});
  const [upayaTracking, setUpayaTracking] = useState(null); // { available, ref, tracking, error }
  const [upayaLoading, setUpayaLoading]   = useState(false);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) { setTrackId(id); fetchOrder(id); }
  }, []);

  // Load saved refund details when cancel modal opens
  useEffect(() => {
    if (!cancelModal) return;
    usersApi.getRefundDetails()
      .then(({ data }) => {
        const s = data.data?.savedRefundDetails || {};
        setSavedRefund(s);
        const method = s.lastRefundMethod === 'upi' ? 'upi' : 'bank_transfer';
        setCancelRefundMethod(method);
        setCancelBankDetails(method === 'upi' ? (s.upi || {}) : (s.bankTransfer || {}));
        if (method === 'upi' && s.upi?.upiId) setCancelUpiConfirm(s.upi.upiId);
        if (method === 'bank_transfer' && s.bankTransfer?.accountNumber) setCancelAccountConfirm(s.bankTransfer.accountNumber);
      })
      .catch(() => {});
  }, [cancelModal]);

  const fetchOrder = async (id) => {
    if (!id?.trim()) return;
    if (!user) { navigate('/login', loginNavState()); return; }
    setLoading(true); setSearched(true);
    const r = await getOrderById(id.trim());
    setLoading(false);
    setOrder(r.success ? r.order : null);
    setUpayaTracking(null);
    if (r.success && r.order) {
      setUpayaLoading(true);
      try {
        const { data } = await upayaApi.trackOrder(r.order._id);
        const live = data.data || null;
        setUpayaTracking(live);
        if (live?.order) {
          setOrder(prev => prev ? { ...prev, ...live.order } : prev);
        }
      } catch {
        setUpayaTracking({ available: false });
      } finally { setUpayaLoading(false); }
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    const isPaidOnline = order.paymentStatus === 'PAID' && order.paymentMethod === 'ONLINE';
    if (!cancelReason.trim()) return;
    if (isPaidOnline) {
      if (cancelRefundMethod === 'bank_transfer') {
        const b = cancelBankDetails;
        if (!b.accountName || !b.accountNumber || !b.ifscCode || !b.bankName) return;
        if (b.accountNumber !== cancelAccountConfirm) { setCancelAccountMismatch(true); return; }
      }
      if (cancelRefundMethod === 'upi') {
        if (!cancelBankDetails.upiId) return;
        if (cancelBankDetails.upiId !== cancelUpiConfirm) { setCancelUpiMismatch(true); return; }
      }
    }
    setCancelling(true);
    const payload = { reason: cancelReason };
    if (isPaidOnline) {
      payload.refundMethod = cancelRefundMethod;
      payload.bankDetails = JSON.stringify(cancelBankDetails);
    }
    const r = await cancelOrder(order._id, payload);
    setCancelling(false);
    if (r.success) { setOrder(r.order); setCancelModal(false); }
  };

  const isCancelled = order?.orderStatus === 'CANCELLED';
  const isDelivered = order?.orderStatus === 'DELIVERED';
  const isReturned  = order?.orderStatus === 'RETURNED';
  // Once the order is CONFIRMED, the shipment is booked on Upaya and the
  // customer can no longer cancel from the storefront — only admin/employee
  // can cancel post-confirmation.
  const canCancel   = order?.orderStatus === 'PLACED';

  const addr = order?.shippingAddress;
  const statusColor = STATUS_COLOR[order?.orderStatus] || '#666';

  return (
    <div style={{ background:'#f0f2f2', minHeight:'100vh', padding:'24px 0 60px' }}>
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'0 16px' }}>

        {/* Search bar */}
        <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, padding:'20px 24px', marginBottom:16 }}>
          <h1 style={{ margin:'0 0 16px', fontSize:20, fontWeight:700 }}>Track Package</h1>
          <div style={{ display:'flex', gap:10, maxWidth:600 }}>
            <input
              className="input"
              placeholder="Enter Order ID or paste from your order confirmation…"
              value={trackId}
              onChange={e=>setTrackId(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&fetchOrder(trackId)}
              style={{ flex:1, height:42 }}
            />
            <button
              onClick={()=>fetchOrder(trackId)}
              disabled={loading}
              style={{ height:42, padding:'0 24px', background:'#FFD814', border:'1px solid #FBA131', borderRadius:8, fontWeight:700, fontSize:14, cursor:'pointer', whiteSpace:'nowrap' }}>
              {loading ? '…' : 'Track'}
            </button>
            <button onClick={()=>navigate('/orders')}
              style={{ height:42, padding:'0 16px', background:'white', border:'1px solid #D5D9D9', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer', color:'#444' }}>
              My Orders
            </button>
          </div>
        </div>

        {/* Not found */}
        {searched && !loading && !order && (
          <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, padding:'48px 24px', textAlign:'center' }}>
            <div style={{ fontSize:52, marginBottom:16 }}>🔍</div>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Order not found</div>
            <div style={{ color:'#888', marginBottom:24 }}>Double-check the Order ID and try again.</div>
            <button onClick={()=>navigate('/orders')} style={{ background:'#FFD814', border:'1px solid #FBA131', borderRadius:20, padding:'8px 24px', fontWeight:700, fontSize:14, cursor:'pointer' }}>
              View My Orders
            </button>
          </div>
        )}

        {order && (
          <>
            {/* Order ID header */}
            <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, padding:'16px 24px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <div>
                <span style={{ fontSize:13, color:'#888' }}>Order # </span>
                <span style={{ fontWeight:700, fontFamily:'monospace', fontSize:15 }}>{order._id?.slice(-8).toUpperCase()}</span>
                <span style={{ fontSize:13, color:'#888', marginLeft:16 }}>Placed on {formatDate(order.createdAt)}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, fontWeight:700, padding:'5px 12px', borderRadius:99, background:statusColor+'18', color:statusColor }}>
                  <span style={{ width:8,height:8,borderRadius:'50%',background:statusColor }} />
                  {isCancelled ? 'Cancelled' : (order.orderStatus||'').replace(/_/g,' ')}
                </span>
              </div>
            </div>

            {/* Delivery info banner */}
            {!isCancelled && !isReturned && (
              <div style={{ background: isDelivered?'#f0fff4':'#fff8f0', border:`1px solid ${isDelivered?'#bbf7d0':'#fed7aa'}`, borderRadius:8, padding:'16px 24px', marginBottom:16, display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ fontSize:36 }}>{isDelivered ? '🏠' : '🚚'}</div>
                <div>
                  {isDelivered ? (
                    <>
                      <div style={{ fontWeight:800, fontSize:17, color:'#15803d' }}>Delivered!</div>
                      <div style={{ fontSize:13, color:'#166534', marginTop:2 }}>
                        {order.deliveredAt ? `Delivered on ${formatDate(order.deliveredAt)}` : 'Your order has been delivered'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight:800, fontSize:17, color:'#c2410c' }}>
                        Estimated Delivery: {order.estimatedDeliveryDate ? formatDate(order.estimatedDeliveryDate) : '3–5 business days'}
                      </div>
                      <div style={{ fontSize:13, color:'#9a3412', marginTop:2 }}>
                        Current status: <strong>{(order.orderStatus||'').replace(/_/g,' ')}</strong>
                        {order.trackingId && ` · Tracking ID: ${order.trackingId}`}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Return in progress banner */}
            {isReturned && (
              <div style={{ background:'#ede9fe', border:'1px solid #c4b5fd', borderRadius:8, padding:'16px 24px', marginBottom:16, display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ fontSize:36 }}>↩️</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800, fontSize:17, color:'#6d28d9' }}>Return in Progress</div>
                  <div style={{ fontSize:13, color:'#5b21b6', marginTop:2 }}>A return request has been submitted for this order. Track its status below.</div>
                </div>
                <button onClick={()=>navigate('/returns')}
                  style={{ padding:'9px 20px', borderRadius:20, background:'#7c3aed', border:'none', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0 }}>
                  Track Return →
                </button>
              </div>
            )}

            {/* Progress steps */}
            {!isCancelled && <ProgressTracker currentStatus={order.orderStatus} />}

            {/* Cancelled banner */}
            {isCancelled && (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'16px 24px', marginBottom:16, display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ fontSize:36 }}>❌</div>
                <div>
                  <div style={{ fontWeight:800, fontSize:16, color:'#dc2626' }}>Order Cancelled</div>
                  {order.cancellationReason && <div style={{ fontSize:13, color:'#991b1b', marginTop:2 }}>Reason: {order.cancellationReason}</div>}
                  {order.refundStatus && <div style={{ fontSize:13, color:'#991b1b', marginTop:2 }}>Refund: {order.refundStatus} · {formatPriceShort(order.refundAmount)}</div>}
                </div>
              </div>
            )}

            {/* Main 2-col layout */}
            <div className="r-stack" style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16, alignItems:'start' }}>

              {/* Left col */}
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                {/* Order Items */}
                <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, overflow:'hidden' }}>
                  <div style={{ padding:'14px 20px', borderBottom:'1px solid #eee', fontWeight:700, fontSize:15 }}>
                    Order Items ({order.orderItems?.length})
                  </div>
                  <div style={{ padding:'0 20px' }}>
                    {(order.orderItems || []).map((item, i) => (
                      <div key={i} style={{ display:'flex', gap:16, padding:'16px 0', borderBottom:i<order.orderItems.length-1?'1px solid #f0f0f0':'none', alignItems:'flex-start' }}>
                        <div style={{ width:80, height:80, border:'1px solid #ddd', borderRadius:6, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#fafafa' }}>
                          {item.image ? <img src={item.image} alt={item.title} style={{ width:'100%',height:'100%',objectFit:'contain' }} /> : <span style={{ fontSize:32 }}>🛍️</span>}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:14, marginBottom:6 }}>{item.title}</div>
                          {item.color && <div style={{ fontSize:13, color:'#555', marginBottom:4 }}>Color: <b>{item.color}</b></div>}
                          <div style={{ fontSize:13, color:'#888', marginBottom:4 }}>Qty: {item.quantity}</div>
                          <div style={{ fontSize:14, fontWeight:700 }}>
                            {formatPriceShort(item.price * item.quantity)}
                            <span style={{ fontSize:12, fontWeight:400, color:'#888', marginLeft:6 }}>({formatPriceShort(item.price)} each)</span>
                          </div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          {isDelivered && (
                            <button onClick={()=>navigate(`/returns?orderId=${order._id}`)}
                              style={{ fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:20,border:'1px solid #D5D9D9',background:'linear-gradient(to bottom,#f7f8fa,#e7e9ec)',cursor:'pointer' }}>
                              Return item
                            </button>
                          )}
                          <button onClick={()=>navigate(`/product/${item.product?._id||item.product}`)}
                            style={{ fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:20,border:'1px solid #D5D9D9',background:'linear-gradient(to bottom,#f7f8fa,#e7e9ec)',cursor:'pointer' }}>
                            Buy again
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live courier tracking (Upaya) */}
                {(upayaLoading || upayaTracking?.available) && (
                  <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, overflow:'hidden' }}>
                    <div style={{ padding:'14px 20px', borderBottom:'1px solid #eee', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontWeight:700, fontSize:15 }}>🚚 Live Courier Tracking <span style={{ fontWeight:400, fontSize:12, color:'#888' }}>(via Upaya)</span></span>
                      {upayaTracking?.ref && (
                        <span style={{ fontFamily:'monospace', fontSize:12, color:'#007185', background:'#f0f7ff', padding:'3px 10px', borderRadius:99, border:'1px solid #cfe5ff' }}>
                          {upayaTracking.ref}
                        </span>
                      )}
                    </div>
                    <div style={{ padding:'16px 20px', fontSize:13, color:'#333', lineHeight:1.7 }}>
                      {upayaLoading ? 'Loading live tracking…' : (() => {
                        const t = upayaTracking?.tracking || {};
                        const status = t.status || t.tracking?.status || '—';
                        const eta    = t.estimatedDeliveryDate || t.tracking?.estimatedDeliveryDate;
                        const upayaItems = t.items || t.tracking?.items || [];
                        return (
                          <>
                            <div><strong>Status:</strong> <span style={{ color:'#FF5A1F', fontWeight:700 }}>{String(status).replace(/_/g,' ')}</span></div>
                            {eta && <div><strong>Estimated delivery:</strong> {formatDate(eta)}</div>}
                            {upayaItems.length > 0 && (
                              <div style={{ marginTop:8 }}>
                                <strong>Items on dispatch:</strong>
                                <ul style={{ margin:'4px 0 0 18px', padding:0 }}>
                                  {upayaItems.map((it, i) => (
                                    <li key={i} style={{ fontSize:12, color:'#555' }}>{it.name} × {it.quantity}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Status timeline */}
                {(order.statusHistory || []).length > 0 && (
                  <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, overflow:'hidden' }}>
                    <div style={{ padding:'14px 20px', borderBottom:'1px solid #eee', fontWeight:700, fontSize:15 }}>Tracking History</div>
                    <div style={{ padding:'16px 20px' }}>
                      {[...(order.statusHistory || [])].reverse().map((entry, i) => (
                        <div key={i} style={{ display:'flex', gap:16, marginBottom: i<order.statusHistory.length-1?20:0 }}>
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                            <div style={{ width:12, height:12, borderRadius:'50%', background:i===0?'#FF5A1F':'#007600', flexShrink:0, marginTop:2 }} />
                            {i<order.statusHistory.length-1 && <div style={{ width:2,flex:1,background:'#e5e7eb',marginTop:4 }} />}
                          </div>
                          <div style={{ paddingBottom: i<order.statusHistory.length-1?0:0 }}>
                            <div style={{ fontWeight:700, fontSize:13, color:i===0?'#FF5A1F':'#333' }}>
                              {entry.status?.replace(/_/g,' ')}
                            </div>
                            {entry.note && <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{entry.note}</div>}
                            {entry.timestamp && <div style={{ fontSize:12, color:'#aaa', marginTop:2 }}>{formatDate(entry.timestamp)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display:'flex', gap:10 }}>
                  {canCancel && (
                    <button onClick={() => setCancelModal(true)}
                      style={{ padding:'10px 20px',borderRadius:20,border:'1px solid #c0392b',background:'white',color:'#c0392b',fontWeight:700,fontSize:13,cursor:'pointer' }}>
                      Cancel Order
                    </button>
                  )}
                  {isDelivered && (() => {
                    const firstItem = order.orderItems?.[0];
                    const prod = firstItem?.product || {};
                    const isReturnable = prod.returnable !== false;
                    const returnWindow = prod.returnWindow || 7;
                    const deliveredAt = order.deliveredAt || order.updatedAt;
                    const daysElapsed = deliveredAt ? Math.floor((Date.now() - new Date(deliveredAt).getTime()) / 86400000) : 0;
                    const windowExpired = daysElapsed > returnWindow;
                    if (!isReturnable) return <span style={{ padding:'10px 16px',borderRadius:20,background:'#fef2f2',color:'#dc2626',fontWeight:600,fontSize:12,border:'1px solid #fecaca' }}>🚫 Non-returnable</span>;
                    if (windowExpired) return <span style={{ padding:'10px 16px',borderRadius:20,background:'#fef2f2',color:'#dc2626',fontWeight:600,fontSize:12,border:'1px solid #fecaca' }}>Return window expired</span>;
                    return (
                      <button onClick={()=>navigate(`/returns?orderId=${order._id}`)}
                        style={{ padding:'10px 20px',borderRadius:20,border:'1px solid #D5D9D9',background:'linear-gradient(to bottom,#f7f8fa,#e7e9ec)',fontWeight:600,fontSize:13,cursor:'pointer' }}>
                        Return / Refund
                      </button>
                    );
                  })()}
                  {isReturned && (
                    <button onClick={()=>navigate('/returns')}
                      style={{ padding:'10px 20px',borderRadius:20,border:'1px solid #FF5A1F',background:'#FF5A1F',color:'white',fontWeight:700,fontSize:13,cursor:'pointer' }}>
                      ↩️ Track Your Return
                    </button>
                  )}
                  <button onClick={()=>navigate('/orders')}
                    style={{ padding:'10px 20px',borderRadius:20,border:'1px solid #D5D9D9',background:'linear-gradient(to bottom,#f7f8fa,#e7e9ec)',fontWeight:600,fontSize:13,cursor:'pointer' }}>
                    ← All Orders
                  </button>
                </div>
              </div>

              {/* Right col */}
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                {/* Delivery address */}
                <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, padding:'18px 20px' }}>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>📍 Delivery Address</div>
                  {addr ? (
                    <div style={{ fontSize:13, lineHeight:1.7, color:'#333' }}>
                      <div style={{ fontWeight:700, fontSize:14 }}>{addr.fullName}</div>
                      <div>{addr.houseNo}, {addr.area}</div>
                      <div>{addr.city}, {addr.state} — {addr.pincode}</div>
                      {addr.landmark && <div style={{ color:'#888' }}>Near: {addr.landmark}</div>}
                      <div style={{ marginTop:6, fontWeight:600 }}>📞 {addr.phone}</div>
                    </div>
                  ) : <div style={{ color:'#888', fontSize:13 }}>Address not available</div>}
                </div>

                {/* Payment summary */}
                <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, padding:'18px 20px' }}>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>💳 Payment Summary</div>
                  {[
                    ['Method',   order.paymentMethod],
                    ['Status',   order.paymentStatus],
                    ['Items',    formatPriceShort(order.itemsPrice)],
                    ['Shipping', order.shippingPrice===0 ? 'FREE' : formatPriceShort(order.shippingPrice)],
                    ...(order.discountAmount>0 ? [['Discount', `-${formatPriceShort(order.discountAmount)}`]] : []),
                  ].map(([label, val]) => (
                    <div key={label} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'5px 0', borderBottom:'1px solid #f5f5f5' }}>
                      <span style={{ color:'#666' }}>{label}</span>
                      <span style={{ fontWeight:600, color: label==='Discount'?'#c45500':'#333' }}>{val}</span>
                    </div>
                  ))}

                  {/* Order total row */}
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0 0', borderTop:'2px solid #eee', marginTop:4 }}>
                    <span style={{ fontWeight:700, fontSize:15 }}>Order Total</span>
                    <span style={{ fontWeight:800, fontSize:18,
                      color: order.codBookingStatus === 'PAID' ? '#aaa' : '#c45500',
                      textDecoration: order.codBookingStatus === 'PAID' ? 'line-through' : 'none' }}>
                      {formatPriceShort(order.totalPrice)}
                    </span>
                  </div>

                  {/* COD booking breakdown */}
                  {order.codBookingAmount > 0 && (
                    <div style={{ marginTop:12, padding:'12px 14px', borderRadius:8,
                      background: order.codBookingStatus === 'PAID' ? '#f0fdf4' : '#fefce8',
                      border: `1px solid ${order.codBookingStatus === 'PAID' ? '#bbf7d0' : '#fde68a'}` }}>
                      {order.codBookingStatus === 'PAID' ? (
                        <>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:8 }}>
                            <span style={{ color:'#16a34a', fontWeight:700 }}>✓ Booking paid (FonePay)</span>
                            <span style={{ color:'#16a34a', fontWeight:700 }}>−{formatPriceShort(order.codBookingAmount)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:900, borderTop:'1px dashed #bbf7d0', paddingTop:8 }}>
                            <span style={{ color:'#111' }}>Pay on Delivery</span>
                            <span style={{ color:'#c45500' }}>{formatPriceShort(order.totalPrice - order.codBookingAmount)}</span>
                          </div>
                          <div style={{ fontSize:11, color:'#6b7280', marginTop:5 }}>Cash at doorstep · Booking non-refundable</div>
                        </>
                      ) : (
                        <>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                            <span style={{ color:'#b45309', fontWeight:700 }}>⚡ Booking (pending payment)</span>
                            <span style={{ color:'#b45309', fontWeight:700 }}>{formatPriceShort(order.codBookingAmount)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:800, borderTop:'1px dashed #fde68a', paddingTop:8 }}>
                            <span>Pay on Delivery</span>
                            <span>{formatPriceShort(order.totalPrice - order.codBookingAmount)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Help */}
                <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, padding:'18px 20px' }}>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Need Help?</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {[
                      ['📞','Contact Support', `/support?orderId=${order._id}`],
                      ['❓','Order FAQs',       '/support'],
                      ['🔄','Return Policy',    `/returns?orderId=${order._id}`],
                    ].map(([ic,label,to])=>(
                      <button key={label} onClick={()=>navigate(to)}
                        style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 0',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#007185',fontWeight:600,textAlign:'left' }}>
                        {ic} {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Cancel Order Modal */}
      {cancelModal && order && (
        <CancelOrderModal
          order={order}
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
          cancelRefundMethod={cancelRefundMethod}
          setCancelRefundMethod={setCancelRefundMethod}
          cancelBankDetails={cancelBankDetails}
          setCancelBankDetails={setCancelBankDetails}
          cancelAccountConfirm={cancelAccountConfirm}
          setCancelAccountConfirm={setCancelAccountConfirm}
          cancelAccountMismatch={cancelAccountMismatch}
          setCancelAccountMismatch={setCancelAccountMismatch}
          cancelUpiConfirm={cancelUpiConfirm}
          setCancelUpiConfirm={setCancelUpiConfirm}
          cancelUpiMismatch={cancelUpiMismatch}
          setCancelUpiMismatch={setCancelUpiMismatch}
          savedRefund={savedRefund}
          cancelling={cancelling}
          onClose={() => setCancelModal(false)}
          onConfirm={handleCancel}
        />
      )}
    </div>
  );
}

function CancelOrderModal({
  order,
  cancelReason, setCancelReason,
  cancelRefundMethod, setCancelRefundMethod,
  cancelBankDetails, setCancelBankDetails,
  cancelAccountConfirm, setCancelAccountConfirm,
  cancelAccountMismatch, setCancelAccountMismatch,
  cancelUpiConfirm, setCancelUpiConfirm,
  cancelUpiMismatch, setCancelUpiMismatch,
  savedRefund,
  cancelling,
  onClose,
  onConfirm,
}) {
  const isPaidOnline = order.paymentStatus === 'PAID' && order.paymentMethod === 'ONLINE';

  const setB = (k, v) => setCancelBankDetails(b => ({ ...b, [k]: v }));

  const fieldStyle = {
    width: '100%', height: 36, border: '1px solid #ddd', borderRadius: 6,
    padding: '0 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#888',
    marginBottom: 4, textTransform: 'uppercase',
  };

  const inputValid = () => {
    if (!cancelReason.trim()) return false;
    if (!isPaidOnline) return true;
    if (cancelRefundMethod === 'bank_transfer') {
      const b = cancelBankDetails;
      return !!(b.accountName && b.accountNumber && b.ifscCode && b.bankName && b.accountNumber === cancelAccountConfirm);
    }
    if (cancelRefundMethod === 'upi') {
      return !!(cancelBankDetails.upiId && cancelBankDetails.upiId === cancelUpiConfirm);
    }
    return true;
  };

  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, background:'#0008', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background:'white', borderRadius:12, padding:28, maxWidth:520, width:'100%', maxHeight:'90vh', overflowY:'auto' }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontWeight:800, fontSize:17 }}>❌ Cancel Order</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#888', lineHeight:1 }}>×</button>
        </div>

        {/* Reason */}
        <div style={{ marginBottom:16 }}>
          <label style={labelStyle}>Reason for cancellation *</label>
          <select value={cancelReason} onChange={e => setCancelReason(e.target.value)} style={fieldStyle}>
            <option value="">— Select a reason —</option>
            <option value="Ordered by mistake">Ordered by mistake</option>
            <option value="Found a better price">Found a better price</option>
            <option value="Changed my mind">Changed my mind</option>
            <option value="Shipping too slow">Shipping too slow</option>
            <option value="Duplicate order">Duplicate order</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Refund details — only for paid online orders */}
        {isPaidOnline && (
          <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:16, marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:12, color:'#333' }}>
              💳 Refund details — Rs. {order.refundAmount || order.totalPrice}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
              {[
                ['bank_transfer', '🏦', 'Bank Transfer', '3–5 business days'],
                ['upi', '📱', 'UPI Transfer', 'Within 24 hours'],
              ].map(([id, icon, label, time]) => (
                <div
                  key={id}
                  onClick={() => {
                    setCancelRefundMethod(id);
                    setCancelUpiMismatch(false);
                    setCancelAccountMismatch(false);
                    const s = id === 'upi' ? (savedRefund.upi || {}) : (savedRefund.bankTransfer || {});
                    setCancelBankDetails(s);
                    if (id === 'upi') setCancelUpiConfirm(s.upiId || '');
                    if (id === 'bank_transfer') setCancelAccountConfirm(s.accountNumber || '');
                  }}
                  style={{
                    border: `2px solid ${cancelRefundMethod === id ? '#FF5A1F' : '#ddd'}`,
                    borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                    background: cancelRefundMethod === id ? '#fff8f0' : 'white',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span style={{ fontSize:20 }}>{icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13 }}>{label}</div>
                    <div style={{ fontSize:12, color:'#888' }}>{time}</div>
                  </div>
                  <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${cancelRefundMethod===id?'#FF5A1F':'#ccc'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {cancelRefundMethod === id && <div style={{ width:9, height:9, borderRadius:'50%', background:'#FF5A1F' }} />}
                  </div>
                </div>
              ))}
            </div>

            {cancelRefundMethod === 'bank_transfer' && (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <label style={labelStyle}>Account Holder Name *</label>
                    <input value={cancelBankDetails.accountName||''} onChange={e=>setB('accountName',e.target.value)} placeholder="As per bank records" style={fieldStyle} />
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={labelStyle}>Bank Name *</label>
                    <input value={cancelBankDetails.bankName||''} onChange={e=>setB('bankName',e.target.value)} placeholder="Everest Bank Limited" style={fieldStyle} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <label style={labelStyle}>Account Number *</label>
                    <input
                      value={cancelBankDetails.accountNumber||''}
                      onChange={e=>{
                        const v = e.target.value;
                        setB('accountNumber', v);
                        setCancelAccountMismatch(cancelAccountConfirm !== '' && v !== cancelAccountConfirm);
                      }}
                      placeholder="00100456789012"
                      style={{ ...fieldStyle, borderColor: cancelAccountMismatch ? '#dc2626' : '#ddd' }}
                    />
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={labelStyle}>Branch Name *</label>
                    <input value={cancelBankDetails.ifscCode||''} onChange={e=>setB('ifscCode',e.target.value)} placeholder="Putalisadak Branch" style={fieldStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Confirm Account Number *</label>
                  <input
                    value={cancelAccountConfirm}
                    onChange={e=>{
                      const v = e.target.value;
                      setCancelAccountConfirm(v);
                      setCancelAccountMismatch(v !== '' && (cancelBankDetails.accountNumber || '') !== v);
                    }}
                    onPaste={e => e.preventDefault()}
                    placeholder="Re-enter account number"
                    style={{ ...fieldStyle, borderColor: cancelAccountMismatch ? '#dc2626' : '#ddd' }}
                  />
                  {cancelAccountMismatch && (
                    <div style={{ color:'#dc2626', fontSize:11, marginTop:4 }}>Account numbers do not match.</div>
                  )}
                </div>
              </div>
            )}

            {cancelRefundMethod === 'upi' && (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div>
                  <label style={labelStyle}>UPI ID *</label>
                  <input
                    value={cancelBankDetails.upiId||''}
                    onChange={e=>{ setB('upiId',e.target.value); setCancelUpiMismatch(false); }}
                    placeholder="yourname@paytm"
                    style={{ ...fieldStyle, borderColor: cancelUpiMismatch ? '#dc2626' : '#ddd' }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Confirm UPI ID *</label>
                  <input
                    value={cancelUpiConfirm}
                    onChange={e=>{ setCancelUpiConfirm(e.target.value); setCancelUpiMismatch(false); }}
                    placeholder="Re-enter UPI ID"
                    style={{ ...fieldStyle, borderColor: cancelUpiMismatch ? '#dc2626' : '#ddd' }}
                  />
                </div>
                {cancelUpiMismatch && (
                  <div style={{ fontSize:12, color:'#dc2626', fontWeight:600 }}>⚠ UPI IDs do not match</div>
                )}
                {!cancelUpiMismatch && cancelBankDetails.upiId && cancelUpiConfirm && cancelBankDetails.upiId === cancelUpiConfirm && (
                  <div style={{ fontSize:12, color:'#16a34a', fontWeight:600 }}>✓ UPI IDs match</div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding:'10px 20px', borderRadius:8, border:'1px solid #ddd', background:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}
          >
            Keep Order
          </button>
          <button
            onClick={onConfirm}
            disabled={cancelling || !inputValid()}
            style={{
              padding:'10px 20px', borderRadius:8, border:'none',
              background: (!inputValid() || cancelling) ? '#ccc' : '#dc2626',
              color:'white', fontSize:13, fontWeight:700,
              cursor: (!inputValid() || cancelling) ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelling ? 'Cancelling…' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}
