import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormDraft } from '../../hooks/useFormDraft';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { employeeApi } from '../../api/employee';
import { ordersApi } from '../../api/orders';
import { returnsApi } from '../../api/returns';
import { deliveryAreasApi } from '../../api/deliveryAreas';
import { upayaApi } from '../../api/upaya';
import { getErrorMessage } from '../../api/client';
import { settingsApi } from '../../api/settings';
import { couponsApi } from '../../api/coupons';
import { productsApi } from '../../api/products';
import { attributesApi } from '../../api/catalog';
import { useCatalog } from '../../context/CatalogContext';
import AdminCatalogTab from '../admin/AdminCatalogTab';
import AdminBannersTab from '../admin/AdminBannersTab';
import AdminMediaTab from '../admin/AdminMediaTab';
import { AdminSupportTab } from '../admin/AdminDashboard';
import { hasPermission, ALL_PERMISSIONS } from '../../utils/permissions';
import { isHttpUrl, toDirectImageUrl } from '../../utils/imageUrl';
import OrderPipeline from '../../components/orders/OrderPipeline';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { C, useDashboardTheme } from '../../theme/dashboardTheme';

const STATUS_COLORS = {
  PLACED: C.yellow, CONFIRMED: C.blue, PACKED: C.purple,
  SHIPPED: C.cyan, OUT_FOR_DELIVERY: C.accent,
  DELIVERED: C.green, CANCELLED: C.red, RETURNED: C.mute,
};

const REASON_LABEL = {
  defective:       'Defective / Not Working',
  wrong_item:      'Wrong Item Received',
  damaged:         'Damaged in Transit',
  not_as_described:'Not as Described',
  changed_mind:    'Changed My Mind',
  missing_parts:   'Missing Parts / Accessories',
};

const fmt    = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtRs  = (n) => `Rs. ${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;

const NOTIF_ICONS = { ORDER: '🛒', PAYMENT: '💳', OFFER: '🎁', REFUND: '↩️', SYSTEM: '🔔' };
const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  return `${Math.floor(h / 24)} day${Math.floor(h / 24) > 1 ? 's' : ''} ago`;
};
const fmtShort = (n) => {
  const v = Math.round(Number(n || 0));
  if (v >= 10000000) return `Rs. ${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `Rs. ${(v / 100000).toFixed(1)}L`;
  if (v >= 10000)    return `Rs. ${(v / 1000).toFixed(1)}K`;
  return fmtRs(v);
};

/* â"€â"€ Responsive hook â"€â"€ */
function useResponsive() {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return { w, isMobile: w < 768, isTablet: w >= 768 && w < 1100, isDesktop: w >= 1100 };
}

/* â"€â"€ SVG Icons â"€â"€ */
const Icon = {
  grid:    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  bag:     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  orders:  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  refund:  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>,
  plus:    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  dollar:  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  truck:   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  tag:     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  star:    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  shield:  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  search:  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  menu:    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  chevD:   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>,
  extlink: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  pencil:  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  warn:    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  check:   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  x:       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  shop:    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  box:     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  arrow:   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  catalog: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  gear:    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.42 1.42M4.93 4.93l1.42 1.42M19.07 19.07l-1.42-1.42M4.93 19.07l1.42-1.42M20 12h2M2 12h2M12 20v2M12 2v2"/></svg>,
  coupon:  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  bell:    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  lock:    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
};

function SvgAt({ el, size = 17 }) {
  if (!el) return null;
  return (
    <svg xmlns={el.props.xmlns} fill={el.props.fill} viewBox={el.props.viewBox}
      stroke={el.props.stroke} strokeWidth={el.props.strokeWidth}
      style={{ width: size, height: size, display: 'block', flexShrink: 0 }}>
      {el.props.children}
    </svg>
  );
}

/* â"€â"€ Shared UI components â"€â"€ */
const ICON_COLOR_MAP = { blue: C.blue, purple: C.purple, yellow: C.yellow, green: C.green, orange: C.accent, red: C.red, cyan: C.cyan };
const ICON_BG_MAP   = { blue: 'rgba(59,130,246,.15)', purple: 'rgba(139,92,246,.15)', yellow: 'rgba(234,179,8,.15)', green: 'rgba(34,197,94,.15)', orange: 'rgba(249,115,22,.15)', red: 'rgba(239,68,68,.15)', cyan: 'rgba(6,182,212,.15)' };

function KpiCard({ label, value, sub, colorKey = 'blue', iconEl, rawValue }) {
  const col = ICON_COLOR_MAP[colorKey] || C.blue;
  const bg  = ICON_BG_MAP[colorKey]   || 'rgba(59,130,246,.15)';
  const nowrap = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, color: C.mute, fontWeight: 500, marginBottom: 3, ...nowrap }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, lineHeight: 1.2, margin: '3px 0 2px', ...nowrap }}
          title={rawValue !== undefined ? fmtRs(rawValue) : undefined}>{value}</div>
        {sub && <div style={{ fontSize: 10.5, color: C.mute, ...nowrap }}>{sub}</div>}
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <SvgAt el={iconEl} size={18} />
      </div>
    </div>
  );
}

function Card({ title, children, action, style }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', ...style }}>
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px' }}>
          {title && <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: C.text }}>{title}</div>}
          {action}
        </div>
      )}
      <div style={{ padding: title || action ? '0 22px 22px' : '22px' }}>{children}</div>
    </div>
  );
}

