import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { returnsApi } from '../api/returns';
import { formatPriceShort, formatDate } from '../utils/formatters';

/* status pipeline — employee-first flow */
const REFUND_PIPELINE = [
  { key: 'REQUESTED',        label: 'Return Requested',   icon: '📤', desc: 'Your request has been received' },
  { key: 'APPROVED',         label: 'Approved',           icon: '✅', desc: 'Your return has been approved' },
  { key: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled',   icon: '🚚', desc: 'A pickup agent will collect the item' },
  { key: 'ITEM_RECEIVED',    label: 'Item Received',      icon: '📦', desc: 'Item reached our warehouse' },
  { key: 'REFUND_INITIATED', label: 'Refund Initiated',   icon: '💳', desc: 'Refund has been processed' },
  { key: 'REFUND_COMPLETED', label: 'Refund Completed',   icon: '🎉', desc: 'Money sent to your account' },
];

const REPLACEMENT_PIPELINE = [
  { key: 'REQUESTED',        label: 'Return Requested',   icon: '📤', desc: 'Your request has been received' },
  { key: 'APPROVED',         label: 'Approved',           icon: '✅', desc: 'Your return has been approved' },
  { key: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled',   icon: '🚚', desc: 'A pickup agent will collect the item' },
  { key: 'ITEM_RECEIVED',    label: 'Item Received',      icon: '📦', desc: 'Item reached our warehouse' },
  { key: 'REPLACEMENT_SENT', label: 'Replacement Sent',   icon: '🔄', desc: 'New item dispatched to you' },
  { key: 'COMPLETED',        label: 'Completed',          icon: '🎉', desc: 'Replacement delivered successfully' },
];

const STORE_CREDIT_PIPELINE = [
  { key: 'REQUESTED',        label: 'Return Requested',   icon: '📤', desc: 'Your request has been received' },
  { key: 'APPROVED',         label: 'Approved',           icon: '✅', desc: 'Your return has been approved' },
  { key: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled',   icon: '🚚', desc: 'A pickup agent will collect the item' },
  { key: 'ITEM_RECEIVED',    label: 'Item Received',      icon: '📦', desc: 'Item reached our warehouse' },
  { key: 'REFUND_COMPLETED', label: 'Credit Added',       icon: '🎁', desc: 'Store credit added to your account' },
];

const STATUS_META = {
  REQUESTED:        { label: 'Requested',        color: '#f59e0b', bg: '#fef3c7' },
  EMPLOYEE_APPROVED:  { label: 'Approved',          color: '#22c55e', bg: '#dcfce7' },
  EMPLOYEE_REJECTED:  { label: 'Under Review',      color: '#f59e0b', bg: '#fef3c7' },
  APPROVED:         { label: 'Approved',         color: '#22c55e', bg: '#dcfce7' },
  REJECTED:         { label: 'Rejected',         color: '#dc2626', bg: '#fee2e2' },
  PICKUP_SCHEDULED: { label: 'Pickup Scheduled', color: '#8b5cf6', bg: '#ede9fe' },
  ITEM_RECEIVED:    { label: 'Item Received',    color: '#06b6d4', bg: '#cffafe' },
  REFUND_INITIATED: { label: 'Refund Initiated', color: '#FF5A1F', bg: '#ffedd5' },
  REFUND_COMPLETED: { label: 'Refund Complete',  color: '#16a34a', bg: '#dcfce7' },
  REPLACEMENT_SENT: { label: 'Replacement Sent', color: '#8b5cf6', bg: '#ede9fe' },
  COMPLETED:        { label: 'Completed',        color: '#16a34a', bg: '#dcfce7' },
};

const REASONS = {
  defective: 'Defective / Not Working', wrong_item: 'Wrong Item Received',
  damaged: 'Damaged in Transit', not_as_described: 'Not as Described',
  changed_mind: 'Changed My Mind', missing_parts: 'Missing Parts/Accessories',
};

/* standalone input — must live OUTSIDE RefundMethodCard to avoid remount on every render */
const BankInp = ({ label, value, onChange, placeholder, disabled, error, onPaste }) => (
  <div>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 4, textTransform: 'uppercase' }}>{label}</label>
    <input value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} onPaste={onPaste}
      style={{ width: '100%', height: 36, border: `1px solid ${error ? '#dc2626' : '#ddd'}`, borderRadius: 6, padding: '0 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
  </div>
);

/* Refund Method Selector */
function RefundMethodCard({ ret, onUpdate }) {
  const defaultMode = ret.refundMethod === 'upi' ? 'upi' : 'bank_transfer';

  const [mode, setMode]     = useState(defaultMode);
  const [bank, setBank]     = useState(ret.bankDetails || {});
  const [accountConfirm, setAccountConfirm] = useState(ret.bankDetails?.accountNumber || '');
  const [accountMismatch, setAccountMismatch] = useState(false);
  const [saving, setSaving] = useState(false);

  const alreadySaved = ret.refundMethod && (
    ret.refundMethod === 'bank_transfer'
        ? !!ret.bankDetails?.accountNumber
        : !!ret.bankDetails?.upiId
  );
  const [done, setDone] = useState(!!alreadySaved);
  const [edit, setEdit] = useState(!alreadySaved);

  const setB = (k, v) => {
    setBank(b => ({ ...b, [k]: v }));
    if (k === 'accountNumber') {
      setAccountMismatch(accountConfirm !== '' && v !== accountConfirm);
    }
  };

  const canSave =
    (mode === 'bank_transfer' && bank.accountName && bank.accountNumber && bank.ifscCode && bank.accountNumber === accountConfirm) ||
    (mode === 'upi' && bank.upiId);

  const save = async () => {
    if (mode === 'bank_transfer' && bank.accountNumber !== accountConfirm) {
      setAccountMismatch(true);
      return;
    }
    setSaving(true);
    try {
      await returnsApi.updateRefundMethod(ret._id, { refundMethod: mode, bankDetails: bank });
      setDone(true); setEdit(false);
      onUpdate?.();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const blocked = ['REFUND_INITIATED', 'REFUND_COMPLETED', 'COMPLETED', 'REJECTED'].includes(ret.status);

  const OPT = ({ id, icon, title, sub }) => (
    <div onClick={() => !blocked && setMode(id)}
      style={{ border: `2px solid ${mode === id ? '#FF5A1F' : '#e5e7eb'}`, borderRadius: 8, padding: '12px 16px',
        cursor: blocked ? 'default' : 'pointer', background: mode === id ? '#fff8f0' : 'white',
        display: 'flex', alignItems: 'center', gap: 12, transition: 'all .15s' }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: mode === id ? '#FF5A1F' : '#f0f0f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${mode === id ? '#FF5A1F' : '#ccc'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {mode === id && <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF5A1F' }} />}
      </div>
    </div>
  );

  if (!edit && done) return (
    <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 8, padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>💳 Refund Method</div>
        <span style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>Locked after submission</span>
      </div>
      <div style={{ fontSize: 13, color: '#333' }}>
        {mode === 'bank_transfer' && <span>🏦 Bank Transfer — <strong>{bank.bankName} ···{bank.accountNumber?.slice(-4)}</strong> ({bank.accountName})</span>}
        {mode === 'upi' && <span>📱 UPI — <strong>{bank.upiId}</strong></span>}
      </div>
      <div style={{ fontSize: 12, color: '#007600', marginTop: 6 }}>
        Refund amount: <strong>{formatPriceShort(ret.refundAmount)}</strong>
        {mode === 'upi' ? ' · Within 24 hours' : ' · 3–5 business days'}
      </div>
    </div>
  );

  return (
    <div style={{ background: 'white', border: '2px solid #FF5A1F', borderRadius: 8, padding: '18px 20px' }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>💳 How would you like your refund?</div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
        Refund amount: <strong style={{ color: '#FF5A1F' }}>{formatPriceShort(ret.refundAmount)}</strong>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <OPT id="bank_transfer" icon="🏦" title="Bank Transfer" sub="Direct transfer to your bank account · 3–5 business days" />
        <OPT id="upi" icon="📱" title="UPI Transfer" sub="Instant transfer to your UPI ID · Within 24 hours" />
      </div>

      {mode === 'bank_transfer' && (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><BankInp label="Account Holder Name *" value={bank.accountName || ''} onChange={e => setB('accountName', e.target.value)} placeholder="As per bank records" disabled={blocked} /></div>
            <div style={{ flex: 1 }}><BankInp label="Bank Name *" value={bank.bankName || ''} onChange={e => setB('bankName', e.target.value)} placeholder="Everest Bank Limited" disabled={blocked} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><BankInp label="Account Number *" value={bank.accountNumber || ''} onChange={e => setB('accountNumber', e.target.value)} placeholder="00100456789012" disabled={blocked} error={accountMismatch} /></div>
            <div style={{ flex: 1 }}><BankInp label="Branch Name *" value={bank.ifscCode || ''} onChange={e => setB('ifscCode', e.target.value)} placeholder="Putalisadak Branch" disabled={blocked} /></div>
          </div>
          <div>
            <BankInp
              label="Confirm Account Number *"
              value={accountConfirm}
              onChange={e => {
                const v = e.target.value;
                setAccountConfirm(v);
                setAccountMismatch(v !== '' && (bank.accountNumber || '') !== v);
              }}
              onPaste={e => e.preventDefault()}
              placeholder="Re-enter account number"
              disabled={blocked}
              error={accountMismatch}
            />
            {accountMismatch && (
              <div style={{ color:'#dc2626', fontSize:11, marginTop:4 }}>Account numbers do not match.</div>
            )}
          </div>
        </div>
      )}

      {mode === 'upi' && (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
          <BankInp label="UPI ID *" value={bank.upiId || ''} onChange={e => setB('upiId', e.target.value)} placeholder="yourname@paytm / @gpay / @ybl" disabled={blocked} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={save} disabled={saving || !canSave}
          style={{ flex: 1, padding: '10px', background: canSave ? '#FFD814' : '#f0f0f0', border: '1px solid', borderColor: canSave ? '#FBA131' : '#ddd',
            borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: canSave ? 'pointer' : 'not-allowed', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : 'Confirm Refund Method'}
        </button>
        {done && <button onClick={() => setEdit(false)} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #ddd', background: 'white', fontSize: 13, cursor: 'pointer', color: '#555' }}>Cancel</button>}
      </div>
    </div>
  );
}

/* Progress Tracker */
function Tracker({ status, resolution }) {
  const pipeline =
    resolution === 'replacement' ? REPLACEMENT_PIPELINE :
    resolution === 'store_credit' ? STORE_CREDIT_PIPELINE : REFUND_PIPELINE;

  const mappedStatus = status === 'EMPLOYEE_APPROVED' ? 'APPROVED' : status;
  const activeIdx = pipeline.findIndex(p => p.key === mappedStatus);
  const isRejected = ['REJECTED', 'EMPLOYEE_REJECTED'].includes(status);

  return (
    <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 8, padding: '24px 20px' }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 24, color: '#333' }}>Return Progress</div>

      {isRejected && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#dc2626', fontWeight: 600, fontSize: 13 }}>
          ❌ This return was {status === 'EMPLOYEE_REJECTED' ? 'rejected by the employee' : 'rejected'}. Contact support to appeal.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {pipeline.map((stage, i) => {
          const done   = activeIdx !== -1 && i < activeIdx;
          const active = i === activeIdx && !isRejected;
          const future = i > activeIdx || isRejected;

          return (
            <div key={stage.key} style={{ display: 'flex', gap: 16 }}>
              {/* Left: icon + line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 44, flexShrink: 0 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: done ? '#22c55e' : active ? '#FF5A1F' : '#e5e7eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: done ? 18 : 20,
                  boxShadow: active ? '0 0 0 4px #FF5A1F22' : 'none',
                  border: active ? '3px solid #FF5A1F' : 'none',
                  transition: 'all .3s', zIndex: 1,
                }}>
                  {done ? <span style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>✓</span> : <span style={{ filter: future ? 'grayscale(1) opacity(.4)' : 'none' }}>{stage.icon}</span>}
                </div>
                {i < pipeline.length - 1 && (
                  <div style={{ width: 3, flex: 1, minHeight: 28, background: done ? '#22c55e' : '#e5e7eb', borderRadius: 2, margin: '2px 0' }} />
                )}
              </div>

              {/* Right: text */}
              <div style={{ flex: 1, paddingBottom: i < pipeline.length - 1 ? 20 : 0, paddingTop: 10 }}>
                <div style={{ fontWeight: active ? 800 : done ? 600 : 500, fontSize: active ? 15 : 14,
                  color: active ? '#FF5A1F' : done ? '#15803d' : '#9ca3af' }}>
                  {stage.label}
                </div>
                <div style={{ fontSize: 12, color: active ? '#555' : '#aaa', marginTop: 2 }}>
                  {stage.desc}
                </div>
                {active && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
                    background: '#fff8f0', border: '1px solid #ffedd5', borderRadius: 20, padding: '3px 10px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF5A1F', animation: 'pulse 1.5s infinite' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#FF5A1F' }}>Current Status</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Timeline */
function Timeline({ events }) {
  if (!events?.length) return null;
  return (
    <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 8, padding: '18px 20px' }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#333' }}>Activity Log</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {[...events].reverse().map((ev, i, arr) => (
          <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: i < arr.length - 1 ? 16 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? '#FF5A1F' : '#d1d5db', marginTop: 3, flexShrink: 0 }} />
              {i < arr.length - 1 && <div style={{ width: 1, background: '#e5e7eb', flex: 1, marginTop: 3, minHeight: 20 }} />}
            </div>
            <div style={{ flex: 1, paddingBottom: i < arr.length - 1 ? 4 : 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? '#FF5A1F' : '#333' }}>
                {ev.status?.replace(/_/g, ' ')}
              </div>
              {ev.note && <div style={{ fontSize: 12, color: '#666', marginTop: 1 }}>{ev.note}</div>}
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                {formatDate(ev.at)} · {ev.by}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Main Page */
/* Refund Proof Lightbox */
function ProofModal({ proof, onClose }) {
  const [idx, setIdx] = useState(0);
  if (!proof?.length) return null;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'white', borderRadius:12, padding:24, maxWidth:520, width:'90vw' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:15 }}>🧾 Refund Proof ({proof.length} image{proof.length!==1?'s':''})</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#888', lineHeight:1 }}>×</button>
        </div>
        <img src={proof[idx].url} alt={`Proof ${idx+1}`}
          style={{ width:'100%', maxHeight:360, objectFit:'contain', borderRadius:8, border:'1px solid #ddd', display:'block' }} />
        {proof.length > 1 && (
          <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'center', flexWrap:'wrap' }}>
            {proof.map((p, i) => (
              <img key={i} src={p.url} alt="" onClick={() => setIdx(i)}
                style={{ width:56, height:56, objectFit:'cover', borderRadius:6, border: i===idx ? '2px solid #FF5A1F' : '2px solid #ddd', cursor:'pointer' }} />
            ))}
          </div>
        )}
        <div style={{ fontSize:11, color:'#aaa', marginTop:10, textAlign:'center' }}>
          Uploaded by {proof[idx].uploadedBy} · {proof[idx].uploadedAt ? new Date(proof[idx].uploadedAt).toLocaleDateString('en-IN') : ''}
        </div>
      </div>
    </div>
  );
}

export default function ReturnStatusPage() {
  const { returnId } = useParams();
  const navigate     = useNavigate();
  const { user }     = useAuth();

  const [ret, setRet]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [proofOpen, setProofOpen] = useState(false);

  const load = useCallback(() => {
    if (!returnId) return;
    returnsApi.getById(returnId)
      .then(r => setRet(r.data?.data?.returnRequest || null))
      .catch(e => setError(e?.response?.data?.message || 'Failed to load return details'))
      .finally(() => setLoading(false));
  }, [returnId]);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    load();
  }, [user, load]);

  if (!user) return null;

  if (loading) return (
    <div style={{ background: '#f0f2f2', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
        <div style={{ fontWeight: 600 }}>Loading return details…</div>
      </div>
    </div>
  );

  if (error || !ret) return (
    <div style={{ background: '#f0f2f2', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
        <div style={{ fontWeight: 600, marginBottom: 16 }}>{error || 'Return not found'}</div>
        <button onClick={() => navigate('/returns')} style={{ padding: '9px 24px', borderRadius: 20, background: '#FFD814', border: '1px solid #FBA131', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          My Returns
        </button>
      </div>
    </div>
  );

  const sm = STATUS_META[ret.status] || STATUS_META.REQUESTED;
  const order = ret.order;
  const isRefund = ret.resolution === 'refund' || ret.resolution === 'store_credit';
  const isTerminal = ['REFUND_COMPLETED', 'REPLACEMENT_SENT', 'COMPLETED', 'REJECTED', 'EMPLOYEE_REJECTED'].includes(ret.status);
  const needsRefundMethod = isRefund && !['REJECTED', 'EMPLOYEE_REJECTED'].includes(ret.status) && !['REFUND_COMPLETED', 'COMPLETED'].includes(ret.status);

  return (
    <div style={{ background: '#f0f2f2', minHeight: '100vh', padding: '24px 0 60px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '0 16px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13 }}>
          <button onClick={() => navigate('/orders')} style={{ background: 'none', border: 'none', color: '#007185', cursor: 'pointer', fontWeight: 600, padding: 0 }}>Your Orders</button>
          <span style={{ color: '#ccc' }}>/</span>
          <button onClick={() => navigate('/returns')} style={{ background: 'none', border: 'none', color: '#007185', cursor: 'pointer', fontWeight: 600, padding: 0 }}>Returns</button>
          <span style={{ color: '#ccc' }}>/</span>
          <span style={{ color: '#888' }}>#{ret._id?.slice(-8).toUpperCase()}</span>
        </div>

        {/* Header card */}
        <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 8, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Return #{ret._id?.slice(-8).toUpperCase()}</h1>
              <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                Submitted {formatDate(ret.createdAt)}
                {' · '}Resolution: <strong style={{ textTransform: 'capitalize' }}>{ret.resolution?.replace('_', ' ')}</strong>
              </div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99,
              background: sm.bg, color: sm.color, fontWeight: 700, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: sm.color }} />
              {sm.label}
            </span>
          </div>

          {/* Item row */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            {ret.product?.images?.[0]
              ? <img src={ret.product.images[0]} alt="" style={{ width: 64, height: 64, objectFit: 'contain', border: '1px solid #ddd', borderRadius: 6 }} />
              : <div style={{ width: 64, height: 64, background: '#f0f0f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📦</div>
            }
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{ret.product?.title || 'Product'}</div>
              <div style={{ fontSize: 13, color: '#666', marginTop: 3 }}>
                Reason: <strong>{REASONS[ret.reason] || ret.reason}</strong>
              </div>
              {ret.description && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>"{ret.description}"</div>}
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em' }}>Refund Value</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#B12704' }}>{formatPriceShort(ret.refundAmount)}</div>
            </div>
          </div>
        </div>

        {/* Completed / Rejected banner */}
        {isTerminal && !['REJECTED','EMPLOYEE_REJECTED'].includes(ret.status) && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 32 }}>🎉</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#15803d' }}>
                {ret.resolution === 'replacement' ? 'Replacement Dispatched!' : 'Refund Completed!'}
              </div>
              <div style={{ fontSize: 13, color: '#166534', marginTop: 2 }}>
                {ret.resolution === 'replacement'
                  ? 'Your replacement item has been shipped. Track it in My Orders.'
                  : `Rs. ${Number(ret.refundAmount || 0).toLocaleString('en-IN')} has been refunded to your ${ret.refundMethod === 'bank_transfer' ? 'bank account' : ret.refundMethod === 'upi' ? 'UPI ID' : 'original payment method'}.`}
              </div>
            </div>
          </div>
        )}

        <div className="r-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Refund method card — show when relevant */}
            {needsRefundMethod && (
              <RefundMethodCard ret={ret} onUpdate={load} />
            )}

            {/* Progress tracker */}
            <Tracker status={ret.status} resolution={ret.resolution} />

            {/* Timeline */}
            <Timeline events={ret.timeline} />
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Order info */}
            <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 8, padding: '18px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📋 Order Details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Order #</span>
                  <span style={{ fontWeight: 600 }}>{order?.orderNumber || order?._id?.slice(-8).toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Ordered on</span>
                  <span style={{ fontWeight: 600 }}>{formatDate(order?.createdAt)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Payment</span>
                  <span style={{ fontWeight: 600 }}>{order?.paymentMethod}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Order Total</span>
                  <span style={{ fontWeight: 700 }}>{formatPriceShort(order?.totalPrice)}</span>
                </div>
                <div style={{ borderTop: '1px solid #eee', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Refund Amount</span>
                  <span style={{ fontWeight: 800, color: '#B12704' }}>{formatPriceShort(ret.refundAmount)}</span>
                </div>
              </div>
              <button onClick={() => navigate(`/track?id=${order?._id}`)}
                style={{ marginTop: 14, width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: 6, background: 'white', fontSize: 13, fontWeight: 600, color: '#007185', cursor: 'pointer' }}>
                View Original Order →
              </button>
            </div>

            {/* Refund method summary (if set) */}
            {ret.refundMethod && !needsRefundMethod && (
              <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 8, padding: '18px 20px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>💳 Refund To</div>
                <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>
                  {ret.refundMethod === 'bank_transfer' && (
                    <>
                      <div style={{ color: '#888' }}>Bank Account</div>
                      <div style={{ fontWeight: 600 }}>{ret.bankDetails?.accountName}</div>
                      <div>{ret.bankDetails?.bankName} — ···{ret.bankDetails?.accountNumber?.slice(-4)}</div>
                      <div style={{ color: '#888', fontSize: 12 }}>Branch: {ret.bankDetails?.ifscCode}</div>
                    </>
                  )}
                  {ret.refundMethod === 'upi' && (
                    <>
                      <div style={{ color: '#888' }}>UPI ID</div>
                      <div style={{ fontWeight: 600 }}>{ret.bankDetails?.upiId}</div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {(ret.employeeNote || ret.adminNote) && (
              <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 8, padding: '18px 20px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📝 Notes</div>
                {ret.employeeNote && (
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 3 }}>From Our Team</div>
                    <div style={{ color: '#333' }}>{ret.employeeNote}</div>
                  </div>
                )}
                {ret.adminNote && (
                  <div style={{ fontSize: 13 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 3 }}>From Support</div>
                    <div style={{ color: '#333' }}>{ret.adminNote}</div>
                  </div>
                )}
              </div>
            )}

            {/* Refund proof */}
            {ret.refundProof?.length > 0 && (
              <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 8, padding: '18px 20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>🧾 Refund Proof</div>
                  <button onClick={() => setProofOpen(true)}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:20, background:'#f0f9ff', border:'1px solid #0ea5e933', fontSize:12, fontWeight:700, color:'#0369a1', cursor:'pointer' }}>
                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M1 12C1 12 5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                    View {ret.refundProof.length} screenshot{ret.refundProof.length!==1?'s':''}
                  </button>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {ret.refundProof.map((p, i) => (
                    <img key={i} src={p.url} alt={`proof ${i+1}`} onClick={() => setProofOpen(true)}
                      style={{ width:52, height:52, objectFit:'cover', borderRadius:6, border:'1px solid #ddd', cursor:'pointer' }} />
                  ))}
                </div>
              </div>
            )}
            {proofOpen && <ProofModal proof={ret.refundProof} onClose={() => setProofOpen(false)} />}

            {/* Help */}
            <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 8, padding: '18px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Need Help?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button style={{ textAlign: 'left', padding: '9px 14px', border: '1px solid #ddd', borderRadius: 8, background: 'white', fontSize: 13, fontWeight: 600, color: '#007185', cursor: 'pointer' }}>
                  📞 Contact Support
                </button>
                <button onClick={() => navigate('/returns')} style={{ textAlign: 'left', padding: '9px 14px', border: '1px solid #ddd', borderRadius: 8, background: 'white', fontSize: 13, fontWeight: 600, color: '#007185', cursor: 'pointer' }}>
                  ↩️ All My Returns
                </button>
                <button onClick={() => navigate('/orders')} style={{ textAlign: 'left', padding: '9px 14px', border: '1px solid #ddd', borderRadius: 8, background: 'white', fontSize: 13, fontWeight: 600, color: '#007185', cursor: 'pointer' }}>
                  📦 My Orders
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
