import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrderContext';
import { useToast } from '../context/ToastContext';
import { returnsApi } from '../api/returns';
import { usersApi } from '../api/users';
import { getErrorMessage } from '../api/client';
import { formatPriceShort, formatDate } from '../utils/formatters';

/* constants */
const REASONS = [
  { id: 'defective',        icon: '🔧', label: 'Defective / Not Working',  desc: 'The item stopped working or never worked' },
  { id: 'wrong_item',       icon: '📦', label: 'Wrong Item Received',       desc: 'I received a different item than ordered' },
  { id: 'damaged',          icon: '💥', label: 'Damaged in Transit',        desc: 'Item arrived broken or damaged' },
  { id: 'not_as_described', icon: '📋', label: 'Not as Described',          desc: "Item doesn't match the listing" },
  { id: 'changed_mind',     icon: '💭', label: 'Changed My Mind',           desc: 'I no longer need this item' },
  { id: 'missing_parts',    icon: '🧩', label: 'Missing Parts/Accessories', desc: 'Box was incomplete' },
];

const RESOLUTIONS = [
  { id: 'refund',       icon: '💳', label: 'Refund',       desc: 'Receive money by bank or UPI', time: 'Within 24 hours to 5 business days' },
  { id: 'replacement',  icon: '🔄', label: 'Replacement',  desc: 'Send me the same item again',     time: '3–5 business days' },
];

const STEPS = ['Select Order', 'Choose Item', 'Reason', 'Resolution'];

/* Status pipeline — ordered for the tracker */
const STATUS_PIPELINE = [
  { key: 'REQUESTED',        label: 'Return Requested',    icon: '📤' },
  { key: 'APPROVED',         label: 'Approved',            icon: '✅' },
  { key: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled',    icon: '🚚' },
  { key: 'ITEM_RECEIVED',    label: 'Item Received',       icon: '📦' },
  { key: 'REFUND_INITIATED', label: 'Refund Initiated',    icon: '💳' },
  { key: 'REFUND_COMPLETED', label: 'Refund Completed',    icon: '🎉' },
];

const REPL_PIPELINE = [
  { key: 'REQUESTED',          label: 'Return Requested',   icon: '📤' },
  { key: 'APPROVED',           label: 'Approved',           icon: '✅' },
  { key: 'PICKUP_SCHEDULED',   label: 'Pickup Scheduled',   icon: '🚚' },
  { key: 'ITEM_RECEIVED',      label: 'Item Received',      icon: '📦' },
  { key: 'REPLACEMENT_SENT',   label: 'Replacement Sent',   icon: '🔄' },
  { key: 'COMPLETED',          label: 'Completed',          icon: '🎉' },
];

const STATUS_META = {
  REQUESTED:        { label: 'Requested',        color: '#f59e0b', bg: '#fef3c7' },
  EMPLOYEE_APPROVED:  { label: 'Approved',          color: '#22c55e', bg: '#dcfce7' },
  EMPLOYEE_REJECTED:  { label: 'Under Review',      color: '#f59e0b', bg: '#fef9c3' },
  APPROVED:         { label: 'Approved',         color: '#22c55e', bg: '#dcfce7' },
  REJECTED:         { label: 'Rejected',         color: '#dc2626', bg: '#fee2e2' },
  PICKUP_SCHEDULED: { label: 'Pickup Scheduled', color: '#8b5cf6', bg: '#ede9fe' },
  ITEM_RECEIVED:    { label: 'Item Received',    color: '#06b6d4', bg: '#cffafe' },
  REFUND_INITIATED: { label: 'Refund Initiated', color: '#FF5A1F', bg: '#ffedd5' },
  REFUND_COMPLETED: { label: 'Refund Completed', color: '#16a34a', bg: '#dcfce7' },
  REPLACEMENT_SENT: { label: 'Replacement Sent', color: '#8b5cf6', bg: '#ede9fe' },
  COMPLETED:        { label: 'Completed',        color: '#16a34a', bg: '#dcfce7' },
};

/* sub-components */
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.REQUESTED;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700,
      padding:'3px 10px', borderRadius:99, background:m.bg, color:m.color }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:m.color }} />
      {m.label}
    </span>
  );
}

