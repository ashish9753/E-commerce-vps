import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { supportApi } from '../api/support';
import { ordersApi } from '../api/orders';
import SupportIcon from '../components/icons/SupportIcon';
import { COMPANY } from '../config/company';
import { loginNavState } from '../utils/authRedirect';

/* palette */
const C = {
  orange: '#FF5A1F',
  orangeLight: '#fff3ee',
  blue:   '#2563eb',
  green:  '#16a34a',
  amber:  '#d97706',
  gray:   '#6b7280',
  bg:     '#f0f4f8',
  white:  '#ffffff',
  border: '#e5e7eb',
  text:   '#111827',
  muted:  '#6b7280',
  chatBg: '#f0f2f5',
};

const STATUS_META = {
  OPEN:        { label: 'Open',        color: '#2563eb', bg: '#eff6ff' },
  IN_PROGRESS: { label: 'In Progress', color: '#d97706', bg: '#fffbeb' },
  RESOLVED:    { label: 'Resolved',    color: '#16a34a', bg: '#f0fdf4' },
  CLOSED:      { label: 'Closed',      color: '#6b7280', bg: '#f3f4f6' },
};

const ORDER_STATUS_META = {
  PLACED:           { label: 'Placed',           color: '#d97706' },
  CONFIRMED:        { label: 'Confirmed',         color: '#2563eb' },
  PACKED:           { label: 'Packed',            color: '#7c3aed' },
  SHIPPED:          { label: 'Shipped',           color: '#0891b2' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery',  color: '#FF5A1F' },
  DELIVERED:        { label: 'Delivered',         color: '#16a34a' },
  CANCELLED:        { label: 'Cancelled',         color: '#dc2626' },
  RETURNED:         { label: 'Returned',          color: '#6b7280' },
};

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 700);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 700);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

function StatusBadge({ status, small }) {
  const m = STATUS_META[status] || STATUS_META.OPEN;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: small ? 10 : 11, fontWeight: 700,
      padding: small ? '2px 7px' : '3px 9px', borderRadius: 99,
      background: m.bg, color: m.color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.color }} />
      {m.label}
    </span>
  );
}

