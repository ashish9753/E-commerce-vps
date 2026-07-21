import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { resolveNotificationLink } from '../utils/notificationLink';
import { loginNavState } from '../utils/authRedirect';

const TYPE_ICON  = { ORDER:'📦', PAYMENT:'💳', OFFER:'🎁', REFUND:'↩️', SYSTEM:'🔔' };
const TYPE_COLOR = { ORDER:'#3b82f6', PAYMENT:'#8b5cf6', OFFER:'#f59e0b', REFUND:'#22c55e', SYSTEM:'#6b7280' };

function CopyButton({ code }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#f0fdf4',
      border:'1px solid #86efac', borderRadius:8, padding:'6px 12px', marginTop:8 }}>
      <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:14, color:'#16a34a', letterSpacing:'.1em' }}>{code}</span>
      <button
        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
        style={{ background: copied ? '#16a34a' : 'white', color: copied ? 'white' : '#16a34a',
          border:'1px solid #86efac', borderRadius:6, padding:'3px 10px', fontSize:12, fontWeight:700,
          cursor:'pointer', transition:'all .2s', whiteSpace:'nowrap' }}>
        {copied ? '✓ Copied!' : '📋 Copy'}
      </button>
    </div>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead, remove } = useNotifications();
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  if (!user) {
    return (
      <div style={{ minHeight:'100vh', background:'#f0f2f2', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:64, marginBottom:16 }}>🔔</div>
          <h3 style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>Sign in to view notifications</h3>
          <button onClick={() => navigate('/login', loginNavState())}
            style={{ padding:'10px 28px', borderRadius:8, background:'#FF5A1F', color:'white', border:'none', fontWeight:700, fontSize:14, cursor:'pointer' }}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const visible = filter === 'unread' ? notifications.filter(n => !n.isRead) : notifications;

  return (
    <div style={{ background:'#f0f2f2', minHeight:'100vh', padding:'24px 0 60px' }}>
      <div style={{ maxWidth:780, margin:'0 auto', padding:'0 16px' }}>

        {/* Header card */}
        <div style={{ background:'white', borderRadius:8, padding:'20px 24px', marginBottom:16, border:'1px solid #ddd', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ margin:0, fontSize:24, fontWeight:700 }}>Notifications</h1>
            <p style={{ margin:'4px 0 0', fontSize:13, color:'#666' }}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {/* Filter pills */}
            {['all','unread'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding:'6px 16px', borderRadius:99, border:'1px solid', fontWeight:700, fontSize:12, cursor:'pointer',
                  background: filter === f ? '#0f172a' : 'white',
                  color: filter === f ? 'white' : '#555',
                  borderColor: filter === f ? '#0f172a' : '#ddd' }}>
                {f === 'all' ? 'All' : `Unread (${unreadCount})`}
              </button>
            ))}
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                style={{ padding:'6px 16px', borderRadius:99, border:'1px solid #007185', fontWeight:700, fontSize:12, cursor:'pointer', background:'white', color:'#007185' }}>
                ✓ Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Notifications list */}
        {visible.length === 0 ? (
          <div style={{ background:'white', borderRadius:8, border:'1px solid #ddd', padding:'60px 24px', textAlign:'center' }}>
            <div style={{ fontSize:64, marginBottom:16 }}>🔔</div>
            <h3 style={{ fontSize:20, fontWeight:700, margin:'0 0 8px' }}>
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p style={{ color:'#666', fontSize:14 }}>We'll notify you about orders, offers and more.</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {visible.map(n => {
              const color = TYPE_COLOR[n.type] || '#6b7280';
              return (
                <div key={n._id}
                  style={{
                    background: n.isRead ? 'white' : '#FFF8F5',
                    border:`1px solid ${n.isRead ? '#ddd' : '#FFCDB8'}`,
                    borderLeft:`4px solid ${color}`,
                    borderRadius:8, padding:'16px 20px',
                    display:'flex', gap:14, alignItems:'flex-start',
                    cursor: 'default',
                    transition:'box-shadow .15s',
                  }}
                  onClick={() => { if (!n.isRead) markRead(n._id); }}
                >
                  {/* Icon */}
                  <div style={{ width:42, height:42, borderRadius:'50%', background:color+'15', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                    {TYPE_ICON[n.type] || '🔔'}
                  </div>

                  {/* Content */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                      <span style={{ fontWeight: n.isRead ? 600 : 800, fontSize:14, color:'#0f172a' }}>{n.title}</span>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99, background:color+'20', color }}>{n.type}</span>
                      {!n.isRead && <span style={{ width:7, height:7, borderRadius:'50%', background:'#FF5A1F', flexShrink:0 }} />}
                    </div>
                    <p style={{ margin:'0 0 8px', fontSize:13, color:'#555', lineHeight:1.6 }}>{n.message}</p>

                    {/* Coupon code with copy */}
                    {n.couponCode && <CopyButton code={n.couponCode} />}

                    {/* Clickable link */}
                    {n.link && (() => { const target = resolveNotificationLink(n); return (
                      <a
                        href={target.startsWith('http') ? target : `${window.location.origin}${target}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e => { e.stopPropagation(); if (!n.isRead) markRead(n._id); }}
                        style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:8,
                          padding:'7px 14px', borderRadius:8, background:'#eff6ff', border:'1px solid #bfdbfe',
                          fontSize:13, fontWeight:700, color:'#1d4ed8', cursor:'pointer', textDecoration:'none' }}>
                        🔗 Click here ↗
                      </a>
                    ); })()}

                    <div style={{ fontSize:11, color:'#9ca3af', marginTop:8 }}>
                      {new Date(n.createdAt).toLocaleString('en-IN', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                    {!n.isRead && (
                      <button onClick={e => { e.stopPropagation(); markRead(n._id); }}
                        style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:6, background:'#f1f5f9', border:'1px solid #e2e8f0', cursor:'pointer', color:'#333', whiteSpace:'nowrap' }}>
                        Mark read
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); remove(n._id); }}
                      style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:6, background:'#fef2f2', border:'1px solid #fecaca', cursor:'pointer', color:'#dc2626' }}>
                      Delete
                    </button>
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