function ReturnTracker({ status, resolution }) {
  const pipeline = resolution === 'replacement' ? REPL_PIPELINE : STATUS_PIPELINE;
  const terminal = ['REJECTED', 'EMPLOYEE_REJECTED'];
  const isTerminal = terminal.includes(status);

  const mappedStatus = status === 'EMPLOYEE_APPROVED' ? 'APPROVED' : status;
  const activeIdx = pipeline.findIndex(p => p.key === mappedStatus);
  const effectiveIdx = activeIdx === -1 ? (isTerminal ? -1 : 0) : activeIdx;

  return (
    <div style={{ padding:'20px 24px' }}>
      {isTerminal && (
        <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'12px 16px', marginBottom:20, color:'#dc2626', fontWeight:600, fontSize:13 }}>
          ❌ This return has been {status === 'EMPLOYEE_REJECTED' ? 'rejected by the employee' : 'rejected by admin'}.
          {status === 'EMPLOYEE_REJECTED' && ' You may contact support for an appeal.'}
        </div>
      )}
      <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        {/* connecting line */}
        <div style={{ position:'absolute', top:16, left:'7%', right:'7%', height:3, background:'#e5e7eb', zIndex:0 }} />
        <div style={{ position:'absolute', top:16, left:'7%', height:3, background:'#22c55e', zIndex:1,
          width: effectiveIdx <= 0 ? '0%' : `${(effectiveIdx / (pipeline.length - 1)) * 86}%`,
          transition:'width .4s ease' }} />

        {pipeline.map((stage, i) => {
          const done   = i < effectiveIdx;
          const active = i === effectiveIdx && !isTerminal;
          const future = i > effectiveIdx || isTerminal;
          return (
            <div key={stage.key} style={{ display:'flex', flexDirection:'column', alignItems:'center', zIndex:2, flex:1 }}>
              <div style={{
                width:34, height:34, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
                background: done ? '#22c55e' : active ? '#FF5A1F' : '#e5e7eb',
                color: done || active ? 'white' : '#9ca3af',
                border: active ? '3px solid #FF5A1F' : 'none',
                boxShadow: active ? '0 0 0 4px #FF5A1F22' : 'none',
                transition:'all .3s',
              }}>
                {done ? '✓' : stage.icon}
              </div>
              <div style={{ fontSize:10, fontWeight: active ? 700 : 500, color: active ? '#FF5A1F' : done ? '#22c55e' : '#9ca3af', marginTop:6, textAlign:'center', lineHeight:1.3 }}>
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RefundProofModal({ proof, onClose }) {
  const [idx, setIdx] = useState(0);
  if (!proof?.length) return null;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'white', borderRadius:12, padding:24, maxWidth:500, width:'90vw' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:15 }}>🧾 Refund Proof</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#888', lineHeight:1 }}>×</button>
        </div>
        <img src={proof[idx].url} alt={`Proof ${idx+1}`}
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
          {proof.length} screenshot{proof.length!==1?'s':''} uploaded by our team
        </div>
      </div>
    </div>
  );
}

function MyReturnsView({ onNewReturn }) {
  const navigate = useNavigate();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [proofModal, setProofModal] = useState(null); // proof array to show

  useEffect(() => {
    returnsApi.getMy()
      .then(r => setReturns(r.data?.data?.data || r.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding:60, textAlign:'center', color:'#888' }}>Loading your returns…</div>
  );

  if (returns.length === 0) return (
    <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, padding:'60px 24px', textAlign:'center' }}>
      <div style={{ fontSize:56, marginBottom:16 }}>📦</div>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>No return requests yet</div>
      <div style={{ color:'#888', marginBottom:24 }}>All your return & refund requests will appear here.</div>
      <button onClick={onNewReturn}
        style={{ background:'#FFD814', border:'1px solid #FBA131', borderRadius:20, padding:'9px 28px', fontWeight:700, fontSize:14, cursor:'pointer' }}>
        Start a Return
      </button>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {returns.map(req => {
        const isOpen = expanded === req._id;
        const order  = req.order;
        const reasonLabel = REASONS.find(r => r.id === req.reason)?.label || req.reason;
        const resMeta = RESOLUTIONS.find(r => r.id === req.resolution);

        return (
          <div key={req._id} style={{ background:'white', border:'1px solid #ddd', borderRadius:8, overflow:'hidden' }}>
            {/* Header row */}
            <div style={{ background:'#f0f2f2', padding:'12px 20px', display:'flex', alignItems:'center', gap:32, flexWrap:'wrap', borderBottom:'1px solid #ddd' }}>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'#888', letterSpacing:'.06em', textTransform:'uppercase' }}>Submitted</div>
                <div style={{ fontSize:13, fontWeight:600, marginTop:2 }}>{formatDate(req.createdAt)}</div>
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'#888', letterSpacing:'.06em', textTransform:'uppercase' }}>Refund Amount</div>
                <div style={{ fontSize:13, fontWeight:700, marginTop:2 }}>{formatPriceShort(req.refundAmount)}</div>
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'#888', letterSpacing:'.06em', textTransform:'uppercase' }}>Resolution</div>
                <div style={{ fontSize:13, fontWeight:600, marginTop:2 }}>{resMeta?.label || req.resolution || '—'}</div>
              </div>
              <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
                <StatusBadge status={req.status} />
                {req.refundProof?.length > 0 && (
                  <button onClick={() => setProofModal(req.refundProof)}
                    title="View refund proof screenshots"
                    style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#0369a1', background:'#f0f9ff', border:'1px solid #0ea5e933', cursor:'pointer', fontWeight:700, padding:'5px 12px', borderRadius:20 }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M1 12C1 12 5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                    Proof
                  </button>
                )}
                <button onClick={() => navigate(`/return-status/${req._id}`)}
                  style={{ fontSize:12, color:'white', background:'#FF5A1F', border:'none', cursor:'pointer', fontWeight:700, padding:'5px 14px', borderRadius:20 }}>
                  Track Return →
                </button>
                <button onClick={() => setExpanded(isOpen ? null : req._id)}
                  style={{ fontSize:12, color:'#007185', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                  {isOpen ? 'Hide ↑' : 'Details'}
                </button>
              </div>
            </div>

            {/* Item + reason summary */}
            <div style={{ padding:'14px 20px', display:'flex', gap:14, alignItems:'center', borderBottom: isOpen ? '1px solid #eee' : 'none' }}>
              {req.product?.images?.[0]
                ? <img src={req.product.images[0]} alt="" style={{ width:56, height:56, objectFit:'contain', border:'1px solid #ddd', borderRadius:6 }} />
                : <div style={{ width:56, height:56, background:'#f0f0f0', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>📦</div>
              }
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>{req.product?.title || 'Order Item'}</div>
                <div style={{ fontSize:12, color:'#888', marginTop:2 }}>Reason: {reasonLabel}</div>
                {req.description && <div style={{ fontSize:12, color:'#666', marginTop:2 }}>"{req.description.slice(0, 80)}{req.description.length > 80 ? '…' : ''}"</div>}
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'.06em' }}>Return #</div>
                <div style={{ fontSize:12, fontWeight:700 }}>{req._id?.slice(-8).toUpperCase()}</div>
              </div>
            </div>

            {/* Tracker — expanded */}
            {isOpen && (
              <>
                <ReturnTracker status={req.status} resolution={req.resolution} />

                {/* Timeline */}
                {req.timeline?.length > 0 && (
                  <div style={{ padding:'0 24px 20px' }}>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:12, color:'#333' }}>Activity Timeline</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                      {[...req.timeline].reverse().map((ev, i) => (
                        <div key={i} style={{ display:'flex', gap:12, paddingBottom:i < req.timeline.length - 1 ? 14 : 0 }}>
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                            <div style={{ width:10, height:10, borderRadius:'50%', background: i === 0 ? '#FF5A1F' : '#d1d5db', flexShrink:0, marginTop:3 }} />
                            {i < req.timeline.length - 1 && <div style={{ width:1, background:'#e5e7eb', flex:1, marginTop:3 }} />}
                          </div>
                          <div style={{ flex:1, paddingBottom: i < req.timeline.length - 1 ? 4 : 0 }}>
                            <div style={{ fontSize:12, fontWeight:700, color: i === 0 ? '#FF5A1F' : '#333' }}>
                              {ev.status?.replace(/_/g, ' ')}
                            </div>
                            {ev.note && <div style={{ fontSize:12, color:'#666', marginTop:1 }}>{ev.note}</div>}
                            <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{formatDate(ev.at)} · by {ev.by}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin/Employee notes */}
                {(req.adminNote || req.employeeNote) && (
                  <div style={{ margin:'0 24px 20px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'12px 16px' }}>
                    {req.employeeNote && <div style={{ fontSize:12, color:'#555', marginBottom:4 }}><strong>Employee:</strong> {req.employeeNote}</div>}
                    {req.adminNote  && <div style={{ fontSize:12, color:'#555' }}><strong>Admin:</strong> {req.adminNote}</div>}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      {proofModal && <RefundProofModal proof={proofModal} onClose={() => setProofModal(null)} />}
    </div>
  );
}

/* Main page */
export default function ReturnsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user }  = useAuth();
  const { getMyOrders } = useOrders();
  const toast = useToast();

  const [view, setView]             = useState(searchParams.get('orderId') ? 'new' : 'my'); // 'my' | 'new'
  const [orders, setOrders]         = useState([]);
  const [orderId, setOrderId]       = useState(searchParams.get('orderId') || '');
  const [selectedItem, setSelItem]  = useState(null);
  const [reason, setReason]         = useState('');
  const [resolution, setResolution] = useState('refund');
  const [refundMethod, setRefundMethod] = useState('bank_transfer');
  const [bankDetails, setBankDetails]   = useState({});
  const [accountConfirm, setAccountConfirm] = useState('');
  const [accountMismatch, setAccountMismatch] = useState(false);
  const [upiConfirm, setUpiConfirm]     = useState('');
  const [upiMismatch, setUpiMismatch]   = useState(false);
  const [savedRefundDetails, setSavedRefundDetails] = useState({});
  const [description, setDesc]      = useState('');
  const [photos, setPhotos]         = useState([]);
  const [video, setVideo]           = useState(null);
  const [step, setStep]             = useState(searchParams.get('orderId') ? 2 : 1);
  const [loading, setLoading]       = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [fetchingOrders, setFetch]  = useState(true);

  useEffect(() => {
    if (!user) return;
    getMyOrders({ limit: 50 }).then(r => {
      if (r.success) {
        const eligible = (r.data || r.orders || []).filter(o => o.orderStatus === 'DELIVERED');
        setOrders(eligible);
      }
    }).finally(() => setFetch(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    usersApi.getRefundDetails()
      .then(({ data }) => {
        const saved = data.data?.savedRefundDetails || {};
        setSavedRefundDetails(saved);
        const method = saved.lastRefundMethod === 'upi' ? 'upi' : 'bank_transfer';
        setRefundMethod(method);
        setBankDetails(method === 'upi' ? (saved.upi || {}) : (saved.bankTransfer || {}));
        if (method === 'upi' && saved.upi?.upiId) setUpiConfirm(saved.upi.upiId);
        if (method === 'bank_transfer' && saved.bankTransfer?.accountNumber) setAccountConfirm(saved.bankTransfer.accountNumber);
      })
      .catch(() => {});
  }, [user]);

  if (!user) { navigate('/login'); return null; }

  const selectedOrder = orders.find(o => o._id === orderId);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('orderId', orderId);
      const pid = selectedItem?.product?._id || selectedItem?.product;
      if (pid) fd.append('productId', typeof pid === 'object' ? pid.toString() : pid);
      fd.append('reason', reason);
      fd.append('resolution', resolution);
      if (resolution === 'refund') {
        if (refundMethod === 'bank_transfer' && (!bankDetails.accountName || !bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.ifscCode)) {
          toast('Please enter complete bank details.', 'error');
          return;
        }
        if (refundMethod === 'bank_transfer' && bankDetails.accountNumber !== accountConfirm) {
          setAccountMismatch(true);
          toast('Account numbers do not match. Please re-enter.', 'error');
          return;
        }
        if (refundMethod === 'upi') {
          if (!bankDetails.upiId) {
            toast('Please enter your UPI ID.', 'error');
            return;
          }
          if (bankDetails.upiId !== upiConfirm) {
            setUpiMismatch(true);
            toast('UPI IDs do not match. Please re-enter.', 'error');
            return;
          }
        }
        fd.append('refundMethod', refundMethod);
        fd.append('bankDetails', JSON.stringify(bankDetails));
      }
      if (description) fd.append('description', description);
      photos.forEach(file => fd.append('photos', file));
      if (video) fd.append('video', video);
      const res = await returnsApi.submit(fd);
      const returnId = res.data?.data?.returnRequest?._id;
      if (returnId) {
        navigate(`/return-status/${returnId}`);
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  /* Success screen */
  if (submitted) return (
    <div style={{ background:'#f0f2f2', minHeight:'100vh', padding:'60px 16px' }}>
      <div style={{ maxWidth:560, margin:'0 auto', background:'white', border:'1px solid #ddd', borderRadius:8, padding:'48px 40px', textAlign:'center' }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, margin:'0 auto 20px' }}>✅</div>
        <h2 style={{ fontSize:22, fontWeight:700, margin:'0 0 12px' }}>Return Request Submitted!</h2>
        <p style={{ color:'#666', fontSize:14, lineHeight:1.7, marginBottom:28 }}>
          We've received your return request for <strong>{selectedItem?.title}</strong>.<br />
          Our team will review it within <strong>24–48 hours</strong> and send a confirmation to <strong>{user.email}</strong>.
        </p>
        <div style={{ background:'#f0f2f2', borderRadius:8, padding:'14px 20px', marginBottom:28, textAlign:'left', fontSize:13 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ color:'#888' }}>Resolution</span>
            <span style={{ fontWeight:700 }}>{RESOLUTIONS.find(r=>r.id===resolution)?.label}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ color:'#888' }}>Processing Time</span>
            <span style={{ fontWeight:700 }}>{RESOLUTIONS.find(r=>r.id===resolution)?.time}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ color:'#888' }}>Reason</span>
            <span style={{ fontWeight:700 }}>{REASONS.find(r=>r.id===reason)?.label}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button onClick={() => { setSubmitted(false); setView('my'); setStep(1); setOrderId(''); setSelItem(null); setReason(''); setPhotos([]); setVideo(null); }}
            style={{ padding:'10px 24px', borderRadius:20, border:'1px solid #D5D9D9', background:'linear-gradient(to bottom,#f7f8fa,#e7e9ec)', fontWeight:600, fontSize:13, cursor:'pointer' }}>
            View My Returns
          </button>
          <button onClick={()=>navigate('/')}
            style={{ padding:'10px 24px', borderRadius:20, background:'#FFD814', border:'1px solid #FBA131', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background:'#f0f2f2', minHeight:'100vh', padding:'24px 0 60px' }}>
      <div style={{ maxWidth:860, margin:'0 auto', padding:'0 16px' }}>

        {/* Page header */}
        <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, padding:'20px 24px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={()=>navigate('/orders')} style={{ background:'none', border:'none', cursor:'pointer', color:'#007185', fontWeight:600, fontSize:13, padding:0 }}>
              ← Your Orders
            </button>
            <span style={{ color:'#ccc' }}>/</span>
            <span style={{ fontSize:13, color:'#888' }}>Returns & Refunds</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:12, flexWrap:'wrap', gap:10 }}>
            <div>
              <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Returns & Refunds</h1>
              <p style={{ margin:'4px 0 0', fontSize:13, color:'#666' }}>Track your return requests or start a new one.</p>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setView('my')}
                style={{ padding:'8px 20px', borderRadius:20, border:'1px solid #D5D9D9',
                  background: view === 'my' ? '#FF5A1F' : 'linear-gradient(to bottom,#f7f8fa,#e7e9ec)',
                  color: view === 'my' ? 'white' : '#333',
                  fontWeight:700, fontSize:13, cursor:'pointer' }}>
                My Returns
              </button>
              <button onClick={() => { setView('new'); setStep(1); setOrderId(''); setSelItem(null); setReason(''); setPhotos([]); setVideo(null); }}
                style={{ padding:'8px 20px', borderRadius:20, border:'1px solid #D5D9D9',
                  background: view === 'new' ? '#FF5A1F' : 'linear-gradient(to bottom,#f7f8fa,#e7e9ec)',
                  color: view === 'new' ? 'white' : '#333',
                  fontWeight:700, fontSize:13, cursor:'pointer' }}>
                + New Return
              </button>
            </div>
          </div>
        </div>

        {/* My Returns view */}
        {view === 'my' && <MyReturnsView onNewReturn={() => setView('new')} />}

        {/* New Return wizard */}
        {view === 'new' && (
          <div className="r-stack" style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:16, alignItems:'start' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

              {/* Step indicator */}
              <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, padding:'16px 24px' }}>
                <div style={{ display:'flex', alignItems:'center' }}>
                  {STEPS.map((s, i) => {
                    const n = i + 1;
                    const done = n < step, active = n === step;
                    return (
                      <div key={s} style={{ display:'flex', alignItems:'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                          <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700,
                            background: done ? '#22c55e' : active ? '#FF5A1F' : '#e5e7eb',
                            color: done || active ? 'white' : '#9ca3af' }}>
                            {done ? '✓' : n}
                          </div>
                          <div style={{ fontSize:10, fontWeight: active ? 700 : 500, color: active ? '#FF5A1F' : done ? '#22c55e' : '#9ca3af', whiteSpace:'nowrap' }}>{s}</div>
                        </div>
                        {i < STEPS.length - 1 && (
                          <div style={{ flex:1, height:2, background: n < step ? '#22c55e' : '#e5e7eb', margin:'0 6px', marginBottom:18 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 1 — Select Order */}
              {step >= 1 && (
                <div style={{ background:'white', border:`2px solid ${step===1?'#FF5A1F':'#ddd'}`, borderRadius:8, overflow:'hidden' }}>
                  <div style={{ padding:'14px 20px', borderBottom:'1px solid #eee', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background: step===1?'#FF5A1F':'#22c55e', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>
                      {step > 1 ? '✓' : '1'}
                    </div>
                    <span style={{ fontWeight:700, fontSize:15 }}>Select the order to return</span>
                    {step > 1 && selectedOrder && (
                      <span style={{ marginLeft:'auto', fontSize:12, color:'#007185', fontWeight:600, cursor:'pointer' }} onClick={()=>setStep(1)}>Change</span>
                    )}
                  </div>
                  {step === 1 ? (
                    <div style={{ padding:'16px 20px' }}>
                      {fetchingOrders ? (
                        <div style={{ textAlign:'center', color:'#888', padding:20 }}>Loading orders…</div>
                      ) : orders.length === 0 ? (
                        <div style={{ textAlign:'center', color:'#888', padding:20 }}>No delivered orders eligible for return.</div>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                          {orders.map(order => (
                            <div key={order._id} onClick={() => { setOrderId(order._id); setStep(2); }}
                              style={{ border:`2px solid ${orderId===order._id?'#FF5A1F':'#e5e7eb'}`, borderRadius:8, padding:'14px 16px', cursor:'pointer',
                                background: orderId===order._id ? '#fff8f0' : 'white', transition:'all .15s' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                                <span style={{ fontSize:13, fontWeight:700 }}>Order #{order._id?.slice(-8).toUpperCase()}</span>
                                <span style={{ fontSize:13, fontWeight:700 }}>{formatPriceShort(order.totalPrice)}</span>
                              </div>
                              <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>Delivered: {formatDate(order.deliveredAt || order.updatedAt)}</div>
                              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                                {(order.orderItems || []).slice(0, 3).map((item, i) => (
                                  <div key={i} style={{ width:40, height:40, border:'1px solid #ddd', borderRadius:4, overflow:'hidden', background:'#fafafa', flexShrink:0 }}>
                                    {item.image ? <img src={item.image} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} /> : <span style={{ fontSize:20 }}>📦</span>}
                                  </div>
                                ))}
                                {(order.orderItems?.length || 0) > 3 && (
                                  <div style={{ width:40, height:40, border:'1px solid #ddd', borderRadius:4, background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#888' }}>
                                    +{order.orderItems.length - 3}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : selectedOrder && (
                    <div style={{ padding:'14px 20px', background:'#f9f9f9', fontSize:13 }}>
                      <span style={{ fontWeight:600 }}>Order #{selectedOrder._id?.slice(-8).toUpperCase()}</span>
                      <span style={{ color:'#888', marginLeft:8 }}>· {formatPriceShort(selectedOrder.totalPrice)} · {selectedOrder.orderItems?.length} item(s)</span>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2 — Choose Item */}
              {step >= 2 && (
                <div style={{ background:'white', border:`2px solid ${step===2?'#FF5A1F':'#ddd'}`, borderRadius:8, overflow:'hidden' }}>
                  <div style={{ padding:'14px 20px', borderBottom:'1px solid #eee', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background: step===2?'#FF5A1F':'#22c55e', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>
                      {step > 2 ? '✓' : '2'}
                    </div>
                    <span style={{ fontWeight:700, fontSize:15 }}>Which item are you returning?</span>
                    {step > 2 && selectedItem && (
                      <span style={{ marginLeft:'auto', fontSize:12, color:'#007185', fontWeight:600, cursor:'pointer' }} onClick={()=>setStep(2)}>Change</span>
                    )}
                  </div>
                  {step === 2 ? (
                    <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:10 }}>
                      {(selectedOrder?.orderItems || []).map((item, i) => {
                        const prod = item.product || {};
                        const isReturnable = prod.returnable !== false;
                        const returnWindow = prod.returnWindow || 7;
                        const deliveredAt = selectedOrder.deliveredAt || selectedOrder.updatedAt;
                        const daysElapsed = deliveredAt ? Math.floor((Date.now() - new Date(deliveredAt).getTime()) / 86400000) : 0;
                        const windowExpired = daysElapsed > returnWindow;
                        const blocked = !isReturnable || windowExpired;
                        const blockReason = !isReturnable ? 'Non-returnable item' : `Return window expired (${returnWindow}-day limit)`;

                        return (
                          <div key={i} onClick={() => !blocked && setSelItem(item)}
                            style={{ border:`2px solid ${selectedItem===item?'#FF5A1F':blocked?'#fecaca':'#e5e7eb'}`, borderRadius:8, padding:'12px 14px',
                              cursor: blocked ? 'not-allowed' : 'pointer',
                              background: selectedItem===item ? '#fff8f0' : blocked ? '#fef2f2' : 'white',
                              display:'flex', gap:12, alignItems:'center', transition:'all .15s',
                              opacity: blocked ? 0.75 : 1 }}>
                            <div style={{ width:64, height:64, border:'1px solid #ddd', borderRadius:6, overflow:'hidden', flexShrink:0, background:'#fafafa', display:'flex', alignItems:'center', justifyContent:'center' }}>
                              {item.image ? <img src={item.image} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} /> : <span style={{ fontSize:28 }}>📦</span>}
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:600, fontSize:14 }}>{item.title}</div>
                              <div style={{ fontSize:12, color:'#888', marginTop:3 }}>Qty: {item.quantity} · {formatPriceShort(item.price)} each</div>
                              <div style={{ fontSize:14, fontWeight:700, marginTop:3 }}>{formatPriceShort(item.price * item.quantity)}</div>
                              {!blocked && isReturnable && (
                                <div style={{ fontSize:11, color:'#16a34a', marginTop:3, fontWeight:600 }}>
                                  ↩️ {returnWindow}-day return · {Math.max(0, returnWindow - daysElapsed)} day(s) left
                                </div>
                              )}
                              {blocked && (
                                <div style={{ fontSize:11, color:'#dc2626', marginTop:3, fontWeight:700 }}>
                                  🚫 {blockReason}
                                </div>
                              )}
                            </div>
                            {!blocked && (
                              <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${selectedItem===item?'#FF5A1F':'#ccc'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                {selectedItem===item && <div style={{ width:10, height:10, borderRadius:'50%', background:'#FF5A1F' }} />}
                              </div>
                            )}
                            {blocked && <span style={{ fontSize:18 }}>🔒</span>}
                          </div>
                        );
                      })}
                      {selectedItem && (
                        <button onClick={()=>setStep(3)} style={{ width:'100%', padding:'11px', borderRadius:8, background:'#FFD814', border:'1px solid #FBA131', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                          Continue →
                        </button>
                      )}
                    </div>
                  ) : selectedItem && (
                    <div style={{ padding:'14px 20px', background:'#f9f9f9', fontSize:13, display:'flex', gap:10, alignItems:'center' }}>
                      {selectedItem.image && <img src={selectedItem.image} alt="" style={{ width:36, height:36, objectFit:'contain', border:'1px solid #ddd', borderRadius:4 }} />}
                      <span style={{ fontWeight:600 }}>{selectedItem.title}</span>
                      <span style={{ color:'#888' }}>· {formatPriceShort(selectedItem.price * selectedItem.quantity)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3 — Reason */}
              {step >= 3 && (
                <div style={{ background:'white', border:`2px solid ${step===3?'#FF5A1F':'#ddd'}`, borderRadius:8, overflow:'hidden' }}>
                  <div style={{ padding:'14px 20px', borderBottom:'1px solid #eee', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background: step===3?'#FF5A1F':'#22c55e', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>
                      {step > 3 ? '✓' : '3'}
                    </div>
                    <span style={{ fontWeight:700, fontSize:15 }}>Why are you returning this?</span>
                    {step > 3 && reason && (
                      <span style={{ marginLeft:'auto', fontSize:12, color:'#007185', fontWeight:600, cursor:'pointer' }} onClick={()=>setStep(3)}>Change</span>
                    )}
                  </div>
                  {step === 3 ? (
                    <div style={{ padding:'16px 20px' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                        {REASONS.map(r => (
                          <div key={r.id} onClick={() => setReason(r.id)}
                            style={{ border:`2px solid ${reason===r.id?'#FF5A1F':'#e5e7eb'}`, borderRadius:8, padding:'12px 14px', cursor:'pointer',
                              background: reason===r.id ? '#fff8f0' : 'white', display:'flex', alignItems:'center', gap:12, transition:'all .15s' }}>
                            <div style={{ width:38, height:38, borderRadius:8, background: reason===r.id?'#FF5A1F':'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                              {r.icon}
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:600, fontSize:13 }}>{r.label}</div>
                              <div style={{ fontSize:12, color:'#888', marginTop:1 }}>{r.desc}</div>
                            </div>
                            <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${reason===r.id?'#FF5A1F':'#ccc'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              {reason===r.id && <div style={{ width:10, height:10, borderRadius:'50%', background:'#FF5A1F' }} />}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginBottom:16 }}>
                        <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:'#333' }}>Additional comments <span style={{ color:'#888', fontWeight:400 }}>(optional)</span></div>
                        <textarea rows={3} value={description} onChange={e=>setDesc(e.target.value)}
                          placeholder="Describe the issue in detail…"
                          style={{ width:'100%', border:'1px solid #ddd', borderRadius:8, padding:'10px 14px', fontSize:13, resize:'vertical', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                      </div>

                      {/* Photos — required */}
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:'#333' }}>
                          Photos <span style={{ color:'#dc2626' }}>*</span>{' '}
                          <span style={{ color:'#888', fontWeight:400 }}>(at least 1, up to 5)</span>
                        </div>
                        {photos.length > 0 && (
                          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                            {photos.map((file, i) => (
                              <div key={i} style={{ position:'relative', width:72, height:72 }}>
                                <img src={URL.createObjectURL(file)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:6, border:'1px solid #ddd' }} />
                                <button onClick={() => setPhotos(p => p.filter((_,j)=>j!==i))}
                                  style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', background:'#dc2626', border:'none', color:'white', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {photos.length < 5 && (
                          <label style={{ display:'flex', alignItems:'center', gap:12, border:`2px dashed ${photos.length===0?'#FF5A1F':'#d1d5db'}`, borderRadius:8, padding:'14px 16px', cursor:'pointer', background:'#fafafa' }}>
                            <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple style={{ display:'none' }}
                              onChange={e => { const f=Array.from(e.target.files); setPhotos(p=>[...p,...f].slice(0,5)); e.target.value=''; }} />
                            <span style={{ fontSize:26 }}>📷</span>
                            <div>
                              <div style={{ fontSize:13, fontWeight:600, color:'#333' }}>{photos.length===0?'Upload photos of the issue':'Add more photos'}</div>
                              <div style={{ fontSize:11, color:'#888' }}>JPEG, PNG or WebP · max 10 MB each</div>
                            </div>
                          </label>
                        )}
                      </div>

                      {/* Video — optional */}
                      <div style={{ marginBottom:16 }}>
                        <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:'#333' }}>
                          Video <span style={{ color:'#888', fontWeight:400 }}>(optional · max 50 MB)</span>
                        </div>
                        {video ? (
                          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', border:'1px solid #ddd', borderRadius:8, background:'#f9f9f9' }}>
                            <span style={{ fontSize:22 }}>🎬</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:13, fontWeight:600, color:'#333' }}>{video.name}</div>
                              <div style={{ fontSize:11, color:'#888' }}>{(video.size/1024/1024).toFixed(1)} MB</div>
                            </div>
                            <button onClick={()=>setVideo(null)} style={{ border:'none', background:'none', color:'#dc2626', cursor:'pointer', fontWeight:700, fontSize:20, lineHeight:1, padding:'2px 6px' }}>×</button>
                          </div>
                        ) : (
                          <label style={{ display:'flex', alignItems:'center', gap:12, border:'2px dashed #d1d5db', borderRadius:8, padding:'14px 16px', cursor:'pointer', background:'#fafafa' }}>
                            <input type="file" accept="video/mp4,video/quicktime,video/webm" style={{ display:'none' }}
                              onChange={e => { if(e.target.files[0]) setVideo(e.target.files[0]); e.target.value=''; }} />
                            <span style={{ fontSize:26 }}>🎬</span>
                            <div>
                              <div style={{ fontSize:13, fontWeight:600, color:'#333' }}>Upload a video</div>
                              <div style={{ fontSize:11, color:'#888' }}>MP4, MOV or WebM · max 50 MB</div>
                            </div>
                          </label>
                        )}
                      </div>

                      {reason && photos.length === 0 && (
                        <div style={{ fontSize:12, color:'#dc2626', textAlign:'center', padding:'9px 12px', border:'1px solid #fecaca', borderRadius:8, background:'#fef2f2', marginBottom:10 }}>
                          ⚠ Please upload at least 1 photo to continue
                        </div>
                      )}
                      {reason && photos.length > 0 && (
                        <button onClick={()=>setStep(4)} style={{ width:'100%', padding:'11px', borderRadius:8, background:'#FFD814', border:'1px solid #FBA131', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                          Continue →
                        </button>
                      )}
                    </div>
                  ) : reason && (
                    <div style={{ padding:'14px 20px', background:'#f9f9f9', fontSize:13 }}>
                      <span style={{ fontWeight:600 }}>{REASONS.find(r=>r.id===reason)?.icon} {REASONS.find(r=>r.id===reason)?.label}</span>
                      {description && <span style={{ color:'#888', marginLeft:8 }}>· "{description.slice(0,40)}{description.length>40?'…':''}"</span>}
                      <span style={{ color:'#888', marginLeft:8 }}>· {photos.length} photo{photos.length!==1?'s':''}{video?', 1 video':''}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4 — Resolution */}
              {step >= 4 && (
                <div style={{ background:'white', border:'2px solid #FF5A1F', borderRadius:8, overflow:'hidden' }}>
                  <div style={{ padding:'14px 20px', borderBottom:'1px solid #eee', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background:'#FF5A1F', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>4</div>
                    <span style={{ fontWeight:700, fontSize:15 }}>How would you like to be compensated?</span>
                  </div>
                  <div style={{ padding:'16px 20px' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
                      {RESOLUTIONS.map(res => (
                        <div key={res.id} onClick={()=>setResolution(res.id)}
                          style={{ border:`2px solid ${resolution===res.id?'#FF5A1F':'#ddd'}`, borderRadius:8, padding:'14px 16px', cursor:'pointer', background:resolution===res.id?'#fff8f0':'white', display:'flex', alignItems:'center', gap:14, transition:'all .15s' }}>
                          <div style={{ width:44, height:44, borderRadius:8, background:resolution===res.id?'#FF5A1F':'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                            {res.icon}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:14 }}>{res.label}</div>
                            <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{res.desc}</div>
                            <div style={{ fontSize:12, color:'#007600', fontWeight:600, marginTop:3 }}>⏱ {res.time}</div>
                          </div>
                          <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${resolution===res.id?'#FF5A1F':'#ccc'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            {resolution===res.id && <div style={{ width:10,height:10,borderRadius:'50%',background:'#FF5A1F' }} />}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Refund method — shown only when Refund is selected */}
                    {resolution === 'refund' && (() => {
                      const effectiveMethod = refundMethod || 'bank_transfer';
                      const setB = (k, v) => {
                        setBankDetails(b => ({ ...b, [k]: v }));
                        if (k === 'accountNumber') {
                          setAccountMismatch(accountConfirm !== '' && v !== accountConfirm);
                        }
                      };
                      const chooseMethod = (method) => {
                        setRefundMethod(method);
                        setUpiMismatch(false);
                        setAccountMismatch(false);
                        const saved = method === 'upi' ? (savedRefundDetails.upi || {}) : (savedRefundDetails.bankTransfer || {});
                        setBankDetails(saved);
                        if (method === 'upi') setUpiConfirm(saved.upiId || '');
                        if (method === 'bank_transfer') setAccountConfirm(saved.accountNumber || '');
                      };
                      const inp = (label, key, placeholder) => (
                        <div style={{ flex:1 }}>
                          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#888', marginBottom:4, textTransform:'uppercase' }}>{label}</label>
                          <input value={bankDetails[key]||''} onChange={e=>setB(key,e.target.value)} placeholder={placeholder}
                            style={{ width:'100%', height:36, border:`1px solid ${key==='accountNumber' && accountMismatch ? '#dc2626' : '#ddd'}`, borderRadius:6, padding:'0 10px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                        </div>
                      );
                      return (
                        <div style={{ marginBottom:20, padding:'16px', background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0' }}>
                          <div style={{ fontWeight:700, fontSize:13, marginBottom:12, color:'#333' }}>💳 How would you like to receive your refund?</div>
                          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
                            <div onClick={()=>chooseMethod('bank_transfer')}
                              style={{ border:`2px solid ${effectiveMethod==='bank_transfer'?'#FF5A1F':'#ddd'}`, borderRadius:8, padding:'10px 14px', cursor:'pointer', background:effectiveMethod==='bank_transfer'?'#fff8f0':'white', display:'flex', alignItems:'center', gap:10 }}>
                              <span style={{ fontSize:20 }}>🏦</span>
                              <div style={{ flex:1 }}>
                                <div style={{ fontWeight:700, fontSize:13 }}>Bank Transfer</div>
                                <div style={{ fontSize:12, color:'#888' }}>Direct to your bank account · 3–5 business days</div>
                              </div>
                              <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${effectiveMethod==='bank_transfer'?'#FF5A1F':'#ccc'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                {effectiveMethod==='bank_transfer' && <div style={{ width:9, height:9, borderRadius:'50%', background:'#FF5A1F' }} />}
                              </div>
                            </div>
                            <div onClick={()=>chooseMethod('upi')}
                              style={{ border:`2px solid ${effectiveMethod==='upi'?'#FF5A1F':'#ddd'}`, borderRadius:8, padding:'10px 14px', cursor:'pointer', background:effectiveMethod==='upi'?'#fff8f0':'white', display:'flex', alignItems:'center', gap:10 }}>
                              <span style={{ fontSize:20 }}>📱</span>
                              <div style={{ flex:1 }}>
                                <div style={{ fontWeight:700, fontSize:13 }}>UPI Transfer</div>
                                <div style={{ fontSize:12, color:'#888' }}>Instant transfer to UPI ID · Within 24 hours</div>
                              </div>
                              <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${effectiveMethod==='upi'?'#FF5A1F':'#ccc'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                {effectiveMethod==='upi' && <div style={{ width:9, height:9, borderRadius:'50%', background:'#FF5A1F' }} />}
                              </div>
                            </div>
                          </div>
                          {effectiveMethod === 'bank_transfer' && (
                            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                              <div style={{ display:'flex', gap:10 }}>
                                {inp('Account Holder Name *', 'accountName', 'As per bank records')}
                                {inp('Bank Name *', 'bankName', 'Everest Bank Limited')}
                              </div>
                              <div style={{ display:'flex', gap:10 }}>
                                {inp('Account Number *', 'accountNumber', '00100456789012')}
                                {inp('Branch Name *', 'ifscCode', 'Putalisadak Branch')}
                              </div>
                              <div>
                                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#888', marginBottom:4, textTransform:'uppercase' }}>Confirm Account Number *</label>
                                <input
                                  value={accountConfirm}
                                  onChange={e=>{
                                    const v = e.target.value;
                                    setAccountConfirm(v);
                                    setAccountMismatch(v !== '' && (bankDetails.accountNumber || '') !== v);
                                  }}
                                  onPaste={e => e.preventDefault()}
                                  placeholder="Re-enter account number"
                                  style={{ width:'100%', height:36, border:`1px solid ${accountMismatch?'#dc2626':'#ddd'}`, borderRadius:6, padding:'0 10px', fontSize:13, outline:'none', boxSizing:'border-box' }}
                                />
                                {accountMismatch && (
                                  <div style={{ color:'#dc2626', fontSize:11, marginTop:4 }}>Account numbers do not match.</div>
                                )}
                              </div>
                            </div>
                          )}
                          {effectiveMethod === 'upi' && (
                            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                              <div>
                                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#888', marginBottom:4, textTransform:'uppercase' }}>UPI ID *</label>
                                <input value={bankDetails.upiId||''} onChange={e=>{ setB('upiId',e.target.value); setUpiMismatch(false); }} placeholder="yourname@paytm / @gpay / @ybl"
                                  style={{ width:'100%', height:36, border:`1px solid ${upiMismatch?'#dc2626':'#ddd'}`, borderRadius:6, padding:'0 10px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                              </div>
                              <div>
                                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#888', marginBottom:4, textTransform:'uppercase' }}>Confirm UPI ID *</label>
                                <input value={upiConfirm} onChange={e=>{ setUpiConfirm(e.target.value); setUpiMismatch(false); }} placeholder="Re-enter UPI ID to confirm"
                                  style={{ width:'100%', height:36, border:`1px solid ${upiMismatch?'#dc2626':'#ddd'}`, borderRadius:6, padding:'0 10px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                              </div>
                              {upiMismatch && (
                                <div style={{ fontSize:12, color:'#dc2626', fontWeight:600 }}>⚠ UPI IDs do not match</div>
                              )}
                              {!upiMismatch && bankDetails.upiId && upiConfirm && bankDetails.upiId === upiConfirm && (
                                <div style={{ fontSize:12, color:'#16a34a', fontWeight:600 }}>✓ UPI IDs match</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <button onClick={handleSubmit} disabled={loading}
                      style={{ width:'100%', padding:'13px', borderRadius:8, background:'#FF5A1F', border:'none', color:'white', fontWeight:700, fontSize:15, cursor:'pointer', opacity:loading?0.7:1 }}>
                      {loading ? 'Submitting…' : 'Submit Return Request'}
                    </button>
                    <div style={{ fontSize:11, color:'#888', textAlign:'center', marginTop:10 }}>
                      By submitting, you agree to our return policy. Items must be in original condition.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, padding:'18px 20px' }}>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Return Summary</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:13 }}>
                  <div>
                    <div style={{ color:'#888', marginBottom:3 }}>Order</div>
                    <div style={{ fontWeight:600 }}>{selectedOrder ? `#${selectedOrder._id?.slice(-8).toUpperCase()}` : '—'}</div>
                  </div>
                  <div>
                    <div style={{ color:'#888', marginBottom:3 }}>Item</div>
                    <div style={{ fontWeight:600 }}>{selectedItem?.title || '—'}</div>
                    {selectedItem && <div style={{ color:'#888', fontSize:12 }}>Qty: {selectedItem.quantity} · {formatPriceShort(selectedItem.price * selectedItem.quantity)}</div>}
                  </div>
                  <div>
                    <div style={{ color:'#888', marginBottom:3 }}>Reason</div>
                    <div style={{ fontWeight:600 }}>{reason ? REASONS.find(r=>r.id===reason)?.label : '—'}</div>
                  </div>
                  <div>
                    <div style={{ color:'#888', marginBottom:3 }}>Resolution</div>
                    <div style={{ fontWeight:600 }}>{RESOLUTIONS.find(r=>r.id===resolution)?.label}</div>
                    <div style={{ fontSize:12, color:'#007600' }}>{RESOLUTIONS.find(r=>r.id===resolution)?.time}</div>
                  </div>
                </div>
              </div>

              <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, padding:'18px 20px' }}>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>📜 Return Policy</div>
                {[
                  ['✅', '10-day return window from delivery'],
                  ['✅', 'Free pickup for defective items'],
                  ['✅', 'Full refund for eligible returns'],
                  ['❌', 'Items must be unused & original packaging'],
                  ['❌', 'No return after 10 days of delivery'],
                ].map(([ic, txt]) => (
                  <div key={txt} style={{ display:'flex', gap:8, fontSize:12, color:'#444', marginBottom:8 }}>
                    <span>{ic}</span><span>{txt}</span>
                  </div>
                ))}
              </div>

              <div style={{ background:'white', border:'1px solid #ddd', borderRadius:8, padding:'18px 20px' }}>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Need Help?</div>
                <button style={{ display:'block', width:'100%', padding:'9px 14px', borderRadius:8, border:'1px solid #ddd', background:'white', fontSize:13, fontWeight:600, color:'#007185', cursor:'pointer', textAlign:'left', marginBottom:8 }}>
                  📞 Call Support
                </button>
                <button style={{ display:'block', width:'100%', padding:'9px 14px', borderRadius:8, border:'1px solid #ddd', background:'white', fontSize:13, fontWeight:600, color:'#007185', cursor:'pointer', textAlign:'left' }}>
                  💬 Live Chat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