/* NEW TICKET MODAL */
function NewTicketModal({ onClose, onCreated, prefillOrderId = '' }) {
  const [subject, setSubject]   = useState('');
  const [message, setMessage]   = useState('');
  const [orderId, setOrderId]   = useState(prefillOrderId);
  const [orders, setOrders]     = useState([]);
  const [loadingOrders, setLO]  = useState(true);
  const [pickerOpen, setPicker] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const fn = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPicker(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [pickerOpen]);

  useEffect(() => {
    ordersApi.getMy({ limit: 50 }).then(res => {
      const list = res.data?.data?.data || res.data?.data || [];
      setOrders(list);
      if (prefillOrderId && !list.find(o => o._id === prefillOrderId)) setOrderId('');
    }).catch(() => {}).finally(() => setLO(false));
  }, []);

  const submit = async () => {
    if (!orderId) { setError('Please select the order this ticket is about.'); return; }
    if (!subject.trim() || !message.trim()) { setError('Subject and message are required.'); return; }
    setSaving(true); setError('');
    try {
      const res = await supportApi.createTicket({ subject: subject.trim(), message: message.trim(), orderId });
      onCreated(res.data?.data?.ticket);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to create ticket.');
    } finally { setSaving(false); }
  };

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtRs   = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
  const selected = orders.find(o => o._id === orderId);

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 500,
          boxShadow: '0 20px 60px rgba(0,0,0,.18)', overflow: 'hidden',
          maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ background: '#131921', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Open a Support Ticket</div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11, marginTop: 2 }}>Typically answered within 24 hours</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
          {/* Order picker */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              Which order is this about? <span style={{ color: '#dc2626' }}>*</span>
            </label>
            {loadingOrders ? (
              <div style={{ height: 48, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 14px', fontSize: 13, color: '#9ca3af' }}>Loading orders…</div>
            ) : orders.length === 0 ? (
              <div style={{ padding: '10px 14px', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', background: '#fef2f2' }}>
                You have no orders to raise a ticket for.
              </div>
            ) : (
              <div style={{ position: 'relative' }} ref={pickerRef}>
                <button type="button" onClick={() => setPicker(v => !v)}
                  style={{ width: '100%', border: `1.5px solid ${orderId ? C.border : '#fca5a5'}`, borderRadius: 8,
                    padding: '8px 12px', background: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', outline: 'none' }}>
                  {selected ? (
                    <>
                      <div style={{ display: 'flex', flexShrink: 0 }}>
                        {(selected.orderItems || []).slice(0, 2).map((item, i) => (
                          <div key={i} style={{ width: 36, height: 36, borderRadius: 6, border: '2px solid #fff',
                            marginLeft: i === 0 ? 0 : -8, background: '#f3f4f6', overflow: 'hidden',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.image ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 16 }}>📦</span>}
                          </div>
                        ))}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>#{selected._id.slice(-8).toUpperCase()}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>
                          {fmtRs(selected.totalPrice)} · {fmtDate(selected.createdAt)}
                          <span style={{ marginLeft: 6, fontWeight: 700, color: ORDER_STATUS_META[selected.orderStatus]?.color || '#6b7280' }}>
                            {ORDER_STATUS_META[selected.orderStatus]?.label || selected.orderStatus}
                          </span>
                        </div>
                      </div>
                      <span style={{ color: '#9ca3af', fontSize: 10 }}>▼</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 18 }}>🛍️</span>
                      <span style={{ fontSize: 13, color: '#9ca3af', flex: 1 }}>— Select an order —</span>
                      <span style={{ color: '#9ca3af', fontSize: 10 }}>▼</span>
                    </>
                  )}
                </button>
                {pickerOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
                    background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,.1)', maxHeight: 260, overflowY: 'auto' }}>
                    {orders.map(o => {
                      const sMeta = ORDER_STATUS_META[o.orderStatus] || {};
                      const isSel = o._id === orderId;
                      return (
                        <div key={o._id} onClick={() => { setOrderId(o._id); setPicker(false); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                            cursor: 'pointer', background: isSel ? '#fff3ee' : '#fff',
                            borderBottom: `1px solid #f3f4f6` }}
                          onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#f9fafb'; }}
                          onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = '#fff'; }}>
                          <div style={{ display: 'flex', flexShrink: 0 }}>
                            {(o.orderItems || []).slice(0, 2).map((item, i) => (
                              <div key={i} style={{ width: 38, height: 38, borderRadius: 6,
                                border: `2px solid ${isSel ? C.orange : '#fff'}`,
                                marginLeft: i === 0 ? 0 : -10, background: '#f3f4f6', overflow: 'hidden',
                                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {item.image ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 18 }}>📦</span>}
                              </div>
                            ))}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>#{o._id.slice(-8).toUpperCase()}</div>
                            <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {(o.orderItems || []).map(i => i.title).filter(Boolean).slice(0, 2).join(', ')}
                            </div>
                            <div style={{ fontSize: 11, color: sMeta.color || '#6b7280', fontWeight: 600 }}>
                              {fmtRs(o.totalPrice)} · {sMeta.label || o.orderStatus}
                            </div>
                          </div>
                          {isSel && <span style={{ color: C.orange, fontSize: 16, flexShrink: 0 }}>✓</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
              Subject <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. My order hasn't arrived yet"
              style={{ width: '100%', height: 38, border: `1px solid ${C.border}`, borderRadius: 8, padding: '0 12px',
                fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
              Message <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
              placeholder="Describe your issue in detail…"
              style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px',
                fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          {error && (
            <div style={{ color: '#dc2626', fontSize: 12, fontWeight: 600, marginBottom: 12,
              padding: '8px 12px', background: '#fef2f2', borderRadius: 8 }}>{error}</div>
          )}

          <button onClick={submit} disabled={saving || loadingOrders || orders.length === 0}
            style={{ width: '100%', padding: '11px 0', borderRadius: 9, background: C.orange, color: '#fff',
              border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              opacity: (saving || loadingOrders || orders.length === 0) ? 0.6 : 1 }}>
            {saving ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* CHAT PANEL  (with SSE bug fixes + polling) */
function ChatPanel({ ticket, onBack, onUpdated }) {
  const { user }                           = useAuth();
  const { lastSupportMsg, sseReconnectCount } = useNotifications();
  const [reply, setReply]  = useState('');
  const [sending, setSend] = useState(false);
  const [error, setError]  = useState('');
  const [mode, setMode]    = useState('message'); // 'message' | 'call'
  const bottomRef          = useRef(null);

  /* Always-fresh refs to avoid stale closures */
  const ticketRef    = useRef(ticket);
  const onUpdatedRef = useRef(onUpdated);
  useEffect(() => { ticketRef.current    = ticket;    }, [ticket]);
  useEffect(() => { onUpdatedRef.current = onUpdated; }, [onUpdated]);

  /* Scroll to bottom on new messages */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages?.length]);

  /* SSE: append incoming message (uses ref, never stale) */
  useEffect(() => {
    if (!lastSupportMsg) return;
    if (lastSupportMsg.ticketId !== ticketRef.current?._id) return;
    const cur = ticketRef.current;
    const alreadyExists = (cur.messages || []).some(
      m => m._id && m._id === lastSupportMsg.message?._id
    );
    if (alreadyExists) return;
    onUpdatedRef.current({
      ...cur,
      status:   lastSupportMsg.status,
      messages: [...(cur.messages || []), lastSupportMsg.message],
    });
  }, [lastSupportMsg]);

  /* Re-fetch on SSE reconnect (catches messages missed during gap) */
  useEffect(() => {
    if (sseReconnectCount === 0) return;
    supportApi.getTicket(ticketRef.current._id)
      .then(r => { const t = r.data?.data?.ticket; if (t) onUpdatedRef.current(t); })
      .catch(() => {});
  }, [sseReconnectCount]);

  /* Periodic poll: 25s fallback so user never waits for a page reload */
  useEffect(() => {
    const id = setInterval(() => {
      supportApi.getTicket(ticketRef.current._id)
        .then(r => {
          const fresh = r.data?.data?.ticket;
          if (!fresh) return;
          const curLen   = ticketRef.current?.messages?.length ?? 0;
          const freshLen = fresh.messages?.length ?? 0;
          if (freshLen !== curLen || fresh.status !== ticketRef.current?.status) {
            onUpdatedRef.current(fresh);
          }
        })
        .catch(() => {});
    }, 25_000);
    return () => clearInterval(id);
  }, [ticket._id]); // only re-create when ticket changes, not on every render

  /* Re-fetch when user switches back to this tab */
  useEffect(() => {
    const fn = () => {
      if (document.visibilityState !== 'visible') return;
      supportApi.getTicket(ticketRef.current._id)
        .then(r => { const t = r.data?.data?.ticket; if (t) onUpdatedRef.current(t); })
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', fn);
    return () => document.removeEventListener('visibilitychange', fn);
  }, []);

  const send = async () => {
    if (!reply.trim()) return;
    setSend(true); setError('');
    try {
      const res = await supportApi.replyToTicket(ticket._id, { message: reply.trim() });
      setReply('');
      onUpdatedRef.current(res.data?.data?.ticket);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to send. Try again.');
    } finally { setSend(false); }
  };

  const isClosed      = ['RESOLVED', 'CLOSED'].includes(ticket.status);
  const isUserRole    = user?.role !== 'admin';
  const hasAdminReply = (ticket.messages || []).some(m => m.senderRole === 'admin');
  const waitingForTeam = isUserRole && !hasAdminReply && !isClosed;

  const SUPPORT_PHONE = COMPANY.supportPhone;
  const SUPPORT_HOURS = COMPANY.hours;

  return (
    <div style={{
      background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 180px)', minHeight: 500, maxHeight: 680,
    }}>
      {/* ── Header ── */}
      <div style={{
        background: '#fff', borderBottom: `1px solid ${C.border}`,
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        {onBack && (
          <button onClick={onBack}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280', lineHeight: 1, padding: '0 4px', flexShrink: 0 }}>
            ←
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>
            {ticket.subject}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
            #{ticket._id?.slice(-8).toUpperCase()}
            {ticket.order && ` · Order #${ticket.order.orderNumber || ticket.order._id?.slice(-8).toUpperCase()}`}
          </div>
        </div>

        {/* Mode toggle — compact pill */}
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 2, gap: 1, flexShrink: 0 }}>
          {[{ id: 'message', icon: '💬' }, { id: 'call', icon: '📞' }].map(opt => (
            <button key={opt.id} onClick={() => setMode(opt.id)}
              style={{
                padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                background: mode === opt.id ? '#fff' : 'transparent',
                color:      mode === opt.id ? C.orange : '#6b7280',
                boxShadow:  mode === opt.id ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
              }}>
              {opt.icon}
            </button>
          ))}
        </div>

        <StatusBadge status={ticket.status} small />
      </div>

      {/* ── Call view ── */}
      {mode === 'call' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.chatBg, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px 36px', textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,.07)', border: `1px solid ${C.border}`, width: '100%', maxWidth: 320 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#dcfce7',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px' }}>
              📞
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4, color: C.text }}>Call Support</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>Available during business hours</div>
            <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}
              style={{ display: 'block', textDecoration: 'none', background: '#f0fdf4',
                border: '2px solid #86efac', borderRadius: 10, padding: '14px 20px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Phone Number</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>{SUPPORT_PHONE}</div>
            </a>
            <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.7 }}>🕐 {SUPPORT_HOURS}</div>
            <button onClick={() => setMode('message')}
              style={{ marginTop: 18, background: 'none', border: `1px solid ${C.border}`, borderRadius: 7,
                padding: '7px 18px', fontSize: 12, fontWeight: 600, color: '#555', cursor: 'pointer' }}>
              Back to messages
            </button>
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      {mode === 'message' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', background: C.chatBg,
          display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          {(ticket.messages || []).length === 0 && (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 40 }}>
              No messages yet. Type below to send the first message.
            </div>
          )}
          {(ticket.messages || []).map((msg, i) => {
            const isMe    = msg.sender?._id === user?._id || msg.sender === user?._id;
            const isAdmin = msg.senderRole === 'admin';
            const showAvatar = !isMe;
            return (
              <div key={msg._id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                {showAvatar && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: isAdmin ? '#7c3aed' : '#6b7280',
                    marginBottom: 3, paddingLeft: 2 }}>
                    {isAdmin ? '🛡️ Support Team' : (msg.sender?.name || 'You')}
                  </div>
                )}
                <div style={{ maxWidth: '74%' }}>
                  <div style={{
                    padding: '9px 13px',
                    borderRadius: isMe ? '16px 16px 3px 16px' : '3px 16px 16px 16px',
                    background: isMe ? C.orange : '#fff',
                    color: isMe ? '#fff' : C.text,
                    border: isMe ? 'none' : `1px solid ${C.border}`,
                    fontSize: 13, lineHeight: 1.55,
                    boxShadow: '0 1px 2px rgba(0,0,0,.06)',
                    wordBreak: 'break-word',
                  }}>
                    {msg.text}
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3,
                    textAlign: isMe ? 'right' : 'left', paddingLeft: 2 }}>
                    {new Date(msg.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── Reply box / status footer ── */}
      {mode === 'message' && (
        isClosed ? (
          <div style={{ background: '#f9fafb', borderTop: `1px solid ${C.border}`, padding: '12px 16px',
            textAlign: 'center', color: '#9ca3af', fontSize: 12, flexShrink: 0 }}>
            This ticket is {ticket.status === 'RESOLVED' ? 'resolved' : 'closed'}. No further replies.
          </div>
        ) : waitingForTeam ? (
          <div style={{ background: '#fffbeb', borderTop: `1px solid #fde68a`, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>⏳</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#92400e' }}>Waiting for our support team</div>
              <div style={{ fontSize: 11, color: '#b45309', marginTop: 1 }}>
                You can reply once a support agent responds to your ticket.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderTop: `1px solid ${C.border}`, padding: '10px 12px', flexShrink: 0 }}>
            {error && <div style={{ color: '#dc2626', fontSize: 11, marginBottom: 6 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Type a message… (Enter ↵ to send)"
                rows={2}
                style={{
                  flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 9,
                  padding: '9px 13px', fontSize: 13, resize: 'none', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5,
                  maxHeight: 100, overflowY: 'auto',
                  transition: 'border-color .15s',
                }}
                onFocus={e => { e.target.style.borderColor = C.orange; }}
                onBlur={e => { e.target.style.borderColor = C.border; }}
              />
              <button onClick={send} disabled={sending || !reply.trim()}
                style={{
                  background: (sending || !reply.trim()) ? '#e5e7eb' : C.orange,
                  color: (sending || !reply.trim()) ? '#9ca3af' : '#fff',
                  border: 'none', borderRadius: 9, padding: '10px 16px',
                  fontWeight: 700, fontSize: 13, cursor: (sending || !reply.trim()) ? 'not-allowed' : 'pointer',
                  flexShrink: 0, transition: 'all .15s', whiteSpace: 'nowrap',
                }}>
                {sending ? '…' : '↑ Send'}
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* TICKET SIDEBAR (left panel) */
function TicketSidebar({ tickets, loading, activeId, onSelect }) {
  if (loading) {
    return (
      <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`,
        padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
        Loading tickets…
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`,
        padding: '32px 20px', textAlign: 'center' }}>
        <SupportIcon size={36} color="#9ca3af" />
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 12 }}>No tickets yet</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Open a ticket to get help</div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px 8px', borderBottom: `1px solid #f3f4f6` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.07em' }}>
          Your Tickets ({tickets.length})
        </div>
      </div>
      <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
        {tickets.map(t => {
          const isActive = t._id === activeId;
          const m = STATUS_META[t.status] || STATUS_META.OPEN;
          return (
            <div key={t._id} onClick={() => onSelect(t._id)}
              style={{
                padding: '12px 14px', cursor: 'pointer',
                borderBottom: `1px solid #f9fafb`,
                borderLeft: isActive ? `3px solid ${C.orange}` : '3px solid transparent',
                background: isActive ? C.orangeLight : '#fff',
                transition: 'all .12s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f9fafb'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '#fff'; }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: isActive ? '#ffe4d6' : '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <SupportIcon size={16} color={isActive ? C.orange : '#9ca3af'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: isActive ? C.text : '#374151',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                    {t.subject}
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>
                    #{t._id?.slice(-8).toUpperCase()}
                    {t.order && ` · #${t.order.orderNumber || t.order._id?.slice(-8).toUpperCase()}`}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: m.bg, color: m.color }}>
                      {m.label}
                    </span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>
                      {new Date(t.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* EMPTY STATE (desktop right panel — no ticket) */
function EmptyPanel() {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: 'calc(100vh - 180px)', minHeight: 400, textAlign: 'center', padding: 40 }}>
      <SupportIcon size={52} color="#d1d5db" />
      <div style={{ fontWeight: 700, fontSize: 15, color: '#374151', marginTop: 20, marginBottom: 8 }}>
        Select a ticket to view the conversation
      </div>
      <div style={{ fontSize: 13, color: '#9ca3af', maxWidth: 280, lineHeight: 1.6 }}>
        Choose a ticket from the list on the left, or open a new ticket if you need help.
      </div>
    </div>
  );
}

/* MAIN SUPPORT PAGE */
export default function SupportPage() {
  const navigate              = useNavigate();
  const [searchParams]        = useSearchParams();
  const { user }              = useAuth();
  const isMobile              = useIsMobile();

  const [tickets, setTickets]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTicket, setActive]     = useState(null);
  const [loadingTicket, setLoadingT]  = useState(false);
  const [showNew, setShowNew]         = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login', loginNavState()); return; }
    fetchTickets();
    const tid = searchParams.get('ticketId');
    if (tid) openTicket(tid);
    const oid = searchParams.get('orderId');
    if (oid) setShowNew(true);
  }, [user]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await supportApi.getMyTickets({ limit: 50 });
      setTickets(res.data?.data?.data || []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const openTicket = async (id) => {
    setLoadingT(true);
    try {
      const res = await supportApi.getTicket(id);
      setActive(res.data?.data?.ticket);
    } catch { /* silent */ } finally { setLoadingT(false); }
  };

  const handleCreated = (ticket) => {
    setShowNew(false);
    setTickets(prev => [ticket, ...prev]);
    setActive(ticket);
  };

  const handleUpdated = useCallback((ticket) => {
    setActive(ticket);
    setTickets(prev => prev.map(t =>
      t._id === ticket._id ? { ...t, status: ticket.status, updatedAt: ticket.updatedAt } : t
    ));
  }, []);

  if (!user) return null;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '20px 0 48px' }}>
      {showNew && (
        <NewTicketModal
          onClose={() => setShowNew(false)}
          onCreated={handleCreated}
          prefillOrderId={searchParams.get('orderId') || ''}
        />
      )}

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '0 16px' }}>

        {/* ── Page header ── */}
        <div style={{
          background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`,
          padding: '14px 20px', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fff3ee', border: `1px solid #ffe4d6`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <SupportIcon size={20} color={C.orange} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Customer Support</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Get help with your orders and account</div>
            </div>
          </div>
          <button onClick={() => setShowNew(true)}
            style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + New Ticket
          </button>
        </div>

        {/* ── Two-panel layout ── */}
        {isMobile ? (
          /* Mobile: show list OR chat */
          activeTicket ? (
            <ChatPanel
              ticket={activeTicket}
              onBack={() => { setActive(null); fetchTickets(); }}
              onUpdated={handleUpdated}
            />
          ) : (
            <TicketSidebar
              tickets={tickets}
              loading={loading}
              activeId={activeTicket?._id}
              onSelect={openTicket}
            />
          )
        ) : (
          /* Desktop: side-by-side */
          <div className="r-stack" style={{ display: 'grid', gridTemplateColumns: '256px 1fr', gap: 14, alignItems: 'start' }}>
            <TicketSidebar
              tickets={tickets}
              loading={loading}
              activeId={activeTicket?._id}
              onSelect={openTicket}
            />

            <div>
              {loadingTicket ? (
                <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`,
                  height: 'calc(100vh - 180px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
                  Loading conversation…
                </div>
              ) : activeTicket ? (
                <ChatPanel
                  ticket={activeTicket}
                  onUpdated={handleUpdated}
                />
              ) : (
                <EmptyPanel />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