function Th({ children }) {
  return <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11.5, fontWeight: 600, color: C.mute, letterSpacing: '.07em', textTransform: 'uppercase', borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap' }}>{children}</th>;
}
function Td({ children, style }) {
  return <td style={{ padding: '13px 14px', fontSize: 13.5, borderBottom: `1px solid ${C.line}`, color: C.text, verticalAlign: 'middle', ...style }}>{children}</td>;
}
function Badge({ text, color }) {
  return <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background: color+'22', color, border:`1px solid ${color}44` }}>{text}</span>;
}
function Input({ value, onChange, placeholder, type = 'text', style }) {
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{ height: 36, border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 12px', fontSize: 13, outline: 'none', background: C.bg, color: C.text, fontFamily: 'inherit', ...style }} />;
}
function Sel({ value, onChange, children, style }) {
  return <select value={value} onChange={onChange}
    style={{ height: 36, border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 10px', fontSize: 13, background: C.bg, color: C.text, cursor: 'pointer', fontFamily: 'inherit', ...style }}>{children}</select>;
}
function Btn({ children, onClick, disabled, variant = 'ghost', style }) {
  const base = { fontSize: 13, fontWeight: 500, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', border: 'none', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, ...style };
  const variants = {
    ghost:   { background: 'rgba(255,255,255,.06)', color: C.sub, border: `1px solid ${C.line}` },
    danger:  { background: 'rgba(239,68,68,.12)',   color: '#f87171', border: '1px solid rgba(239,68,68,.25)' },
    success: { background: 'rgba(34,197,94,.12)',   color: C.green,   border: '1px solid rgba(34,197,94,.25)' },
    warn:    { background: 'rgba(234,179,8,.12)',   color: C.yellow,  border: '1px solid rgba(234,179,8,.25)' },
    primary: { background: C.accent, color: 'white' },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], opacity: disabled ? .5 : 1 }}>{children}</button>;
}
function Loader() {
  return <div style={{ padding: 60, textAlign: 'center', color: C.mute, fontFamily: "'DM Sans',sans-serif" }}>Loading…</div>;
}
function Empty({ text }) {
  return <div style={{ padding: '40px 0', textAlign: 'center', color: C.mute, fontSize: 14 }}>{text}</div>;
}
function PagBar({ page, pagination, loading, setPage, label = '', borderBottom = false }) {
  if (pagination.totalPages <= 1) return null;
  const lineStyle = borderBottom ? { borderBottom:`1px solid ${C.line}`, marginBottom:8, paddingBottom:8 } : { borderTop:`1px solid ${C.line}`, marginTop:8, paddingTop:8 };
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', ...lineStyle }}>
      <span style={{ fontSize:13, color:C.mute }}>
        Page <strong style={{color:C.text}}>{page}</strong> of <strong style={{color:C.text}}>{pagination.totalPages}</strong>
        {label && <span style={{ marginLeft:8 }}>· {label}</span>}
      </span>
      <div style={{ display:'flex', gap:6 }}>
        <Btn onClick={() => setPage(p => p - 1)} disabled={!pagination.hasPrevPage || loading}>← Prev</Btn>
        {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).filter(p => Math.abs(p - page) <= 2).map(p => (
          <button key={p} onClick={() => setPage(p)}
            style={{ minWidth:34, height:34, borderRadius:8, border:`1px solid ${p===page?C.accent:C.line}`, background:p===page?C.accent:'transparent', color:p===page?'white':C.text, fontWeight:p===page?700:400, fontSize:13, cursor:'pointer' }}>
            {p}
          </button>
        ))}
        <Btn onClick={() => setPage(p => p + 1)} disabled={!pagination.hasNextPage || loading}>Next →</Btn>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   OVERVIEW TAB
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function OverviewTab({ profile }) {
  const { isMobile, isTablet } = useResponsive();
  const navigate = useNavigate();
  const { notifications } = useNotifications();
  const [products, setProducts] = useState([]);
  const [ordersData, setOrdersData] = useState(null);
  const [loading, setLoading]   = useState(true);
  const notifs = notifications.slice(0, 6);

  useEffect(() => {
    Promise.all([
      employeeApi.getMyProducts({ limit: 200 }),
      employeeApi.getMyOrders({ limit: 200 }),
    ]).then(([pRes, oRes]) => {
      setProducts(pRes.data?.data?.data || []);
      setOrdersData(oRes.data?.data || {});
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;

  const orders = ordersData?.data || [];
  const revenue = ordersData?.employeeRevenue || 0;
  const refunded = ordersData?.employeeRefunded || 0;
  const breakdown = ordersData?.statusBreakdown || [];

  const totalStock  = products.reduce((a, p) => a + (p.stock || 0), 0);
  const stockValue  = products.reduce((a, p) => a + ((p.discountPrice || p.price || 0) * (p.stock || 0)), 0);
  const publishedN  = products.filter(p => p.isPublished).length;
  const lowStock    = products.filter(p => p.stock > 0 && p.stock <= 5);
  const outOfStock  = products.filter(p => p.stock === 0);
  const delivered   = breakdown.find(b => b._id === 'DELIVERED')?.count || 0;
  const pending     = breakdown.filter(b => ['PLACED','CONFIRMED','PACKED','SHIPPED','OUT_FOR_DELIVERY'].includes(b._id)).reduce((a,b)=>a+b.count,0);
  const stockChart  = products.slice(0, 8).map(p => ({ name: p.title?.slice(0,14), stock: p.stock }));
  const payMethods  = {};
  orders.forEach(o => { payMethods[o.paymentMethod] = (payMethods[o.paymentMethod]||0) + 1; });
  const payChart = Object.entries(payMethods).map(([k,v]) => ({ name: k, value: v }));

  const cols3 = isMobile ? '1fr' : isTablet ? '1fr 1fr' : '1fr 1fr 1fr';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
        <KpiCard label="Net Revenue"     value={fmtShort(revenue)}   sub="Paid minus refunded"   colorKey="green"  iconEl={Icon.dollar} rawValue={revenue} />
        <KpiCard label="Refunded"        value={fmtShort(refunded)}  sub={`${breakdown.filter(b=>['RETURNED','CANCELLED'].includes(b._id)).reduce((a,b)=>a+b.count,0)} orders`} colorKey="red" iconEl={Icon.refund} rawValue={refunded} />
        <KpiCard label="Active Products" value={publishedN}          sub={`${products.length} total`} colorKey="orange" iconEl={Icon.bag} />
        <KpiCard label="Pending Orders"  value={fmt(pending)}        sub="To be processed"       colorKey="yellow" iconEl={Icon.truck} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: cols3, gap: 16 }}>
        <Card title="Inventory Value">
          <div style={{ fontSize: 24, fontWeight: 800, color: C.purple, marginBottom: 4 }} title={fmtRs(stockValue)}>{fmtShort(stockValue)}</div>
          <div style={{ fontSize: 12, color: C.mute, marginBottom: 16 }}>{fmt(totalStock)} units in stock</div>
          {outOfStock.length > 0 && (
            <div style={{ background: C.red+'14', border:`1px solid ${C.red}33`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.red, marginBottom: 8, display:'flex', alignItems:'center', gap:8 }}>
              <SvgAt el={Icon.warn} size={14} />
              <strong>{outOfStock.length} {outOfStock.length === 1 ? 'product' : 'products'}</strong>&nbsp;out of stock
            </div>
          )}
          {lowStock.length > 0 && (
            <div style={{ background: C.yellow+'14', border:`1px solid ${C.yellow}33`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.yellow, display:'flex', alignItems:'center', gap:8 }}>
              <SvgAt el={Icon.warn} size={14} />
              <strong>{lowStock.length} {lowStock.length === 1 ? 'product' : 'products'}</strong>&nbsp;with 5 or fewer units left
            </div>
          )}
        </Card>

        <Card title="Order Status">
          {breakdown.length === 0 ? <Empty text="No orders yet" /> :
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={breakdown.map(b=>({name:b._id,value:b.count}))} cx="50%" cy="42%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                  {breakdown.map(b => <Cell key={b._id} fill={STATUS_COLORS[b._id]||C.mute} />)}
                </Pie>
                <Tooltip contentStyle={{ background: C.card, border:`1px solid ${C.line}`, borderRadius:8, color:C.text, fontSize:12 }} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: C.sub }} />
              </PieChart>
            </ResponsiveContainer>
          }
        </Card>

        <Card title="Payment Methods">
          {payChart.length === 0 ? <Empty text="No orders yet" /> :
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={payChart} cx="50%" cy="42%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                  <Cell fill={C.blue} />
                  <Cell fill={C.green} />
                </Pie>
                <Tooltip contentStyle={{ background: C.card, border:`1px solid ${C.line}`, borderRadius:8, color:C.text, fontSize:12 }} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: C.sub }} />
              </PieChart>
            </ResponsiveContainer>
          }
        </Card>
      </div>

      {/* Stock bar chart */}
      {stockChart.length > 0 && (
        <Card title="Stock Levels by Product">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stockChart} margin={{ top: 4, right: 8, left: -10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.mute }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: C.mute }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: C.card, border:`1px solid ${C.line}`, borderRadius:8, color:C.text, fontSize:12 }} />
              <Bar dataKey="stock" fill={C.blue} radius={[4,4,0,0]} name="Stock" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Latest Notifications */}
      <Card title="Latest Notifications" action={
        <span onClick={() => navigate('/notifications')}
          style={{ fontSize: 12, color: C.accent, cursor: 'pointer', fontWeight: 600 }}>View all →</span>
      }>
        {notifs.length === 0
          ? <Empty text="No notifications yet" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {notifs.map((n, i) => (
                <div key={n._id || i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0',
                  borderBottom: i < notifs.length - 1 ? `1px solid ${C.line}` : 'none',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: C.bg, border: `1px solid ${C.line}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  }}>
                    {NOTIF_ICONS[n.type] || '🔔'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: n.isRead ? 600 : 700, fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: C.mute, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.message}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.mute, flexShrink: 0, whiteSpace: 'nowrap' }}>{timeAgo(n.createdAt)}</div>
                </div>
              ))}
            </div>
        }
      </Card>

    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MY PRODUCTS TAB
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export function ProductsTab({ onEdit }) {
  const { isMobile } = useResponsive();
  const [all, setAll]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]     = useState(null);
  const [search, setSearch] = useState('');
  const [stockF, setStockF] = useState('');
  const [pubF, setPubF]     = useState('');

  const load = useCallback(() => {
    setLoading(true);
    employeeApi.getMyProducts({ limit: 200 }).then(r => setAll(r.data?.data?.data || [])).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const products = all.filter(p => {
    const q = search.toLowerCase();
    const mQ = !q || p.title?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q);
    const mS = !stockF || (stockF === 'out' ? p.stock === 0 : stockF === 'low' ? p.stock > 0 && p.stock <= 5 : p.stock > 5);
    const mP = !pubF || (pubF === 'live' ? p.isPublished : !p.isPublished);
    return mQ && mS && mP;
  });

  const totalRevPotential = all.reduce((a,p) => a + (p.discountPrice||p.price||0)*(p.stock||0), 0);
  const totalSold = all.reduce((a,p) => a + (p.sold||0), 0);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    setBusy(id);
    await employeeApi.deleteProduct(id).catch(()=>{});
    setAll(prev => prev.filter(x => x._id !== id));
    setBusy(null);
  };

  const handleTogglePublish = async (p) => {
    setBusy(p._id);
    await employeeApi.updateProduct(p._id, { isPublished: !p.isPublished }).catch(()=>{});
    setAll(prev => prev.map(x => x._id === p._id ? {...x, isPublished: !p.isPublished} : x));
    setBusy(null);
  };

  if (loading) return <Loader />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
        <KpiCard label="Total Products"  value={all.length}                                    sub={`${all.filter(p=>p.isPublished).length} live`} colorKey="blue"   iconEl={Icon.bag} />
        <KpiCard label="Units in Stock"  value={fmt(all.reduce((a,p)=>a+(p.stock||0),0))}     sub="Across all products"                           colorKey="green"  iconEl={Icon.box} />
        <KpiCard label="Total Sold"      value={fmt(totalSold)}                               sub="Units sold ever"                               colorKey="orange" iconEl={Icon.check} />
        <KpiCard label="Stock Value"     value={fmtShort(totalRevPotential)}                  sub="At current prices"                             colorKey="purple" iconEl={Icon.dollar} rawValue={totalRevPotential} />
      </div>

      <Card>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:C.bg, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 12px', height:36, flex:1, minWidth:200 }}>
            <span style={{ color:C.mute, display:'flex' }}><SvgAt el={Icon.search} size={14} /></span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…"
              style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:13, color:C.text, fontFamily:'inherit' }} />
          </div>
          <Sel value={stockF} onChange={e=>setStockF(e.target.value)} style={{ width: 150 }}>
            <option value="">All Stock</option>
            <option value="ok">In Stock (&gt;5)</option>
            <option value="low">Low Stock (5 or fewer)</option>
            <option value="out">Out of Stock</option>
          </Sel>
          <Sel value={pubF} onChange={e=>setPubF(e.target.value)} style={{ width: 130 }}>
            <option value="">All Status</option>
            <option value="live">Published</option>
            <option value="hidden">Hidden</option>
          </Sel>
          {(search||stockF||pubF) && <Btn onClick={()=>{setSearch('');setStockF('');setPubF('');}}>Clear</Btn>}
          <span style={{ fontSize:13,color:C.mute,marginLeft:'auto' }}><strong style={{color:C.text}}>{products.length}</strong> of <strong style={{color:C.text}}>{all.length}</strong></span>
        </div>
      </Card>

      <Card title={`Products (${products.length})`}>
        {products.length === 0 ? <Empty text="No products match your filters" /> :
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                <Th>Product</Th><Th>Category</Th><Th>MRP</Th><Th>Sale Price</Th><Th>Discount</Th><Th>Stock</Th><Th>Sold</Th><Th>Status</Th><Th>Actions</Th>
              </tr></thead>
              <tbody>
                {products.map(p => {
                  const mrp  = p.price || 0;
                  const sale = p.discountPrice || p.price || 0;
                  const disc = mrp > sale ? Math.round(((mrp-sale)/mrp)*100) : 0;
                  const catName = typeof p.category === 'object' ? p.category?.name : p.category;
                  return (
                    <tr key={p._id} style={{ opacity: busy===p._id ? .5:1 }}>
                      <Td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:42, height:42, borderRadius:8, background:C.card2, overflow:'hidden', flexShrink:0, border:`1px solid ${C.line}` }}>
                            {p.images?.[0]
                              ? <img src={p.images[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                              : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:C.mute }}><SvgAt el={Icon.bag} size={20} /></div>}
                          </div>
                          <div>
                            <div style={{ fontWeight:700, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:C.text }}>{p.title}</div>
                            <div style={{ fontSize:11, color:C.mute }}>{p.brand}</div>
                          </div>
                        </div>
                      </Td>
                      <Td style={{ color:C.mute }}>{catName || '—'}</Td>
                      <Td style={{ color: disc > 0 ? C.mute : C.text, textDecoration: disc>0?'line-through':'none' }}>{fmtRs(mrp)}</Td>
                      <Td><span style={{ fontWeight:700, color:C.green }}>{fmtRs(sale)}</span></Td>
                      <Td>{disc > 0 ? <Badge text={`-${disc}%`} color={C.green} /> : <span style={{ color:C.mute }}>—</span>}</Td>
                      <Td>
                        <span style={{ fontWeight:700, color: p.stock===0?C.red:p.stock<=5?C.yellow:C.green }}>
                          {p.stock}
                        </span>
                      </Td>
                      <Td style={{ fontWeight:600 }}>{fmt(p.sold||0)}</Td>
                      <Td>
                        <button onClick={()=>handleTogglePublish(p)} disabled={busy===p._id}
                          style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:8, border:'none', cursor:'pointer',
                            background: p.isPublished ? C.green+'22' : C.red+'22',
                            color: p.isPublished ? C.green : C.red }}>
                          {p.isPublished ? 'Live' : 'Hidden'}
                        </button>
                      </Td>
                      <Td>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={()=>onEdit(p)} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:8, border:`1px solid ${C.line}`, background:C.card2, color:C.sub, cursor:'pointer' }}>
                            <SvgAt el={Icon.pencil} size={12} /> Edit
                          </button>
                          <button onClick={()=>handleDelete(p._id,p.title)} disabled={busy===p._id} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:8, border:`1px solid ${C.red}44`, background:C.red+'18', color:C.red, cursor:'pointer' }}>
                            <SvgAt el={Icon.trash} size={12} /> Del
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        }
      </Card>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ORDERS TAB
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
// Employees can only confirm orders. All subsequent statuses are updated by Upaya.
const EMPLOYEE_STATUSES = ['CONFIRMED'];
const STATUS_NEXT = { PLACED: 'CONFIRMED' };

function OrderStatusCell({ order, onUpdated, onViewReturns }) {
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const current     = order.orderStatus;
  const isFinal     = ['RETURNED','CANCELLED','DELIVERED'].includes(current);
  const isReturned  = current === 'RETURNED';
  const isDelivered = current === 'DELIVERED';
  const canConfirm  = current === 'PLACED';
  const canCancel   = current === 'PLACED';
  const sm = STATUS_COLORS[current] || C.mute;

  const doConfirm = async () => {
    setSaving(true);
    try {
      await employeeApi.updateOrderStatus(order._id, { status: 'CONFIRMED' });
      onUpdated(order._id, 'CONFIRMED', '');
    } catch(e) {
      alert(e?.response?.data?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  const doCancel = async () => {
    const reason = window.prompt(`Cancel order ${order.orderNumber || ''}?\n\nReason (shown to customer):`, 'Cancelled by store');
    if (!reason) return;
    setCancelling(true);
    try {
      await ordersApi.cancel(order._id, { reason });
      onUpdated(order._id, 'CANCELLED', reason);
    } catch (e) {
      alert(e?.response?.data?.message || 'Cancel failed');
    } finally { setCancelling(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: canConfirm || isReturned ? 6 : 0 }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700,
          padding:'3px 9px', borderRadius:99, background: sm+'22', color: sm }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background: sm }} />
          {current.replace(/_/g,' ')}
        </span>
      </div>

      {canConfirm && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          <button onClick={doConfirm} disabled={saving || cancelling}
            style={{ fontSize:11, fontWeight:700, padding:'5px 14px', borderRadius:6,
              background: C.green+'22', color: C.green,
              border:`1px solid ${C.green}44`, cursor:'pointer',
              opacity: saving ? 0.6 : 1, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
            <SvgAt el={Icon.check} size={11} />
            {saving ? '…' : '✓ Confirm Order'}
          </button>
          <button onClick={doCancel} disabled={saving || cancelling}
            style={{ fontSize:11, fontWeight:700, padding:'5px 10px', borderRadius:6,
              background: C.red+'18', color: C.red,
              border:`1px solid ${C.red}44`, cursor:'pointer',
              opacity: cancelling ? 0.6 : 1, whiteSpace:'nowrap' }}>
            {cancelling ? '…' : '✕ Cancel'}
          </button>
        </div>
      )}

      {!isFinal && !canConfirm && current !== 'PLACED' && (
        <div style={{ fontSize:10, color: C.mute, display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
          <span>🚚</span> Tracked by Upaya
        </div>
      )}

      {isReturned && (
        <button onClick={onViewReturns}
          style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:6,
            background: C.purple+'22', color: C.purple,
            border:`1px solid ${C.purple}44`, cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
          <SvgAt el={Icon.refund} size={11} /> Handle Return
        </button>
      )}
      {isDelivered && <span style={{ fontSize:11, color:C.green, fontWeight:600, display:'flex', alignItems:'center', gap:5 }}><SvgAt el={Icon.check} size={12} /> Delivered</span>}
      {current === 'CANCELLED' && <span style={{ fontSize:11, color:C.mute }}>Order cancelled</span>}

    </div>
  );
}

function OrdersTab({ onViewReturns }) {
  const { isMobile } = useResponsive();
  const [all, setAll]       = useState([]);
  const [revenue, setRev]   = useState(0);
  const [breakdown, setBD]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusF, setStatF]   = useState('');
  const [payF, setPayF]       = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [page, setPage]         = useState(1);
  const [pagination, setPag]    = useState({ total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false });
  const [expandedId, setExpandedId] = useState(null);
  const [pendingPayCount, setPendingPay] = useState(0);


  // appliedSearch only updates on Enter / Search button — no API calls while typing
  const [appliedSearch, setAppliedSearch] = useState('');
  const applySearch = () => { setPage(1); setAppliedSearch(search); };

  useEffect(() => { setPage(1); }, [statusF, payF]);

  const hasLoadedRef = useRef(false);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    const params = { limit: 100, page };
    // PENDING_PAYMENT — synthetic option that means "PLACED + paymentStatus=PENDING".
    if (statusF === 'PENDING_PAYMENT') {
      params.status        = 'PLACED';
      params.paymentStatus = 'PENDING';
    } else {
      if (statusF) params.status        = statusF;
      if (payF)    params.paymentStatus = payF;
    }
    if (appliedSearch) params.search    = appliedSearch;
    employeeApi.getMyOrders(params).then(r => {
      const d = r.data?.data || {};
      setAll(d.data || []);
      setRev(d.employeeRevenue || 0);
      setBD(d.statusBreakdown || []);
      setPendingPay(d.pendingPaymentCount || 0);
      setPag(d.pagination || { total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false });
    }).catch(()=>{}).finally(()=>{ setLoading(false); hasLoadedRef.current = true; });
  }, [page, statusF, payF, appliedSearch]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Local-only update — don't refetch the entire list. The user can refresh by
  // re-applying a filter / search if they want fresh aggregate stats.
  const handleStatusUpdated = useCallback((orderId, newStatus) => {
    setAll(prev => {
      // If the active tab no longer matches, drop the row so it doesn't sit there stale.
      const stillMatchesFilter =
        !statusF ||
        statusF === newStatus ||
        (statusF === 'PENDING_PAYMENT' && newStatus === 'PLACED');
      if (!stillMatchesFilter) {
        return prev.filter(o => o._id !== orderId);
      }
      return prev.map(o => o._id === orderId ? { ...o, orderStatus: newStatus } : o);
    });
  }, [statusF]);

  // date filter is client-side (no backend support); text/status/payment are server-side
  const orders = all.filter(o => {
    const d = o.createdAt ? new Date(o.createdAt) : null;
    const mD = (!dateFrom || (d && d >= new Date(dateFrom))) &&
               (!dateTo   || (d && d <= new Date(dateTo + 'T23:59:59')));
    return mD;
  });

  const delivered = all.filter(o=>o.orderStatus==='DELIVERED').length;
  const pending   = all.filter(o=>['PLACED','CONFIRMED','PACKED','SHIPPED','OUT_FOR_DELIVERY'].includes(o.orderStatus)).length;

  if (loading && !hasLoadedRef.current) return <Loader />;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, opacity: loading ? 0.55 : 1, transition: 'opacity .2s', pointerEvents: loading ? 'none' : 'auto' }}>
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:12 }}>
        <KpiCard label="Total Orders"   value={fmt(all.length)}  sub={`${delivered} delivered`}   colorKey="blue"   iconEl={Icon.orders} />
        <KpiCard label="Revenue Earned" value={fmtShort(revenue)} sub="From paid orders"           colorKey="green"  iconEl={Icon.dollar} rawValue={revenue} />
        <KpiCard label="Pending"        value={fmt(pending)}     sub="Awaiting fulfilment"         colorKey="yellow" iconEl={Icon.truck} />
        <KpiCard label="Cancelled"      value={fmt(all.filter(o=>o.orderStatus==='CANCELLED').length)} colorKey="red" iconEl={Icon.x} />
      </div>

      {breakdown.length > 0 && (
        <Card title="Order Status Breakdown">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={breakdown.map(b=>({name:b._id,count:b.count}))} margin={{top:4,right:8,left:-10,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
              <XAxis dataKey="name" tick={{fontSize:10, fill:C.mute}} />
              <YAxis tick={{fontSize:10, fill:C.mute}} allowDecimals={false} />
              <Tooltip contentStyle={{ background: C.card, border:`1px solid ${C.line}`, borderRadius:8, color:C.text, fontSize:12 }} />
              <Bar dataKey="count" radius={[5,5,0,0]}>
                {breakdown.map(b=><Cell key={b._id} fill={STATUS_COLORS[b._id]||C.mute} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        {/* Quick status tabs — matches Return Requests UX so staff can hop between
            statuses with one click instead of opening a dropdown. */}
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
          {[
            { key:'',                label:'All' },
            { key:'PENDING_PAYMENT', label:'⏳ Pending Pay' },
            { key:'PLACED',          label:'Placed' },
            { key:'CONFIRMED',       label:'Confirmed' },
            { key:'PACKED',          label:'Packed' },
            { key:'SHIPPED',         label:'Shipped' },
            { key:'OUT_FOR_DELIVERY',label:'Out for Delivery' },
            { key:'DELIVERED',       label:'Delivered' },
            { key:'CANCELLED',       label:'Cancelled' },
            { key:'RETURNED',        label:'Returned' },
          ].map(f => {
            const active = statusF === f.key;
            // Counts come from the backend breakdown so every tab stays populated
            // regardless of which one is currently selected.
            const totalAcross = breakdown.reduce((a, b) => a + b.count, 0);
            const count = f.key === ''
              ? totalAcross
              : f.key === 'PENDING_PAYMENT'
                ? pendingPayCount
                : (breakdown.find(b => b._id === f.key)?.count || 0);
            return (
              <button key={f.key || 'ALL'} onClick={() => { setStatF(f.key); setPage(1); }}
                style={{ padding:'5px 14px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6,
                  border: active ? `1px solid ${C.accent}` : `1px solid ${C.line}`,
                  background: active ? C.accent : C.card2,
                  color: active ? 'white' : C.sub }}>
                {f.label}
                {count > 0 && (
                  <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:8,
                    background: active ? 'rgba(255,255,255,.22)' : C.bg,
                    color: active ? 'white' : C.mute }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', gap:6, flex:1, minWidth:200 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:C.bg, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 12px', height:36, flex:1 }}>
              <span style={{ color:C.mute, display:'flex' }}><SvgAt el={Icon.search} size={14} /></span>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&applySearch()}
                placeholder="Order #, name, email, phone…"
                style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:13, color:C.text, fontFamily:'inherit' }} />
            </div>
            <Btn variant="primary" onClick={applySearch} style={{ flexShrink:0 }}>
              <SvgAt el={Icon.search} size={14} /> Search
            </Btn>
          </div>
          <Sel value={payF} onChange={e=>setPayF(e.target.value)} style={{ width:140 }}>
            <option value="">All Payments</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
          </Sel>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            title="From date"
            style={{ height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 10px', fontSize:12, background:C.card, color:C.text, outline:'none', cursor:'pointer' }} />
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            title="To date"
            style={{ height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 10px', fontSize:12, background:C.card, color:C.text, outline:'none', cursor:'pointer' }} />
          {(appliedSearch||statusF||payF||dateFrom||dateTo) && <Btn onClick={()=>{setSearch('');setAppliedSearch('');setStatF('');setPayF('');setDateFrom('');setDateTo('');setPage(1);}}>Clear</Btn>}
          <span style={{ fontSize:13, color:C.mute, marginLeft:'auto' }}>
            {(dateFrom||dateTo) ? <><strong style={{color:C.text}}>{orders.length}</strong> match &middot; </> : null}
            <strong style={{color:C.text}}>{pagination.total}</strong> {appliedSearch ? 'found' : 'total'}
          </span>
        </div>
      </Card>

      <Card title={`Orders (${pagination.total})`}>
        <PagBar page={page} pagination={pagination} loading={loading} setPage={setPage} label={`${pagination.total} total`} borderBottom />
        {orders.length === 0 ? <Empty text="No orders match your filters" /> : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {orders.map(o => {
              const isExpanded = expandedId === o._id;
              return (
                <div key={o._id} style={{ border:`1px solid ${C.line}`, borderRadius:10, marginBottom:0, overflow:'hidden' }}>
                  <div
                    onClick={() => setExpandedId(expandedId === o._id ? null : o._id)}
                    style={{
                      background: C.card2,
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      userSelect: 'none',
                      borderRadius: isExpanded ? '10px 10px 0 0' : 10,
                      transition: 'background .15s',
                    }}
                  >
                    <div style={{ flexShrink:0 }}>
                      <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, color:C.accent }}>{o.orderNumber}</span>
                      {o.trackingId && <div style={{ fontSize:10, color:C.mute, marginTop:1 }}>Track: {o.trackingId}</div>}
                    </div>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:13, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{o.user?.name||'—'}</div>
                      <div style={{ fontSize:11, color:C.mute, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{o.user?.email}</div>
                    </div>
                    <span style={{ fontSize:12, color:C.mute, flexShrink:0 }}>{o.orderItems?.length || 0} item{(o.orderItems?.length||0)!==1?'s':''}</span>
                    <span style={{ fontWeight:700, fontSize:13, color:C.text, flexShrink:0 }}>{fmtRs(o.totalPrice)}</span>
                    <Badge text={o.paymentStatus} color={o.paymentStatus==='PAID'?C.green:o.paymentStatus==='FAILED'?C.red:C.yellow} />
                    <Badge text={o.orderStatus} color={STATUS_COLORS[o.orderStatus]||C.mute} />
                    <span style={{ fontSize:11, color:C.mute, flexShrink:0 }}>
                      {new Date(o.createdAt).toLocaleDateString('en-IN',{ day:'numeric', month:'short' })}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ width:16, height:16, transition:'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', color:C.mute, flexShrink:0 }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  {isExpanded && (
                    <div style={{ background:C.card, borderTop:`1px solid ${C.line}`, padding:16 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:14 }}>
                        <div>
                          <div style={{ fontSize:11, fontWeight:700, color:C.mute, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Customer</div>
                          <div style={{ fontWeight:700, fontSize:13, color:C.text }}>{o.user?.name||'—'}</div>
                          <div style={{ fontSize:12, color:C.mute }}>{o.user?.email}</div>
                          <div style={{ fontSize:12, color:C.mute }}>{o.user?.phone}</div>
                        </div>
                        {o.shippingAddress && (
                          <div>
                            <div style={{ fontSize:11, fontWeight:700, color:C.mute, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Shipping Address</div>
                            <div style={{ fontSize:12, color:C.sub, lineHeight:1.6 }}>
                              {o.shippingAddress.name && <div style={{ fontWeight:600, color:C.text }}>{o.shippingAddress.name}</div>}
                              {o.shippingAddress.line1 && <div>{o.shippingAddress.line1}</div>}
                              {o.shippingAddress.line2 && <div>{o.shippingAddress.line2}</div>}
                              {(o.shippingAddress.city||o.shippingAddress.state||o.shippingAddress.pincode) && (
                                <div>{[o.shippingAddress.city,o.shippingAddress.state,o.shippingAddress.pincode].filter(Boolean).join(', ')}</div>
                              )}
                              {o.shippingAddress.phone && <div style={{ color:C.mute }}>{o.shippingAddress.phone}</div>}
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ marginBottom:14 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:C.mute, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Order Items</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          {o.orderItems?.map(item => (
                            <div key={item._id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <div style={{ width:28, height:28, borderRadius:5, background:C.card2, overflow:'hidden', flexShrink:0, border:`1px solid ${item.isFreebie ? C.green : C.line}` }}>
                                {item.image
                                  ? <img src={item.image} style={{ width:'100%', height:'100%', objectFit:'contain' }} alt="" />
                                  : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:C.mute }}>{item.isFreebie ? '🎁' : <SvgAt el={Icon.bag} size={13}/>}</div>}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:12, color:C.sub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 }}>
                                  {item.title}
                                  {item.isFreebie && <span style={{ fontSize:9, fontWeight:800, letterSpacing:'.1em', color:C.green, background:C.green+'22', padding:'1px 6px', borderRadius:99 }}>FREE GIFT</span>}
                                </div>
                                <div style={{ fontSize:11, color:C.mute }}>
                                  Qty: {item.quantity}{item.color ? ` · Color: ${item.color}` : ''}
                                </div>
                              </div>
                              <span style={{ fontSize:13, fontWeight:700, color: item.isFreebie ? C.green : C.text, flexShrink:0 }}>
                                {item.isFreebie || (item.price === 0) ? 'FREE' : fmtRs(item.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Price Breakdown — itemized totals + coupon + delivery */}
                      <div style={{ marginBottom:14, border:`1px solid ${C.line}`, borderRadius:8, padding:'12px 14px', background:C.bg }}>
                        <div style={{ fontSize:11, fontWeight:700, color:C.mute, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Price Breakdown</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:12 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', color:C.sub }}>
                            <span>Items subtotal</span>
                            <span style={{ color:C.text, fontWeight:600 }}>{fmtRs(o.itemsPrice ?? 0)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', color:C.sub }}>
                            <span>Delivery charge</span>
                            <span style={{ color: o.shippingPrice === 0 ? C.green : C.text, fontWeight:600 }}>
                              {o.shippingPrice === 0
                                ? (o.coupon?.discountType === 'FREE_SHIPPING' ? 'FREE (coupon)' : 'FREE')
                                : fmtRs(o.shippingPrice ?? 0)}
                            </span>
                          </div>
                          {o.coupon && (
                            <div style={{
                              marginTop:6, padding:'8px 10px', borderRadius:6,
                              border:`1px dashed ${C.green}66`, background:C.green+'12',
                              display:'flex', flexDirection:'column', gap:4,
                            }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <span style={{ fontSize:11, color:C.mute, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>Coupon</span>
                                  <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:12, color:C.green, background:C.green+'22', padding:'2px 8px', borderRadius:4, letterSpacing:'.06em' }}>
                                    {o.coupon.code}
                                  </span>
                                </div>
                                <span style={{ fontSize:11, fontWeight:700, color:C.green }}>
                                  {o.coupon.discountType === 'PERCENTAGE'    ? `${o.coupon.discountValue}% off`
                                    : o.coupon.discountType === 'FIXED'      ? `Rs. ${o.coupon.discountValue} off`
                                    : o.coupon.discountType === 'FREEBIE'    ? '🎁 Free Gift'
                                    : o.coupon.discountType === 'FREE_SHIPPING' ? '🚚 Free Shipping'
                                    : ''}
                                </span>
                              </div>
                              {(o.discountAmount ?? 0) > 0 && (
                                <div style={{ display:'flex', justifyContent:'space-between', color:C.green, fontSize:12 }}>
                                  <span>Discount applied</span>
                                  <span style={{ fontWeight:700 }}>− {fmtRs(o.discountAmount)}</span>
                                </div>
                              )}
                            </div>
                          )}
                          <div style={{ borderTop:`1px solid ${C.line}`, marginTop:4, paddingTop:8, display:'flex', justifyContent:'space-between', fontSize:13 }}>
                            <span style={{ fontWeight:700, color:C.text }}>Order total</span>
                            <span style={{ fontWeight:800, color:C.accent, fontSize:14 }}>{fmtRs(o.totalPrice ?? 0)}</span>
                          </div>
                        </div>
                      </div>
                      {/* Visual fulfilment pipeline — click the next step to advance */}
                      <div style={{ marginBottom:14, border:`1px solid ${C.line}`, borderRadius:8, overflow:'hidden' }}>
                        <OrderPipeline
                          status={o.orderStatus}
                          onAdvance={async (nextStatus) => {
                            try {
                              await employeeApi.updateOrderStatus(o._id, { status: nextStatus });
                              handleStatusUpdated(o._id, nextStatus, '');
                            } catch (e) {
                              alert(e?.response?.data?.message || 'Update failed');
                            }
                          }}
                          theme={{ line:C.line, accent:C.accent, green:C.green, red:C.red, mute:C.mute, text:C.text, bg:C.bg, card2:C.card2 }}
                        />
                      </div>

                      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:14, padding:'10px 14px', background:C.bg, borderRadius:8, border:`1px solid ${C.line}` }}>
                        <div style={{ fontSize:11, fontWeight:700, color:C.mute, textTransform:'uppercase', letterSpacing:'.05em' }}>Payment</div>
                        <Badge text={o.paymentMethod} color={o.paymentMethod==='COD'?C.yellow:C.blue} />
                        <Badge text={o.paymentStatus} color={o.paymentStatus==='PAID'?C.green:o.paymentStatus==='FAILED'?C.red:C.yellow} />
                        <span style={{ fontWeight:700, fontSize:13, color:C.text, marginLeft:'auto' }}>{fmtRs(o.totalPrice)}</span>
                      </div>
                      <OrderStatusCell order={o} onUpdated={handleStatusUpdated} onViewReturns={onViewReturns} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <PagBar page={page} pagination={pagination} loading={loading} setPage={setPage} label={`${pagination.total} total`} />
      </Card>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PRODUCT FORM (Add / Edit)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function SectionHead({ title, sub }) {
  return (
    <div style={{ borderBottom:`2px solid ${C.accent}`, paddingBottom:10, marginBottom:18, marginTop:24 }}>
      <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{title}</div>
      {sub && <div style={{ fontSize:12, color:C.mute, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

export function ProductForm({ initial, onSave, onCancel, employees }) {
  const { brands: catalogBrands, topCategories, getSubcats } = useCatalog();
  const fileInputRef = useRef(null);
  const isEditMode = !!initial;
  const showEmployeePicker = Array.isArray(employees);

  const initEmployeeId = initial
    ? (typeof initial.employee === 'object' ? initial.employee?._id : initial.employee) || ''
    : '';

  const empty = { title:'',description:'',shortDescription:'',brand:'',sku:'',tags:'',price:'',discountPrice:'',stock:'',category:'',isFeatured:false,isHotDeal:false,isPublished:true,returnable:true,returnWindow:7,taxLabel:'No Tax',taxRate:0,employee:initEmployeeId };

  // Derive initial parentCat from the initial category's parent field
  const initCatId = initial ? (typeof initial.category==='object' ? initial.category?._id : initial.category)||'' : '';
  const editInitialParent = isEditMode ? (() => {
    const cat = initial.category;
    if (typeof cat === 'object' && cat?.parent) return (cat.parent?._id || cat.parent) + '';
    return initCatId;
  })() : '';
  const [parentCat, setParentCatRaw, clearParentDraft] = useFormDraft('emp-product-parent', editInitialParent, !isEditMode);
  const setParentCat = (v) => { setParentCatRaw(v); };

  const editInitialForm = isEditMode ? {
    title: initial.title||'', description: initial.description||'',
    shortDescription: initial.shortDescription||'', brand: initial.brand||'',
    price: initial.price||'', discountPrice: initial.discountPrice||'',
    stock: initial.stock??'',
    category: initCatId, sku: initial.sku||'', tags: Array.isArray(initial.tags) ? initial.tags.join(', ') : (initial.tags||''),
    isFeatured: initial.isFeatured||false, isHotDeal: initial.isHotDeal||false, isPublished: initial.isPublished!==false,
    returnable: initial.returnable !== false, returnWindow: initial.returnWindow || 7,
    taxLabel: 'No Tax', taxRate: 0,
    employee: initEmployeeId,
  } : empty;

  const [form, setForm, clearFormDraft] = useFormDraft('emp-product-draft', editInitialForm, !isEditMode);

  const subcats = getSubcats(parentCat);

  const handleParentChange = (e) => {
    const pid = e.target.value;
    setParentCat(pid);
    // If no subcategories exist for this parent, set category to parent itself
    const subs = getSubcats(pid);
    set('category', subs.length > 0 ? '' : pid);
  };

  /* â"€â"€ image state â"€â"€ */
  const [existingImgs, setExistingImgs] = useState(initial?.images || []);
  const [newFiles,     setNewFiles]     = useState([]);      // File objects
  const [newPreviews,  setNewPreviews]  = useState([]);      // data-URL strings
  const [urlImages,    setUrlImages]    = useState([]);      // external image URLs
  const [urlInput,     setUrlInput]     = useState('');      // URL being typed
  const [dragOver,     setDragOver]     = useState(false);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  /* ── category attributes (defined per sub-category in Catalog → Attributes) ── */
  const [allAttrs, setAllAttrs] = useState([]);
  const [attrVals, setAttrVals] = useState({});      // { [attributeName]: selectedOption }
  const attrReconciled = useRef(false);
  useEffect(() => {
    attributesApi.getAll()
      .then(r => setAllAttrs(r.data?.data?.attributes || []))
      .catch(() => {});
  }, []);
  // Attributes whose sub-category matches the product's selected sub-category.
  const subAttrs = allAttrs.filter(a => (a.subcategory?._id || a.subcategory) === form.category);

  const initSpecs = () => {
    if (!initial?.specifications) return [{ key:'', value:'' }];
    const m = initial.specifications instanceof Map ? Object.fromEntries(initial.specifications) : initial.specifications;
    const rows = Object.entries(m || {}).map(([key, value]) => ({ key, value }));
    return rows.length ? rows : [{ key:'', value:'' }];
  };
  const [specs, setSpecs, clearSpecsDraft] = useFormDraft('emp-product-specs', initSpecs(), !isEditMode);
  const [specBulkMode, setSpecBulkMode] = useState(false);
  const [specBulkText, setSpecBulkText] = useState('');
  const addSpec    = () => setSpecs(s => [...s, { key:'', value:'' }]);
  const removeSpec = (i) => setSpecs(s => s.filter((_,j) => j !== i));
  const setSpec    = (i, field, val) => setSpecs(s => s.map((r,j) => j===i ? {...r,[field]:val} : r));

  // ── Colors / Variants (each has its own image, price and stock) ──
  // Pre-fill straight from initial.colors in edit mode (robust direct read).
  const initColors = () => {
    if (!isEditMode || !Array.isArray(initial?.colors)) return [];
    return initial.colors.map(c => ({
      name: c.name || '', image: c.image || '',
      price: c.price ?? '', discountPrice: c.discountPrice ?? '', stock: c.stock ?? '',
    }));
  };
  const [colors, setColors, clearColorsDraft] = useFormDraft('emp-product-colors', initColors(), !isEditMode);
  // Master toggle: only when ON does the product use colors. Defaults ON in edit
  // mode if the product already has colors; OFF otherwise (stays single-stock).
  const [enableColors, setEnableColors] = useState(() => isEditMode && Array.isArray(initial?.colors) && initial.colors.length > 0);
  const addColor    = () => setColors(cs => [...cs, { name:'', image:'', price:'', discountPrice:'', stock:'' }]);
  const removeColor = (i) => setColors(cs => cs.filter((_, j) => j !== i));
  const setColor    = (i, field, val) => setColors(cs => cs.map((c, j) => j === i ? { ...c, [field]: val } : c));
  const toggleColors = (on) => { setEnableColors(on); if (on && colors.length === 0) addColor(); };
  const colorRows   = colors.filter(c => c.name.trim());
  const usingColors = enableColors && colorRows.length > 0;
  const colorStockSum = colorRows.reduce((s, c) => s + (Number(c.stock) || 0), 0);

  // Edit mode: once this sub-category's attributes are known, pull any saved
  // attribute values into the attribute dropdowns and drop those keys from the
  // manual spec rows so they aren't shown (or saved) twice. Runs once.
  //
  // We read the values straight from `initial.specifications` (the product's
  // saved data) rather than from the mutable `specs` state. The old version
  // moved values via a closure split across two setState calls, which was
  // timing-sensitive and could drop them — and since it ALSO removed the rows
  // from `specs`, a failed capture meant the next save wiped the attributes.
  useEffect(() => {
    if (attrReconciled.current || !isEditMode || !allAttrs.length) return;
    const names = new Set(subAttrs.map(a => a.name));
    // This sub-category's attributes may not be resolved yet (allAttrs loads
    // async, and subAttrs depends on form.category). Just wait — do NOT mark
    // reconciliation done, or a single early pass would permanently leave the
    // attribute dropdowns blank on reopen.
    if (!names.size) return;

    const rawSpecs = initial?.specifications instanceof Map
      ? Object.fromEntries(initial.specifications)
      : (initial?.specifications || {});
    const picked = {};
    for (const [k, v] of Object.entries(rawSpecs)) {
      if (names.has(k)) picked[k] = v;
    }

    setAttrVals(v => ({ ...picked, ...v }));
    // Hide attribute keys from the manual spec rows (they're edited via the
    // dropdowns above, not the free-form spec table).
    setSpecs(prev => {
      const kept = prev.filter(r => !names.has(r.key?.trim()));
      return kept.length ? kept : [{ key: '', value: '' }];
    });
    attrReconciled.current = true;
  }, [allAttrs, isEditMode, subAttrs, initial]);

  const mrp    = Number(form.price)||0;
  const sale   = Number(form.discountPrice)||0;
  const disc   = mrp > sale && sale > 0 ? Math.round(((mrp-sale)/mrp)*100) : 0;
  const profit = sale > 0 ? sale : mrp;
  const totalImgs = existingImgs.length + newFiles.length + urlImages.length;

  const addUrl = () => {
    const raw = urlInput.trim();
    if (!raw) return;
    if (!isHttpUrl(raw)) { alert('Enter a full image link starting with http:// or https://'); return; }
    if (totalImgs >= 5) { alert('You can add up to 5 images in total.'); return; }
    // Rewrite Google Drive share links to a directly embeddable form.
    const u = toDirectImageUrl(raw);
    if (existingImgs.includes(u) || urlImages.includes(u)) { setUrlInput(''); return; }
    setUrlImages(prev => [...prev, u]);
    setUrlInput('');
  };
  const removeUrl = (idx) => setUrlImages(prev => prev.filter((_, i) => i !== idx));

  /* â"€â"€ file handling â"€â"€ */
  const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
  const addFiles = (fileList) => {
    const allowed = ['image/jpeg','image/jpg','image/png','image/webp'];
    const all = Array.from(fileList);
    const tooBig = all.filter(f => f.size > MAX_SIZE);
    const valid  = all.filter(f => allowed.includes(f.type) && f.size <= MAX_SIZE);
    if (tooBig.length) {
      alert(`${tooBig.length} file(s) skipped — each image must be under 2 MB.\n\nSkipped:\n${tooBig.map(f=>`• ${f.name} (${(f.size/1024/1024).toFixed(1)} MB)`).join('\n')}`);
    }
    const slots = Math.max(0, 5 - totalImgs);
    const toAdd = valid.slice(0, slots);
    if (!toAdd.length) return;
    setNewFiles(prev => [...prev, ...toAdd]);
    toAdd.forEach(f => {
      const reader = new FileReader();
      reader.onload = e => setNewPreviews(prev => [...prev, e.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const removeExisting = (idx) => setExistingImgs(prev => prev.filter((_,i) => i !== idx));
  const removeNew = (idx) => {
    setNewFiles(prev    => prev.filter((_,i) => i !== idx));
    setNewPreviews(prev => prev.filter((_,i) => i !== idx));
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  /* â"€â"€ submit â"€â"€ */
  const handleSubmit = async () => {
    // When colors are enabled, the top-level stock is derived from them, so it
    // isn't required directly — but at least one named color is.
    const stockOk = usingColors || form.stock !== '';
    if (!form.title||!form.description||!form.price||!stockOk||!form.category) {
      setError('Title, description, price, stock, and category are required.');
      return;
    }
    if (enableColors && colorRows.length === 0) {
      setError('Add at least one color (with a name), or turn off "different colors".');
      return;
    }
    if (showEmployeePicker && !form.employee) {
      setError('Please select a seller / employee for this product.');
      return;
    }
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      // scalar fields
      const tagsArr = form.tags ? form.tags.split(',').map(t=>t.trim()).filter(Boolean) : [];
      const scalar = { ...form, price: Number(form.price), stock: Number(form.stock),
        discountPrice: form.discountPrice ? Number(form.discountPrice) : '',
        returnWindow: form.returnable ? Number(form.returnWindow) : '',
        tags: undefined };
      Object.entries(scalar).forEach(([k,v]) => { if (v !== '' && v !== undefined) fd.append(k, v); });
      tagsArr.forEach(t => fd.append('tags', t));
      // images: tell backend which existing URLs to keep
      existingImgs.forEach(url => fd.append('keepImages', url));
      // new uploads
      newFiles.forEach(f => fd.append('images', f));
      // external image links (stored as-is, not uploaded to Cloudinary)
      urlImages.forEach(u => fd.append('imageUrls', u));
      // specifications — manual key/value rows, then category-attribute
      // selections (these win on key clashes). Only attributes belonging to
      // the currently selected sub-category are saved.
      const specObj = {};
      specs.forEach(({ key, value }) => { if (key.trim()) specObj[key.trim()] = value.trim(); });
      const subAttrNames = new Set(subAttrs.map(a => a.name));
      Object.entries(attrVals).forEach(([k, v]) => {
        if (subAttrNames.has(k) && v && v.trim()) specObj[k] = v.trim();
      });
      if (Object.keys(specObj).length) fd.append('specifications', JSON.stringify(specObj));
      // Colors / variants — always send (even empty) so removing colors / turning
      // off the toggle persists. Empty when the "different colors" toggle is off.
      const colorsPayload = usingColors ? colorRows.map(c => ({
        name: c.name.trim(),
        image: (c.image || '').trim(),
        price: c.price === '' ? undefined : Number(c.price),
        discountPrice: c.discountPrice === '' ? undefined : Number(c.discountPrice),
        stock: Number(c.stock) || 0,
      })) : [];
      fd.append('colors', JSON.stringify(colorsPayload));
      await onSave(fd);
      // Clear draft only after successful save in create mode
      if (!isEditMode) { clearFormDraft(); clearSpecsDraft(); clearParentDraft(); clearColorsDraft(); }
    } catch(err) { setError(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const LS = { display:'block', fontSize:11, fontWeight:700, color:C.mute, marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' };
  const inpStyle = { width:'100%', height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 12px', fontSize:13, outline:'none', background:C.bg, color:C.text, fontFamily:'inherit', boxSizing:'border-box' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {(mrp > 0 || sale > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          <KpiCard label="MRP"         value={fmtRs(mrp)}                               sub="Original price"  colorKey="blue"   iconEl={Icon.tag} />
          <KpiCard label="Sale Price"  value={fmtRs(profit)}                            sub="Customer pays"   colorKey="green"  iconEl={Icon.dollar} />
          <KpiCard label="Discount"    value={disc>0?`${disc}%`:'—'}                    sub="Off MRP"         colorKey="orange" iconEl={Icon.tag} />
          <KpiCard label="Stock Value" value={fmtShort(profit*(Number(form.stock)||0))} sub="At sale price"   colorKey="purple" iconEl={Icon.box} rawValue={profit*(Number(form.stock)||0)} />
        </div>
      )}

      <Card title={initial ? 'Edit Product' : 'Add New Product'}>
        {showEmployeePicker && (
          <div style={{ marginBottom:16, padding:'12px 14px', borderRadius:10, border:`1px solid ${C.accent}44`, background:C.accent+'10' }}>
            <label style={LS}>Seller / Employee *</label>
            <select value={form.employee} onChange={e=>set('employee', e.target.value)} style={{ ...inpStyle, cursor:'pointer' }}>
              <option value="">— Select seller —</option>
              {employees.map(emp => (
                <option key={emp._id} value={emp._id}>
                  {emp.shopName || emp.user?.name || 'Unnamed shop'}{emp.user?.email ? ` · ${emp.user.email}` : ''}
                </option>
              ))}
            </select>
            <div style={{ fontSize:11, color:C.mute, marginTop:6 }}>
              This product will be listed under the selected seller's shop.
            </div>
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div><label style={LS}>Title *</label><input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Product name" style={inpStyle} /></div>
          <div>
            <label style={LS}>Brand</label>
            <select value={form.brand} onChange={e=>set('brand',e.target.value)} style={{ ...inpStyle, cursor:'pointer' }}>
              <option value="">— Select Brand —</option>
              {catalogBrands.map(b => <option key={b._id} value={b.name}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={LS}>Category *</label>
            <select value={parentCat} onChange={handleParentChange} style={{ ...inpStyle, cursor:'pointer' }}>
              <option value="">Select category…</option>
              {topCategories.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={LS}>
              Sub-Category
              {subcats.length === 0 && parentCat && <span style={{ fontWeight:400, textTransform:'none', color:C.mute, marginLeft:6 }}>(none available)</span>}
            </label>
            <select
              value={form.category}
              onChange={e=>set('category', e.target.value)}
              disabled={!parentCat || subcats.length === 0}
              style={{ ...inpStyle, cursor: (!parentCat || subcats.length===0) ? 'not-allowed' : 'pointer', opacity: (!parentCat || subcats.length===0) ? 0.5 : 1 }}>
              <option value="">{parentCat && subcats.length === 0 ? 'No sub-categories' : 'Select sub-category…'}</option>
              {subcats.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div><label style={LS}>Stock *</label>
            {usingColors
              ? <input type="number" value={colorStockSum} disabled title="Auto-calculated from color stock" style={{ ...inpStyle, opacity:0.7, cursor:'not-allowed' }} />
              : <input type="number" value={form.stock} onChange={e=>set('stock',e.target.value)} placeholder="0" style={inpStyle} />}
            {usingColors && <div style={{ fontSize:11, color:C.mute, marginTop:4 }}>= sum of color stock</div>}
          </div>
          <div>
            <label style={LS}>MRP (Rs.) *</label>
            <input type="number" value={form.price} onChange={e=>set('price',e.target.value)} placeholder="0" style={inpStyle} />
          </div>
          <div>
            <label style={LS}>Sale Price (Rs.) <span style={{ color:C.green, textTransform:'none' }}>— Optional</span></label>
            <input type="number" value={form.discountPrice} onChange={e=>set('discountPrice',e.target.value)} placeholder="Leave blank = no discount" style={inpStyle} />
            {disc > 0 && <div style={{ fontSize:12, color:C.green, marginTop:4 }}>{disc}% off MRP</div>}
          </div>
          <div><label style={LS}>SKU / Model No.</label><input value={form.sku} onChange={e=>set('sku',e.target.value)} placeholder="e.g. SM-G998B" style={inpStyle} /></div>
          <div><label style={LS}>Tags <span style={{ color:C.mute, textTransform:'none', fontWeight:400 }}>comma-separated</span></label><input value={form.tags} onChange={e=>set('tags',e.target.value)} placeholder="wireless, bluetooth, sport" style={inpStyle} /></div>
        </div>

        <div style={{ marginTop:16 }}>
          <label style={LS}>Short Description</label>
          <input value={form.shortDescription} onChange={e=>set('shortDescription',e.target.value)} placeholder="Brief product tagline" style={inpStyle} />
        </div>
        <div style={{ marginTop:16 }}>
          <label style={LS}>Full Description *</label>
          <textarea rows={6} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Detailed product description..."
            style={{ ...inpStyle, height:'auto', padding:'10px 12px', resize:'vertical' }} />
        </div>

        {subAttrs.length > 0 && (
          <>
            <SectionHead title="Category Attributes" sub="Options defined for this sub-category in Catalog → Attributes" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {subAttrs.map(a => (
                <div key={a._id}>
                  <label style={LS}>{a.name}{a.unit ? ` (${a.unit})` : ''}</label>
                  <select value={attrVals[a.name] || ''} onChange={e=>setAttrVals(v=>({ ...v, [a.name]: e.target.value }))}
                    style={{ ...inpStyle, cursor:'pointer' }}>
                    <option value="">— Select {a.name} —</option>
                    {(a.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}

        <SectionHead title="Colors / Variants" sub="Optional. Each color has its own image, price and stock. Customers must pick a color before ordering." />
        <label style={{ display:'inline-flex', alignItems:'center', gap:9, padding:'9px 14px', borderRadius:8,
          background: enableColors ? C.accent+'12' : C.bg, border:`1px solid ${enableColors ? C.accent+'55' : C.line}`,
          cursor:'pointer', fontSize:13, fontWeight:600, color:C.text }}>
          <input type="checkbox" checked={enableColors} onChange={e=>toggleColors(e.target.checked)} />
          This product comes in different colors
        </label>
        {enableColors && (
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:12 }}>
          {colors.map((c, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'46px 1.2fr 2fr 1fr 1fr 1fr 32px', gap:8, alignItems:'center' }}>
              <div style={{ width:46, height:46, borderRadius:8, border:`1px solid ${C.line}`, background:C.bg, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {c.image
                  ? <img src={toDirectImageUrl(c.image)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{ e.currentTarget.style.display='none'; }} />
                  : <span style={{ fontSize:9, color:C.mute }}>img</span>}
              </div>
              <input value={c.name} onChange={e=>setColor(i,'name',e.target.value)} placeholder="Color name *" style={inpStyle} />
              <input value={c.image} onChange={e=>setColor(i,'image',e.target.value)} placeholder="Image URL (Drive/any)" style={inpStyle} />
              <input type="number" value={c.price} onChange={e=>setColor(i,'price',e.target.value)} placeholder="MRP" style={inpStyle} />
              <input type="number" value={c.discountPrice} onChange={e=>setColor(i,'discountPrice',e.target.value)} placeholder="Sale" style={inpStyle} />
              <input type="number" value={c.stock} onChange={e=>setColor(i,'stock',e.target.value)} placeholder="Stock" style={inpStyle} />
              <button type="button" onClick={()=>removeColor(i)} title="Remove color"
                style={{ width:32, height:32, borderRadius:8, border:`1px solid ${C.red}44`, background:C.red+'18', color:C.red, cursor:'pointer', fontSize:16, lineHeight:1 }}>×</button>
            </div>
          ))}
          <button type="button" onClick={addColor}
            style={{ alignSelf:'flex-start', padding:'7px 14px', borderRadius:8, border:`1px dashed ${C.line}`, background:C.bg, color:C.accent, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            + Add color
          </button>
          {colorRows.length > 0 && (
            <div style={{ fontSize:11, color:C.mute }}>
              {colorRows.length} color{colorRows.length !== 1 ? 's' : ''} · total stock {colorStockSum}. Leave a color's price blank to use the product's base price.
            </div>
          )}
        </div>
        )}

        <SectionHead title="Product Specifications" sub="Key-value pairs shown in the spec table on the product page" />
        {/* Bulk paste mode */}
        {specBulkMode ? (
          <div>
            <textarea
              autoFocus
              value={specBulkText}
              onChange={e => setSpecBulkText(e.target.value)}
              placeholder={`Paste specs here, one per line:\nCapacity        → 7 KG\nType            → Fully Automatic Top Load\nEnergy Rating   → 5 Star`}
              rows={10}
              style={{ ...inpStyle, width:'100%', resize:'vertical', fontFamily:'monospace', fontSize:13, lineHeight:1.7, height:'auto', padding:'10px 12px', boxSizing:'border-box' }}
            />
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button type="button" onClick={() => {
                const rows = specBulkText.split('\n')
                  .map(line => {
                    const sep = line.includes('→') ? '→' : line.includes(':') ? ':' : null;
                    if (!sep) return null;
                    const idx = line.indexOf(sep);
                    const key = line.slice(0, idx).trim();
                    const value = line.slice(idx + sep.length).trim();
                    return key ? { key, value } : null;
                  })
                  .filter(Boolean);
                if (rows.length) setSpecs(rows);
                setSpecBulkMode(false);
                setSpecBulkText('');
              }}
                style={{ padding:'7px 18px', borderRadius:8, border:'none', background:C.accent, color:'white', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Apply
              </button>
              <button type="button" onClick={() => { setSpecBulkMode(false); setSpecBulkText(''); }}
                style={{ padding:'7px 18px', borderRadius:8, border:`1px solid ${C.line}`, background:'transparent', color:C.mute, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {specs.map((row, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:8, alignItems:'center' }}>
                  <input value={row.key} onChange={e => setSpec(i,'key',e.target.value)}
                    placeholder={['Colour','Capacity','Dimensions','Weight','Material','Warranty'][i] || 'Spec name'}
                    style={inpStyle} />
                  <input value={row.value} onChange={e => setSpec(i,'value',e.target.value)}
                    placeholder="Value" style={inpStyle} />
                  <button type="button" onClick={() => removeSpec(i)} disabled={specs.length===1}
                    style={{ width:32, height:36, borderRadius:8, border:`1px solid ${C.line}`, background:'transparent',
                      color: specs.length===1 ? C.line : C.red, cursor: specs.length===1 ? 'not-allowed' : 'pointer',
                      fontWeight:700, fontSize:16 }}>x</button>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
              <button type="button" onClick={addSpec}
                style={{ padding:'6px 16px', borderRadius:8, border:`1px dashed ${C.accent}`,
                  background:'transparent', color:C.accent, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                + Add Row
              </button>
              <button type="button" onClick={() => setSpecBulkMode(true)}
                style={{ padding:'6px 16px', borderRadius:8, border:`1px dashed ${C.mute}`,
                  background:'transparent', color:C.mute, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Paste Bulk
              </button>
            </div>
            <div style={{ fontSize:11, color:C.mute, marginTop:6 }}>Leave key blank to skip that row.</div>
          </>
        )}

        {/* IMAGE UPLOAD */}
        <div style={{ marginTop:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <label style={LS}>Product Images <span style={{ color:C.sub, textTransform:'none', fontWeight:500 }}>({totalImgs}/5)</span></label>
            <span style={{ fontSize:11, color:C.mute }}>JPEG · PNG · WebP · max 2 MB each</span>
          </div>

          {/* Existing + new previews */}
          {totalImgs > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:12 }}>
              {existingImgs.map((url, i) => (
                <div key={`ex-${i}`} style={{ position:'relative', width:90, height:90, borderRadius:8, overflow:'hidden', border:`1px solid ${C.line}` }}>
                  <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  <button onClick={() => removeExisting(i)} title="Remove"
                    style={{ position:'absolute', top:3, right:3, width:20, height:20, borderRadius:'50%',
                      background:'rgba(0,0,0,.75)', color:'white', border:'none', cursor:'pointer',
                      fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
                    x
                  </button>
                  {i === 0 && <span style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,.6)', color:'white', fontSize:9, fontWeight:700, textAlign:'center', padding:'2px 0' }}>MAIN</span>}
                </div>
              ))}
              {newPreviews.map((src, i) => (
                <div key={`new-${i}`} style={{ position:'relative', width:90, height:90, borderRadius:8, overflow:'hidden', border:`2px solid ${C.accent}` }}>
                  <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  <button onClick={() => removeNew(i)} title="Remove"
                    style={{ position:'absolute', top:3, right:3, width:20, height:20, borderRadius:'50%',
                      background:'rgba(0,0,0,.75)', color:'white', border:'none', cursor:'pointer',
                      fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
                    x
                  </button>
                  <span style={{ position:'absolute', bottom:0, left:0, right:0, background:C.accent+'cc', color:'white', fontSize:9, fontWeight:700, textAlign:'center', padding:'2px 0' }}>NEW</span>
                </div>
              ))}
              {urlImages.map((url, i) => (
                <div key={`url-${i}`} style={{ position:'relative', width:90, height:90, borderRadius:8, overflow:'hidden', border:`2px solid ${C.green}` }}>
                  <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                    onError={e => { e.currentTarget.style.opacity = 0.3; }} />
                  <button onClick={() => removeUrl(i)} title="Remove"
                    style={{ position:'absolute', top:3, right:3, width:20, height:20, borderRadius:'50%',
                      background:'rgba(0,0,0,.75)', color:'white', border:'none', cursor:'pointer',
                      fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
                    x
                  </button>
                  <span style={{ position:'absolute', bottom:0, left:0, right:0, background:C.green+'cc', color:'white', fontSize:9, fontWeight:700, textAlign:'center', padding:'2px 0' }}>LINK</span>
                </div>
              ))}
            </div>
          )}

          {/* Drop zone */}
          {totalImgs < 5 && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              style={{ border:`2px dashed ${dragOver ? C.accent : C.line}`, borderRadius:10, padding:'28px 20px',
                textAlign:'center', cursor:'pointer', background: dragOver ? C.accent+'0a' : C.card2,
                transition:'all .15s' }}>
              <div style={{ fontSize:30, marginBottom:8 }}>🖼</div>
              <div style={{ fontWeight:700, fontSize:13, color:C.text, marginBottom:4 }}>
                Click to upload or drag &amp; drop
              </div>
              <div style={{ fontSize:12, color:C.mute }}>Up to {5-totalImgs} more image{5-totalImgs!==1?'s':''} · Max 2 MB each</div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                style={{ display:'none' }}
                onChange={e => { addFiles(e.target.files); e.target.value=''; }}
              />
            </div>
          )}

          {/* Add image by URL — stored as a link, no upload (saves storage) */}
          {totalImgs < 5 && (
            <div style={{ marginTop:12 }}>
              <label style={{ ...LS, marginBottom:6 }}>Or add image by URL <span style={{ color:C.sub, textTransform:'none', fontWeight:500 }}>— paste a hosted image link</span></label>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
                  placeholder="https://example.com/image.jpg"
                  style={{ ...inpStyle, flex:1 }} />
                <button type="button" onClick={addUrl}
                  style={{ padding:'0 18px', height:36, borderRadius:8, border:`1px solid ${C.green}`,
                    background:'transparent', color:C.green, fontWeight:700, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
                  + Add Link
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:24, marginTop:16, flexWrap:'wrap', alignItems:'center' }}>
          {[['isFeatured','Mark as Featured'],['isHotDeal','🔥 Hot Deal (show in Hot Deals)'],['isPublished','Publish immediately']].map(([k,l])=>(
            <label key={k} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontWeight:600, fontSize:13, color:C.sub }}>
              <input type="checkbox" checked={form[k]} onChange={e=>set(k,e.target.checked)} />
              {l}
            </label>
          ))}
        </div>

        {/* Return Policy */}
        <div style={{ marginTop:18, padding:'14px 16px', borderRadius:10, border:`1px solid ${C.line}`, background:C.card2 }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:C.text, display:'flex', alignItems:'center', gap:8 }}>
            <SvgAt el={Icon.refund} size={14} /> Return Policy
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontWeight:600, fontSize:13, color:C.sub }}>
              <input type="checkbox" checked={form.returnable} onChange={e=>set('returnable',e.target.checked)} />
              Allow Returns
            </label>
            {form.returnable && (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:13, fontWeight:600, color:C.sub }}>Window:</span>
                {[7, 10].map(days => (
                  <button key={days} type="button" onClick={() => set('returnWindow', days)}
                    style={{ padding:'5px 16px', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer',
                      background: form.returnWindow === days ? C.accent : C.bg,
                      color:      form.returnWindow === days ? 'white'   : C.mute,
                      border: `1px solid ${form.returnWindow === days ? C.accent : C.line}` }}>
                    {days} days
                  </button>
                ))}
              </div>
            )}
            {!form.returnable && (
              <span style={{ fontSize:12, color:C.red, fontWeight:600, background:C.red+'14', padding:'4px 10px', borderRadius:6, border:`1px solid ${C.red}33` }}>
                Non-returnable
              </span>
            )}
          </div>
        </div>

        {error &&<div style={{ marginTop:14, color:C.red, fontSize:13, fontWeight:600, background:C.red+'14', padding:'10px 14px', borderRadius:8, border:`1px solid ${C.red}33` }}>{error}</div>}

        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <Btn variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Uploading…' : initial ? 'Save Changes' : 'Add Product'}
          </Btn>
          {onCancel && <Btn onClick={onCancel}>Cancel</Btn>}
        </div>
      </Card>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   RETURNS TAB — employee
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const RETURN_STATUS_META = {
  REQUESTED:         { label:'Requested',        color: C.yellow },
  EMPLOYEE_APPROVED: { label:'You Approved',     color: C.green  },
  EMPLOYEE_REJECTED: { label:'You Rejected',     color: C.red    },
  APPROVED:          { label:'Admin Approved',   color: C.green  },
  REJECTED:          { label:'Admin Rejected',   color: C.red    },
  PICKUP_SCHEDULED:  { label:'Pickup Scheduled', color: C.purple },
  ITEM_RECEIVED:     { label:'Item Received',    color: C.cyan   },
  REFUND_INITIATED:  { label:'Refund Initiated', color: C.accent },
  REFUND_COMPLETED:  { label:'Refund Completed', color: C.green  },
  REPLACEMENT_SENT:  { label:'Replacement Sent', color: C.purple },
  COMPLETED:         { label:'Completed',        color: C.green  },
};

function ReturnBadge({ status }) {
  const m = RETURN_STATUS_META[status] || { label: status, color: C.mute };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700,
      padding:'3px 9px', borderRadius:99, background: m.color+'22', color: m.color, border:`1px solid ${m.color}44` }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background: m.color }} />{m.label}
    </span>
  );
}

function EmployeeReturnsTab() {
  const { isMobile } = useResponsive();
  const [returns, setReturns]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('ALL');
  const [actionId, setActionId]     = useState(null);
  const [note, setNote]             = useState('');
  const [saving, setSaving]         = useState(false);
  const [advanceId, setAdvanceId]   = useState(null); // id of return showing proof upload panel
  const [advanceNote, setAdvanceNote] = useState('');
  const [proofFiles, setProofFiles] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    returnsApi.getEmployeeReturns({ limit: 100 })
      .then(r => setReturns(r.data?.data?.data || r.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const doAction = async (id, action) => {
    setSaving(true);
    try {
      await returnsApi.employeeAction(id, { action, note });
      setActionId(null); setNote('');
      load();
    } catch(e) { alert(e?.response?.data?.message || 'Action failed'); }
    finally { setSaving(false); }
  };

  const doAdvance = async (id, withProof = false) => {
    if (withProof && proofFiles.length === 0) {
      alert('Please upload at least 1 refund proof screenshot before proceeding.');
      return;
    }
    setSaving(true);
    try {
      await returnsApi.employeeAdvance(id, {
        note: withProof ? advanceNote : undefined,
        files: withProof && proofFiles.length ? proofFiles : undefined,
      });
      setAdvanceId(null); setAdvanceNote(''); setProofFiles([]);
      load();
    }
    catch(e) { alert(e?.response?.data?.message || 'Failed to update'); }
    finally { setSaving(false); }
  };

  const filtered = filter === 'ALL' ? returns : returns.filter(r => r.status === filter);
  const stats = {
    pending:   returns.filter(r => r.status === 'REQUESTED').length,
    approved:  returns.filter(r => ['APPROVED','PICKUP_SCHEDULED','ITEM_RECEIVED','REFUND_INITIATED'].includes(r.status)).length,
    completed: returns.filter(r => r.status === 'REFUND_COMPLETED').length,
    rejected:  returns.filter(r => r.status === 'EMPLOYEE_REJECTED').length,
    total:     returns.length,
  };

  const FILTERS = [
    { key:'ALL',               label:'All' },
    { key:'REQUESTED',         label:'Pending' },
    { key:'APPROVED',          label:'Admin OK' },
    { key:'PICKUP_SCHEDULED',  label:'Pickup' },
    { key:'ITEM_RECEIVED',     label:'Received' },
    { key:'REFUND_INITIATED',  label:'Refunding' },
    { key:'REFUND_COMPLETED',  label:'Done' },
    { key:'EMPLOYEE_REJECTED', label:'Rejected' },
  ];

  const ADVANCE_LABELS = {
    APPROVED:         { label:'Schedule Pickup',      next:'PICKUP_SCHEDULED', iconEl:Icon.truck },
    PICKUP_SCHEDULED: { label:'Mark Item Received',   next:'ITEM_RECEIVED',    iconEl:Icon.check },
    ITEM_RECEIVED:    { label:'Initiate Refund',       next:'REFUND_INITIATED', iconEl:Icon.dollar },
    REFUND_INITIATED: { label:'Mark Refund Completed', next:'REFUND_COMPLETED', iconEl:Icon.check },
  };

  const PIPELINE = ['PICKUP_SCHEDULED','ITEM_RECEIVED','REFUND_INITIATED','REFUND_COMPLETED'];
  const PIPELINE_LABELS = { PICKUP_SCHEDULED:'Pickup', ITEM_RECEIVED:'Received', REFUND_INITIATED:'Refund', REFUND_COMPLETED:'Done' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap:12 }}>
        <KpiCard label="Total Returns"  value={stats.total}     colorKey="blue"   iconEl={Icon.refund} />
        <KpiCard label="Pending Action" value={stats.pending}   colorKey="yellow" iconEl={Icon.warn} />
        <KpiCard label="In Progress"    value={stats.approved}  colorKey="green"  iconEl={Icon.truck} />
        <KpiCard label="Completed"      value={stats.completed} colorKey="purple" iconEl={Icon.check} />
        <KpiCard label="Rejected"       value={stats.rejected}  colorKey="red"    iconEl={Icon.x} />
      </div>

      <Card title="Return Requests">
        <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding:'5px 14px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
                border: filter===f.key ? `1px solid ${C.accent}` : `1px solid ${C.line}`,
                background: filter===f.key ? C.accent : C.card2,
                color: filter===f.key ? 'white' : C.sub }}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? <Loader /> : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:C.mute }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:12, opacity:.4 }}><SvgAt el={Icon.box} size={40} /></div>
            <div style={{ fontWeight:700 }}>No return requests</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {filtered.map(req => {
              const isOpen     = actionId === req._id;
              const canAct     = req.status === 'REQUESTED';
              const canAdvance = ['APPROVED','PICKUP_SCHEDULED','ITEM_RECEIVED','REFUND_INITIATED'].includes(req.status);
              const adv        = ADVANCE_LABELS[req.status];
              const pipelineIdx = PIPELINE.indexOf(req.status);

              const isExpanded = expandedId === req._id;

              return (
                <div key={req._id} style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:'hidden' }}>
                  {/* Collapsed header — always visible */}
                  <div
                    onClick={() => setExpandedId(expandedId === req._id ? null : req._id)}
                    style={{
                      background: C.card2,
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, color:C.accent, flexShrink:0 }}>
                      #{req._id?.slice(-8).toUpperCase()}
                    </span>
                    <span style={{ fontSize:13, fontWeight:600, color:C.text, minWidth:100, flexShrink:0 }}>
                      {req.user?.name}
                    </span>
                    <span style={{ fontSize:12, color:C.mute, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {(req.product?.title || '').slice(0, 30)}{(req.product?.title || '').length > 30 ? '…' : ''}
                    </span>
                    <ReturnBadge status={req.status} />
                    <span style={{ fontWeight:700, fontSize:13, color:C.accent, flexShrink:0 }}>
                      {fmtRs(req.refundAmount || 0)}
                    </span>
                    <span style={{ fontSize:11, color:C.mute, flexShrink:0 }}>
                      {new Date(req.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                    </span>
                    <span style={{ fontSize:16, color:C.mute, transition:'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'none', flexShrink:0 }}>▾</span>
                  </div>

                  {/* Expanded body */}
                  {isExpanded && (
                    <>
                      {/* Item info */}
                      <div style={{ padding:'12px 18px', display:'flex', gap:12, alignItems:'center', borderTop:`1px solid ${C.line}` }}>
                        {req.product?.images?.[0]
                          ? <img src={req.product.images[0]} alt="" style={{ width:52, height:52, objectFit:'contain', border:`1px solid ${C.line}`, borderRadius:6 }} />
                          : <div style={{ width:52, height:52, background:C.card2, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', color:C.mute }}><SvgAt el={Icon.box} size={24} /></div>
                        }
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:13, color:C.text }}>{req.product?.title || 'Product'}</div>
                          <div style={{ fontSize:12, color:C.mute, marginTop:2 }}>
                            Reason: <strong style={{color:C.text}}>{REASON_LABEL[req.reason] || req.reason?.replace(/_/g,' ')}</strong>
                            {' · '}Resolution: <strong style={{color:C.sub}}>{req.resolution || 'refund'}</strong>
                          </div>
                          {req.description && <div style={{ fontSize:12, color:C.sub, marginTop:3, fontStyle:'italic' }}>"{req.description}"</div>}
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0, fontSize:12, color:C.mute }}>
                          {req.order?.orderNumber || req.order?._id?.slice(-6)?.toUpperCase() || '—'}
                        </div>
                      </div>

                      {/* Customer evidence — photos & video */}
                      {req.evidence?.length > 0 && (
                        <div style={{ padding:'12px 18px', borderTop:`1px solid ${C.line}`, background:C.bg }}>
                          <div style={{ fontSize:11, fontWeight:700, color:C.accent, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>
                            📸 Return Evidence ({req.evidence.filter(e=>e.type==='image').length} photo{req.evidence.filter(e=>e.type==='image').length!==1?'s':''}
                            {req.evidence.some(e=>e.type==='video') ? ', 1 video' : ''})
                          </div>
                          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-start' }}>
                            {req.evidence.filter(e=>e.type==='image').map((ev, i) => (
                              <a key={i} href={ev.url} target="_blank" rel="noopener noreferrer" title="Click to view full size">
                                <img src={ev.url} alt={`Evidence ${i+1}`}
                                  style={{ width:80, height:80, objectFit:'cover', borderRadius:8, border:`2px solid ${C.line}`, cursor:'zoom-in', display:'block', transition:'all .15s' }}
                                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.transform='scale(1.06)';}}
                                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.line;e.currentTarget.style.transform='scale(1)';}}
                                />
                              </a>
                            ))}
                            {req.evidence.filter(e=>e.type==='video').map((ev, i) => (
                              <a key={`v${i}`} href={ev.url} target="_blank" rel="noopener noreferrer"
                                style={{ width:80, height:80, borderRadius:8, border:`2px solid ${C.blue}55`, background:C.blue+'12', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, textDecoration:'none', cursor:'pointer', transition:'all .15s' }}
                                onMouseEnter={e=>e.currentTarget.style.borderColor=C.blue}
                                onMouseLeave={e=>e.currentTarget.style.borderColor=C.blue+'55'}>
                                <span style={{ fontSize:28 }}>🎬</span>
                                <span style={{ fontSize:9, fontWeight:700, color:C.blue, letterSpacing:'.04em' }}>VIEW VIDEO</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bank / UPI details — always visible for refund returns */}
                      {req.resolution === 'refund' && (
                        <div style={{ padding:'10px 18px', borderTop:`1px solid ${C.line}`, background:C.card2+'99', fontSize:12 }}>
                          <div style={{ fontWeight:700, color:C.blue, marginBottom:5, fontSize:11, textTransform:'uppercase', letterSpacing:'.06em' }}>💳 Refund Details</div>
                          {req.refundMethod === 'bank_transfer' && req.bankDetails?.accountNumber ? (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 18px', color:C.text }}>
                              <span><span style={{ color:C.mute }}>Bank: </span><strong>{req.bankDetails.bankName}</strong></span>
                              <span><span style={{ color:C.mute }}>A/C: </span>···{req.bankDetails.accountNumber.slice(-4)}</span>
                              <span><span style={{ color:C.mute }}>Name: </span>{req.bankDetails.accountName}</span>
                              <span><span style={{ color:C.mute }}>IFSC: </span>{req.bankDetails.ifscCode}</span>
                            </div>
                          ) : req.refundMethod === 'upi' && req.bankDetails?.upiId ? (
                            <div style={{ color:C.text }}>
                              <span style={{ color:C.mute }}>UPI ID: </span><strong>{req.bankDetails.upiId}</strong>
                            </div>
                          ) : req.refundMethod === 'original_payment' ? (
                            <div style={{ color:C.mute }}>Back to original payment method</div>
                          ) : (
                            <div style={{ color:C.yellow, fontWeight:600 }}>
                              ⚠ {req.order?.paymentMethod === 'COD'
                                ? 'COD order — customer has not provided bank/UPI details yet'
                                : 'Customer has not selected a refund method yet'}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pipeline tracker */}
                      {pipelineIdx >= 0 && (
                        <div style={{ padding:'10px 18px', borderTop:`1px solid ${C.line}`, background:C.bg }}>
                          <div style={{ display:'flex', alignItems:'center' }}>
                            {PIPELINE.map((step, i) => {
                              const done   = i < pipelineIdx;
                              const active = i === pipelineIdx;
                              const col    = done ? C.green : active ? C.accent : C.line;
                              return (
                                <div key={step} style={{ display:'flex', alignItems:'center', flex: i < PIPELINE.length-1 ? 1 : 'none' }}>
                                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                                    <div style={{ width:22, height:22, borderRadius:'50%', background: done?C.green:active?C.accent:C.card2, border:`2px solid ${col}`,
                                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color: done||active?'white':C.mute, fontWeight:800 }}>
                                      {done ? <SvgAt el={Icon.check} size={11} /> : i+1}
                                    </div>
                                    <div style={{ fontSize:9, fontWeight:700, color: active?C.accent:done?C.green:C.mute, whiteSpace:'nowrap' }}>
                                      {PIPELINE_LABELS[step]}
                                    </div>
                                  </div>
                                  {i < PIPELINE.length-1 && (
                                    <div style={{ flex:1, height:2, background: done?C.green:C.line, margin:'0 4px', marginBottom:14 }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Approve/Reject panel — only when card is expanded AND action panel is open */}
                      {isExpanded && isOpen && canAct && (
                        <div style={{ padding:'14px 18px', background:C.bg, borderTop:`1px solid ${C.line}` }}>
                          <div style={{ fontSize:13, fontWeight:700, marginBottom:10, color:C.text }}>Your response to customer:</div>
                          <textarea rows={2} value={note} onChange={e=>setNote(e.target.value)}
                            placeholder="Optional note to customer…"
                            style={{ width:'100%', border:`1px solid ${C.line}`, borderRadius:8, padding:'8px 12px', fontSize:13, resize:'none', outline:'none', fontFamily:'inherit', boxSizing:'border-box', marginBottom:10, background:C.card2, color:C.text }} />
                          <div style={{ display:'flex', gap:10 }}>
                            <button onClick={() => doAction(req._id, 'approve')} disabled={saving}
                              style={{ flex:1, padding:'9px', borderRadius:8, background:C.green, color:'white', border:'none', fontWeight:700, fontSize:13, cursor:'pointer', opacity:saving?0.6:1, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                              <SvgAt el={Icon.check} size={14} /> Approve & Start Pickup
                            </button>
                            <button onClick={() => doAction(req._id, 'reject')} disabled={saving}
                              style={{ flex:1, padding:'9px', borderRadius:8, background:C.red, color:'white', border:'none', fontWeight:700, fontSize:13, cursor:'pointer', opacity:saving?0.6:1, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                              <SvgAt el={Icon.x} size={14} /> Reject Return
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Take Action button (only in expanded view, for REQUESTED status) */}
                      {canAct && !isOpen && (
                        <div style={{ padding:'10px 18px', borderTop:`1px solid ${C.line}`, background:C.bg, display:'flex', justifyContent:'flex-end' }}>
                          <button onClick={e => { e.stopPropagation(); setActionId(req._id); }}
                            style={{ padding:'6px 14px', borderRadius:8, background:C.accent, color:'white',
                              border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                            Take Action
                          </button>
                        </div>
                      )}
                      {canAct && isOpen && (
                        <div style={{ padding:'10px 18px', borderTop:`1px solid ${C.line}`, background:C.bg, display:'flex', justifyContent:'flex-end' }}>
                          <button onClick={e => { e.stopPropagation(); setActionId(null); setNote(''); }}
                            style={{ padding:'6px 14px', borderRadius:8, background:C.card, color:C.sub,
                              border:`1px solid ${C.line}`, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                            Close Action
                          </button>
                        </div>
                      )}

                      {/* Refund proof photos */}
                      {req.refundProof?.length > 0 && (
                        <div style={{ padding:'12px 18px', borderTop:`1px solid ${C.line}`, background:C.bg }}>
                          <div style={{ fontSize:11, fontWeight:700, color:C.green, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                            🧾 Refund Proof ({req.refundProof.length})
                          </div>
                          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                            {req.refundProof.map((p,i) => (
                              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
                                <img src={p.url} alt={`proof ${i+1}`}
                                  style={{ width:72, height:72, objectFit:'cover', borderRadius:8, border:`2px solid ${C.green}55`, cursor:'zoom-in', display:'block' }} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Advance button */}
                      {canAdvance && adv && advanceId !== req._id && (
                        <div style={{ padding:'12px 18px', borderTop:`1px solid ${C.line}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:C.bg }}>
                          <div style={{ fontSize:12, color:C.mute }}>
                            Next step: <strong style={{color:C.text}}>{adv.next.replace(/_/g,' ')}</strong>
                          </div>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (['ITEM_RECEIVED','REFUND_INITIATED'].includes(req.status)) {
                                setAdvanceId(req._id); setAdvanceNote(''); setProofFiles([]);
                              } else {
                                doAdvance(req._id, false);
                              }
                            }}
                            disabled={saving}
                            style={{ padding:'8px 20px', borderRadius:8, background:C.green, color:'white', border:'none',
                              fontWeight:700, fontSize:13, cursor:'pointer', opacity:saving?0.6:1, whiteSpace:'nowrap', fontFamily:'inherit', display:'flex', alignItems:'center', gap:7 }}>
                            <SvgAt el={adv.iconEl} size={14} />
                            {saving ? '…' : adv.label}
                          </button>
                        </div>
                      )}

                      {/* Proof upload panel for refund steps */}
                      {canAdvance && adv && advanceId === req._id && (
                        <div style={{ padding:'14px 18px', borderTop:`1px solid ${C.line}`, background:C.bg }}>
                          <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:C.text }}>
                            {adv.label} — Add Refund Proof
                          </div>
                          <div style={{ marginBottom:10 }}>
                            <label style={{ fontSize:11, fontWeight:700, color:C.mute, display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'.06em' }}>
                              Upload Refund Screenshot / Photo <span style={{ color:C.red }}>*</span> <span style={{ fontWeight:400, textTransform:'none' }}>(required, up to 5)</span>
                            </label>
                            <input type="file" accept="image/*" multiple
                              onChange={e => setProofFiles(Array.from(e.target.files || []))}
                              style={{ fontSize:12, color:C.text }} />
                            {proofFiles.length > 0 && (
                              <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                                {proofFiles.map((f,i) => (
                                  <span key={i} style={{ fontSize:11, background:C.card2, borderRadius:6, padding:'2px 8px', color:C.sub }}>
                                    🖼 {f.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ marginBottom:10 }}>
                            <label style={{ fontSize:11, fontWeight:700, color:C.mute, display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'.06em' }}>Note to Customer</label>
                            <textarea rows={2} value={advanceNote} onChange={e=>setAdvanceNote(e.target.value)}
                              placeholder="Optional message about refund…"
                              style={{ width:'100%', border:`1px solid ${C.line}`, borderRadius:8, padding:'8px 12px', fontSize:13, resize:'none', outline:'none', fontFamily:'inherit', boxSizing:'border-box', background:C.card2, color:C.text }} />
                          </div>
                          <div style={{ display:'flex', gap:8 }}>
                            <button onClick={() => doAdvance(req._id, true)} disabled={saving}
                              style={{ padding:'8px 20px', borderRadius:8, background:C.green, color:'white', border:'none', fontWeight:700, fontSize:13, cursor:'pointer', opacity:saving?0.6:1, fontFamily:'inherit', display:'flex', alignItems:'center', gap:7 }}>
                              <SvgAt el={adv.iconEl} size={14} /> {saving ? 'Saving…' : 'Confirm & ' + adv.label}
                            </button>
                            <button onClick={e => { e.stopPropagation(); setAdvanceId(null); setProofFiles([]); setAdvanceNote(''); }}
                              style={{ padding:'8px 16px', borderRadius:8, background:C.card2, border:`1px solid ${C.line}`, fontWeight:600, fontSize:13, cursor:'pointer', color:C.mute }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {req.status === 'REFUND_COMPLETED' && (
                        <div style={{ padding:'10px 18px', background:C.green+'14', borderTop:`1px solid ${C.line}`, fontSize:12, color:C.green, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                          <SvgAt el={Icon.check} size={14} /> Refund completed — this return is closed
                        </div>
                      )}
                      {req.status === 'EMPLOYEE_REJECTED' && (
                        <div style={{ padding:'10px 18px', background:C.red+'14', borderTop:`1px solid ${C.line}`, fontSize:12, color:C.red }}>
                          Return rejected. Admin may review and override.
                        </div>
                      )}

                      {(req.employeeNote || req.adminNote) && (
                        <div style={{ padding:'10px 18px', background:C.card2, borderTop:`1px solid ${C.line}`, fontSize:12, color:C.mute }}>
                          {req.employeeNote && <div><strong style={{color:C.sub}}>Your note:</strong> {req.employeeNote}</div>}
                          {req.adminNote  && <div style={{ marginTop:4 }}><strong style={{color:C.sub}}>Admin note:</strong> {req.adminNote}</div>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN EMPLOYEE DASHBOARD
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/* ─────────────────────────────────────────────────────────
   DELIVERY AREAS TAB
───────────────────────────────────────────────────────── */
function UpayaServicePanel() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState('');
  const [fetchedAt, setFetchedAt] = useState(null);
  const [search, setSearch]       = useState('');

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { data } = force ? await upayaApi.refreshLocations() : await upayaApi.getLocations();
      setLocations(data.data?.locations || []);
      setFetchedAt(data.data?.refreshedAt || data.data?.fetchedAt || new Date().toISOString());
    } catch (err) {
      setError(err?.response?.data?.message || 'Couldn\'t reach Upaya. Check the UPAYA_API_KEY env var on the server.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(false); }, [load]);

  const filtered = locations.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.locationName || '').toLowerCase().includes(q) || (l.address || '').toLowerCase().includes(q);
  });

  return (
    <Card title="🚚 Upaya Delivery Service">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:14 }}>
        <div style={{ fontSize:12, color:C.mute }}>
          Delivery locations are managed by <strong style={{ color:C.text }}>Upaya</strong> and auto-update for admin, employees and customers.
          {fetchedAt && <span> Last synced: {new Date(fetchedAt).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}.</span>}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search city / area…"
            style={{ height:34, padding:'0 12px', border:`1px solid ${C.line}`, borderRadius:8, background:C.bg, color:C.text, fontSize:13, outline:'none' }} />
          <Btn variant="primary" onClick={() => load(true)} disabled={refreshing || loading}>
            {refreshing ? 'Refreshing…' : '↻ Refresh from Upaya'}
          </Btn>
        </div>
      </div>

      {error && (
        <div style={{ padding:'10px 14px', background:C.red+'18', border:`1px solid ${C.red}44`, borderRadius:8, color:C.red, fontSize:13, marginBottom:14 }}>
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:C.mute }}>Loading Upaya locations…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:40, color:C.mute }}>
          {locations.length === 0
            ? 'No locations returned by Upaya. Check that the API key is configured.'
            : `No locations match "${search}".`}
        </div>
      ) : (
        <div style={{ overflowX:'auto', maxHeight:420, overflowY:'auto', border:`1px solid ${C.line}`, borderRadius:8 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:C.card2, position:'sticky', top:0 }}>
                <th style={{ padding:'10px 14px', textAlign:'left', color:C.mute, fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:`1px solid ${C.line}` }}>Location ID</th>
                <th style={{ padding:'10px 14px', textAlign:'left', color:C.mute, fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:`1px solid ${C.line}` }}>City / Location</th>
                <th style={{ padding:'10px 14px', textAlign:'left', color:C.mute, fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:`1px solid ${C.line}` }}>Address</th>
                <th style={{ padding:'10px 14px', textAlign:'left', color:C.mute, fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:`1px solid ${C.line}` }}>Area ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => (
                <tr key={l.locationId || i} style={{ borderBottom:`1px solid ${C.line}`, background: i%2===0 ? 'transparent' : C.card2+'44' }}>
                  <td style={{ padding:'9px 14px', fontFamily:'monospace', color:C.accent, fontWeight:700 }}>{l.locationId}</td>
                  <td style={{ padding:'9px 14px', color:C.text, fontWeight:600 }}>{l.locationName || '—'}</td>
                  <td style={{ padding:'9px 14px', color:C.sub }}>{l.address || '—'}</td>
                  <td style={{ padding:'9px 14px', fontFamily:'monospace', color:C.mute }}>{l.areaId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop:14, padding:'10px 14px', background:C.card2, borderRadius:8, fontSize:12, color:C.mute, border:`1px solid ${C.line}` }}>
        <strong style={{ color:C.text }}>How it works:</strong> Customers pick their city from this Upaya list at checkout.
        Orders are dispatched to Upaya automatically. Rates come live from Upaya per order weight & destination — no need to maintain prices here.
      </div>
    </Card>
  );
}

export function DeliveryAreasTab() {
  const [areas, setAreas]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [editId, setEditId]     = useState(null);
  const empty = { city:'', state:'', pincode:'', deliveryCharge:'' };
  const [form, setForm]         = useState(empty);
  const [showForm, setShowForm] = useState(false);

  // Auto-save create draft (not edit) to sessionStorage
  useEffect(() => {
    if (!editId) {
      try { sessionStorage.setItem('emp-delivery-draft', JSON.stringify(form)); } catch {}
    }
  }, [form, editId]);

  const load = () => {
    setLoading(true);
    deliveryAreasApi.getAllAdmin()
      .then(({ data }) => setAreas(data.data?.areas || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.city.trim()) { setError('City / location is required'); return; }
    const charge = form.deliveryCharge === '' ? 0 : Number(form.deliveryCharge);
    setSaving(true); setError('');
    try {
      if (editId) {
        await deliveryAreasApi.update(editId, { ...form, deliveryCharge: charge });
      } else {
        await deliveryAreasApi.create({ ...form, deliveryCharge: charge });
        try { sessionStorage.removeItem('emp-delivery-draft'); } catch {}
      }
      setForm(empty); setEditId(null); setShowForm(false); load();
    } catch (e) { setError(e?.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleEdit = (a) => {
    setForm({ city: a.city||'', state: a.state||'', pincode: a.pincode||'', deliveryCharge: a.deliveryCharge });
    setEditId(a._id); setShowForm(true); setError('');
  };

  const handleToggle = async (a) => {
    await deliveryAreasApi.update(a._id, { isActive: !a.isActive });
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this delivery area?')) return;
    await deliveryAreasApi.remove(id);
    load();
  };

  const LS = { display:'block', fontSize:11, fontWeight:700, color:C.mute, marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' };
  const inpStyle = { width:'100%', height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 12px', fontSize:13, outline:'none', background:C.bg, color:C.text, fontFamily:'inherit', boxSizing:'border-box' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <UpayaServicePanel />
      <Card title="Custom / Fallback Delivery Areas">
        <div style={{ fontSize:12, color:C.mute, marginBottom:14 }}>
          Optional manual overrides for cities that aren't yet on Upaya. Most stores can leave this empty — Upaya covers it.
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
          <Btn variant="primary" onClick={() => {
            if (!showForm) {
              // Restore any saved draft when opening create form
              try { const s = sessionStorage.getItem('emp-delivery-draft'); setForm(s ? { ...empty, ...JSON.parse(s) } : empty); } catch { setForm(empty); }
            }
            setEditId(null); setShowForm(s => !s); setError('');
          }}>
            {showForm && !editId ? 'Cancel' : showForm ? 'Cancel' : '+ Add City'}
          </Btn>
        </div>

        {showForm && (
          <div style={{ background:C.card2, border:`1px solid ${C.line}`, borderRadius:12, padding:20, marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:14, color:C.text, marginBottom:16 }}>
              {editId ? 'Edit Delivery Area' : 'Add New Delivery Area'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
              <div>
                <label style={LS}>City / Location *</label>
                <input value={form.city} onChange={e=>set('city',e.target.value)}
                  placeholder="e.g. Kathmandu" style={inpStyle} />
              </div>
              <div>
                <label style={LS}>State / Province</label>
                <input value={form.state} onChange={e=>set('state',e.target.value)}
                  placeholder="e.g. Bagmati" style={inpStyle} />
              </div>
              <div>
                <label style={LS}>Pincode (optional)</label>
                <input value={form.pincode} onChange={e=>set('pincode', e.target.value)}
                  placeholder="Leave blank if N/A" style={inpStyle} />
              </div>
              <div>
                <label style={LS}>Delivery Charge (Rs.) — blank = Free</label>
                <input type="number" min="0" value={form.deliveryCharge} onChange={e=>set('deliveryCharge',e.target.value)}
                  placeholder="0 = Free delivery" style={inpStyle} />
              </div>
            </div>
            {error && <div style={{ marginTop:12, color:C.red, fontSize:13, fontWeight:600 }}>{error}</div>}
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <Btn variant="primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Area'}
              </Btn>
              <Btn onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Btn>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:C.mute }}>Loading...</div>
        ) : areas.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:C.mute }}>
            <div style={{ fontSize:40, marginBottom:8 }}>📍</div>
            <div>No delivery areas added yet.</div>
            <div style={{ fontSize:12, marginTop:4 }}>Add cities to enable delivery checking for customers.</div>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:C.card2 }}>
                  {['City / Location','State','Pincode','Delivery Charge','Status','Actions'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', color:C.mute, fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:`1px solid ${C.line}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {areas.map((a, i) => (
                  <tr key={a._id} style={{ borderBottom:`1px solid ${C.line}`, background: i%2===0?'transparent':C.card2+'44' }}>
                    <td style={{ padding:'10px 14px', fontWeight:700, color:C.text }}>{a.city || '—'}</td>
                    <td style={{ padding:'10px 14px', color:C.sub }}>{a.state || '—'}</td>
                    <td style={{ padding:'10px 14px', color:C.sub, fontFamily:'monospace' }}>{a.pincode || '—'}</td>
                    <td style={{ padding:'10px 14px', color: a.deliveryCharge===0 ? C.green : C.text, fontWeight:600 }}>
                      {a.deliveryCharge === 0 ? 'Free' : `Rs. ${a.deliveryCharge}`}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <button onClick={() => handleToggle(a)}
                        style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, cursor:'pointer', border:'none',
                          background: a.isActive ? C.green+'22' : C.red+'22',
                          color: a.isActive ? C.green : C.red }}>
                        {a.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => handleEdit(a)}
                          style={{ padding:'4px 12px', borderRadius:6, border:`1px solid ${C.line}`, background:'transparent', color:C.accent, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(a._id)}
                          style={{ padding:'4px 12px', borderRadius:6, border:`1px solid ${C.red}33`, background:C.red+'14', color:C.red, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop:16, padding:'12px 16px', background:C.card2, borderRadius:8, fontSize:12, color:C.mute, border:`1px solid ${C.line}` }}>
          <strong style={{ color:C.text }}>Tip:</strong> Set delivery charge to <strong style={{ color:C.green }}>0</strong> for free delivery in that area. Customers will see delivery availability before placing an order.
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   EMPLOYEE SETTINGS TAB  (identical to admin settings)
══════════════════════════════════════════════════════ */
function EmployeeSettingsTab() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    settingsApi.getCodSettings()
      .then(r => {
        const s = r.data?.data?.codSettings || {};
        setCfg({
          minOrderAmount: s.minOrderAmount ?? 0,
          maxOrderAmount: s.maxOrderAmount ?? 0,
          codEnabled:     s.codEnabled     ?? true,
          bookingEnabled: s.bookingEnabled ?? false,
          bookingType:    s.bookingType    ?? 'flat',
          bookingValue:   s.bookingValue   ?? 500,
        });
      })
      .catch(() => {});
  }, []);

  const set = (k, v) => setCfg(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    await settingsApi.updateCodSettings(cfg).catch(() => {});
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (!cfg) return <div style={{ padding: 40, textAlign: 'center', color: C.mute }}>Loading settings…</div>;

  const inp = {
    width: '100%', height: 40, padding: '0 12px',
    border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, fontWeight: 600,
    outline: 'none', boxSizing: 'border-box', background: C.bg, color: C.text, fontFamily: 'inherit',
  };
  const lbl = { fontSize: 11.5, fontWeight: 600, color: C.mute, display: 'block', marginBottom: 6 };

  function Toggle({ on, onChange }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={onChange}>
        <div style={{ position: 'relative', width: 44, height: 24 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 12, background: on ? C.accent : C.mute, transition: 'background .2s' }} />
          <div style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: on ? C.green : C.mute, minWidth: 52 }}>{on ? 'Enabled' : 'Disabled'}</span>
      </div>
    );
  }

  const numVal = v => v === 0 ? '' : v;
  const numChg = (k) => (e) => set(k, e.target.value === '' ? 0 : Number(e.target.value));

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.line}`, overflow: 'hidden' }}>

        {/* Order limits */}
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 2 }}>COD Order Amount Limits</div>
          <div style={{ fontSize: 11.5, color: C.mute, marginBottom: 14 }}>Applies to COD orders only. Online (Razorpay) orders have no restrictions. Leave empty for no limit.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Minimum Amount (Rs.)</label>
              <input type="number" min="0" value={numVal(cfg.minOrderAmount)} placeholder="No minimum"
                onChange={numChg('minOrderAmount')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Maximum Amount (Rs.)</label>
              <input type="number" min="0" value={numVal(cfg.maxOrderAmount)} placeholder="No maximum"
                onChange={numChg('maxOrderAmount')} style={inp} />
            </div>
          </div>
        </div>

        {/* COD toggle + Booking toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ padding: '18px 22px', borderRight: `1px solid ${C.line}` }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 2 }}>Cash on Delivery</div>
            <div style={{ fontSize: 11.5, color: C.mute, marginBottom: 14 }}>Allow customers to pay cash on delivery.</div>
            <Toggle on={cfg.codEnabled} onChange={() => set('codEnabled', !cfg.codEnabled)} />
          </div>
          <div style={{ padding: '18px 22px' }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 2 }}>COD Booking Amount</div>
            <div style={{ fontSize: 11.5, color: C.mute, marginBottom: 14 }}>Collect non-refundable advance via Razorpay for COD orders.</div>
            <Toggle on={cfg.bookingEnabled} onChange={() => set('bookingEnabled', !cfg.bookingEnabled)} />
          </div>
        </div>

        {/* Booking fields (only when enabled) */}
        {cfg.bookingEnabled && (
          <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.line}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Booking Amount Type</label>
                <select value={cfg.bookingType} onChange={e => set('bookingType', e.target.value)}
                  style={{ ...inp, fontWeight: 500 }}>
                  <option value="flat">Fixed Amount (Rs.)</option>
                  <option value="percent">Percentage of Order (%)</option>
                </select>
              </div>
              <div>
                <label style={lbl}>{cfg.bookingType === 'percent' ? 'Percentage (%)' : 'Amount (Rs.)'}</label>
                <input type="number" min="0" max={cfg.bookingType === 'percent' ? 100 : undefined}
                  value={numVal(cfg.bookingValue)} placeholder="e.g. 500"
                  onChange={numChg('bookingValue')} style={inp} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ background: C.accent + '12', border: `1px solid ${C.accent}30`, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: C.accent, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Preview</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
                  {cfg.bookingType === 'percent' ? `${cfg.bookingValue || 0}% of order total` : `Rs. ${Number(cfg.bookingValue || 0).toLocaleString('en-IN')}`}
                </div>
                <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>Razorpay (UPI) · Non-refundable</div>
              </div>
              <div style={{ background: 'rgba(239,68,68,.08)', border: `1px solid rgba(239,68,68,.2)`, borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#f87171', lineHeight: 1.5 }}>
                ⚠ This booking is <span style={{ fontWeight: 700 }}>non-refundable</span> and collected before the order is confirmed.
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Btn variant="primary" onClick={save} disabled={saving} style={{ padding: '9px 26px' }}>
            {saving ? 'Saving…' : 'Save Settings'}
          </Btn>
          {saved && <span style={{ color: C.green, fontWeight: 600, fontSize: 13 }}>✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MY SALARY TAB
════════════════════════════════════════════════════════════════ */
const SAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function MySalaryTab() {
  const [records, setRecords]         = useState([]);
  const [monthlySalary, setMonthlySal] = useState(0);
  const [designation, setDesignation]  = useState('');
  const [joiningDate, setJoiningDate]  = useState(null);
  const [loading, setLoading]          = useState(true);

  useEffect(() => {
    employeeApi.getMySalary()
      .then(r => {
        setRecords(r.data?.data?.records || []);
        setMonthlySal(r.data?.data?.monthlySalary || 0);
        setDesignation(r.data?.data?.designation || '');
        setJoiningDate(r.data?.data?.joiningDate || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalPaid    = records.filter(r=>r.status==='PAID').reduce((s,r)=>s+r.netSalary,0);
  const totalPending = records.filter(r=>r.status==='PENDING').reduce((s,r)=>s+r.netSalary,0);

  if (loading) return <div style={{ padding:40, textAlign:'center', color:C.mute }}>Loading salary information…</div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Info strip */}
      {(designation || joiningDate) && (
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          {designation && (
            <div style={{ padding:'10px 18px', background:C.card, border:`1px solid ${C.line}`, borderRadius:10, fontSize:13 }}>
              <span style={{ color:C.mute, fontSize:11, textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:2 }}>Designation</span>
              <strong>{designation}</strong>
            </div>
          )}
          {joiningDate && (
            <div style={{ padding:'10px 18px', background:C.card, border:`1px solid ${C.line}`, borderRadius:10, fontSize:13 }}>
              <span style={{ color:C.mute, fontSize:11, textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:2 }}>Joined</span>
              <strong>{new Date(joiningDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</strong>
            </div>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        <KpiCard label="Monthly Salary"  value={`Rs. ${monthlySalary.toLocaleString('en-IN')}`}  sub="Base amount"        colorKey="blue"   iconEl={Icon.dollar} />
        <KpiCard label="Total Received"  value={`Rs. ${totalPaid.toLocaleString('en-IN')}`}       sub="All-time paid"      colorKey="green"  iconEl={Icon.check} />
        <KpiCard label="Pending"         value={`Rs. ${totalPending.toLocaleString('en-IN')}`}    sub="Awaiting payment"   colorKey="yellow" iconEl={Icon.bell} />
      </div>

      {/* Salary records */}
      {records.length === 0 ? (
        <Card>
          <div style={{ textAlign:'center', padding:'40px 0', color:C.mute, fontSize:13 }}>No salary records yet. Records will appear here once admin adds them.</div>
        </Card>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {records.map(rec => {
            const dedTotal = rec.deductions.reduce((s,d)=>s+d.amount,0);
            const bonTotal = rec.bonuses.reduce((s,b)=>s+b.amount,0);
            return (
              <Card key={rec._id} title={`${SAL_MONTHS[rec.month-1]} ${rec.year}`}
                action={<span style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, background:rec.status==='PAID'?C.green+'20':C.yellow+'20', color:rec.status==='PAID'?C.green:C.yellow }}>{rec.status}</span>}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:14, marginBottom: (rec.deductions.length||rec.bonuses.length||rec.notes)?16:0 }}>
                  <div>
                    <div style={{ fontSize:10, color:C.mute, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>Base Salary</div>
                    <div style={{ fontSize:18, fontWeight:800, color:C.text }}>Rs. {rec.baseSalary.toLocaleString('en-IN')}</div>
                  </div>
                  {dedTotal>0 && (
                    <div>
                      <div style={{ fontSize:10, color:C.mute, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>Deductions</div>
                      <div style={{ fontSize:18, fontWeight:800, color:'#f87171' }}>-Rs. {dedTotal.toLocaleString('en-IN')}</div>
                    </div>
                  )}
                  {bonTotal>0 && (
                    <div>
                      <div style={{ fontSize:10, color:C.mute, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>Bonuses</div>
                      <div style={{ fontSize:18, fontWeight:800, color:C.green }}>+Rs. {bonTotal.toLocaleString('en-IN')}</div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize:10, color:C.mute, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>Net Salary</div>
                    <div style={{ fontSize:18, fontWeight:800, color:C.blue }}>Rs. {rec.netSalary.toLocaleString('en-IN')}</div>
                  </div>
                </div>

                {rec.deductions.length>0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f87171', marginBottom:4 }}>Deductions</div>
                    {rec.deductions.map((d,i)=>(
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:`1px solid ${C.line}` }}>
                        <span style={{ color:C.sub }}>{d.reason}</span>
                        <span style={{ fontWeight:700, color:'#f87171' }}>-Rs. {d.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}
                {rec.bonuses.length>0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.green, marginBottom:4 }}>Bonuses</div>
                    {rec.bonuses.map((b,i)=>(
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:`1px solid ${C.line}` }}>
                        <span style={{ color:C.sub }}>{b.reason}</span>
                        <span style={{ fontWeight:700, color:C.green }}>+Rs. {b.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}
                {rec.notes && <div style={{ fontSize:12, color:C.mute, fontStyle:'italic', marginTop:4 }}>Note: {rec.notes}</div>}
                {rec.paidAt && <div style={{ fontSize:11, color:C.mute, marginTop:4 }}>Paid on {new Date(rec.paidAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   EMPLOYEE COUPONS TAB
════════════════════════════════════════════════════════════════ */
const EMPTY_COUPON_EMP = {
  code: '', discountType: 'PERCENTAGE', discountValue: '',
  minimumAmount: '', maximumDiscount: '', expiryDate: '',
  usageLimit: '', isActive: true, visibility: 'hidden',
  applicableBrands: [], applicableCategories: [], applicableSubcategories: [],
  freebieProduct: '', freebieQuantity: 1,
};

function EmployeeCouponsTab() {
  const { brands, topCategories, subCategories } = useCatalog();
  const [coupons, setCoupons]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState(EMPTY_COUPON_EMP);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(null);
  // Product list for the FREEBIE picker — loaded once on mount.
  const [products, setProducts] = useState([]);
  useEffect(() => {
    productsApi.getAll({ limit: 500 })
      .then(r => setProducts(r.data?.data?.data || r.data?.data?.products || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) {
      try { sessionStorage.setItem('emp-coupon-draft', JSON.stringify(form)); } catch {}
    }
  }, [form, editId]);

  const load = useCallback(() => {
    setLoading(true);
    couponsApi.getAll({ limit: 100 })
      .then(r => setCoupons(r.data?.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => {
    let draft = EMPTY_COUPON_EMP;
    try { const s = sessionStorage.getItem('emp-coupon-draft'); if (s) draft = { ...EMPTY_COUPON_EMP, ...JSON.parse(s) }; } catch {}
    setForm(draft); setEditId(null); setError(''); setShowForm(true);
  };

  const openEdit = (c) => {
    setForm({
      code: c.code, discountType: c.discountType, discountValue: c.discountValue,
      minimumAmount: c.minimumAmount || '', maximumDiscount: c.maximumDiscount || '',
      expiryDate: c.expiryDate ? c.expiryDate.slice(0, 10) : '',
      usageLimit: c.usageLimit || '', isActive: c.isActive,
      visibility: c.visibility || 'hidden',
      applicableBrands:        (c.applicableBrands        || []).map(x => x?._id || x),
      applicableCategories:    (c.applicableCategories    || []).map(x => x?._id || x),
      applicableSubcategories: (c.applicableSubcategories || []).map(x => x?._id || x),
      freebieProduct:  c.freebieProduct?._id || c.freebieProduct || '',
      freebieQuantity: c.freebieQuantity || 1,
    });
    setEditId(c._id); setError(''); setShowForm(true);
  };

  const handleSubmit = async () => {
    const isFreebie      = form.discountType === 'FREEBIE';
    const isFreeShipping = form.discountType === 'FREE_SHIPPING';
    const needsValue     = !isFreebie && !isFreeShipping;
    if (!form.code || !form.expiryDate) {
      setError('Code and expiry date are required.'); return;
    }
    if (needsValue && !form.discountValue) {
      setError('Discount value is required.'); return;
    }
    if (isFreebie && !form.freebieProduct) {
      setError('Pick a free gift product for this coupon.'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        code: form.code.toUpperCase(),
        discountType: form.discountType,
        discountValue: needsValue ? Number(form.discountValue) : 0,
        minimumAmount: form.minimumAmount ? Number(form.minimumAmount) : 0,
        maximumDiscount: form.maximumDiscount ? Number(form.maximumDiscount) : undefined,
        expiryDate: form.expiryDate,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        isActive: form.isActive,
        visibility: form.visibility || 'hidden',
        applicableBrands:        form.applicableBrands.length        ? form.applicableBrands        : [],
        applicableCategories:    form.applicableCategories.length    ? form.applicableCategories    : [],
        applicableSubcategories: form.applicableSubcategories.length ? form.applicableSubcategories : [],
        freebieProduct:  isFreebie ? form.freebieProduct          : null,
        freebieQuantity: isFreebie ? (Number(form.freebieQuantity) || 1) : 1,
      };
      if (editId) await couponsApi.update(editId, payload);
      else {
        await couponsApi.create(payload);
        try { sessionStorage.removeItem('emp-coupon-draft'); } catch {}
      }
      setShowForm(false); load();
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to save coupon.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this coupon?')) return;
    setDeleting(id);
    try { await couponsApi.delete(id); load(); }
    catch (e) { alert(e?.response?.data?.message || 'Delete failed'); }
    finally { setDeleting(null); }
  };

  const handleToggle = async (c) => {
    try { await couponsApi.update(c._id, { isActive: !c.isActive }); load(); }
    catch { alert('Update failed'); }
  };

  const now = new Date();
  const active  = coupons.filter(c => c.isActive && new Date(c.expiryDate) > now).length;
  const expired = coupons.filter(c => new Date(c.expiryDate) <= now).length;
  const inactive = coupons.filter(c => !c.isActive).length;

  const LabelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: C.mute, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' };
  const InpStyle   = { height: 36, border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 12px', fontSize: 13, outline: 'none', background: C.bg, color: C.text, width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        <KpiCard label="Total Coupons" value={coupons.length} colorKey="blue"   iconEl={Icon.coupon} />
        <KpiCard label="Active"        value={active}         colorKey="green"  iconEl={Icon.shield} />
        <KpiCard label="Expired"       value={expired}        colorKey="red"    iconEl={Icon.bell}   />
        <KpiCard label="Inactive"      value={inactive}       colorKey="yellow" iconEl={Icon.lock}   />
      </div>

      {/* Create button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={openCreate}
          style={{ padding: '10px 22px', borderRadius: 10, background: C.accent, color: 'white', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Create Coupon
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <Card title={editId ? '✏️ Edit Coupon' : '🎟️ New Coupon'}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={LabelStyle}>Coupon Code *</label>
              <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="e.g. SAVE20"
                className="inp-dark"
                style={{ ...InpStyle, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }} />
            </div>
            <div>
              <label style={LabelStyle}>Discount Type *</label>
              <select value={form.discountType} onChange={e => set('discountType', e.target.value)} style={{ ...InpStyle, cursor: 'pointer' }}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (Rs.)</option>
                <option value="FREEBIE">Freebie (free product)</option>
                <option value="FREE_SHIPPING">Free Shipping (waive delivery)</option>
              </select>
            </div>
            {form.discountType === 'FREEBIE' ? (
              <div>
                <label style={LabelStyle}>Free Gift Product *</label>
                <select value={form.freebieProduct} onChange={e => set('freebieProduct', e.target.value)} style={{ ...InpStyle, cursor: 'pointer' }}>
                  <option value="">— Select a product —</option>
                  {products.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.title} {typeof p.stock === 'number' ? `(stock: ${p.stock})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : form.discountType === 'FREE_SHIPPING' ? (
              <div>
                <label style={LabelStyle}>Coupon Effect</label>
                <div style={{ ...InpStyle, display:'flex', alignItems:'center', gap:8, background:C.bg, color:C.text }}>
                  🚚 Waives the delivery charge on this order
                </div>
              </div>
            ) : (
              <div>
                <label style={LabelStyle}>Discount Value * {form.discountType === 'PERCENTAGE' ? '(%)' : '(Rs.)'}</label>
                <input type="number" min="0" value={form.discountValue} onChange={e => set('discountValue', e.target.value)}
                  placeholder={form.discountType === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 500'} style={InpStyle} />
              </div>
            )}
            {form.discountType === 'FREEBIE' && (
              <div>
                <label style={LabelStyle}>Free Gift Quantity</label>
                <input type="number" min="1" max="10" value={form.freebieQuantity} onChange={e => set('freebieQuantity', e.target.value)}
                  placeholder="1" style={InpStyle} />
              </div>
            )}
            <div>
              <label style={LabelStyle}>Expiry Date *</label>
              <input type="date" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)}
                min={new Date().toISOString().slice(0, 10)} style={InpStyle} />
            </div>
            <div>
              <label style={LabelStyle}>Minimum Order (Rs.)</label>
              <input type="number" min="0" value={form.minimumAmount} onChange={e => set('minimumAmount', e.target.value)}
                placeholder="0 = no minimum" style={InpStyle} />
            </div>
            {form.discountType !== 'FREEBIE' && form.discountType !== 'FREE_SHIPPING' && (
              <div>
                <label style={LabelStyle}>Max Discount Cap (Rs.) <span style={{ color: C.mute, fontWeight: 400 }}>— for % coupons</span></label>
                <input type="number" min="0" value={form.maximumDiscount} onChange={e => set('maximumDiscount', e.target.value)}
                  placeholder="Leave blank = no cap" style={InpStyle} />
              </div>
            )}
            <div>
              <label style={LabelStyle}>Usage Limit</label>
              <input type="number" min="1" value={form.usageLimit} onChange={e => set('usageLimit', e.target.value)}
                placeholder="Leave blank = unlimited" style={InpStyle} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: C.text }}>
                <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} />
                Active (users can apply this coupon)
              </label>
            </div>
            <div>
              <label style={LabelStyle}>Visibility</label>
              <select value={form.visibility} onChange={e => set('visibility', e.target.value)}
                style={{ ...InpStyle, cursor: 'pointer' }}>
                <option value="hidden">Hidden — manual apply only (default)</option>
                <option value="new_users">First-order users only — show to new users</option>
                <option value="everyone">Everyone — show on home page</option>
              </select>
            </div>
          </div>

          {/* Applicable To */}
          <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 10, border: `1px solid ${C.line}`, background: C.card2 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.text, marginBottom: 2 }}>Applicable To</div>
            <div style={{ fontSize: 12, color: C.mute, marginBottom: 12 }}>Leave all empty → coupon applies to all products</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: '🏷️ Brands', key: 'applicableBrands', list: brands },
                { label: '📂 Categories', key: 'applicableCategories', list: topCategories },
                { label: '📁 Sub-categories', key: 'applicableSubcategories', list: subCategories },
              ].map(({ label, key, list }) => (
                <div key={key}>
                  <label style={LabelStyle}>{label}</label>
                  <select onChange={e => { const v = e.target.value; if (v && !form[key].includes(v)) set(key, [...form[key], v]); e.target.value = ''; }}
                    style={{ ...InpStyle, cursor: 'pointer' }}>
                    <option value="">Add…</option>
                    {list.filter(x => !form[key].includes(x._id)).map(x => <option key={x._id} value={x._id}>{x.name}</option>)}
                  </select>
                  {form[key].length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {form[key].map(id => {
                        const item = list.find(x => x._id === id);
                        return item ? (
                          <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.accent + '22', color: C.accent, fontSize: 11, fontWeight: 700, padding: '2px 8px 2px 10px', borderRadius: 99, border: `1px solid ${C.accent}44` }}>
                            {item.name}
                            <button type="button" onClick={() => set(key, form[key].filter(x => x !== id))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0 0 0 2px', lineHeight: 1, fontSize: 14 }}>×</button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 12, color: C.red, fontSize: 13, fontWeight: 600, background: C.red + '10', padding: '8px 12px', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={handleSubmit} disabled={saving}
              style={{ padding: '10px 24px', borderRadius: 8, background: C.green, color: 'white', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Coupon'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '10px 18px', borderRadius: 8, background: C.card, border: `1px solid ${C.line}`, fontWeight: 600, fontSize: 13, cursor: 'pointer', color: C.mute }}>
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* Coupons table */}
      <Card title={`All Coupons (${coupons.length})`}>
        {loading
          ? <div style={{ padding: 40, textAlign: 'center', color: C.mute }}>Loading…</div>
          : coupons.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: C.mute }}>No coupons yet. Create one above.</div>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['Code', 'Type', 'Value', 'Min Order', 'Cap', 'Usage', 'Expiry', 'Status', 'Visibility', 'Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: C.mute, letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {coupons.map(c => {
                      const isExpired  = new Date(c.expiryDate) <= now;
                      const daysLeft   = Math.ceil((new Date(c.expiryDate) - now) / 86400000);
                      const statusColor = isExpired ? C.red : !c.isActive ? C.mute : C.green;
                      const statusLabel = isExpired ? 'Expired' : !c.isActive ? 'Inactive' : 'Active';
                      return (
                        <tr key={c._id} style={{ background: isExpired ? C.red + '10' : C.card }}>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.line}` }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, background: C.bg, color: C.text, padding: '3px 8px', borderRadius: 6, letterSpacing: '.08em' }}>
                              {c.code}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.line}`, fontSize: 12, color: C.mute }}>
                            {c.discountType === 'PERCENTAGE'       ? 'Percentage'
                              : c.discountType === 'FIXED'         ? 'Fixed'
                              : c.discountType === 'FREE_SHIPPING' ? '🚚 Free Shipping'
                              : '🎁 Freebie'}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.line}`, fontWeight: 700, fontSize: 13, color: C.green }}>
                            {c.discountType === 'PERCENTAGE'       ? `${c.discountValue}%`
                              : c.discountType === 'FIXED'         ? `Rs. ${c.discountValue}`
                              : c.discountType === 'FREE_SHIPPING' ? 'Waives delivery'
                              : (c.freebieProduct?.title
                                  ? `${c.freebieQuantity || 1}× ${c.freebieProduct.title}`
                                  : '— gift unavailable')}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.line}`, fontSize: 12, color: C.mute }}>
                            {c.minimumAmount > 0 ? `Rs. ${c.minimumAmount}` : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.line}`, fontSize: 12, color: C.mute }}>
                            {c.maximumDiscount ? `Rs. ${c.maximumDiscount}` : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.line}`, fontSize: 12 }}>
                            <span style={{ color: c.usageLimit && c.usedCount >= c.usageLimit ? C.red : C.mute }}>
                              {c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ' used'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.line}`, fontSize: 12, whiteSpace: 'nowrap' }}>
                            <div style={{ color: isExpired ? C.red : daysLeft <= 3 ? C.yellow : C.text, fontWeight: isExpired || daysLeft <= 3 ? 700 : 400 }}>
                              {new Date(c.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            {!isExpired && <div style={{ fontSize: 11, color: daysLeft <= 3 ? C.red : C.mute }}>{daysLeft}d left</div>}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.line}` }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: statusColor + '20', color: statusColor }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor }} />{statusLabel}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.line}`, fontSize: 12, whiteSpace: 'nowrap' }}>
                            {c.visibility === 'new_users'
                              ? <span style={{ color: C.yellow, fontWeight: 700 }}>First-order Users</span>
                              : c.visibility === 'hidden'
                              ? <span style={{ color: C.mute }}>Hidden</span>
                              : <span style={{ color: C.green }}>Everyone</span>}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.line}` }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => openEdit(c)}
                                style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: C.bg, border: `1px solid ${C.line}`, cursor: 'pointer', color: C.text }}>
                                ✏️ Edit
                              </button>
                              <button onClick={() => handleToggle(c)}
                                style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: c.isActive ? C.red + '18' : '#22c55e18', border: `1px solid ${c.isActive ? C.red : C.green}40`, cursor: 'pointer', color: c.isActive ? C.red : C.green }}>
                                {c.isActive ? 'Disable' : 'Enable'}
                              </button>
                              <button onClick={() => handleDelete(c._id)} disabled={deleting === c._id}
                                style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: '#fef2f2', border: `1px solid ${C.red}`, cursor: 'pointer', color: C.red, opacity: deleting === c._id ? 0.5 : 1 }}>
                                🗑
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   CANCELLATIONS TAB (employee — process refunds)
══════════════════════════════════════════════════════ */
function ProofViewModalEmp({ proofs, onClose }) {
  const [idx, setIdx] = useState(0);
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'white', borderRadius:12, padding:24, maxWidth:500, width:'90vw' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:15 }}>🧾 Refund Proof</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#888' }}>×</button>
        </div>
        <img src={proofs[idx]?.url} alt="" style={{ width:'100%', maxHeight:340, objectFit:'contain', borderRadius:8, border:'1px solid #ddd', display:'block' }} />
        {proofs.length > 1 && (
          <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'center' }}>
            {proofs.map((p, i) => (
              <img key={i} src={p.url} alt="" onClick={() => setIdx(i)}
                style={{ width:52, height:52, objectFit:'cover', borderRadius:6, border: i===idx ? '2px solid #FF5A1F' : '2px solid #ddd', cursor:'pointer' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmployeeCancellationsTab() {
  const { isMobile } = useResponsive();
  const [all, setAll]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [payF, setPayF]         = useState('');
  const [expandId, setExpandId] = useState(null);
  const [proofFiles, setProofFiles] = useState({});
  const [processing, setProcessing] = useState(null);
  const [proofModal, setProofModal] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    employeeApi.getMyOrders({ limit: 500 }).then(r => {
      const orders = r.data?.data?.data || [];
      setAll(orders.filter(o => o.orderStatus === 'CANCELLED'));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = all.filter(o => {
    const q = search.toLowerCase();
    const mQ = !q || o.orderNumber?.toLowerCase().includes(q) || o.user?.name?.toLowerCase().includes(q) || o.user?.email?.toLowerCase().includes(q);
    const mP = !payF || o.paymentMethod === payF;
    return mQ && mP;
  });

  const onlineOrders  = all.filter(o => o.paymentMethod === 'ONLINE');
  const refundedCount = onlineOrders.filter(o => o.refundStatus === 'COMPLETED').length;
  const pendingCount  = onlineOrders.filter(o => o.refundStatus !== 'COMPLETED').length;
  const totalRefunded = all.reduce((s, o) => s + (o.refundAmount || 0), 0);

  const handleProcessRefund = async (orderId) => {
    const files = proofFiles[orderId] || [];
    if (files.length === 0) {
      alert('Please upload at least 1 refund proof screenshot before marking as refunded.');
      return;
    }
    setProcessing(orderId);
    try {
      const form = new FormData();
      [...files].forEach(f => form.append('refundProof', f));
      await ordersApi.processRefund(orderId, form);
      setAll(prev => prev.map(o => o._id === orderId ? { ...o, refundStatus: 'COMPLETED', paymentStatus: 'REFUNDED' } : o));
      setExpandId(null);
      setProofFiles(p => { const n = {...p}; delete n[orderId]; return n; });
    } catch(e) { alert(e?.response?.data?.message || 'Failed'); }
    finally { setProcessing(null); }
  };

  if (loading) return <Loader />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
        <KpiCard label="Cancelled Orders" value={fmt(all.length)}          sub="All orders"             colorKey="red"    iconEl={Icon.orders} />
        <KpiCard label="Refund Pending"   value={fmt(pendingCount)}        sub="Online — action needed" colorKey="yellow" iconEl={Icon.refund} />
        <KpiCard label="Refunds Done"     value={fmt(refundedCount)}       sub="Manually processed"     colorKey="green"  iconEl={Icon.refund} />
        <KpiCard label="Total Refunded"   value={fmtShort(totalRefunded)}  sub="Amount returned"        colorKey="blue"   iconEl={Icon.dollar} rawValue={totalRefunded} />
      </div>

      <Card>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 12px', height: 36, flex: 1, minWidth: 200 }}>
            <span style={{ color: C.mute, display: 'flex' }}><SvgAt el={Icon.search} size={14} /></span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Order #, name, email…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: C.text, fontFamily: 'inherit' }} />
          </div>
          <Sel value={payF} onChange={e => setPayF(e.target.value)} style={{ width: 160 }}>
            <option value="">All Payment</option>
            <option value="ONLINE">Online / UPI</option>
            <option value="COD">COD</option>
          </Sel>
          {(search || payF) && <Btn onClick={() => { setSearch(''); setPayF(''); }}>Clear</Btn>}
          <span style={{ fontSize: 13, color: C.mute, marginLeft: 'auto' }}><strong style={{ color: C.text }}>{filtered.length}</strong> of <strong style={{ color: C.text }}>{all.length}</strong></span>
        </div>
      </Card>

      <Card title={`Cancelled Orders (${filtered.length})`}>
        {filtered.length === 0 ? <Empty text="No cancelled orders" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(o => {
              const isPaid      = o.paymentMethod === 'ONLINE';
              const refundDone  = o.refundStatus === 'COMPLETED';
              const needsRefund = isPaid && !refundDone;
              const isOpen      = expandId === o._id;
              const bd          = o.cancellationBankDetails || {};

              return (
                <div key={o._id} style={{ border: `1px solid ${needsRefund ? C.yellow+'66' : C.line}`, borderRadius: 10, overflow: 'hidden' }}>
                  {/* Collapsed header — always visible */}
                  <div
                    onClick={() => setExpandId(expandId === o._id ? null : o._id)}
                    style={{
                      background: C.card2,
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: C.accent, flexShrink: 0 }}>{o.orderNumber}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text, minWidth: 100, flexShrink: 0 }}>{o.user?.name}</span>
                    <span style={{ fontSize: 12, color: C.mute, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(o.items?.[0]?.product?.title || '').slice(0, 30)}{(o.items?.[0]?.product?.title || '').length > 30 ? '…' : ''}
                    </span>
                    <Badge text={o.paymentMethod} color={o.paymentMethod === 'ONLINE' ? C.blue : C.yellow} />
                    {isPaid && <Badge text={refundDone ? 'REFUNDED' : 'PENDING'} color={refundDone ? C.green : C.yellow} />}
                    <span style={{ fontWeight: 700, fontSize: 13, color: C.accent, flexShrink: 0 }}>{fmtRs(o.totalPrice)}</span>
                    <span style={{ fontSize: 11, color: C.mute, flexShrink: 0 }}>
                      {new Date(o.updatedAt || o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    <span style={{ fontSize: 16, color: C.mute, transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▾</span>
                  </div>

                  {/* Expanded body */}
                  {isOpen && (
                    <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.line}` }}>
                      {o.cancellationReason && (
                        <div style={{ fontSize: 13, color: C.mute, marginBottom: 10 }}>
                          <strong style={{ color: C.text }}>Reason:</strong> {o.cancellationReason}
                        </div>
                      )}

                      {/* Refund details customer provided */}
                      {isPaid && o.cancellationRefundMethod && (
                        <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                          <div style={{ fontWeight: 700, marginBottom: 6, color: C.text }}>
                            {o.cancellationRefundMethod === 'upi' ? '📱 UPI Refund' : '🏦 Bank Transfer Refund'}
                          </div>
                          {o.cancellationRefundMethod === 'upi' && (
                            <div style={{ color: C.mute }}>UPI ID: <strong style={{ color: C.text }}>{bd.upiId || '—'}</strong></div>
                          )}
                          {o.cancellationRefundMethod === 'bank_transfer' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                              {[['Name', bd.accountName],['Bank', bd.bankName],['Account #', bd.accountNumber],['IFSC', bd.ifscCode]].map(([l, v]) => (
                                <div key={l} style={{ color: C.mute }}>{l}: <strong style={{ color: C.text }}>{v || '—'}</strong></div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Proof thumbnails */}
                      {o.cancellationRefundProof?.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                          {o.cancellationRefundProof.map((p, i) => (
                            <img key={i} src={p.url} alt="" onClick={() => setProofModal(o.cancellationRefundProof)}
                              style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.line}`, cursor: 'pointer' }} />
                          ))}
                          <button onClick={() => setProofModal(o.cancellationRefundProof)} style={{ fontSize: 11, color: C.blue, background: C.blue+'14', border: `1px solid ${C.blue}33`, borderRadius: 20, padding: '4px 10px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12C1 12 5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg> View
                          </button>
                        </div>
                      )}

                      {/* Process refund panel */}
                      {needsRefund && (
                        <div style={{ border: `1px solid ${C.yellow}44`, borderRadius: 8, padding: 14, background: C.yellow+'08' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: C.text }}>Process Refund</div>
                          {proofFiles[o._id]?.length > 0 && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                              {Array.from(proofFiles[o._id]).map((f, i) => (
                                <img key={i} src={URL.createObjectURL(f)} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.line}` }} />
                              ))}
                            </div>
                          )}
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px dashed ${C.line}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', marginBottom: 10, background: C.bg }}>
                            <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                              onChange={e => setProofFiles(p => ({ ...p, [o._id]: e.target.files }))} />
                            <span style={{ fontSize: 18 }}>📷</span>
                            <span style={{ fontSize: 12, color: C.mute }}>Upload proof screenshot <span style={{ color: C.red }}>*</span> (required, up to 5)</span>
                          </label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Btn variant="success" disabled={processing === o._id} onClick={() => handleProcessRefund(o._id)}>
                              {processing === o._id ? 'Saving…' : '✓ Mark as Refunded'}
                            </Btn>
                            <Btn onClick={e => { e.stopPropagation(); setExpandId(null); }}>Cancel</Btn>
                          </div>
                        </div>
                      )}
                      {refundDone && (
                        <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>✓ Refund completed</span>
                      )}
                      {!isPaid && (
                        <span style={{ fontSize: 12, color: C.mute }}>COD order — no refund required</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {proofModal && <ProofViewModalEmp proofs={proofModal} onClose={() => setProofModal(null)} />}
    </div>
  );
}

const NAV_TABS = [
  { id:'Overview',        iconEl: Icon.grid,    perm: 'overview' },
  { id:'Products',        iconEl: Icon.bag,     perm: 'products' },
  { id:'Orders',          iconEl: Icon.orders,  perm: 'orders' },
  { id:'Returns',         iconEl: Icon.refund,  perm: 'returns' },
  { id:'Cancellations',   iconEl: Icon.refund,  perm: 'cancellations' },
  { id:'Delivery Areas',  iconEl: Icon.box,     perm: 'deliveryAreas' },
  { id:'Add Product',     iconEl: Icon.plus,    perm: 'products.write' },
  { id:'Coupons',         iconEl: Icon.coupon,  perm: 'coupons' },
  { id:'Support',         iconEl: Icon.chat || Icon.coupon, perm: 'support' },
  { id:'My Salary',       iconEl: Icon.dollar,  perm: 'salary' },
  { id:'Catalog',         iconEl: Icon.catalog, perm: 'catalog' },
  { id:'Banners',         iconEl: Icon.bag,     perm: 'banners' },
  { id:'Media',           iconEl: Icon.catalog, perm: 'media' },
  { id:'Settings',        iconEl: Icon.gear,    perm: 'settings' },
];

const TAB_SUBTITLES = {
  Overview:         'Your shop performance and key metrics',
  'Products':    'Manage your product listings',
  Orders:           'Track and fulfil orders containing your products',
  Returns:          'Review and respond to return requests from customers',
  Cancellations:    'Cancelled orders and their refund status',
  'Delivery Areas': 'Manage serviceable cities and delivery charges',
  'Add Product':    'Create a new product listing',
  Coupons:          'Create and manage discount coupons for customers',
  Support:          'Reply to customer support tickets and resolve queries',
  'My Salary':      'View your monthly salary, deductions, and bonuses',
  Catalog:          'Manage brands, categories, attributes and events',
  Banners:          'Upload and manage homepage banners — with text overlays, fonts and product links',
  Settings:         'Configure COD availability, order amount limits, and booking payments',
};

export default function SellerDashboard() {
  const { isMobile } = useResponsive();
  const { isLight, toggle: toggleTheme } = useDashboardTheme();
  const [tab, setTab]           = useState('Overview');
  const [mountedTabs, setMountedTabs] = useState(() => new Set(['Overview']));
  const navTo = (t) => { setTab(t); setMountedTabs(prev => { if (prev.has(t)) return prev; const n = new Set(prev); n.add(t); return n; }); };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKeys, setRefreshKeys] = useState({});
  const [spinning, setSpinning]       = useState(false);
  const doRefresh = () => {
    setRefreshKeys(k => ({ ...k, [tab]: (k[tab] || 0) + 1 }));
    setSpinning(true);
    setTimeout(() => setSpinning(false), 700);
  };
  const [profile, setProfile]   = useState(null);
  const [editProduct, setEdit]  = useState(null);
  const [loading, setLoading]   = useState(true);

  // Effective permissions for this employee. Legacy profiles without a
  // permissions array fall back to full access (matches backend behaviour).
  const myPerms = (profile && Array.isArray(profile.permissions) && profile.permissions.length)
    ? profile.permissions
    : ALL_PERMISSIONS;

  const visibleTabs = NAV_TABS.filter(t => !t.perm || hasPermission(myPerms, t.perm));

  // If the current tab was just revoked, fall back to the first allowed tab.
  useEffect(() => {
    if (!profile) return;
    if (!visibleTabs.find(t => t.id === tab) && visibleTabs.length) {
      setTab(visibleTabs[0].id);
      setMountedTabs(prev => prev.has(visibleTabs[0].id) ? prev : new Set([...prev, visibleTabs[0].id]));
    }
  }, [profile, visibleTabs, tab]);
  const navigate                = useNavigate();
  const { user, logout }        = useAuth();
  const { notifications, unreadCount, markRead, markAllRead, remove } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    if (!notifOpen) return;
    if (unreadCount > 0) markAllRead();
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  const loadProfile = useCallback(() => {
    setLoading(true);
    employeeApi.getMyProfile()
      .then(r => setProfile(r.data?.data?.employee || null))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleTabClick = (id) => {
    navTo(id);
    setEdit(null);
    if (isMobile) setSidebarOpen(false);
  };

  // Force the (keep-alive) Products tab to remount so it refetches from the
  // server. Without this, the cached in-memory list still shows pre-edit data,
  // so reopening a product looks "unedited".
  const refreshProducts = () => setRefreshKeys(k => ({ ...k, Products: (k.Products || 0) + 1 }));

  const handleAddProduct = async (data) => {
    await employeeApi.createProduct(data);
    refreshProducts();
    handleTabClick('Products');
  };

  const handleEditSave = async (data) => {
    await employeeApi.updateProduct(editProduct._id, data);
    setEdit(null);
    refreshProducts();
    handleTabClick('Products');
  };

  const activeTab = editProduct ? 'Products' : tab;
  const pageTitle = editProduct ? 'Edit Product' : tab;
  const pageSub   = editProduct ? `Editing: ${editProduct.title}` : TAB_SUBTITLES[tab];

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', fontFamily:"'DM Sans', sans-serif" }}>

      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:99 }} />
      )}

      {/* â"€â"€ Sidebar â"€â"€ */}
      <div style={{
        position:'fixed', left:0, top:0, bottom:0, width:220,
        background:C.sidebar, display:'flex', flexDirection:'column',
        zIndex:100, borderRight:`1px solid ${C.line}`,
        transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
        transition:'transform .25s ease',
      }}>
        {/* Logo */}
        <div style={{ padding:'16px 18px 14px', borderBottom:`1px solid ${C.line}` }}>
          <img src="/LOGO.png" alt="TradeEngine" style={{ height:40, width:'auto', display:'block' }} />
          <div style={{ fontSize:11, color:C.mute, marginTop:6, fontWeight:500, letterSpacing:'.02em' }}>Employee Panel</div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'8px 10px', overflowY:'auto' }}>
          {profile && visibleTabs.map(t => {
            const active = activeTab === t.id && !editProduct || (editProduct && t.id === 'Products');
            const isEdit = editProduct && t.id === 'Products';
            return (
              <button key={t.id} onClick={() => handleTabClick(t.id)}
                style={{ width:'100%', textAlign:'left', padding:'9px 12px',
                  background: active ? C.active : 'transparent',
                  border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:10,
                  color: active ? C.text : C.sub,
                  fontWeight: active ? 600 : 400, fontSize:13.5, borderRadius:8,
                  transition:'all .12s', marginBottom:2, fontFamily:'inherit' }}>
                <span style={{ display:'flex', alignItems:'center', color: active ? C.accent : 'inherit', opacity: active ? 1 : 0.75, flexShrink:0 }}>
                  <SvgAt el={t.iconEl} size={17} />
                </span>
                <span style={{ flex:1 }}>{isEdit ? 'Edit Product' : t.id}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding:'12px 10px', borderTop:`1px solid ${C.line}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, marginBottom:6 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Syne',sans-serif", fontWeight:800, color:'white', fontSize:14, flexShrink:0 }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize:11, color:C.mute }}>{profile?.shopName || 'Employee'}</div>
            </div>
          </div>
          <button onClick={() => navigate('/')}
            style={{ width:'100%', padding:'8px 12px', background:'rgba(255,255,255,.04)', border:`1px solid ${C.line}`, borderRadius:8, color:C.sub, fontWeight:500, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontFamily:'inherit' }}>
            <span style={{ flex:1, textAlign:'left' }}>Back to Store</span>
            <span style={{ color:C.mute, display:'flex', alignItems:'center' }}><SvgAt el={Icon.extlink} size={14} /></span>
          </button>
        </div>
      </div>

      {/* â"€â"€ Main content â"€â"€ */}
      <div style={{ marginLeft: isMobile ? 0 : 220, flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>

        {/* Topbar */}
        <div style={{ position:'sticky', top:0, zIndex:90, background:C.sidebar, borderBottom:`1px solid ${C.line}`, padding: isMobile ? '0 14px' : '0 24px', height:58, display:'flex', alignItems:'center', gap: isMobile ? 10 : 14 }}>
          {isMobile && (
            <div onClick={() => setSidebarOpen(s=>!s)}
              style={{ color:C.mute, cursor:'pointer', display:'flex', alignItems:'center' }}>
              <SvgAt el={Icon.menu} size={20} />
            </div>
          )}

          {isMobile && (
            <div style={{ flex:1, fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {pageTitle}
            </div>
          )}

          {/* Day/Night theme toggle */}
          <button
            onClick={toggleTheme}
            title={isLight ? 'Switch to dark theme' : 'Switch to day theme'}
            aria-label="Toggle theme"
            style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:C.mute, display:'flex', alignItems:'center', padding:4 }}
          >
            {isLight ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            )}
          </button>

          {/* Notification bell */}
          <div ref={notifRef} style={{ position:'relative' }}>
            <button
              onClick={() => setNotifOpen(o => !o)}
              style={{ position:'relative', background:'none', border:'none', cursor:'pointer', color: notifOpen ? C.accent : C.mute, display:'flex', alignItems:'center', padding:4 }}>
              <SvgAt el={Icon.bell} size={20} />
              {unreadCount > 0 && (
                <span style={{ position:'absolute', top:-3, right:-3, background:C.red, color:'white', fontSize:9, fontWeight:800, minWidth:16, height:16, borderRadius:99, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown panel */}
            {notifOpen && (
              <div style={{ position:'fixed', top:62, right: isMobile ? 8 : 24, width: isMobile ? 'calc(100vw - 16px)' : 380, maxWidth:380, background:C.card, border:`1px solid ${C.line}`, borderRadius:14, boxShadow:'0 20px 50px rgba(0,0,0,.55)', zIndex:999, display:'flex', flexDirection:'column', maxHeight:520, overflow:'hidden' }}>
                {/* Panel header */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px 12px', borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
                  <div style={{ fontWeight:700, fontSize:15, color:C.text }}>
                    Notifications
                    {unreadCount > 0 && <span style={{ marginLeft:8, background:C.red+'22', color:C.red, fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99 }}>{unreadCount} new</span>}
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} style={{ fontSize:11, fontWeight:600, color:C.accent, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                        Mark all read
                      </button>
                    )}
                    <button onClick={() => setNotifOpen(false)} style={{ background:'none', border:'none', color:C.mute, cursor:'pointer', fontSize:18, lineHeight:1, padding:0 }}>✕</button>
                  </div>
                </div>

                {/* Notification list */}
                <div style={{ overflowY:'auto', flex:1 }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding:'40px 16px', textAlign:'center', color:C.mute, fontSize:13 }}>
                      <div style={{ fontSize:28, marginBottom:8 }}>🔔</div>
                      No notifications yet
                    </div>
                  ) : notifications.slice(0, 20).map(n => (
                    <div key={n._id}
                      onClick={() => { if (!n.isRead) markRead(n._id); }}
                      style={{ display:'flex', gap:12, padding:'12px 16px', borderBottom:`1px solid ${C.line}`, background: n.isRead ? 'transparent' : C.accent+'0a', cursor:'default', alignItems:'flex-start' }}>
                      <div style={{ width:34, height:34, borderRadius:10, flexShrink:0, background:C.bg, border:`1px solid ${C.line}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>
                        {NOTIF_ICONS[n.type] || '🔔'}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight: n.isRead ? 500 : 700, fontSize:13, color: n.isRead ? C.sub : C.text, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize:12, color:C.mute, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                          {n.message}
                        </div>
                        {n.link && (
                          <a href={n.link.startsWith('http') ? n.link : `${window.location.origin}${n.link}`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={e => { e.stopPropagation(); if (!n.isRead) markRead(n._id); }}
                            style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:6, padding:'4px 10px', borderRadius:6, background:C.accent+'18', border:`1px solid ${C.accent}44`, fontSize:12, fontWeight:700, color:C.accent, textDecoration:'none' }}>
                            🔗 Click here ↗
                          </a>
                        )}
                        <div style={{ fontSize:10, color:C.mute, marginTop:4 }}>
                          {new Date(n.createdAt).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); remove(n._id); }}
                        style={{ flexShrink:0, background:'none', border:'none', color:C.mute, cursor:'pointer', fontSize:14, lineHeight:1, padding:'2px 4px', borderRadius:4, opacity:.6 }}
                        title="Delete">✕</button>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ padding:'12px 16px', borderTop:`1px solid ${C.line}`, textAlign:'center', flexShrink:0 }}>
                  <button onClick={() => { navigate('/notifications'); setNotifOpen(false); }}
                    style={{ fontSize:13, fontWeight:700, color:C.accent, background:'none', border:'none', cursor:'pointer' }}>
                    View all notifications →
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Syne',sans-serif", fontWeight:800, color:'white', fontSize:13, flexShrink:0 }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            {!isMobile && (
              <div style={{ lineHeight:1.25 }}>
                <div style={{ fontWeight:600, fontSize:13, color:C.text }}>{user?.name}</div>
                <div style={{ fontSize:11, color:C.mute }}>Employee</div>
              </div>
            )}
          </div>
          {/* Logout */}
          <button onClick={() => { logout(); navigate('/login'); }}
            style={{ display:'flex', alignItems:'center', gap:6, background:C.red+'18', border:`1px solid ${C.red}44`,
              borderRadius:8, padding:'6px 14px', color:C.red, fontSize:13, fontWeight:700, cursor:'pointer' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {!isMobile && 'Logout'}
          </button>
        </div>

        {/* Page content */}
        <div style={{ padding: isMobile ? '18px 14px' : '28px 30px', flex:1 }}>
          <div style={{ marginBottom:22, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            {!isMobile && (
              <div>
                <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:700, color:C.text, margin:0, lineHeight:1 }}>{pageTitle}</h1>
                <p style={{ color:C.mute, margin:'6px 0 0', fontSize:13 }}>{pageSub}</p>
              </div>
            )}
            {!editProduct && tab !== 'Add Product' && (
              <button onClick={doRefresh} disabled={spinning}
                title="Refresh this page"
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8,
                  background: spinning ? C.active : 'rgba(255,255,255,.06)',
                  border:`1px solid ${C.line}`, color: spinning ? C.accent : C.sub,
                  fontSize:13, fontWeight:500, cursor: spinning ? 'default' : 'pointer',
                  fontFamily:'inherit', flexShrink:0,
                  marginLeft: isMobile ? 'auto' : 0,
                  transition:'color .2s, background .2s' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth="2"
                  style={{ transform: spinning ? 'rotate(360deg)' : 'rotate(0deg)', transition:'transform .6s ease' }}>
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                {spinning ? 'Refreshing…' : 'Refresh'}
              </button>
            )}
          </div>

          {loading ? <Loader /> : !profile ? (
            /* No profile — admin must create the employee account */
            <div style={{ maxWidth:500, margin:'60px auto 0', textAlign:'center' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:C.yellow+'22', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px', color:C.yellow }}>
                <SvgAt el={Icon.lock} size={28} />
              </div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:C.text, marginBottom:8 }}>Account Not Set Up</div>
              <div style={{ color:C.mute, fontSize:14, lineHeight:1.7 }}>Your employee account has not been created yet. Please contact the admin to add you to the system with your full details.</div>
            </div>
          ) : (
            <>
              {/* Keep-alive: mount once, CSS-hide when not active */}
              {editProduct && <ProductForm initial={editProduct} onSave={handleEditSave} onCancel={()=>setEdit(null)} />}
              {!editProduct && (<>
                <div style={{ display: tab==='Overview'      ? '' : 'none' }}>{mountedTabs.has('Overview')      && <OverviewTab          key={refreshKeys['Overview']       || 0} profile={profile} />}</div>
                <div style={{ display: tab==='Products'   ? '' : 'none' }}>{mountedTabs.has('Products')   && <ProductsTab          key={refreshKeys['Products']    || 0} onEdit={p=>setEdit(p)} />}</div>
                <div style={{ display: tab==='Orders'        ? '' : 'none' }}>{mountedTabs.has('Orders')        && <OrdersTab            key={refreshKeys['Orders']         || 0} onViewReturns={() => navTo('Returns')} />}</div>
                <div style={{ display: tab==='Returns'       ? '' : 'none' }}>{mountedTabs.has('Returns')       && <EmployeeReturnsTab   key={refreshKeys['Returns']        || 0} />}</div>
                <div style={{ display: tab==='Cancellations' ? '' : 'none' }}>{mountedTabs.has('Cancellations') && <EmployeeCancellationsTab key={refreshKeys['Cancellations'] || 0} />}</div>
                <div style={{ display: tab==='Delivery Areas'? '' : 'none' }}>{mountedTabs.has('Delivery Areas')&& <DeliveryAreasTab      key={refreshKeys['Delivery Areas'] || 0} />}</div>
                <div style={{ display: tab==='Coupons'       ? '' : 'none' }}>{mountedTabs.has('Coupons')       && <EmployeeCouponsTab   key={refreshKeys['Coupons']        || 0} />}</div>
                <div style={{ display: tab==='Support'       ? '' : 'none' }}>{mountedTabs.has('Support')       && <AdminSupportTab      key={refreshKeys['Support']        || 0} />}</div>
                <div style={{ display: tab==='My Salary'     ? '' : 'none' }}>{mountedTabs.has('My Salary')     && <MySalaryTab          key={refreshKeys['My Salary']      || 0} />}</div>
                <div style={{ display: tab==='Catalog'       ? '' : 'none' }}>{mountedTabs.has('Catalog')       && <AdminCatalogTab      key={refreshKeys['Catalog']        || 0} />}</div>
                <div style={{ display: tab==='Banners'       ? '' : 'none' }}>{mountedTabs.has('Banners')       && <AdminBannersTab      key={refreshKeys['Banners']        || 0} />}</div>
                <div style={{ display: tab==='Media'         ? '' : 'none' }}>{mountedTabs.has('Media')         && <AdminMediaTab        key={refreshKeys['Media']          || 0} />}</div>
                <div style={{ display: tab==='Settings'      ? '' : 'none' }}>{mountedTabs.has('Settings')      && <EmployeeSettingsTab  key={refreshKeys['Settings']       || 0} />}</div>
                {tab==='Add Product' && <ProductForm onSave={handleAddProduct} />}
              </>)}
          </>
          )}
        </div>
      </div>
    </div>
  );
}

