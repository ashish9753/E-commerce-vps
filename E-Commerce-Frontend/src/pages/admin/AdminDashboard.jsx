import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { adminApi } from '../../api/admin';
import { ordersApi } from '../../api/orders';
import { returnsApi } from '../../api/returns';
import { couponsApi } from '../../api/coupons';
import { productsApi } from '../../api/products';
import { notificationsApi } from '../../api/notifications';
import { supportApi } from '../../api/support';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, AreaChart, Area,
} from 'recharts';
import SupportIcon from '../../components/icons/SupportIcon';
import OrderPipeline from '../../components/orders/OrderPipeline';
import AdminCatalogTab from './AdminCatalogTab';
import AdminBannersTab from './AdminBannersTab';
import AdminMediaTab from './AdminMediaTab';
import { employeeApi } from '../../api/employee';
import { ProductsTab, ProductForm, DeliveryAreasTab } from '../employee/EmployeeDashboard';
import { PERMISSION_GROUPS, ALL_PERMISSIONS } from '../../utils/permissions';
import { cleanPhone, isValidPhone } from '../../utils/validators';
import { settingsApi } from '../../api/settings';
import { paymentsApi } from '../../api/payments';
import { useFormDraft } from '../../hooks/useFormDraft';
import { useCatalog } from '../../context/CatalogContext';
import { C, useDashboardTheme } from '../../theme/dashboardTheme';

const STATUS_COLORS = {
  PLACED: C.yellow, CONFIRMED: C.blue, PACKED: C.purple,
  SHIPPED: C.cyan, OUT_FOR_DELIVERY: C.accent, DELIVERED: C.green,
  CANCELLED: C.red, RETURNED: C.mute,
};

const REASON_LABEL = {
  defective:       'Defective / Not Working',
  wrong_item:      'Wrong Item Received',
  damaged:         'Damaged in Transit',
  not_as_described:'Not as Described',
  changed_mind:    'Changed My Mind',
  missing_parts:   'Missing Parts / Accessories',
};

const ROLE_COLORS = { admin: C.purple, employee: C.yellow, user: C.blue };

/* ── Responsive hook ── */
function useResponsive() {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return { w, isMobile: w < 768, isTablet: w >= 768 && w < 1100, isDesktop: w >= 1100 };
}

/* ── shared helpers ── */
const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtRs = (n) => `Rs. ${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
const fmtShort = (n) => {
  const v = Math.round(Number(n || 0));
  if (v >= 10000000) return `Rs. ${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `Rs. ${(v / 100000).toFixed(1)}L`;
  if (v >= 10000)    return `Rs. ${(v / 1000).toFixed(1)}K`;
  return fmtRs(v);
};

/* ── SVG icon helpers (match HTML mockup) ── */
const Icon = {
  users:  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:20,height:20}}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  shield: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:20,height:20}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  bag:    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:20,height:20}}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  person: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:20,height:20}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  dollar: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:20,height:20}}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  refund: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:20,height:20}}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>,
  truck:  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:20,height:20}}><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  orders: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:20,height:20}}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  bell:   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:20,height:20}}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  gear:   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.42 1.42M4.93 4.93l1.42 1.42M19.07 19.07l-1.42-1.42M4.93 19.07l1.42-1.42M20 12h2M2 12h2M12 20v2M12 2v2"/></svg>,
  tag:    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  book:   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  list:   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M4 6h16M4 12h16M4 18h7"/></svg>,
  coupon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  support:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  box:    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  grid:   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  extlink:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  lock:   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  trash:  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  dots:   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>,
  search: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  menu:   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:20,height:20}}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  chevD:  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><path d="M6 9l6 6 6-6"/></svg>,
};

/* Renders any Icon SVG at a fixed size */
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

function Badge({ text, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 600, padding: '3px 11px', borderRadius: 20,
      background: color + '22', color, border: `1px solid ${color}44`,
    }}>{text}</span>
  );
}

const ICON_COLOR_MAP = { blue: C.blue, purple: C.purple, yellow: C.yellow, green: C.green, orange: C.accent, red: C.red };
const ICON_BG_MAP   = { blue: 'rgba(59,130,246,.15)', purple: 'rgba(139,92,246,.15)', yellow: 'rgba(234,179,8,.15)', green: 'rgba(34,197,94,.15)', orange: 'rgba(249,115,22,.15)', red: 'rgba(239,68,68,.15)' };

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
        {iconEl}
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
  return <td style={{ padding: '14px 14px', fontSize: 13.5, borderBottom: `1px solid ${C.line}`, color: C.text, verticalAlign: 'middle', ...style }}>{children}</td>;
}
function Input({ value, onChange, onKeyDown, placeholder, style }) {
  return <input value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder}
    style={{ height: 36, border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 12px', fontSize: 13, outline: 'none', background: C.bg, color: C.text, fontFamily: 'inherit', ...style }} />;
}
function Select({ value, onChange, children, style }) {
  return <select value={value} onChange={onChange}
    style={{ height: 36, border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 10px', fontSize: 13, background: C.bg, color: C.text, cursor: 'pointer', fontFamily: 'inherit', ...style }}>{children}</select>;
}
function Btn({ children, onClick, disabled, variant = 'ghost', style }) {
  const base = { fontSize: 13, fontWeight: 500, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', border: 'none', transition: 'all .15s', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, ...style };
  const variants = {
    ghost:   { background: 'rgba(255,255,255,.06)', color: C.sub, border: `1px solid ${C.line}` },
    danger:  { background: 'rgba(239,68,68,.12)',   color: '#f87171', border: '1px solid rgba(239,68,68,.25)' },
    success: { background: 'rgba(34,197,94,.12)',   color: C.green,   border: '1px solid rgba(34,197,94,.25)' },
    warn:    { background: 'rgba(234,179,8,.12)',   color: C.yellow,  border: '1px solid rgba(234,179,8,.25)' },
    primary: { background: '#ea580c', color: 'white' },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], opacity: disabled ? .5 : 1 }}>{children}</button>;
}

/* ══════════════════════════════════════════════════════
   OVERVIEW TAB
══════════════════════════════════════════════════════ */
const NOTIF_ICONS = { ORDER: '🛒', PAYMENT: '💳', OFFER: '🎁', REFUND: '↩️', SYSTEM: '⚠️' };

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h>1?'s':''} ago`;
  return `${Math.floor(h/24)} day${Math.floor(h/24)>1?'s':''} ago`;
}

function OverviewTab() {
  const { isMobile, isTablet } = useResponsive();
  const navigate = useNavigate();
  const { notifications } = useNotifications();
  const [stats, setStats]       = useState(null);
  const [allOrders, setAllOrders] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [userCount, setUC]      = useState(0);
  const [loading, setLoading]   = useState(true);
  const [chartPeriod, setChartPeriod] = useState('1Y');

  const notifs = notifications.slice(0, 6);

  useEffect(() => {
    Promise.all([
      adminApi.getOrderStats(),
      adminApi.getOrders({ limit: 1000 }),
      adminApi.getUsers({ limit: 1 }),
    ]).then(([s, o, u]) => {
      setStats(s.data?.data || {});
      const allO = o.data?.data?.data || [];
      setAllOrders(allO);
      setRecentOrders(allO.slice(0, 5));
      setUC(u.data?.data?.pagination?.total || u.data?.data?.total || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;

  const breakdown    = stats?.statusBreakdown || [];
  const delivered    = breakdown.find(b => b._id === 'DELIVERED')?.count || 0;
  const inProgress   = breakdown.filter(b => ['PLACED','CONFIRMED','PACKED','SHIPPED','OUT_FOR_DELIVERY'].includes(b._id)).reduce((a,b) => a+b.count, 0);
  const returned     = breakdown.find(b => b._id === 'RETURNED')?.count || 0;
  const total        = stats?.totalOrders || 0;
  const netRevenue   = stats?.netRevenue   || 0;
  const refundedAmt  = stats?.refundedAmount || 0;

  const donutData = breakdown.map(b => ({ name: b._id, value: b.count }));
  const totalDonut = donutData.reduce((a, b) => a + b.value, 0);

  // Sales chart — build buckets for selected period
  const buildSalesChart = (period) => {
    const now   = new Date();
    const msDay = 86400000;
    const periodDays = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[period] || 365;
    const cutoff = new Date(now - periodDays * msDay);

    const inRange = allOrders.filter(o => new Date(o.createdAt) >= cutoff);

    if (period === '1W' || period === '1M') {
      // Daily buckets
      const map = {};
      for (let i = periodDays - 1; i >= 0; i--) {
        const d = new Date(now - i * msDay);
        const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        map[key] = 0;
      }
      inRange.forEach(o => {
        const d = new Date(o.createdAt);
        const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        if (key in map) map[key] += o.totalPrice || 0;
      });
      return Object.entries(map).map(([day, sales]) => ({ day, sales }));
    } else if (period === '3M' || period === '6M') {
      // Weekly buckets
      const weeks = Math.ceil(periodDays / 7);
      const map = {};
      for (let i = weeks - 1; i >= 0; i--) {
        const d = new Date(now - i * 7 * msDay);
        const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        map[key] = 0;
      }
      inRange.forEach(o => {
        const d   = new Date(o.createdAt);
        const diffDays = Math.floor((now - d) / msDay);
        const weekIdx  = weeks - 1 - Math.floor(diffDays / 7);
        if (weekIdx >= 0) {
          const wkDate = new Date(now - (weeks - 1 - weekIdx) * 7 * msDay);
          const key = wkDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          if (key in map) map[key] += o.totalPrice || 0;
        }
      });
      return Object.entries(map).map(([day, sales]) => ({ day, sales }));
    } else {
      // Monthly buckets for 1Y
      const map = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        map[key] = 0;
      }
      inRange.forEach(o => {
        const d   = new Date(o.createdAt);
        const key = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        if (key in map) map[key] += o.totalPrice || 0;
      });
      return Object.entries(map).map(([day, sales]) => ({ day, sales }));
    }
  };

  const salesChart  = buildSalesChart(chartPeriod);
  const chartTotal  = salesChart.reduce((a, b) => a + b.sales, 0);
  const totalSales  = netRevenue;
  const PERIODS     = ['1W','1M','3M','6M','1Y'];

  // Top payment/status breakdown for right panel
  const payBreakdown = (stats?.paymentBreakdown || []).map(b => ({
    label: b._id, count: b.count,
    color: b._id === 'ONLINE' ? C.blue : C.yellow,
  }));
  const topStatuses = breakdown.slice(0, 5).map(b => ({
    label: b._id, count: b.count,
    color: STATUS_COLORS[b._id] || C.mute,
    pct: totalDonut > 0 ? Math.round((b.count / totalDonut) * 100) : 0,
  })).sort((a,b) => b.count - a.count);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(3,1fr)' : 'repeat(5,1fr)', gap: 12 }}>
        <KpiCard label="Total Orders"  value={fmt(total)}         sub={`${delivered} delivered`}      colorKey="blue"   iconEl={Icon.orders} />
        <KpiCard label="Net Revenue"   value={fmtShort(netRevenue)}  sub="Paid minus refunded"           colorKey="green"  iconEl={Icon.dollar} rawValue={netRevenue} />
        <KpiCard label="Refunded"      value={fmtShort(refundedAmt)} sub={`${returned} returned`}        colorKey="red"    iconEl={Icon.refund} rawValue={refundedAmt} />
        <KpiCard label="In Progress"   value={fmt(inProgress)}    sub="Active orders"                 colorKey="yellow" iconEl={Icon.truck} />
        <KpiCard label="Active Users"  value={fmt(userCount)}     sub="Registered accounts"           colorKey="purple" iconEl={Icon.users} />
      </div>

      {/* ── Row 2: Donut | Sales Chart | Top Categories ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : '1fr 1.6fr 1fr', gap: 16 }}>

        {/* Order Status Donut */}
        <Card title="Order Status">
          {donutData.length === 0
            ? <Empty text="No order data yet" />
            : <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                      paddingAngle={3} dataKey="value" startAngle={90} endAngle={450}>
                      {donutData.map(d => <Cell key={d.name} fill={STATUS_COLORS[d.name] || C.mute} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, color: C.text, fontSize: 12 }}
                      formatter={(v, n) => [v, n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Custom legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {donutData.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[d.name] || C.mute, flexShrink: 0 }} />
                        <span style={{ color: C.mute }}>{d.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: C.text }}>{d.value}</span>
                        <span style={{ color: C.mute }}>({totalDonut > 0 ? Math.round(d.value/totalDonut*100) : 0}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
          }
        </Card>

        {/* Sales Overview */}
        <Card
          title="Sales Overview"
          action={
            <div style={{ display: 'flex', gap: 4 }}>
              {PERIODS.map(p => (
                <button key={p} onClick={() => setChartPeriod(p)}
                  style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, border: `1px solid ${chartPeriod === p ? C.accent : C.line}`, background: chartPeriod === p ? C.accent : 'transparent', color: chartPeriod === p ? 'white' : C.mute, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {p}
                </button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={salesChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.blue} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.mute }} axisLine={false} tickLine={false}
                interval={chartPeriod === '1Y' ? 0 : chartPeriod === '6M' ? 1 : chartPeriod === '3M' ? 1 : 'preserveStartEnd'} />
              <YAxis tick={{ fontSize: 10, fill: C.mute }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(0)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v > 0 ? v : '0'} />
              <Tooltip
                contentStyle={{ background: C.card2, border: `1px solid ${C.line}`, borderRadius: 8, color: C.text, fontSize: 12 }}
                formatter={(v) => [fmtRs(v), 'Revenue']}
                labelStyle={{ color: C.sub, marginBottom: 4 }}
              />
              <Area type="monotone" dataKey="sales" stroke={C.blue} strokeWidth={2.5} fill="url(#salesGrad)"
                dot={chartPeriod === '1Y' ? false : { fill: C.blue, r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: C.blue, stroke: C.card, strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 12, color: C.mute }}>Period Revenue</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{fmtRs(chartTotal)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: C.mute }}>All-time Net</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.green }} title={fmtRs(totalSales)}>{fmtShort(totalSales)}</div>
            </div>
          </div>
        </Card>

        {/* Top Statuses / Payment breakdown */}
        <Card title="Orders by Status" action={<span style={{ fontSize: 11, color: C.mute }}>All time</span>}>
          {topStatuses.length === 0
            ? <Empty text="No data" />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {topStatuses.map(s => (
                  <div key={s.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                      <span style={{ color: C.text, fontWeight: 600 }}>{s.label}</span>
                      <span style={{ color: C.mute, fontSize: 12 }}>{fmtRs(0)}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: C.line }}>
                      <div style={{ height: '100%', borderRadius: 99, background: s.color, width: `${s.pct}%`, minWidth: s.pct > 0 ? 6 : 0, transition: 'width .4s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: C.mute, marginTop: 3 }}>{s.count} orders · {s.pct}%</div>
                  </div>
                ))}
              </div>
          }
        </Card>
      </div>

      {/* ── Row 3: Recent Orders | Latest Notifications ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 16 }}>

        {/* Recent Orders */}
        <Card title="Recent Orders" action={
          <span onClick={() => { const ev = new CustomEvent('overview-nav', { detail: 'Orders' }); window.dispatchEvent(ev); }}
            style={{ fontSize: 12, color: C.accent, cursor: 'pointer', fontWeight: 600 }}>View all orders →</span>
        }>
          {recentOrders.length === 0
            ? <Empty text="No orders yet" />
            : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Order #</Th><Th>Customer</Th><Th>Amount</Th><Th>Status</Th><Th>Date</Th><Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(o => (
                    <tr key={o._id}>
                      <Td><span style={{ fontWeight: 700, color: C.accent, fontFamily:'monospace', fontSize:12 }}>{o.orderNumber}</span></Td>
                      <Td>
                        <div style={{ fontWeight: 600, color: C.text }}>{o.user?.name || '—'}</div>
                        <div style={{ fontSize: 11, color: C.mute }}>{o.user?.email}</div>
                      </Td>
                      <Td><span style={{ fontWeight: 700, color: C.text }}>{fmtRs(o.totalPrice)}</span></Td>
                      <Td><Badge text={o.orderStatus} color={STATUS_COLORS[o.orderStatus] || C.mute} /></Td>
                      <Td style={{ color: C.mute, fontSize: 12 }}>{new Date(o.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</Td>
                      <Td>
                        <button
                          onClick={() => { const ev = new CustomEvent('overview-nav', { detail: 'Orders' }); window.dispatchEvent(ev); }}
                          title="View in Orders tab"
                          style={{ width: 30, height: 30, borderRadius: 8, background: C.bg, border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.sub }}>
                          <SvgAt el={Icon.list} size={14} />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </Card>

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
                      <div style={{ fontWeight: 600, fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: C.mute, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.message}</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.mute, flexShrink: 0 }}>{timeAgo(n.createdAt)}</div>
                  </div>
                ))}
              </div>
          }
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   USERS TAB
══════════════════════════════════════════════════════ */
function buildUserGrowthData(all, period) {
  const now = new Date();
  let buckets = [];
  let labelFn, keyFn;

  if (period === 'today') {
    buckets = Array.from({ length: 24 }, (_, h) => ({ label: `${h}:00`, count: 0 }));
    keyFn = d => d.getHours();
    labelFn = (_, i) => i;
  } else if (period === 'week') {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    buckets = days.map(d => ({ label: d, count: 0 }));
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
    keyFn = d => d.getDay();
    labelFn = (_, i) => i;
    all = all.filter(u => new Date(u.createdAt) >= weekStart);
  } else if (period === 'month') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    buckets = Array.from({ length: daysInMonth }, (_, i) => ({ label: `${i+1}`, count: 0 }));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    keyFn = d => d.getDate() - 1;
    labelFn = (_, i) => i;
    all = all.filter(u => new Date(u.createdAt) >= monthStart);
  } else if (period === 'year') {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    buckets = months.map(m => ({ label: m, count: 0 }));
    const yearStart = new Date(now.getFullYear(), 0, 1);
    keyFn = d => d.getMonth();
    labelFn = (_, i) => i;
    all = all.filter(u => new Date(u.createdAt) >= yearStart);
  } else {
    // all time — group by month-year
    const sorted = [...all].sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (!sorted.length) return [];
    const first = new Date(sorted[0].createdAt);
    const map = {};
    sorted.forEach(u => {
      const d = new Date(u.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = d.toLocaleDateString('en-IN', { month:'short', year:'2-digit' });
      if (!map[key]) map[key] = { label, count: 0 };
      map[key].count++;
    });
    return Object.values(map);
  }

  all.forEach(u => {
    const d = new Date(u.createdAt);
    const idx = keyFn(d);
    if (buckets[idx]) buckets[idx].count++;
  });
  return buckets;
}

/* ── User Detail Modal (addresses + orders) ── */
function UserDetailModal({ user, onClose }) {
  const [activeTab, setActiveTab] = useState('addresses');
  const [userData, setUserData]   = useState(user);
  const [orders, setOrders]       = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [dataLoading, setDataLoading]     = useState(true);

  useEffect(() => {
    adminApi.getUserById(user._id)
      .then(r => setUserData(r.data?.data?.user || user))
      .catch(() => {})
      .finally(() => setDataLoading(false));

    setOrdersLoading(true);
    adminApi.getUserOrders(user._id)
      .then(r => setOrders(r.data?.data?.data || r.data?.data || []))
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, [user._id]);

  const addresses = userData.addresses || [];

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, width: '100%',
        maxWidth: 660, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: (ROLE_COLORS[userData.role] || C.blue) + '22',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
            color: ROLE_COLORS[userData.role] || C.blue, fontSize: 17, flexShrink: 0 }}>
            {userData.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{userData.name}</div>
            <div style={{ fontSize: 12, color: C.mute }}>{userData.email} · {userData.phone}</div>
          </div>
          <Badge text={userData.role} color={ROLE_COLORS[userData.role] || C.mute} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.mute, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px', marginLeft: 4 }}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.line}`, padding: '0 20px', flexShrink: 0 }}>
          {[
            { key: 'addresses', label: `Addresses (${addresses.length})` },
            { key: 'orders',    label: `Orders (${orders.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                color: activeTab === t.key ? C.accent : C.mute,
                borderBottom: activeTab === t.key ? `2px solid ${C.accent}` : '2px solid transparent',
                marginBottom: -1, transition: 'all .15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* Addresses */}
          {activeTab === 'addresses' && (
            dataLoading ? <Loader /> :
            addresses.length === 0
              ? <Empty text="This user has no saved addresses" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {addresses.map((addr, i) => (
                    <div key={addr._id || i} style={{ background: C.card2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 16 }}>📍</span>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{addr.fullName}</div>
                        {i === 0 && <Badge text="Default" color={C.green} />}
                      </div>
                      <div style={{ fontSize: 12, color: C.mute, lineHeight: 1.7 }}>
                        {[addr.houseNo, addr.area, addr.city, addr.state].filter(Boolean).join(', ')}
                        {addr.pincode && ` – ${addr.pincode}`}
                      </div>
                      {addr.phone    && <div style={{ fontSize: 12, color: C.mute, marginTop: 4 }}>📱 {addr.phone}</div>}
                      {addr.landmark && <div style={{ fontSize: 12, color: C.mute }}>Near: {addr.landmark}</div>}
                    </div>
                  ))}
                </div>
          )}

          {/* Orders */}
          {activeTab === 'orders' && (
            ordersLoading ? <Loader /> :
            orders.length === 0
              ? <Empty text="No orders placed by this user" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {orders.map(order => (
                    <div key={order._id} style={{ background: C.card2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '14px 16px' }}>
                      {/* Order header row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                            #{order.orderNumber || order._id?.slice(-8).toUpperCase()}
                          </span>
                          <span style={{ fontSize: 11, color: C.mute, marginLeft: 10 }}>
                            {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Badge text={order.orderStatus || 'PLACED'} color={STATUS_COLORS[order.orderStatus] || C.mute} />
                          <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                            Rs. {Number(order.totalPrice || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                      {/* Items list */}
                      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
                        {(order.orderItems || []).map((item, idx) => (
                          <div key={idx} style={{ fontSize: 12, color: C.mute, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                            <span>• {item.title}{item.color ? ` (${item.color})` : ''} × {item.quantity}</span>
                            <span>Rs. {Number((item.price || 0) * item.quantity).toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                      {/* Payment */}
                      <div style={{ marginTop: 8, fontSize: 11, color: C.mute }}>
                        Payment: <strong style={{ color: order.paymentStatus === 'PAID' ? C.green : C.yellow }}>{order.paymentStatus}</strong>
                        {' · '}{order.paymentMethod}
                      </div>
                    </div>
                  ))}
                </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UsersTab({ globalSearch = '' }) {
  const [all, setAll]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [pagination, setPag]  = useState({ total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false });
  const [busy, setBusy]       = useState(null);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRole] = useState('');
  const [statusFilter, setSt] = useState('');
  const [period, setPeriod]   = useState('month');
  const [viewUser, setViewUser] = useState(null);

  useEffect(() => { setSearch(globalSearch); }, [globalSearch]);

  // appliedSearch is only updated on Enter or Search button — no API calls while typing
  const [appliedSearch, setAppliedSearch] = useState('');
  const applySearch = () => { setPage(1); setAppliedSearch(search); };

  useEffect(() => { setPage(1); }, [roleFilter, statusFilter]);

  const hasLoadedRef = useRef(false);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = { limit: 100, page };
    if (roleFilter) params.role = roleFilter;
    if (statusFilter === 'blocked')  params.isBlocked = true;
    if (statusFilter === 'active')   params.isBlocked = false;
    if (appliedSearch) params.search = appliedSearch;
    adminApi.getUsers(params)
      .then(r => {
        setAll(r.data?.data?.data || []);
        setPag(r.data?.data?.pagination || { total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false });
      })
      .catch(() => {}).finally(() => { setLoading(false); hasLoadedRef.current = true; });
  }, [page, roleFilter, statusFilter, appliedSearch]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // server already filtered — just use all
  const users = all;

  const roleCounts = { admin: 0, employee: 0, user: 0 };
  all.forEach(u => { if (roleCounts[u.role] !== undefined) roleCounts[u.role]++; });

  // Period-filtered counts for KPI
  const now = new Date();
  const periodStart = {
    today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    week:  new Date(now - 7  * 86400000),
    month: new Date(now.getFullYear(), now.getMonth(), 1),
    year:  new Date(now.getFullYear(), 0, 1),
    all:   new Date(0),
  }[period];
  const newInPeriod = all.filter(u => new Date(u.createdAt) >= periodStart).length;
  const growthData  = buildUserGrowthData(all, period);
  const totalGrowth = growthData.reduce((s, d) => s + d.count, 0);

  const PERIODS = [
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'year',  label: 'This Year' },
    { key: 'all',   label: 'All Time' },
  ];

  const handleBlock = async (id, isBlocked) => {
    setBusy(id);
    await adminApi.blockUser(id).catch(() => {});
    setAll(prev => prev.map(x => x._id === id ? { ...x, isBlocked: !isBlocked } : x));
    setBusy(null);
  };
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    setBusy(id);
    await adminApi.deleteUser(id).catch(() => {});
    setAll(prev => prev.filter(x => x._id !== id));
    setBusy(null);
  };

  if (loading && !hasLoadedRef.current) return <Loader />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: loading ? 0.55 : 1, transition: 'opacity .2s', pointerEvents: loading ? 'none' : 'auto' }}>
      {viewUser && <UserDetailModal user={viewUser} onClose={() => setViewUser(null)} />}
      {/* Mini KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        <KpiCard label="Total Users"   value={fmt(all.length)}           sub="All accounts"        colorKey="blue"   iconEl={Icon.users} />
        <KpiCard label="Admins"        value={fmt(roleCounts.admin)}     sub="Admin accounts"      colorKey="purple" iconEl={Icon.shield} />
        <KpiCard label="Employees"     value={fmt(roleCounts.employee)}  sub="Employee accounts"   colorKey="yellow" iconEl={Icon.bag} />
        <KpiCard label="Customers"     value={fmt(roleCounts.user)}      sub="Regular users"       colorKey="green"  iconEl={Icon.person} />
      </div>

      {/* Growth chart + Role donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20 }}>
        {/* Growth chart */}
        <Card title="User Registrations">
          {/* Period toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: period === p.key ? C.blue : C.bg2,
                  color:      period === p.key ? 'white'  : C.mute,
                  transition: 'all .15s' }}>
                {p.label}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 13, color: C.mute, alignSelf: 'center' }}>
              <strong style={{ color: C.blue }}>{totalGrowth}</strong> new {period === 'all' ? 'total' : `in ${PERIODS.find(p2=>p2.key===period)?.label?.toLowerCase()}`}
            </span>
          </div>
          {growthData.length === 0 || totalGrowth === 0
            ? <div style={{ textAlign:'center', padding:'40px 0', color:C.mute, fontSize:13 }}>No registrations in this period</div>
            : <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={growthData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.blue} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.mute }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: C.mute }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [v, 'New Users']} />
                  <Area type="monotone" dataKey="count" stroke={C.blue} strokeWidth={2}
                    fill="url(#userGrad)" dot={false} activeDot={{ r: 4, fill: C.blue }} />
                </AreaChart>
              </ResponsiveContainer>
          }
        </Card>

        {/* Role donut */}
        <Card title="Role Breakdown">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={Object.entries(roleCounts).map(([k,v]) => ({ name: k, value: v }))}
                cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                {Object.keys(roleCounts).map(k => <Cell key={k} fill={ROLE_COLORS[k]} />)}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Filters */}
      <Card title="Filter & Search">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 0 }}>
          <div style={{ flex: 1, minWidth: 220, display: 'flex', gap: 6 }}>
            <Input
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applySearch()}
              placeholder="Search by name, email, phone…"
              style={{ flex: 1 }}
            />
            <Btn variant="primary" onClick={applySearch} style={{ flexShrink: 0 }}>
              <SvgAt el={Icon.search} size={14} /> Search
            </Btn>
          </div>
          <Select value={roleFilter} onChange={e => setRole(e.target.value)}>
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </Select>
          <Select value={statusFilter} onChange={e => setSt(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </Select>
          {(appliedSearch || roleFilter || statusFilter) && (
            <Btn onClick={() => { setSearch(''); setAppliedSearch(''); setRole(''); setSt(''); setPage(1); }}>Clear</Btn>
          )}
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: C.mute }}>
          <strong style={{color:C.text}}>{pagination.total}</strong> {appliedSearch ? 'result' + (pagination.total !== 1 ? 's' : '') + ' found' : 'total users'}
        </div>
      </Card>

      {/* Table */}
      <Card title={`Users (${pagination.total})`}>
        <PagBar page={page} pagination={pagination} loading={loading} setPage={setPage} />
        {users.length === 0
          ? <Empty text="No users match your filters" />
          : <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <Th>User</Th><Th>Phone</Th><Th>Role</Th><Th>Joined</Th><Th>Last Login</Th><Th>Status</Th><Th>Actions</Th><Th>Detail</Th>
                </tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} style={{ opacity: u.isBlocked ? .6 : 1 }}>
                      <Td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: (ROLE_COLORS[u.role] || C.blue) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: ROLE_COLORS[u.role] || C.blue, fontSize: 13 }}>
                            {u.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{u.name}</div>
                            <div style={{ fontSize: 11, color: C.mute }}>{u.email}</div>
                          </div>
                        </div>
                      </Td>
                      <Td style={{ color: C.mute }}>{u.phone}</Td>
                      <Td><Badge text={u.role} color={ROLE_COLORS[u.role] || C.mute} /></Td>
                      <Td style={{ color: C.mute, fontSize: 12 }}>{new Date(u.createdAt).toLocaleDateString()}</Td>
                      <Td style={{ color: C.mute, fontSize: 12 }}>{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '—'}</Td>
                      <Td><Badge text={u.isBlocked ? 'Blocked' : 'Active'} color={u.isBlocked ? C.red : C.green} /></Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Btn variant={u.isBlocked ? 'success' : 'warn'} disabled={busy === u._id} onClick={() => handleBlock(u._id, u.isBlocked)}>
                            {u.isBlocked ? 'Unblock' : 'Block'}
                          </Btn>
                          <Btn variant="danger" disabled={busy === u._id} onClick={() => handleDelete(u._id, u.name)}>
                            Delete
                          </Btn>
                        </div>
                      </Td>
                      <Td>
                        <Btn onClick={() => setViewUser(u)}>View</Btn>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
        <div style={{ borderTop:`1px solid ${C.line}`, marginTop:8, paddingTop:4 }}>
          <PagBar page={page} pagination={pagination} loading={loading} setPage={setPage} />
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SELLERS TAB
══════════════════════════════════════════════════════ */
const EMPTY_EMP_FORM = { name:'', email:'', phone:'', password:'', designation:'', department:'', joiningDate:'', monthlySalary:'', businessAddress:'', permissions: ALL_PERMISSIONS };
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EMPTY_SAL = { month: new Date().getMonth()+1, year: new Date().getFullYear(), baseSalary:'', deductions:[], bonuses:[], status:'PENDING', notes:'' };

const EmpInp = { width:'100%', height:38, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 12px', fontSize:13, outline:'none', background:C.bg, color:C.text, fontFamily:'inherit', boxSizing:'border-box' };
const EmpLbl = ({ ch }) => <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.mute, marginBottom:5, textTransform:'uppercase', letterSpacing:'.05em' }}>{ch}</label>;

function PermissionsPicker({ value, onChange }) {
  const perms = Array.isArray(value) ? value : [];
  const has = (k) => perms.includes(k);

  const toggleRead = (key, write) => {
    const next = new Set(perms);
    if (has(key)) {
      next.delete(key);
      if (write) next.delete(`${key}.write`); // revoking read also revokes write
    } else {
      next.add(key);
    }
    onChange([...next]);
  };
  const toggleWrite = (key) => {
    const next = new Set(perms);
    const w = `${key}.write`;
    if (has(w)) next.delete(w);
    else { next.add(w); next.add(key); } // granting write implies read
    onChange([...next]);
  };

  const setAll = (mode) => {
    if (mode === 'all') {
      const full = [];
      PERMISSION_GROUPS.forEach(g => { full.push(g.key); if (g.write) full.push(`${g.key}.write`); });
      onChange(full);
    } else if (mode === 'none') {
      onChange(['overview']); // always keep overview so they can log in to something
    } else if (mode === 'read') {
      onChange(PERMISSION_GROUPS.map(g => g.key));
    }
  };

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <button type="button" onClick={() => setAll('all')}
          style={{ padding:'5px 12px', fontSize:11, fontWeight:700, borderRadius:6, border:`1px solid ${C.green}55`, background:C.green+'18', color:C.green, cursor:'pointer' }}>
          Grant All
        </button>
        <button type="button" onClick={() => setAll('read')}
          style={{ padding:'5px 12px', fontSize:11, fontWeight:700, borderRadius:6, border:`1px solid ${C.blue}55`, background:C.blue+'18', color:C.blue, cursor:'pointer' }}>
          View-Only
        </button>
        <button type="button" onClick={() => setAll('none')}
          style={{ padding:'5px 12px', fontSize:11, fontWeight:700, borderRadius:6, border:`1px solid ${C.red}55`, background:C.red+'18', color:C.red, cursor:'pointer' }}>
          Revoke All
        </button>
      </div>
      <div style={{ border:`1px solid ${C.line}`, borderRadius:10, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px', padding:'8px 12px', background:C.bg, fontSize:10, fontWeight:700, color:C.mute, textTransform:'uppercase', letterSpacing:'.06em' }}>
          <div>Tab / Feature</div>
          <div style={{ textAlign:'center' }}>View</div>
          <div style={{ textAlign:'center' }}>Edit/Create</div>
        </div>
        {PERMISSION_GROUPS.map(g => (
          <label key={g.key}
            style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px', padding:'10px 12px', borderTop:`1px solid ${C.line}`, alignItems:'center', cursor:'default' }}>
            <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{g.label}</span>
            <span style={{ textAlign:'center' }}>
              <input type="checkbox" checked={has(g.key)} onChange={() => toggleRead(g.key, g.write)}
                style={{ width:16, height:16, cursor:'pointer', accentColor:C.accent }} />
            </span>
            <span style={{ textAlign:'center' }}>
              {g.write ? (
                <input type="checkbox" checked={has(`${g.key}.write`)} onChange={() => toggleWrite(g.key)}
                  style={{ width:16, height:16, cursor:'pointer', accentColor:C.accent }} />
              ) : <span style={{ color:C.mute, fontSize:11 }}>—</span>}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function EmployeesTab({ globalSearch = '' }) {
  const [all, setAll]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(null);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showAdd, setShowAdd]     = useState(false);
  const [editEmp, setEditEmp]     = useState(null);
  const [salaryEmp, setSalaryEmp] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const [form, setForm, clearEmpDraft] = useFormDraft('admin-emp-draft', EMPTY_EMP_FORM);
  const [creating, setCreating]   = useState(false);
  const [createErr, setCreateErr] = useState('');

  const [editForm, setEditForm]     = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr]       = useState('');

  const [salaryRecords, setSalaryRecords]   = useState([]);
  const [salaryLoading, setSalaryLoading]   = useState(false);
  const [salaryForm, setSalaryForm]         = useState(EMPTY_SAL);
  const [salaryEditId, setSalaryEditId]     = useState(null);
  const [salarySaving, setSalarySaving]     = useState(false);
  const [salaryErr, setSalaryErr]           = useState('');
  const [salaryEmpInfo, setSalaryEmpInfo]   = useState(null);

  useEffect(() => { setSearch(globalSearch); }, [globalSearch]);

  useEffect(() => {
    adminApi.getEmployees({ limit: 200 })
      .then(r => setAll(r.data?.data?.data || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const employees = all.filter(s => {
    const q = search.toLowerCase();
    const matchQ = !q || s.user?.name?.toLowerCase().includes(q) || s.user?.email?.toLowerCase().includes(q)
      || s.designation?.toLowerCase().includes(q) || s.department?.toLowerCase().includes(q);
    const matchS = !statusFilter
      || (statusFilter==='active'   && !s.isBlocked)
      || (statusFilter==='blocked'  &&  s.isBlocked)
      || (statusFilter==='verified' &&  s.isVerified)
      || (statusFilter==='pending'  && !s.isVerified);
    return matchQ && matchS;
  });

  const active  = all.filter(s => !s.isBlocked).length;
  const blocked = all.filter(s =>  s.isBlocked).length;
  const totalPayroll = all.reduce((s, e) => s + (e.monthlySalary || 0), 0);

  const handleBlock = async (emp) => {
    setBusy(emp._id);
    try {
      await adminApi.blockEmployee(emp._id);
      setAll(prev => prev.map(x => x._id===emp._id ? {...x, isBlocked: !x.isBlocked} : x));
    } catch(e) {} finally { setBusy(null); }
  };
  const handleDelete = async () => {
    if (!confirmDel) return;
    setBusy(confirmDel._id);
    try {
      await adminApi.deleteEmployee(confirmDel._id);
      setAll(prev => prev.filter(x => x._id !== confirmDel._id));
    } catch(e) {} finally { setBusy(null); setConfirmDel(null); }
  };
  const handleCreate = async () => {
    if (!form.name || !form.email || !form.phone || !form.password) { setCreateErr('Name, email, phone and password are required.'); return; }
    if (!isValidPhone(form.phone)) { setCreateErr('Phone number must be exactly 10 digits.'); return; }
    setCreating(true); setCreateErr('');
    try {
      const res = await adminApi.createEmployee({ ...form, monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : 0 });
      const emp = res.data?.data?.employee;
      if (emp) setAll(prev => [emp, ...prev]);
      setShowAdd(false); clearEmpDraft();
    } catch(e) { setCreateErr(e?.response?.data?.message || 'Failed.'); } finally { setCreating(false); }
  };
  const openEdit = (emp) => {
    setEditEmp(emp);
    setEditForm({
      name: emp.user?.name || '', email: emp.user?.email || '', phone: emp.user?.phone || '', newPassword: '',
      designation: emp.designation||'', department: emp.department||'',
      joiningDate: emp.joiningDate ? emp.joiningDate.slice(0,10) : '',
      monthlySalary: emp.monthlySalary||'', businessAddress: emp.businessAddress||'',
      permissions: Array.isArray(emp.permissions) && emp.permissions.length ? emp.permissions : ALL_PERMISSIONS,
    });
    setEditErr('');
  };
  const handleEditSave = async () => {
    if (!editForm.name || !editForm.email || !editForm.phone) { setEditErr('Name, email and phone are required.'); return; }
    if (!isValidPhone(editForm.phone)) { setEditErr('Phone number must be exactly 10 digits.'); return; }
    setEditSaving(true); setEditErr('');
    try {
      const payload = { ...editForm, monthlySalary: editForm.monthlySalary ? Number(editForm.monthlySalary) : 0 };
      if (!payload.newPassword) delete payload.newPassword;
      const res = await adminApi.updateEmployee(editEmp._id, payload);
      const updated = res.data?.data?.employee;
      setAll(prev => prev.map(x => x._id===editEmp._id ? {...x, ...updated} : x));
      setEditEmp(null);
    } catch(e) { setEditErr(e?.response?.data?.message || 'Save failed.'); } finally { setEditSaving(false); }
  };
  const openSalary = async (emp) => {
    setSalaryEmp(emp); setSalaryRecords([]); setSalaryLoading(true);
    setSalaryForm({ ...EMPTY_SAL, baseSalary: emp.monthlySalary || '' });
    setSalaryEditId(null); setSalaryErr(''); setSalaryEmpInfo(null);
    try {
      const res = await adminApi.getEmployeeSalary(emp._id);
      setSalaryRecords(res.data?.data?.records || []);
      setSalaryEmpInfo(res.data?.data?.employee || null);
    } catch(e) {} finally { setSalaryLoading(false); }
  };
  const addDedRow = () => setSalaryForm(f => ({ ...f, deductions:[...f.deductions,{reason:'',amount:''}] }));
  const addBonRow = () => setSalaryForm(f => ({ ...f, bonuses:[...f.bonuses,{reason:'',amount:''}] }));
  const rmDed = i => setSalaryForm(f => ({ ...f, deductions:f.deductions.filter((_,j)=>j!==i) }));
  const rmBon = i => setSalaryForm(f => ({ ...f, bonuses:f.bonuses.filter((_,j)=>j!==i) }));
  const setDF = (i,k,v) => setSalaryForm(f => { const d=[...f.deductions]; d[i]={...d[i],[k]:v}; return {...f,deductions:d}; });
  const setBF = (i,k,v) => setSalaryForm(f => { const b=[...f.bonuses];    b[i]={...b[i],[k]:v}; return {...f,bonuses:b};    });
  const salNet = () => {
    const base=Number(salaryForm.baseSalary)||0, ded=salaryForm.deductions.reduce((s,d)=>s+(Number(d.amount)||0),0), bon=salaryForm.bonuses.reduce((s,b)=>s+(Number(b.amount)||0),0);
    return Math.max(0, base-ded+bon);
  };
  const startEditSal = (rec) => { setSalaryEditId(rec._id); setSalaryForm({ month:rec.month, year:rec.year, baseSalary:rec.baseSalary, deductions:rec.deductions.map(d=>({...d})), bonuses:rec.bonuses.map(b=>({...b})), status:rec.status, notes:rec.notes||'' }); setSalaryErr(''); };
  const handleSalSave = async () => {
    if (!salaryForm.baseSalary) { setSalaryErr('Base salary is required.'); return; }
    setSalarySaving(true); setSalaryErr('');
    try {
      const payload = { month:Number(salaryForm.month), year:Number(salaryForm.year), baseSalary:Number(salaryForm.baseSalary), deductions:salaryForm.deductions.filter(d=>d.reason&&d.amount).map(d=>({reason:d.reason,amount:Number(d.amount)})), bonuses:salaryForm.bonuses.filter(b=>b.reason&&b.amount).map(b=>({reason:b.reason,amount:Number(b.amount)})), status:salaryForm.status, notes:salaryForm.notes };
      if (salaryEditId) {
        const res = await adminApi.updateSalaryRecord(salaryEditId, payload);
        setSalaryRecords(prev => prev.map(r => r._id===salaryEditId ? res.data?.data?.record : r));
        setSalaryEditId(null);
      } else {
        const res = await adminApi.addSalaryRecord(salaryEmp._id, payload);
        setSalaryRecords(prev => [res.data?.data?.record, ...prev]);
      }
      setSalaryForm({ ...EMPTY_SAL, baseSalary: salaryEmpInfo?.monthlySalary||salaryEmp.monthlySalary||'' });
    } catch(e) { setSalaryErr(e?.response?.data?.message || 'Failed.'); } finally { setSalarySaving(false); }
  };
  const delSalRec = async (id) => {
    if (!window.confirm('Delete this salary record?')) return;
    try { await adminApi.deleteSalaryRecord(id); setSalaryRecords(prev=>prev.filter(r=>r._id!==id)); } catch(e) {}
  };
  const markPaid = async (rec) => {
    try { const res=await adminApi.updateSalaryRecord(rec._id,{status:'PAID'}); setSalaryRecords(prev=>prev.map(r=>r._id===rec._id?res.data?.data?.record:r)); } catch(e) {}
  };

  if (loading) return <Loader />;

  const OV = { position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 };
  const MB = { background:C.card, borderRadius:16, width:'100%', boxShadow:'0 24px 64px rgba(0,0,0,.4)', maxHeight:'92vh', overflowY:'auto' };
  const MH = (title, onClose) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px 0' }}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:17, color:C.text }}>{title}</div>
      <button onClick={onClose} style={{ background:'none', border:'none', color:C.mute, fontSize:22, cursor:'pointer' }}>✕</button>
    </div>
  );
  const MP = { padding:'14px 24px 24px' };
  const EI = { width:'100%', height:38, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 12px', fontSize:13, outline:'none', background:C.bg, color:C.text, fontFamily:'inherit', boxSizing:'border-box' };
  const EL = (t) => <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.mute, marginBottom:5, textTransform:'uppercase', letterSpacing:'.05em' }}>{t}</label>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Add Employee Modal ── */}
      {showAdd && (
        <div style={OV}>
          <div style={{ ...MB, maxWidth:580 }}>
            {MH('Add New Employee', () => { setShowAdd(false); clearEmpDraft(); setCreateErr(''); })}
            <div style={MP}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  { l:'Full Name *',        k:'name',           t:'text',     p:'Employee full name',     col:'1/-1', ac:'off' },
                  { l:'Email *',            k:'email',          t:'email',    p:'employee@email.com',                 ac:'off' },
                  { l:'Phone * (10 digits)', k:'phone',         t:'tel',      p:'10-digit mobile number',             ac:'off' },
                  { l:'Password *',         k:'password',       t:'password', p:'Login password',                     ac:'new-password' },
                  { l:'Designation',        k:'designation',    t:'text',     p:'e.g. Sales Manager',                 ac:'off' },
                  { l:'Department',         k:'department',     t:'text',     p:'e.g. Sales',                         ac:'off' },
                  { l:'Joining Date',       k:'joiningDate',    t:'date',     p:'',                                   ac:'off' },
                  { l:'Monthly Salary (Rs.)', k:'monthlySalary',  t:'number',   p:'e.g. 25000',                         ac:'off' },
                  { l:'Work Address',       k:'businessAddress', t:'text',    p:'Office / work location', col:'1/-1', ac:'off' },
                ].map(({ l, k, t, p, col, ac }) => (
                  <div key={k} style={col ? { gridColumn:col } : {}}>
                    {EL(l)}
                    <input value={form[k]}
                      onChange={e=>{
                        const v = k === 'phone' ? cleanPhone(e.target.value) : e.target.value;
                        setForm(f=>({...f,[k]:v}));
                        setCreateErr('');
                      }}
                      type={t} placeholder={p} autoComplete={ac}
                      inputMode={k === 'phone' ? 'numeric' : undefined}
                      style={EI} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop:18 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.accent, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:10 }}>Access Permissions</div>
                <PermissionsPicker
                  value={form.permissions || ALL_PERMISSIONS}
                  onChange={(p) => setForm(f => ({ ...f, permissions: p }))}
                />
              </div>
              {createErr && <div style={{ marginTop:12, padding:'10px 14px', borderRadius:8, background:C.red+'18', color:'#f87171', fontSize:13 }}>{createErr}</div>}
              <div style={{ display:'flex', gap:10, marginTop:18, justifyContent:'flex-end' }}>
                <Btn onClick={()=>{setShowAdd(false);clearEmpDraft();setCreateErr('');}}>Cancel</Btn>
                <Btn variant="primary" onClick={handleCreate} disabled={creating}>{creating?'Creating…':'Create Employee'}</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Employee Modal ── */}
      {editEmp && (
        <div style={OV}>
          <div style={{ ...MB, maxWidth:580 }}>
            {MH(`Edit — ${editEmp.user?.name||'Employee'}`, ()=>setEditEmp(null))}
            <div style={MP}>
              {/* Account Details */}
              <div style={{ fontSize:11, fontWeight:700, color:C.accent, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:10 }}>Account Details</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                {[
                  { l:'Full Name *',  k:'name',        t:'text',     p:'Employee full name', col:'1/-1', ac:'off' },
                  { l:'Email *',           k:'email',       t:'email',    p:'employee@email.com',             ac:'off' },
                  { l:'Phone * (10 digits)', k:'phone',     t:'tel',      p:'10-digit mobile number',         ac:'off' },
                  { l:'New Password',      k:'newPassword', t:'password', p:'Leave blank to keep current',    ac:'new-password' },
                ].map(({ l, k, t, p, col, ac }) => (
                  <div key={k} style={col ? { gridColumn:col } : {}}>
                    {EL(l)}
                    <input value={editForm[k]||''}
                      onChange={e=>{
                        const v = k === 'phone' ? cleanPhone(e.target.value) : e.target.value;
                        setEditForm(f=>({...f,[k]:v}));
                        setEditErr('');
                      }}
                      type={t} placeholder={p} autoComplete={ac}
                      inputMode={k === 'phone' ? 'numeric' : undefined}
                      style={EI} />
                  </div>
                ))}
              </div>
              {/* Employment Details */}
              <div style={{ fontSize:11, fontWeight:700, color:C.accent, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:10, marginTop:4 }}>Employment Details</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  { l:'Designation',        k:'designation',    t:'text',   p:'e.g. Sales Manager' },
                  { l:'Department',         k:'department',     t:'text',   p:'e.g. Sales' },
                  { l:'Joining Date',       k:'joiningDate',    t:'date',   p:'' },
                  { l:'Monthly Salary (Rs.)', k:'monthlySalary',  t:'number', p:'e.g. 25000' },
                  { l:'Work Address',       k:'businessAddress',t:'text',   p:'Office address', col:'1/-1' },
                ].map(({ l, k, t, p, col }) => (
                  <div key={k} style={col ? { gridColumn:col } : {}}>
                    {EL(l)}
                    <input value={editForm[k]||''} onChange={e=>{setEditForm(f=>({...f,[k]:e.target.value}));setEditErr('');}} type={t} placeholder={p} style={EI} />
                  </div>
                ))}
              </div>
              {/* Permissions */}
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.accent, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:10 }}>Access Permissions</div>
                <PermissionsPicker
                  value={editForm.permissions || ALL_PERMISSIONS}
                  onChange={(p) => { setEditForm(f => ({ ...f, permissions: p })); setEditErr(''); }}
                />
              </div>
              {editErr && <div style={{ marginTop:12, padding:'10px 14px', borderRadius:8, background:C.red+'18', color:'#f87171', fontSize:13 }}>{editErr}</div>}
              <div style={{ display:'flex', gap:10, marginTop:18, justifyContent:'flex-end' }}>
                <Btn onClick={()=>setEditEmp(null)}>Cancel</Btn>
                <Btn variant="primary" onClick={handleEditSave} disabled={editSaving}>{editSaving?'Saving…':'Save Changes'}</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {confirmDel && (
        <div style={OV}>
          <div style={{ ...MB, maxWidth:400 }}>
            {MH('Remove Employee', ()=>setConfirmDel(null))}
            <div style={MP}>
              <p style={{ color:C.sub, fontSize:14, margin:'0 0 18px' }}>Archive <strong>{confirmDel.user?.name}</strong>? Their account reverts to a regular customer and they lose employee access. Their products, orders and salary history are preserved so you can still review them.</p>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <Btn onClick={()=>setConfirmDel(null)}>Cancel</Btn>
                <Btn variant="danger" onClick={handleDelete} disabled={busy===confirmDel._id}>{busy===confirmDel._id?'Removing…':'Remove'}</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Salary Management Modal ── */}
      {salaryEmp && (
        <div style={OV}>
          <div style={{ ...MB, maxWidth:700 }}>
            {MH(`Salary — ${salaryEmp.user?.name}`, ()=>{setSalaryEmp(null);setSalaryEditId(null);})}
            <div style={MP}>
              {/* Summary strip */}
              <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
                {[
                  { l:'Base Salary', v:`Rs. ${(salaryEmpInfo?.monthlySalary||salaryEmp.monthlySalary||0).toLocaleString('en-IN')}`, color:C.blue },
                  { l:'Records',     v:salaryRecords.length,                                           color:C.yellow },
                  { l:'Paid',        v:salaryRecords.filter(r=>r.status==='PAID').length,              color:C.green },
                  { l:'Pending',     v:salaryRecords.filter(r=>r.status==='PENDING').length,           color:C.red },
                ].map(s => (
                  <div key={s.l} style={{ flex:'1 1 110px', padding:'10px 14px', background:C.bg, borderRadius:10, border:`1px solid ${C.line}` }}>
                    <div style={{ fontSize:10, color:C.mute, textTransform:'uppercase', letterSpacing:'.05em' }}>{s.l}</div>
                    <div style={{ fontSize:17, fontWeight:800, color:s.color, marginTop:3 }}>{s.v}</div>
                  </div>
                ))}
              </div>

              {/* Add/Edit form */}
              <div style={{ background:C.bg, borderRadius:12, padding:16, border:`1px solid ${C.line}`, marginBottom:18 }}>
                <div style={{ fontWeight:700, fontSize:13, color:C.text, marginBottom:12 }}>{salaryEditId ? '✏️ Edit Record' : '➕ Add Monthly Salary'}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12 }}>
                  <div>
                    {EL('Month *')}
                    <select value={salaryForm.month} onChange={e=>setSalaryForm(f=>({...f,month:Number(e.target.value)}))} style={{ ...EI, cursor:'pointer' }}>
                      {MONTHS_FULL.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    {EL('Year *')}
                    <input value={String(salaryForm.year)} onChange={e=>setSalaryForm(f=>({...f,year:e.target.value}))} type="number" placeholder="2024" style={EI} />
                  </div>
                  <div>
                    {EL('Base Salary (Rs.) *')}
                    <input value={String(salaryForm.baseSalary)} onChange={e=>setSalaryForm(f=>({...f,baseSalary:e.target.value}))} type="number" placeholder="25000" style={EI} />
                  </div>
                </div>

                {/* Deductions */}
                <div style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                    {EL('Deductions')}
                    <button onClick={addDedRow} style={{ fontSize:11, color:C.red, background:'none', border:`1px solid ${C.red}50`, borderRadius:6, padding:'2px 10px', cursor:'pointer', marginBottom:5 }}>+ Add</button>
                  </div>
                  {salaryForm.deductions.map((d,i)=>(
                    <div key={i} style={{ display:'flex', gap:8, marginBottom:6 }}>
                      <input value={d.reason} onChange={e=>setDF(i,'reason',e.target.value)} placeholder="Reason (e.g. Late fine)" style={{ ...EI, flex:2 }} />
                      <input value={d.amount} onChange={e=>setDF(i,'amount',e.target.value)} type="number" placeholder="Rs." style={{ ...EI, flex:1 }} />
                      <button onClick={()=>rmDed(i)} style={{ background:C.red+'18', border:`1px solid ${C.red}40`, borderRadius:7, padding:'0 10px', color:C.red, cursor:'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>

                {/* Bonuses */}
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                    {EL('Bonuses')}
                    <button onClick={addBonRow} style={{ fontSize:11, color:C.green, background:'none', border:`1px solid ${C.green}50`, borderRadius:6, padding:'2px 10px', cursor:'pointer', marginBottom:5 }}>+ Add</button>
                  </div>
                  {salaryForm.bonuses.map((b,i)=>(
                    <div key={i} style={{ display:'flex', gap:8, marginBottom:6 }}>
                      <input value={b.reason} onChange={e=>setBF(i,'reason',e.target.value)} placeholder="Reason (e.g. Diwali bonus)" style={{ ...EI, flex:2 }} />
                      <input value={b.amount} onChange={e=>setBF(i,'amount',e.target.value)} type="number" placeholder="Rs." style={{ ...EI, flex:1 }} />
                      <button onClick={()=>rmBon(i)} style={{ background:C.red+'18', border:`1px solid ${C.red}40`, borderRadius:7, padding:'0 10px', color:C.red, cursor:'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12 }}>
                  <div>
                    {EL('Status')}
                    <select value={salaryForm.status} onChange={e=>setSalaryForm(f=>({...f,status:e.target.value}))} style={{ ...EI, cursor:'pointer' }}>
                      <option value="PENDING">PENDING</option><option value="PAID">PAID</option>
                    </select>
                  </div>
                  <div>
                    {EL('Net Salary (auto)')}
                    <div style={{ height:38, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 12px', display:'flex', alignItems:'center', fontWeight:800, fontSize:14, color:C.green, background:C.card }}>Rs. {salNet().toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    {EL('Notes')}
                    <input value={salaryForm.notes} onChange={e=>setSalaryForm(f=>({...f,notes:e.target.value}))} placeholder="Remarks…" style={EI} />
                  </div>
                </div>

                {salaryErr && <div style={{ marginBottom:10, padding:'8px 12px', borderRadius:8, background:C.red+'18', color:'#f87171', fontSize:13 }}>{salaryErr}</div>}
                <div style={{ display:'flex', gap:8 }}>
                  <Btn variant="primary" onClick={handleSalSave} disabled={salarySaving}>{salarySaving?'Saving…':salaryEditId?'Update Record':'Add Record'}</Btn>
                  {salaryEditId && <Btn onClick={()=>{setSalaryEditId(null);setSalaryForm({...EMPTY_SAL,baseSalary:salaryEmpInfo?.monthlySalary||salaryEmp.monthlySalary||''});setSalaryErr('');}}>Cancel</Btn>}
                </div>
              </div>

              {/* Records list */}
              {salaryLoading ? <Loader /> : salaryRecords.length===0 ? <Empty text="No salary records yet" /> : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {salaryRecords.map(rec => {
                    const dt=rec.deductions.reduce((s,d)=>s+d.amount,0), bt=rec.bonuses.reduce((s,b)=>s+b.amount,0);
                    return (
                      <div key={rec._id} style={{ background:C.bg, border:`1px solid ${C.line}`, borderRadius:10, padding:'14px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                          <div style={{ fontWeight:700, fontSize:14 }}>{MONTHS_FULL[rec.month-1]} {rec.year}</div>
                          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                            <Badge text={rec.status} color={rec.status==='PAID'?C.green:C.yellow} />
                            {rec.status==='PENDING' && <button onClick={()=>markPaid(rec)} style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:`1px solid ${C.green}50`, background:C.green+'15', color:C.green, cursor:'pointer' }}>Mark Paid</button>}
                            <button onClick={()=>startEditSal(rec)} style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:`1px solid ${C.blue}50`, background:C.blue+'15', color:C.blue, cursor:'pointer' }}>Edit</button>
                            <button onClick={()=>delSalRec(rec._id)} style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:`1px solid ${C.red}40`, background:C.red+'12', color:C.red, cursor:'pointer' }}>Del</button>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:13 }}>
                          <span>Base: <strong>Rs. {rec.baseSalary.toLocaleString('en-IN')}</strong></span>
                          {dt>0 && <span style={{color:C.red}}>Ded: <strong>-Rs. {dt.toLocaleString('en-IN')}</strong></span>}
                          {bt>0 && <span style={{color:C.green}}>Bon: <strong>+Rs. {bt.toLocaleString('en-IN')}</strong></span>}
                          <span style={{color:C.blue}}>Net: <strong>Rs. {rec.netSalary.toLocaleString('en-IN')}</strong></span>
                        </div>
                        {rec.deductions.map((d,i)=><div key={i} style={{ fontSize:11, color:C.mute, marginTop:2 }}>↓ {d.reason}: Rs. {d.amount.toLocaleString('en-IN')}</div>)}
                        {rec.bonuses.map((b,i)   =><div key={i} style={{ fontSize:11, color:C.green+'cc', marginTop:2 }}>↑ {b.reason}: Rs. {b.amount.toLocaleString('en-IN')}</div>)}
                        {rec.notes && <div style={{ fontSize:11, color:C.mute, fontStyle:'italic', marginTop:4 }}>Note: {rec.notes}</div>}
                        {rec.paidAt && <div style={{ fontSize:11, color:C.mute, marginTop:2 }}>Paid: {new Date(rec.paidAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <KpiCard label="Total Employees" value={fmt(all.length)}     sub="All staff"          colorKey="yellow" iconEl={Icon.person} />
        <KpiCard label="Active"          value={fmt(active)}         sub="Access granted"     colorKey="green"  iconEl={Icon.shield} />
        <KpiCard label="Blocked"         value={fmt(blocked)}        sub="Access suspended"   colorKey="red"    iconEl={Icon.bell} />
        <KpiCard label="Monthly Payroll" value={`Rs. ${totalPayroll.toLocaleString('en-IN')}`} sub="Total salaries" colorKey="blue" iconEl={Icon.dollar} />
      </div>

      {/* ── Filter + Add bar ── */}
      <Card>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email, designation, department…" style={{ flex:1, minWidth:220 }} />
          <Select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="">All Employees</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending Verify</option>
          </Select>
          {(search||statusFilter) && <Btn onClick={()=>{setSearch('');setStatusFilter('');}}>Clear</Btn>}
          <button onClick={()=>{setShowAdd(true);clearEmpDraft();setCreateErr('');}}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'none', background:C.accent, color:'white', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            <span style={{ fontSize:17, lineHeight:1 }}>+</span> Add Employee
          </button>
        </div>
        <div style={{ marginTop:10, fontSize:12, color:C.mute }}>Showing {employees.length} of {all.length} employees</div>
      </Card>

      {/* ── Employee table ── */}
      <Card title={`Employees (${employees.length})`}>
        {employees.length === 0 ? <Empty text="No employees match your filters" /> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                <Th>Employee</Th><Th>Designation</Th><Th>Contact</Th><Th>Joined</Th><Th>Salary/mo</Th><Th>Status</Th><Th>Actions</Th>
              </tr></thead>
              <tbody>
                {employees.map(s => (
                  <tr key={s._id}>
                    <Td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:9, background:C.blue+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0, overflow:'hidden' }}>
                          {s.shopLogo ? <img src={s.shopLogo} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '👤'}
                        </div>
                        <div>
                          <div style={{ fontWeight:700, fontSize:13 }}>{s.user?.name || '—'}</div>
                          <div style={{ fontSize:11, color:C.mute }}>{s.department || '—'}</div>
                        </div>
                      </div>
                    </Td>
                    <Td style={{ fontSize:13 }}>{s.designation || <span style={{ color:C.mute }}>—</span>}</Td>
                    <Td style={{ color:C.mute, fontSize:12 }}>{s.user?.email}<br />{s.user?.phone}</Td>
                    <Td style={{ fontSize:12, color:C.mute }}>
                      {s.joiningDate ? new Date(s.joiningDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}
                    </Td>
                    <Td><span style={{ fontWeight:700, color:C.green }}>Rs. {(s.monthlySalary||0).toLocaleString('en-IN')}</span></Td>
                    <Td>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        <Badge text={s.isVerified ? 'Verified' : 'Pending'} color={s.isVerified ? C.green : C.yellow} />
                        {s.isBlocked && <Badge text="Blocked" color={C.red} />}
                      </div>
                    </Td>
                    <Td>
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                        <button onClick={()=>openEdit(s)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:`1px solid ${C.blue}50`, background:C.blue+'12', color:C.blue, cursor:'pointer' }}>Edit</button>
                        <button onClick={()=>openSalary(s)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:`1px solid ${C.green}50`, background:C.green+'12', color:C.green, cursor:'pointer' }}>Salary</button>
                        <button onClick={()=>handleBlock(s)} disabled={busy===s._id} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:`1px solid ${s.isBlocked?C.green:C.yellow}50`, background:s.isBlocked?C.green+'12':C.yellow+'12', color:s.isBlocked?C.green:C.yellow, cursor:'pointer', opacity:busy===s._id?.6:1 }}>
                          {s.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                        <button onClick={()=>setConfirmDel(s)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:`1px solid ${C.red}40`, background:C.red+'12', color:C.red, cursor:'pointer' }}>Remove</button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ORDERS TAB
══════════════════════════════════════════════════════ */
const ORDER_STATUSES = ['PLACED','CONFIRMED','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','RETURNED'];

function OrdersTab({ globalSearch = '' }) {
  const [all, setAll]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [pagination, setPag]  = useState({ total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false });
  const [updating, setUpd]    = useState(null);
  const [search, setSearch]   = useState('');
  const [statusF, setStatusF] = useState('');
  const [paymentF, setPayF]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [refundModal, setRefundModal] = useState(null); // order object
  const [refundForm, setRefundForm]   = useState({ reason: '', adminNote: '', refundAmount: '' });
  const [refunding, setRefunding]     = useState(false);
  const [expandedId, setExpandedId]   = useState(null);
  // Absolute tab counts (independent of active status filter). Backend returns
  // statusBreakdown array + pendingPaymentCount so all tabs stay populated.
  const [statusCounts, setStatusCounts] = useState({});
  const [pendingPayCount, setPendingPay] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => { setSearch(globalSearch); }, [globalSearch]);

  // appliedSearch only updates on Enter / Search button — no API calls while typing
  const [appliedSearch, setAppliedSearch] = useState('');
  const applySearch = () => { setPage(1); setAppliedSearch(search); };

  useEffect(() => { setPage(1); }, [statusF, paymentF]);

  const hasLoadedRef = useRef(false);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    const params = { limit: 100, page };
    // PENDING_PAYMENT is a synthetic filter — orders awaiting customer payment.
    // It maps to: orderStatus=PLACED AND paymentStatus=PENDING (regardless of paymentF).
    if (statusF === 'PENDING_PAYMENT') {
      params.status        = 'PLACED';
      params.paymentStatus = 'PENDING';
    } else {
      if (statusF)  params.status        = statusF;
      if (paymentF) params.paymentStatus = paymentF;
    }
    if (appliedSearch)  params.search        = appliedSearch;
    adminApi.getOrders(params)
      .then(r => {
        const data = r.data?.data || {};
        setAll(data.data || []);
        setPag(data.pagination || { total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false });
        // Build a map { PLACED: 4, DELIVERED: 12, ... } from the breakdown array.
        const counts = {};
        let totalAcross = 0;
        (data.statusBreakdown || []).forEach(b => { counts[b._id] = b.count; totalAcross += b.count; });
        setStatusCounts(counts);
        setPendingPay(data.pendingPaymentCount || 0);
        setTotalCount(totalAcross);
      })
      .catch(() => {}).finally(() => { setLoading(false); hasLoadedRef.current = true; });
  }, [page, statusF, paymentF, appliedSearch]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // date filter is client-side (no backend support); text/status/payment are server-side
  const orders = all.filter(o => {
    const d = o.createdAt ? new Date(o.createdAt) : null;
    const matchD = (!dateFrom || (d && d >= new Date(dateFrom))) &&
                   (!dateTo   || (d && d <= new Date(dateTo + 'T23:59:59')));
    return matchD;
  });

  const handleStatusChange = async (orderId, status) => {
    // CANCELLED must route through cancelOrder so stock is restored and the
    // customer gets a proper cancellation notification — the admin status PATCH
    // only writes the field and skips the restock/refund flow.
    if (status === 'CANCELLED') {
      handleCancel(orderId);
      return;
    }
    setUpd(orderId);
    await adminApi.updateOrderStatus(orderId, { status }).catch(() => {});
    setAll(prev =>
      statusF && status !== statusF
        ? prev.filter(x => x._id !== orderId)
        : prev.map(x => x._id === orderId ? { ...x, orderStatus: status } : x)
    );
    setUpd(null);
  };

  const handleCancel = async (orderId) => {
    const order = all.find(x => x._id === orderId);
    const reason = window.prompt(`Cancel order ${order?.orderNumber || ''}?\n\nReason (shown to customer):`, 'Cancelled by admin');
    if (!reason) return;
    setUpd(orderId);
    try {
      await ordersApi.cancel(orderId, { reason });
      setAll(prev =>
        statusF && 'CANCELLED' !== statusF
          ? prev.filter(x => x._id !== orderId)
          : prev.map(x => x._id === orderId ? { ...x, orderStatus: 'CANCELLED', cancellationReason: reason } : x)
      );
    } catch (e) {
      alert(e?.response?.data?.message || 'Cancel failed');
    } finally {
      setUpd(null);
    }
  };

  const openRefund = (o) => {
    const nonRefundable = (o.codBookingStatus === 'PAID' && o.codBookingAmount > 0) ? o.codBookingAmount : 0;
    setRefundForm({ reason: 'Admin initiated refund', adminNote: '', refundAmount: o.totalPrice - nonRefundable });
    setRefundModal(o);
  };

  const submitForceRefund = async () => {
    if (!refundForm.reason) return;
    setRefunding(true);
    try {
      const refundAmount = Number(refundForm.refundAmount) || refundModal.totalPrice;

      // For Razorpay-paid orders, attempt gateway refund — warn on failure but don't block
      if (refundModal.paymentMethod === 'ONLINE' && refundModal.paymentStatus === 'PAID') {
        try {
          await paymentsApi.initiateRefund(refundModal._id, {
            refundAmount,
            reason: refundForm.reason,
          });
        } catch (rzpErr) {
          const msg = rzpErr?.response?.data?.message || 'Razorpay refund could not be initiated';
          // Inform admin but continue — manual refund may still be needed
          if (!window.confirm(`Razorpay refund failed: "${msg}"\n\nContinue marking the order as RETURNED anyway?`)) {
            setRefunding(false);
            return;
          }
        }
      }

      await adminApi.forceRefund(refundModal._id, {
        reason: refundForm.reason,
        adminNote: refundForm.adminNote,
        refundAmount,
      });
      setAll(prev => prev.map(x => x._id === refundModal._id ? { ...x, orderStatus: 'RETURNED', paymentStatus: 'REFUNDED' } : x));
      setRefundModal(null);
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to initiate refund');
    } finally { setRefunding(false); }
  };

  if (loading && !hasLoadedRef.current) return <Loader />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: loading ? 0.55 : 1, transition: 'opacity .2s', pointerEvents: loading ? 'none' : 'auto' }}>
      {/* Force Refund Modal */}
      {refundModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background: C.card, borderRadius:14, padding:28, width:440, boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ fontWeight:800, fontSize:17, marginBottom:4 }}>↩ Force Refund</div>
            <div style={{ fontSize:12, color:C.mute, marginBottom:20 }}>
              Order <strong>{refundModal.orderNumber}</strong> · {refundModal.user?.name} · {fmtRs(refundModal.totalPrice)}
              {refundModal.codBookingStatus === 'PAID' && refundModal.codBookingAmount > 0 && (
                <span style={{ display:'block', marginTop:5, color: C.yellow, fontWeight:600, background: C.yellow+'15', border:`1px solid ${C.yellow}40`, borderRadius:6, padding:'4px 8px' }}>
                  ⚠ COD booking {fmtRs(refundModal.codBookingAmount)} is non-refundable — max refundable: {fmtRs(refundModal.totalPrice - refundModal.codBookingAmount)}
                </span>
              )}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:C.mute, display:'block', marginBottom:5, textTransform:'uppercase' }}>Reason *</label>
                <input value={refundForm.reason} onChange={e => setRefundForm(f => ({...f, reason: e.target.value}))}
                  placeholder="Reason for refund"
                  style={{ width:'100%', height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 10px', fontSize:13, outline:'none', boxSizing:'border-box', background: C.bg, color: C.text }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:C.mute, display:'block', marginBottom:5, textTransform:'uppercase' }}>Refund Amount (Rs.)</label>
                <input type="number" value={refundForm.refundAmount}
                  onChange={e => setRefundForm(f => ({...f, refundAmount: e.target.value === '' ? '' : Number(e.target.value)}))}
                  style={{ width:'100%', height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 10px', fontSize:13, fontWeight:700, outline:'none', boxSizing:'border-box', background: C.bg, color: C.text }} />
                <div style={{ fontSize:11, color:C.mute, marginTop:3 }}>Default: full order amount</div>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:C.mute, display:'block', marginBottom:5, textTransform:'uppercase' }}>Admin Note (optional)</label>
                <input value={refundForm.adminNote} onChange={e => setRefundForm(f => ({...f, adminNote: e.target.value}))}
                  placeholder="Internal note for records"
                  style={{ width:'100%', height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 10px', fontSize:13, outline:'none', boxSizing:'border-box', background: C.bg, color: C.text }} />
              </div>
            </div>

            <div style={{ background: C.yellow+'15', border:`1px solid ${C.yellow}40`, borderRadius:8, padding:'10px 14px', marginTop:16, fontSize:12, color: C.yellow }}>
              {refundModal?.paymentMethod === 'ONLINE' && refundModal?.paymentStatus === 'PAID'
                ? '⚠ This will issue a Razorpay gateway refund and mark the order as RETURNED.'
                : '⚠ This will mark the order as RETURNED and create an approved refund request. The customer will be notified.'}
            </div>

            <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={() => setRefundModal(null)} disabled={refunding}
                style={{ padding:'8px 18px', borderRadius:8, border:`1px solid ${C.line}`, background: C.card, fontSize:13, cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={submitForceRefund} disabled={refunding || !refundForm.reason}
                style={{ padding:'8px 18px', borderRadius:8, border:'none', background:C.red, color:'white', fontSize:13, fontWeight:700, cursor:'pointer', opacity: !refundForm.reason ? .5 : 1 }}>
                {refunding ? 'Processing…' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <Card>
        {/* Quick status tabs — matches Return Requests UX so admins can hop
            between statuses with one click instead of opening a dropdown. */}
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
            const count = f.key === ''
              ? totalCount
              : f.key === 'PENDING_PAYMENT'
                ? pendingPayCount
                : (statusCounts[f.key] || 0);
            return (
              <button key={f.key || 'ALL'} onClick={() => { setStatusF(f.key); setPage(1); }}
                style={{ padding:'5px 14px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6,
                  border: active ? `1px solid ${C.accent}` : `1px solid ${C.line}`,
                  background: active ? C.accent : C.card2 || C.bg,
                  color: active ? 'white' : C.mute }}>
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

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 240 }}>
            <Input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applySearch()}
              placeholder="Order #, name, email, phone…" style={{ flex: 1 }} />
            <Btn variant="primary" onClick={applySearch} style={{ flexShrink: 0 }}>
              <SvgAt el={Icon.search} size={14} /> Search
            </Btn>
          </div>
          <Select value={paymentF} onChange={e => setPayF(e.target.value)}>
            <option value="">All Payments</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
          </Select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            title="From date"
            style={{ height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 10px', fontSize:12, background:C.card, color:C.text, outline:'none', cursor:'pointer' }} />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            title="To date"
            style={{ height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 10px', fontSize:12, background:C.card, color:C.text, outline:'none', cursor:'pointer' }} />
          {(appliedSearch || statusF || paymentF || dateFrom || dateTo) && <Btn onClick={() => { setSearch(''); setAppliedSearch(''); setStatusF(''); setPayF(''); setDateFrom(''); setDateTo(''); setPage(1); }}>Clear</Btn>}
          <span style={{ fontSize: 13, color: C.mute, marginLeft: 'auto' }}>
            {dateFrom || dateTo
              ? <><strong style={{color:C.text}}>{orders.length}</strong> match · </>
              : null}
            <strong style={{color:C.text}}>{pagination.total}</strong> {appliedSearch ? 'found' : 'total'}
          </span>
        </div>
      </Card>

      <Card title={`Orders (${pagination.total})`}>
        <PagBar page={page} pagination={pagination} loading={loading} setPage={setPage} label={`${pagination.total} total orders`} />
        {orders.length === 0
          ? <Empty text="No orders match your filters" />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.map(o => {
                const isFinal = ['DELIVERED','CANCELLED','RETURNED'].includes(o.orderStatus);
                const canRefund = o.orderStatus === 'DELIVERED';
                const isExpanded = expandedId === o._id;
                return (
                  <div key={o._id} style={{ border:`1px solid ${C.line}`, borderRadius:10, marginBottom:0, overflow:'hidden', opacity: updating === o._id ? .5 : 1 }}>
                    <div
                      onClick={() => setExpandedId(expandedId === o._id ? null : o._id)}
                      style={{
                        background: C.surf,
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
                      <span style={{ fontSize:12, color:C.mute, flexShrink:0 }}>{o.orderItems?.length||0} item{(o.orderItems?.length||0)!==1?'s':''}</span>
                      <span style={{ fontWeight:700, fontSize:13, color:C.text, flexShrink:0 }}>{fmtRs(o.totalPrice)}</span>
                      <Badge text={o.paymentMethod} color={o.paymentMethod==='COD'?C.yellow:C.blue} />
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

                        {/* Visual fulfilment pipeline — click the next step to advance the order */}
                        <div style={{ marginBottom:14, border:`1px solid ${C.line}`, borderRadius:8, overflow:'hidden' }}>
                          <OrderPipeline
                            status={o.orderStatus}
                            busy={updating === o._id}
                            onAdvance={(nextStatus) => handleStatusChange(o._id, nextStatus)}
                            theme={{ line:C.line, accent:C.accent, green:C.green, red:C.red, mute:C.mute, text:C.text, bg:C.bg, card2:C.card2 || C.surf }}
                          />
                        </div>

                        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:14, padding:'10px 14px', background:C.bg, borderRadius:8, border:`1px solid ${C.line}` }}>
                          <div style={{ fontSize:11, fontWeight:700, color:C.mute, textTransform:'uppercase', letterSpacing:'.05em' }}>Payment</div>
                          <Badge text={o.paymentMethod} color={o.paymentMethod==='COD'?C.yellow:C.blue} />
                          <Badge text={o.paymentStatus} color={o.paymentStatus==='PAID'?C.green:o.paymentStatus==='FAILED'?C.red:C.yellow} />
                          <span style={{ fontWeight:700, fontSize:13, color:C.text, marginLeft:'auto' }}>{fmtRs(o.totalPrice)}</span>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-start' }}>
                          <div style={{ fontSize:11, fontWeight:700, color:C.mute, textTransform:'uppercase', letterSpacing:'.05em' }}>Actions</div>
                          <select value={o.orderStatus}
                            disabled={updating === o._id || isFinal}
                            onChange={e => handleStatusChange(o._id, e.target.value)}
                            style={{
                              fontSize: 12, padding: '5px 8px', borderRadius: 8,
                              border: `1px solid ${isFinal ? C.line : C.accent+'55'}`,
                              background: C.bg, color: isFinal ? C.mute : C.text,
                              cursor: isFinal ? 'not-allowed' : 'pointer',
                              opacity: isFinal ? 0.5 : 1,
                            }}>
                            {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          {['PLACED','CONFIRMED'].includes(o.orderStatus) && (
                            <button onClick={() => handleCancel(o._id)} disabled={updating === o._id}
                              style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                                border: `1px solid ${C.red}55`, background: C.red+'18', color: C.red,
                                cursor: updating === o._id ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap', fontFamily: 'inherit', opacity: updating === o._id ? 0.6 : 1 }}>
                              {updating === o._id ? '…' : '✕ Cancel Order'}
                            </button>
                          )}
                          {canRefund && (
                            <button onClick={() => openRefund(o)}
                              style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                                border: `1px solid ${C.red}55`, background: C.red+'18', color: C.red,
                                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                              ↩ Refund
                            </button>
                          )}
                          {isFinal && !canRefund && (
                            <span style={{ fontSize: 11, color: C.mute, padding: '4px 0', fontStyle: 'italic' }}>
                              {o.orderStatus === 'CANCELLED' ? 'Cancelled' : o.orderStatus === 'RETURNED' ? 'Returned' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
        <div style={{ borderTop:`1px solid ${C.line}`, marginTop:8, paddingTop:4 }}>
          <PagBar page={page} pagination={pagination} loading={loading} setPage={setPage} label={`${pagination.total} total orders`} />
        </div>
      </Card>
    </div>
  );
}

/* ── Shared micro-components ─────────────────────── */
function PagBar({ page, pagination, loading, setPage, label = '' }) {
  if (pagination.totalPages <= 1) return null;
  const style = { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 4px', borderBottom:`1px solid ${C.line}`, marginBottom:8 };
  return (
    <div style={style}>
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
function Loader() {
  return (
    <div style={{ padding: 60, textAlign: 'center', color: C.mute }}>
      <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px', borderColor: C.line, borderTopColor: C.accent }} />
      Loading…
    </div>
  );
}
function Empty({ text }) {
  return <div style={{ padding: '40px 0', textAlign: 'center', color: C.mute, fontSize: 14 }}>{text}</div>;
}

/* ══════════════════════════════════════════════════════
   ADMIN RETURNS TAB
══════════════════════════════════════════════════════ */
const ADMIN_RETURN_STATUSES = [
  'REQUESTED','EMPLOYEE_APPROVED','EMPLOYEE_REJECTED',
  'APPROVED','REJECTED','PICKUP_SCHEDULED',
  'ITEM_RECEIVED','REFUND_INITIATED','REFUND_COMPLETED',
  'REPLACEMENT_SENT','COMPLETED',
];

const RETURN_STATUS_META = {
  REQUESTED:         { label:'Requested',          color:'#f59e0b' },
  EMPLOYEE_APPROVED: { label:'Employee Approved',  color:'#3b82f6' },
  EMPLOYEE_REJECTED: { label:'Employee Rejected',  color:'#ef4444' },
  APPROVED:         { label:'Approved',         color:'#22c55e' },
  REJECTED:         { label:'Rejected',         color:'#dc2626' },
  PICKUP_SCHEDULED: { label:'Pickup Scheduled', color:'#8b5cf6' },
  ITEM_RECEIVED:    { label:'Item Received',    color:'#06b6d4' },
  REFUND_INITIATED: { label:'Refund Initiated', color:'#FF5A1F' },
  REFUND_COMPLETED: { label:'Refund Completed', color:'#16a34a' },
  REPLACEMENT_SENT: { label:'Replacement Sent', color:'#8b5cf6' },
  COMPLETED:        { label:'Completed',        color:'#16a34a' },
};

function ReturnStatusBadge({ status }) {
  const m = RETURN_STATUS_META[status] || { label: status, color: '#888' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700,
      padding:'3px 9px', borderRadius:99, background: m.color + '20', color: m.color }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background: m.color }} />{m.label}
    </span>
  );
}

function AdminReturnsTab({ globalSearch = '' }) {
  const { isMobile, isTablet } = useResponsive();
  const [returns, setReturns]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState('ALL');
  const [actionId, setActionId]       = useState(null);
  const [actionForm, setActionForm]   = useState({ status:'', adminNote:'', refundAmount:'' });
  const [proofFiles, setProofFiles]   = useState([]);
  const [proofModal, setProofModal]   = useState(null); // return object to show proof
  const [saving, setSaving]           = useState(false);
  const [search, setSearch]           = useState('');
  const [expandedId, setExpandedId]   = useState(null);

  useEffect(() => { setSearch(globalSearch); }, [globalSearch]);

  const load = useCallback(() => {
    setLoading(true);
    returnsApi.getAll({ limit: 100 })
      .then(r => setReturns(r.data?.data?.data || r.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const doProcess = async (id) => {
    if (!actionForm.status) return;
    if (['REFUND_INITIATED', 'REFUND_COMPLETED'].includes(actionForm.status) && proofFiles.length === 0) {
      alert('Please upload at least 1 refund proof screenshot for refund status updates.');
      return;
    }
    setSaving(true);
    try {
      await returnsApi.process(id, { ...actionForm, files: proofFiles.length ? proofFiles : undefined });
      setActionId(null);
      setActionForm({ status:'', adminNote:'', refundAmount:'' });
      setProofFiles([]);
      load();
    } catch(e) {
      alert(e?.response?.data?.message || 'Action failed');
    } finally { setSaving(false); }
  };

  const q = search.trim().toLowerCase();
  const filtered = returns
    .filter(r => filter === 'ALL' || r.status === filter)
    .filter(r => {
      if (!q) return true;
      return (
        r._id?.toLowerCase().includes(q) ||
        r._id?.slice(-8).toLowerCase().includes(q) ||
        r.user?.name?.toLowerCase().includes(q) ||
        r.user?.email?.toLowerCase().includes(q) ||
        r.user?.phone?.toLowerCase().includes(q) ||
        r.order?.orderNumber?.toLowerCase().includes(q) ||
        r.order?._id?.slice(-8).toLowerCase().includes(q) ||
        r.product?.title?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q)
      );
    });

  const stats = {
    total:            returns.length,
    employeePending:  returns.filter(r => r.status === 'REQUESTED').length,
    employeeRejected: returns.filter(r => r.status === 'EMPLOYEE_REJECTED').length,
    adminPending:     returns.filter(r => r.status === 'EMPLOYEE_APPROVED').length,
    done:             returns.filter(r => ['COMPLETED','REJECTED','REFUND_COMPLETED','REPLACEMENT_SENT'].includes(r.status)).length,
    value:            returns.reduce((s, r) => s + (r.refundAmount || 0), 0),
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Flow explanation */}
      <div style={{ background: C.card, borderRadius:12, padding:'14px 20px', boxShadow:'0 1px 3px #0000000d', display:'flex', gap:0, alignItems:'center', flexWrap:'wrap' }}>
        {[
          { icon:'📤', label:'Customer Submits', color:C.blue },
          { icon:'→', label:'', color:'#aaa' },
          { icon:'🏪', label:'Employee Approves/Rejects', color:C.yellow },
          { icon:'→', label:'', color:'#aaa' },
          { icon:'🛡️', label:'Admin Confirms/Overrides', color:C.accent },
          { icon:'→', label:'', color:'#aaa' },
          { icon:'🚚', label:'Pickup & Refund', color:C.green },
        ].map((s, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px',
            ...(s.label ? { background: s.color+'15', borderRadius:8, border:`1px solid ${s.color}30` } : {}) }}>
            <span style={{ fontSize: s.label ? 16 : 14, color: s.label ? s.color : '#ccc' }}>{s.icon}</span>
            {s.label && <span style={{ fontSize:12, fontWeight:700, color:s.color }}>{s.label}</span>}
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(3,1fr)' : 'repeat(5,1fr)', gap:12 }}>
        <KpiCard label="Total Returns"     value={stats.total}            colorKey="blue"   iconEl={Icon.refund} />
        <KpiCard label="Awaiting Employee" value={stats.employeePending}  colorKey="yellow" iconEl={Icon.bag}    sub="Pending response" />
        <KpiCard label="Employee Rejected" value={stats.employeeRejected} colorKey="red"    iconEl={Icon.bell}   sub="Override needed" />
        <KpiCard label="Awaiting You"      value={stats.adminPending}     colorKey="orange" iconEl={Icon.shield} sub="Needs your approval" />
        <KpiCard label="Refund Value"      value={fmtShort(stats.value)}  colorKey="green"  iconEl={Icon.dollar} rawValue={stats.value} />
      </div>

      {/* Employee-rejected alert banner */}
      {stats.employeeRejected > 0 && (
        <div style={{ background:'rgba(239,68,68,.08)', border:`1px solid rgba(239,68,68,.25)`, borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, fontSize:13.5, color:'#f87171' }}>{stats.employeeRejected} return{stats.employeeRejected > 1 ? 's' : ''} rejected by employee — needs your review</div>
            <div style={{ fontSize:12, color:C.mute, marginTop:2 }}>You can override the employee's decision and approve these returns.</div>
          </div>
          <button onClick={() => setFilter('EMPLOYEE_REJECTED')}
            style={{ padding:'7px 16px', borderRadius:8, background:C.red, color:'white', border:'none', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
            Review Now
          </button>
        </div>
      )}

      <Card title="Return Requests"
        action={
          <div style={{ display:'flex', alignItems:'center', gap:8, background:C.bg, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 10px', height:34, minWidth:220 }}>
            <span style={{ color:C.mute, display:'flex', alignItems:'center', flexShrink:0 }}><SvgAt el={Icon.search} size={14} /></span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Name, email, phone, order #, return ID…"
              style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:12.5, color:C.text, fontFamily:'inherit', minWidth:0 }} />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ background:'none', border:'none', color:C.mute, cursor:'pointer', padding:0, fontSize:14, lineHeight:1 }}>✕</button>
            )}
          </div>
        }>
        {/* Filter pills */}
        <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
          <button key="ALL" onClick={() => setFilter('ALL')}
            style={{ padding:'5px 14px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              border: filter==='ALL' ? `1px solid ${C.accent}` : `1px solid ${C.line}`,
              background: filter==='ALL' ? C.accent : C.card2,
              color: filter==='ALL' ? 'white' : C.sub }}>
            All
          </button>
          {ADMIN_RETURN_STATUSES.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'5px 14px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                border: filter===f ? `1px solid ${RETURN_STATUS_META[f]?.color}` : `1px solid ${C.line}`,
                background: filter===f ? RETURN_STATUS_META[f]?.color + '22' : C.card2,
                color: filter===f ? RETURN_STATUS_META[f]?.color : C.sub }}>
              {RETURN_STATUS_META[f]?.label || f}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:C.mute }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:C.mute }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📦</div>
            <div style={{ fontWeight:700 }}>{q ? 'No returns match your search' : 'No returns in this category'}</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {filtered.map(req => {
              const isOpen = actionId === req._id;
              const isExpanded = expandedId === req._id;

              return (
                <div key={req._id} style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:'hidden' }}>
                  {/* Collapsed header — always visible */}
                  <div
                    onClick={() => setExpandedId(expandedId === req._id ? null : req._id)}
                    style={{
                      background: C.surf,
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'background .15s',
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
                    <ReturnStatusBadge status={req.status} />
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
                      {/* Item + info */}
                      <div style={{ padding:'12px 18px', display:'flex', gap:12, alignItems:'center', borderTop:`1px solid ${C.line}` }}>
                        {req.product?.images?.[0]
                          ? <img src={req.product.images[0]} alt="" style={{ width:52, height:52, objectFit:'contain', border:`1px solid ${C.line}`, borderRadius:6 }} />
                          : <div style={{ width:52, height:52, background:C.surf, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>📦</div>
                        }
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:13, color:C.text }}>{req.product?.title || 'Product'}</div>
                          <div style={{ fontSize:12, color:C.mute, marginTop:2 }}>
                            Reason: <strong style={{ color:C.text }}>{REASON_LABEL[req.reason] || req.reason?.replace(/_/g,' ')}</strong>
                            {' · '}Resolution: <strong>{req.resolution || 'refund'}</strong>
                          </div>
                          {req.description && <div style={{ fontSize:12, color:C.sub, marginTop:3, fontStyle:'italic' }}>"{req.description}"</div>}
                        </div>
                        <div style={{ textAlign:'right', fontSize:12, color:C.mute }}>
                          <div>Order: {req.order?.orderNumber || req.order?._id?.slice(-6)?.toUpperCase() || '—'}</div>
                          <div style={{ marginTop:4, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                            {req.order?.paymentMethod === 'COD' && (
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:4, background:'#fef9c3', color:'#854d0e', border:'1px solid #fde047' }}>COD</span>
                            )}
                            {req.refundMethod === 'bank_transfer' && req.bankDetails?.accountNumber && (
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:4, background: C.green+'25', color: C.green }}>Bank ✓</span>
                            )}
                            {req.refundMethod === 'upi' && req.bankDetails?.upiId && (
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:4, background: C.green+'25', color: C.green }}>UPI ✓</span>
                            )}
                            {req.resolution === 'refund' && !req.bankDetails?.accountNumber && !req.bankDetails?.upiId && req.refundMethod !== 'original_payment' && (
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:4, background:'#fee2e2', color:'#dc2626' }}>Bank details pending</span>
                            )}
                            {req.employeeNote && <span style={{ color:'#007185' }}>Employee replied</span>}
                          </div>
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
                        <div style={{ padding:'10px 18px', borderTop:`1px solid ${C.line}`, background: C.card2+'99', fontSize:12 }}>
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
                            <div style={{ color:C.mute }}>Back to original payment method (Razorpay)</div>
                          ) : (
                            <div style={{ color: C.yellow, fontWeight:600 }}>
                              ⚠ {req.order?.paymentMethod === 'COD'
                                ? 'COD order — customer has not provided bank/UPI details yet'
                                : 'Customer has not selected a refund method yet'}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes from employee */}
                      {(req.employeeNote || req.adminNote) && (
                        <div style={{ padding:'8px 18px', background: C.bg, borderTop:`1px solid ${C.line}`, fontSize:12, color:'#555', display:'flex', gap:16, flexWrap:'wrap' }}>
                          {req.employeeNote && <span><strong>Employee:</strong> {req.employeeNote}</span>}
                          {req.adminNote  && <span><strong>Admin:</strong> {req.adminNote}</span>}
                        </div>
                      )}

                      {/* Refund proof photos (uploaded by admin/employee) */}
                      {req.refundProof?.length > 0 && (
                        <div style={{ padding:'12px 18px', borderTop:`1px solid ${C.line}`, background:C.bg }}>
                          <div style={{ fontSize:11, fontWeight:700, color:C.green, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                            🧾 Refund Proof ({req.refundProof.length} screenshot{req.refundProof.length !== 1 ? 's' : ''})
                          </div>
                          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                            {req.refundProof.map((p, i) => (
                              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" title={`Proof ${i+1} — by ${p.uploadedBy}`}>
                                <img src={p.url} alt={`Refund proof ${i+1}`}
                                  style={{ width:80, height:80, objectFit:'cover', borderRadius:8, border:`2px solid ${C.green}55`, cursor:'zoom-in', display:'block', transition:'all .15s' }}
                                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.green;e.currentTarget.style.transform='scale(1.06)';}}
                                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.green+'55';e.currentTarget.style.transform='scale(1)';}} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Timeline preview */}
                      {req.timeline?.length > 0 && !isOpen && (
                        <div style={{ padding:'8px 18px', borderTop:`1px solid ${C.line}`, fontSize:11, color:C.mute, display:'flex', gap:16, flexWrap:'wrap' }}>
                          {[...req.timeline].slice(-3).map((ev, i) => (
                            <span key={i} style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <span style={{ width:6, height:6, borderRadius:'50%', background:RETURN_STATUS_META[ev.status]?.color || '#888' }} />
                              {ev.status?.replace(/_/g,' ')}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Take Action button */}
                      {!isOpen && (
                        <div style={{ padding:'10px 18px', borderTop:`1px solid ${C.line}`, background:C.bg, display:'flex', justifyContent:'flex-end' }}>
                          <button onClick={e => { e.stopPropagation(); setActionId(req._id); setActionForm({ status:'', adminNote:'', refundAmount: req.refundAmount || '' }); }}
                            style={{ padding:'6px 14px', borderRadius:8, background:C.accent, color:'white',
                              border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                            Take Action
                          </button>
                        </div>
                      )}

                      {/* Admin action panel */}
                      {isOpen && (
                        <div style={{ padding:'16px 18px', background: C.bg, borderTop:`1px solid ${C.line}` }}>
                          <div style={{ fontWeight:700, fontSize:13, marginBottom:12 }}>Admin Action</div>

                          {/* Employee-rejection override notice */}
                          {req.status === 'EMPLOYEE_REJECTED' && (
                            <div style={{ background:'#fef9c3', border:'1px solid #fde047', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#854d0e' }}>
                              ⚠️ <strong>Employee rejected this return.</strong> You can override and set status to <em>Approved</em> if the customer's claim is valid.
                            </div>
                          )}

                          {/* Refund details — show bank info if provided */}
                          {req.resolution === 'refund' && (
                            <div style={{ background:'#f0f9ff', border:`1px solid ${C.line}`, borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12 }}>
                              <div style={{ fontWeight:700, color:'#0369a1', marginBottom:4 }}>💳 Refund Details</div>
                              <div style={{ color:'#555' }}>
                                Method: <strong>{req.order?.paymentMethod === 'COD' ? '🟡 COD (must pay via bank/UPI)' : req.order?.paymentMethod}</strong>
                                {' · '}Refund to: <strong>{req.refundMethod === 'bank_transfer' ? 'Bank Transfer' : req.refundMethod === 'upi' ? 'UPI' : 'Original Payment'}</strong>
                              </div>
                              {req.bankDetails?.accountNumber && (
                                <div style={{ color:'#555', marginTop:3 }}>
                                  🏦 {req.bankDetails.bankName} — ···{req.bankDetails.accountNumber.slice(-4)} ({req.bankDetails.accountName}) · IFSC: {req.bankDetails.ifscCode}
                                </div>
                              )}
                              {req.bankDetails?.upiId && (
                                <div style={{ color:'#555', marginTop:3 }}>📱 UPI: {req.bankDetails.upiId}</div>
                              )}
                              {!req.bankDetails?.accountNumber && !req.bankDetails?.upiId && req.refundMethod !== 'original_payment' && (
                                <div style={{ color:C.red, marginTop:3, fontWeight:700 }}>⚠️ Customer has not provided bank/UPI details yet</div>
                              )}
                            </div>
                          )}
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                            <div>
                              <label style={{ fontSize:11, fontWeight:700, color:C.mute, display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' }}>New Status *</label>
                              <select value={actionForm.status} onChange={e=>setActionForm(f=>({...f,status:e.target.value}))}
                                style={{ width:'100%', height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 10px', fontSize:13, outline:'none', background: C.bg, color: C.text }}>
                                <option value="">— Select Status —</option>
                                {ADMIN_RETURN_STATUSES.map(s => (
                                  <option key={s} value={s}>{RETURN_STATUS_META[s]?.label || s}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize:11, fontWeight:700, color:C.mute, display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' }}>Refund Amount (Rs.)</label>
                              <input type="number" value={actionForm.refundAmount} onChange={e=>setActionForm(f=>({...f,refundAmount:e.target.value}))}
                                style={{ width:'100%', height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 10px', fontSize:13, outline:'none', background: C.bg, color: C.text, boxSizing:'border-box' }} />
                            </div>
                          </div>
                          <div style={{ marginBottom:12 }}>
                            <label style={{ fontSize:11, fontWeight:700, color:C.mute, display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' }}>Note to Customer</label>
                            <textarea rows={2} value={actionForm.adminNote} onChange={e=>setActionForm(f=>({...f,adminNote:e.target.value}))}
                              placeholder="Message to customer about this update…"
                              style={{ width:'100%', border:`1px solid ${C.line}`, borderRadius:8, padding:'8px 12px', fontSize:13, resize:'none', outline:'none', fontFamily:'inherit', boxSizing:'border-box', background: C.bg, color: C.text }} />
                          </div>
                          {/* Refund proof upload */}
                          {['REFUND_INITIATED','REFUND_COMPLETED'].includes(actionForm.status) && (
                            <div style={{ marginBottom:12 }}>
                              <label style={{ fontSize:11, fontWeight:700, color:C.mute, display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' }}>
                                Refund Proof / Screenshot <span style={{ color:C.red }}>*</span> <span style={{ fontWeight:400, textTransform:'none' }}>(required when status is Refund Initiated or Completed)</span>
                              </label>
                              <input type="file" accept="image/*" multiple
                                onChange={e => setProofFiles(Array.from(e.target.files || []))}
                                style={{ fontSize:12, color:C.text }} />
                              {proofFiles.length > 0 && (
                                <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                                  {proofFiles.map((f, i) => (
                                    <div key={i} style={{ fontSize:11, background:C.card2, borderRadius:6, padding:'3px 8px', color:C.sub, display:'flex', alignItems:'center', gap:4 }}>
                                      🖼 {f.name}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <div style={{ display:'flex', gap:10 }}>
                            <button onClick={() => doProcess(req._id)} disabled={saving || !actionForm.status}
                              style={{ padding:'9px 24px', borderRadius:8, background: !actionForm.status ? C.line : C.accent, color: !actionForm.status ? C.mute : 'white',
                                border:'none', fontWeight:700, fontSize:13, cursor: actionForm.status ? 'pointer' : 'not-allowed', opacity: saving ? 0.6 : 1 }}>
                              {saving ? 'Saving…' : 'Update Return Status'}
                            </button>
                            <button onClick={e => { e.stopPropagation(); setActionId(null); setProofFiles([]); }}
                              style={{ padding:'9px 20px', borderRadius:8, background: C.card, border:`1px solid ${C.line}`, fontWeight:600, fontSize:13, cursor:'pointer', color:C.mute }}>
                              Cancel
                            </button>
                          </div>
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

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════
   COUPONS TAB
══════════════════════════════════════════════════════ */
const EMPTY_COUPON = { code:'', discountType:'PERCENTAGE', discountValue:'', minimumAmount:'', maximumDiscount:'', expiryDate:'', usageLimit:'', isActive:true, visibility:'hidden', applicableBrands:[], applicableCategories:[], applicableSubcategories:[], freebieProduct:'', freebieQuantity:1 };

function AdminCouponsTab({ globalSearch = '' }) {
  const { brands, topCategories, subCategories } = useCatalog();
  const [coupons, setCoupons]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState(EMPTY_COUPON);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch]     = useState('');
  // Product list for the FREEBIE picker — loaded once on mount.
  const [products, setProducts] = useState([]);
  useEffect(() => {
    productsApi.getAll({ limit: 500 })
      .then(r => setProducts(r.data?.data?.data || r.data?.data?.products || []))
      .catch(() => {});
  }, []);

  // Auto-save draft while in create mode; cleared on successful create
  useEffect(() => {
    if (!editId) {
      try { sessionStorage.setItem('admin-coupon-draft', JSON.stringify(form)); } catch {}
    }
  }, [form, editId]);

  useEffect(() => { setSearch(globalSearch); }, [globalSearch]);

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
    let draft = EMPTY_COUPON;
    try { const s = sessionStorage.getItem('admin-coupon-draft'); if (s) draft = { ...EMPTY_COUPON, ...JSON.parse(s) }; } catch {}
    setForm(draft); setEditId(null); setError(''); setShowForm(true);
  };
  const openEdit   = (c) => {
    setForm({
      code: c.code, discountType: c.discountType, discountValue: c.discountValue,
      minimumAmount: c.minimumAmount || '', maximumDiscount: c.maximumDiscount || '',
      expiryDate: c.expiryDate ? c.expiryDate.slice(0,10) : '',
      usageLimit: c.usageLimit || '', isActive: c.isActive,
      visibility: c.visibility || 'hidden',
      applicableBrands:       (c.applicableBrands       || []).map(x => x?._id || x),
      applicableCategories:   (c.applicableCategories   || []).map(x => x?._id || x),
      applicableSubcategories:(c.applicableSubcategories|| []).map(x => x?._id || x),
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
        applicableBrands:        form.applicableBrands.length       ? form.applicableBrands       : [],
        applicableCategories:    form.applicableCategories.length   ? form.applicableCategories   : [],
        applicableSubcategories: form.applicableSubcategories.length? form.applicableSubcategories: [],
        freebieProduct:  isFreebie ? form.freebieProduct          : null,
        freebieQuantity: isFreebie ? (Number(form.freebieQuantity) || 1) : 1,
      };
      if (editId) await couponsApi.update(editId, payload);
      else {
        await couponsApi.create(payload);
        try { sessionStorage.removeItem('admin-coupon-draft'); } catch {}
      }
      setShowForm(false); load();
    } catch(e) {
      setError(e?.response?.data?.message || 'Failed to save coupon.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this coupon?')) return;
    setDeleting(id);
    try { await couponsApi.delete(id); load(); }
    catch(e) { alert(e?.response?.data?.message || 'Delete failed'); }
    finally { setDeleting(null); }
  };

  const handleToggle = async (c) => {
    try { await couponsApi.update(c._id, { isActive: !c.isActive }); load(); }
    catch(e) { alert('Update failed'); }
  };

  const now = new Date();
  const active  = coupons.filter(c => c.isActive && new Date(c.expiryDate) > now).length;
  const expired = coupons.filter(c => new Date(c.expiryDate) <= now).length;
  const inactive = coupons.filter(c => !c.isActive).length;

  const LabelStyle = { display:'block', fontSize:11, fontWeight:700, color:C.mute, marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' };
  const InpStyle   = { height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 12px', fontSize:13, outline:'none', background: C.bg, color: C.text, width:'100%', boxSizing:'border-box' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
        <KpiCard label="Total Coupons" value={coupons.length} colorKey="blue"   iconEl={Icon.coupon} />
        <KpiCard label="Active"        value={active}         colorKey="green"  iconEl={Icon.shield} />
        <KpiCard label="Expired"       value={expired}        colorKey="red"    iconEl={Icon.bell} />
        <KpiCard label="Inactive"      value={inactive}       colorKey="yellow" iconEl={Icon.lock} />
      </div>

      {/* Create button */}
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={openCreate}
          style={{ padding:'10px 22px', borderRadius:10, background:C.accent, color:'white', border:'none', fontWeight:700, fontSize:13, cursor:'pointer' }}>
          + Create Coupon
        </button>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <Card title={editId ? '✏️ Edit Coupon' : '🎟️ New Coupon'}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div>
              <label style={LabelStyle}>Coupon Code *</label>
              <input value={form.code} onChange={e=>set('code',e.target.value.toUpperCase())} placeholder="e.g. SAVE20"
                className="inp-dark"
                style={{ ...InpStyle, fontFamily:'monospace', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase' }} />
            </div>
            <div>
              <label style={LabelStyle}>Discount Type *</label>
              <select value={form.discountType} onChange={e=>set('discountType',e.target.value)}
                style={{ ...InpStyle, cursor:'pointer' }}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (Rs.)</option>
                <option value="FREEBIE">Freebie (free product)</option>
                <option value="FREE_SHIPPING">Free Shipping (waive delivery)</option>
              </select>
            </div>
            {form.discountType === 'FREEBIE' ? (
              <div>
                <label style={LabelStyle}>Free Gift Product *</label>
                <select value={form.freebieProduct} onChange={e=>set('freebieProduct',e.target.value)} style={{ ...InpStyle, cursor:'pointer' }}>
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
                <label style={LabelStyle}>Discount Value * {form.discountType==='PERCENTAGE'?'(%)':'(Rs.)'}</label>
                <input type="number" min="0" value={form.discountValue} onChange={e=>set('discountValue',e.target.value)}
                  placeholder={form.discountType==='PERCENTAGE'?'e.g. 20':'e.g. 500'} style={InpStyle} />
              </div>
            )}
            {form.discountType === 'FREEBIE' && (
              <div>
                <label style={LabelStyle}>Free Gift Quantity</label>
                <input type="number" min="1" max="10" value={form.freebieQuantity} onChange={e=>set('freebieQuantity',e.target.value)}
                  placeholder="1" style={InpStyle} />
              </div>
            )}
            <div>
              <label style={LabelStyle}>Expiry Date *</label>
              <input type="date" value={form.expiryDate} onChange={e=>set('expiryDate',e.target.value)}
                min={new Date().toISOString().slice(0,10)} style={InpStyle} />
            </div>
            <div>
              <label style={LabelStyle}>Minimum Order (Rs.)</label>
              <input type="number" min="0" value={form.minimumAmount} onChange={e=>set('minimumAmount',e.target.value)}
                placeholder="0 = no minimum" style={InpStyle} />
            </div>
            {form.discountType !== 'FREEBIE' && form.discountType !== 'FREE_SHIPPING' && (
              <div>
                <label style={LabelStyle}>Max Discount Cap (Rs.) <span style={{color:C.mute,fontWeight:400}}>— for % coupons</span></label>
                <input type="number" min="0" value={form.maximumDiscount} onChange={e=>set('maximumDiscount',e.target.value)}
                  placeholder="Leave blank = no cap" style={InpStyle} />
              </div>
            )}
            <div>
              <label style={LabelStyle}>Usage Limit</label>
              <input type="number" min="1" value={form.usageLimit} onChange={e=>set('usageLimit',e.target.value)}
                placeholder="Leave blank = unlimited" style={InpStyle} />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, paddingTop:22 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontWeight:600, fontSize:13 }}>
                <input type="checkbox" checked={form.isActive} onChange={e=>set('isActive',e.target.checked)} />
                Active (users can apply this coupon)
              </label>
            </div>
            <div>
              <label style={LabelStyle}>Visibility</label>
              <select value={form.visibility} onChange={e=>set('visibility',e.target.value)}
                style={{ ...InpStyle, cursor:'pointer' }}>
                <option value="hidden">Hidden — manual apply only (default)</option>
                <option value="new_users">First-order users only — show to new users</option>
                <option value="everyone">Everyone — show on home page</option>
              </select>
            </div>
          </div>

          {/* Applicable To */}
          <div style={{ marginTop:14, padding:'14px 16px', borderRadius:10, border:`1px solid ${C.line}`, background:C.card2 }}>
            <div style={{ fontWeight:700, fontSize:12, color:C.text, marginBottom:2 }}>Applicable To</div>
            <div style={{ fontSize:12, color:C.mute, marginBottom:12 }}>Leave all empty → coupon applies to all products</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              {[
                { label:'🏷️ Brands', key:'applicableBrands', list: brands },
                { label:'📂 Categories', key:'applicableCategories', list: topCategories },
                { label:'📁 Sub-categories', key:'applicableSubcategories', list: subCategories },
              ].map(({ label, key, list }) => (
                <div key={key}>
                  <label style={LabelStyle}>{label}</label>
                  <select onChange={e => { const v=e.target.value; if(v && !form[key].includes(v)) set(key,[...form[key],v]); e.target.value=''; }}
                    style={{ ...InpStyle, cursor:'pointer' }}>
                    <option value="">Add…</option>
                    {list.filter(x => !form[key].includes(x._id)).map(x => <option key={x._id} value={x._id}>{x.name}</option>)}
                  </select>
                  {form[key].length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                      {form[key].map(id => {
                        const item = list.find(x => x._id === id);
                        return item ? (
                          <span key={id} style={{ display:'inline-flex', alignItems:'center', gap:4, background:C.accent+'22', color:C.accent, fontSize:11, fontWeight:700, padding:'2px 8px 2px 10px', borderRadius:99, border:`1px solid ${C.accent}44` }}>
                            {item.name}
                            <button type="button" onClick={() => set(key, form[key].filter(x => x !== id))}
                              style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', padding:'0 0 0 2px', lineHeight:1, fontSize:14 }}>×</button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <div style={{ marginTop:12, color:C.red, fontSize:13, fontWeight:600, background:C.red+'10', padding:'8px 12px', borderRadius:8 }}>{error}</div>}

          <div style={{ display:'flex', gap:10, marginTop:18 }}>
            <button onClick={handleSubmit} disabled={saving}
              style={{ padding:'10px 24px', borderRadius:8, background:C.green, color:'white', border:'none', fontWeight:700, fontSize:13, cursor:'pointer', opacity:saving?0.6:1 }}>
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Coupon'}
            </button>
            <button onClick={()=>setShowForm(false)}
              style={{ padding:'10px 18px', borderRadius:8, background: C.card, border:`1px solid ${C.line}`, fontWeight:600, fontSize:13, cursor:'pointer', color:C.mute }}>
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* Coupons table */}
      <Card title={`All Coupons (${coupons.length})`}>
        {loading ? <div style={{ padding:40, textAlign:'center', color:C.mute }}>Loading…</div> :
         coupons.length === 0 ? <div style={{ padding:40, textAlign:'center', color:C.mute }}>No coupons yet. Create one above.</div> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                {['Code','Type','Value','Min Order','Cap','Usage','Expiry','Status','Visibility','Actions'].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontSize:11, fontWeight:700, color:C.mute, letterSpacing:'.06em', textTransform:'uppercase', borderBottom:`1px solid ${C.line}`, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {coupons.filter(c => !search || c.code?.toLowerCase().includes(search.toLowerCase())).map(c => {
                  const isExpired  = new Date(c.expiryDate) <= now;
                  const daysLeft   = Math.ceil((new Date(c.expiryDate) - now) / 86400000);
                  const statusColor = isExpired ? C.red : !c.isActive ? C.mute : C.green;
                  const statusLabel = isExpired ? 'Expired' : !c.isActive ? 'Inactive' : 'Active';
                  return (
                    <tr key={c._id} style={{ background: isExpired ? C.red+'10' : C.card }}>
                      <td style={{ padding:'10px 12px', borderBottom:`1px solid ${C.line}` }}>
                        <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:13, background: C.bg, color: C.text, padding:'3px 8px', borderRadius:6, letterSpacing:'.08em' }}>
                          {c.code}
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px', borderBottom:`1px solid ${C.line}`, fontSize:12, color:C.mute }}>
                        {c.discountType === 'PERCENTAGE'    ? 'Percentage'
                          : c.discountType === 'FIXED'      ? 'Fixed'
                          : c.discountType === 'FREE_SHIPPING' ? '🚚 Free Shipping'
                          : '🎁 Freebie'}
                      </td>
                      <td style={{ padding:'10px 12px', borderBottom:`1px solid ${C.line}`, fontWeight:700, fontSize:13, color:C.green }}>
                        {c.discountType === 'PERCENTAGE'       ? `${c.discountValue}%`
                          : c.discountType === 'FIXED'         ? `Rs. ${c.discountValue}`
                          : c.discountType === 'FREE_SHIPPING' ? 'Waives delivery'
                          : (c.freebieProduct?.title
                              ? `${c.freebieQuantity || 1}× ${c.freebieProduct.title}`
                              : '— gift unavailable')}
                      </td>
                      <td style={{ padding:'10px 12px', borderBottom:`1px solid ${C.line}`, fontSize:12, color:C.mute }}>
                        {c.minimumAmount > 0 ? `Rs. ${c.minimumAmount}` : '—'}
                      </td>
                      <td style={{ padding:'10px 12px', borderBottom:`1px solid ${C.line}`, fontSize:12, color:C.mute }}>
                        {c.maximumDiscount ? `Rs. ${c.maximumDiscount}` : '—'}
                      </td>
                      <td style={{ padding:'10px 12px', borderBottom:`1px solid ${C.line}`, fontSize:12 }}>
                        <span style={{ color: c.usageLimit && c.usedCount >= c.usageLimit ? C.red : C.mute }}>
                          {c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ' used'}
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px', borderBottom:`1px solid ${C.line}`, fontSize:12, whiteSpace:'nowrap' }}>
                        <div style={{ color: isExpired ? C.red : daysLeft <= 3 ? C.yellow : '#333', fontWeight: isExpired||daysLeft<=3 ? 700 : 400 }}>
                          {new Date(c.expiryDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                        </div>
                        {!isExpired && <div style={{ fontSize:11, color: daysLeft<=3 ? C.red : C.mute }}>{daysLeft}d left</div>}
                      </td>
                      <td style={{ padding:'10px 12px', borderBottom:`1px solid ${C.line}` }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:99, background:statusColor+'20', color:statusColor }}>
                          <span style={{ width:5, height:5, borderRadius:'50%', background:statusColor }} />{statusLabel}
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px', borderBottom:`1px solid ${C.line}`, fontSize:12, whiteSpace:'nowrap' }}>
                        {c.visibility === 'new_users'
                          ? <span style={{ color:C.yellow, fontWeight:700 }}>First-order Users</span>
                          : c.visibility === 'hidden'
                          ? <span style={{ color:C.mute }}>Hidden</span>
                          : <span style={{ color:C.green }}>Everyone</span>}
                      </td>
                      <td style={{ padding:'10px 12px', borderBottom:`1px solid ${C.line}` }}>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={()=>openEdit(c)}
                            style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:6, background: C.bg, border:`1px solid ${C.line}`, cursor:'pointer', color: C.text }}>
                            ✏️ Edit
                          </button>
                          <button onClick={()=>handleToggle(c)}
                            style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:6, background: c.isActive ? C.red+'18':'#22c55e18', border:`1px solid ${c.isActive?C.red:C.green}40`, cursor:'pointer', color:c.isActive?C.red:C.green }}>
                            {c.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button onClick={()=>handleDelete(c._id)} disabled={deleting===c._id}
                            style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:6, background:'#fef2f2', border:`1px solid ${C.red}`, cursor:'pointer', color:C.red, opacity:deleting===c._id?0.5:1 }}>
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

/* ══════════════════ Admin Notifications Tab ══════════════════ */
const EMPTY_NOTIF = { sendMode:'broadcast', targetRole:'user', userEmail:'', spendFilter:'above', minSpend:'', maxSpend:'', title:'', message:'', type:'SYSTEM', link:'', couponCode:'' };

function AdminNotificationsTab() {
  const [form, setForm, clearNotifDraft] = useFormDraft('admin-notif-draft', EMPTY_NOTIF);
  const [sending, setSending]       = useState(false);
  const [result, setResult]         = useState(null);
  const [history, setHistory]       = useState([]);
  const [copied, setCopied]         = useState(null);
  const [preview, setPreview]       = useState(null);
  const [previewing, setPreviewing] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSpendPreview = async () => {
    const min = form.minSpend.trim();
    const max = form.spendFilter === 'between' ? form.maxSpend.trim() : '';
    if (!min) { setResult({ ok:false, text:'Enter a minimum spend amount.' }); return; }
    if (form.spendFilter === 'between' && !max) { setResult({ ok:false, text:'Enter a maximum spend amount for range.' }); return; }
    setPreviewing(true); setPreview(null); setResult(null);
    try {
      const params = { minSpend: min };
      if (max) params.maxSpend = max;
      const resp = await notificationsApi.spendPreview(params);
      setPreview({ count: resp.data?.data?.count ?? 0 });
    } catch(e) {
      setResult({ ok:false, text: e?.response?.data?.message || 'Preview failed.' });
    } finally { setPreviewing(false); }
  };

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      setResult({ ok: false, text: 'Title and message are required.' }); return;
    }
    if (form.sendMode === 'personal' && !form.userEmail.trim()) {
      setResult({ ok: false, text: 'User email is required for personal notification.' }); return;
    }
    if (form.sendMode === 'spend') {
      if (!form.minSpend.trim()) { setResult({ ok:false, text:'Enter a minimum spend amount.' }); return; }
      if (form.spendFilter === 'between' && !form.maxSpend.trim()) { setResult({ ok:false, text:'Enter a maximum spend amount for range.' }); return; }
    }
    setSending(true); setResult(null);
    try {
      const payload = {
        title:      form.title,
        message:    form.message,
        type:       form.type,
        link:       form.link.trim() || undefined,
        couponCode: form.couponCode.trim().toUpperCase() || undefined,
      };
      if (form.sendMode === 'personal') {
        payload.userEmail = form.userEmail.trim();
      } else if (form.sendMode === 'spend') {
        payload.minSpend = Number(form.minSpend);
        if (form.spendFilter === 'between') payload.maxSpend = Number(form.maxSpend);
      } else {
        payload.targetRole = form.targetRole;
      }
      const resp = await notificationsApi.broadcast(payload);
      const count = resp.data?.data?.count || 0;
      setResult({ ok: true, text: `✅ Sent to ${count} customer${count !== 1 ? 's' : ''}!` });
      setHistory(prev => [{ ...form, sentAt: new Date().toISOString(), count }, ...prev.slice(0, 9)]);
      setPreview(null);
      clearNotifDraft();
    } catch(e) {
      setResult({ ok: false, text: e?.response?.data?.message || e.message || 'Failed to send.' });
    } finally { setSending(false); }
  };

  const LabelStyle = { display:'block', fontSize:11, fontWeight:700, color:C.mute, marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' };
  const InpStyle   = { height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 12px', fontSize:13, outline:'none', background: C.bg, color: C.text, width:'100%', boxSizing:'border-box' };

  const TARGET_OPTIONS = [
    { value:'user',     label:'All Customers', desc:'Every registered buyer',      iconEl: Icon.users,  color: C.blue },
    { value:'employee', label:'All Employees', desc:'Every registered employee',   iconEl: Icon.person, color: C.yellow },
    { value:'all',      label:'Everyone',      desc:'All users on the platform',   iconEl: Icon.bell,   color: C.pink },
  ];
  const TYPE_OPTIONS = ['SYSTEM','ORDER','OFFER','PAYMENT','REFUND'];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Compose card */}
      <Card title="📢 Send Notification">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

          {/* Send mode toggle */}
          <div style={{ gridColumn:'1/-1' }}>
            <label style={LabelStyle}>Send to</label>
            <div style={{ display:'flex', gap:0, border:`1px solid ${C.line}`, borderRadius:10, overflow:'hidden', width:'fit-content', flexWrap:'wrap' }}>
              {[
                { mode:'broadcast', label:'Broadcast (group)',    iconEl: Icon.bell },
                { mode:'personal',  label:'Personal (one user)',  iconEl: Icon.person },
                { mode:'spend',     label:'By Purchase Amount',   iconEl: Icon.coupon },
              ].map(opt => (
                <button key={opt.mode} onClick={() => { set('sendMode', opt.mode); setPreview(null); setResult(null); }}
                  style={{ padding:'9px 20px', border:'none', cursor:'pointer', fontWeight:600, fontSize:13, transition:'all .15s',
                    background: form.sendMode===opt.mode ? C.accent : C.card2,
                    color:      form.sendMode===opt.mode ? 'white' : C.sub,
                    display:'flex', alignItems:'center', gap:8, fontFamily:'inherit' }}>
                  <SvgAt el={opt.iconEl} size={15} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Broadcast: pick role */}
          {form.sendMode === 'broadcast' && (
            <div style={{ gridColumn:'1/-1', display:'flex', gap:10, flexWrap:'wrap' }}>
              {TARGET_OPTIONS.map(opt => {
                const active = form.targetRole === opt.value;
                return (
                <div key={opt.value} onClick={() => set('targetRole', opt.value)}
                  style={{ flex:'1 1 150px', padding:'14px 16px', borderRadius:10,
                    border:`1.5px solid ${active ? opt.color : C.line}`,
                    background: active ? opt.color + '18' : C.card2, cursor:'pointer', transition:'all .15s',
                    display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:9, background: opt.color+'20', color: opt.color,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <SvgAt el={opt.iconEl} size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13, color: active ? C.text : C.sub }}>{opt.label}</div>
                    <div style={{ fontSize:11, color:C.mute, marginTop:2 }}>{opt.desc}</div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* Personal: user email */}
          {form.sendMode === 'personal' && (
            <div style={{ gridColumn:'1/-1' }}>
              <label style={LabelStyle}>User Email *</label>
              <input value={form.userEmail} onChange={e=>set('userEmail',e.target.value)}
                placeholder="user@example.com" type="email" style={InpStyle} />
              <div style={{ fontSize:11, color:C.mute, marginTop:4 }}>The notification will be sent only to this user.</div>
            </div>
          )}

          {/* By Spend: amount filter */}
          {form.sendMode === 'spend' && (
            <div style={{ gridColumn:'1/-1' }}>
              {/* Filter type toggle */}
              <label style={LabelStyle}>Filter Type</label>
              <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
                {[
                  { value:'above',   label:'More than amount',    desc:'Customers who spent above a threshold' },
                  { value:'between', label:'Between two amounts', desc:'Customers within a spend range' },
                ].map(opt => {
                  const active = form.spendFilter === opt.value;
                  return (
                    <div key={opt.value} onClick={() => { set('spendFilter', opt.value); setPreview(null); }}
                      style={{ flex:'1 1 200px', padding:'12px 16px', borderRadius:10, cursor:'pointer', transition:'all .15s',
                        border:`1.5px solid ${active ? C.green : C.line}`,
                        background: active ? C.green+'12' : C.card2 }}>
                      <div style={{ fontWeight:700, fontSize:13, color: active ? C.green : C.sub }}>{opt.label}</div>
                      <div style={{ fontSize:11, color:C.mute, marginTop:2 }}>{opt.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Amount inputs */}
              <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
                <div style={{ flex:'1 1 140px' }}>
                  <label style={LabelStyle}>{form.spendFilter==='between' ? 'Min Amount (Rs.) *' : 'Amount (Rs.) *'}</label>
                  <input value={form.minSpend} onChange={e=>{ set('minSpend',e.target.value); setPreview(null); }}
                    type="number" min="0" placeholder="e.g. 5000" style={InpStyle} />
                </div>
                {form.spendFilter === 'between' && (
                  <div style={{ flex:'1 1 140px' }}>
                    <label style={LabelStyle}>Max Amount (Rs.) *</label>
                    <input value={form.maxSpend} onChange={e=>{ set('maxSpend',e.target.value); setPreview(null); }}
                      type="number" min="0" placeholder="e.g. 20000" style={InpStyle} />
                  </div>
                )}
                <button onClick={handleSpendPreview} disabled={previewing}
                  style={{ height:36, padding:'0 18px', borderRadius:8, border:`1px solid ${C.blue}`, background: C.blue+'15',
                    color:C.blue, fontWeight:700, fontSize:13, cursor:'pointer', whiteSpace:'nowrap', opacity:previewing?0.6:1, flexShrink:0 }}>
                  {previewing ? 'Checking…' : '👁 Preview Count'}
                </button>
              </div>

              {/* Preview result */}
              {preview && (
                <div style={{ marginTop:10, display:'inline-flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:8,
                  background: preview.count > 0 ? C.green+'15' : C.yellow+'20',
                  border:`1px solid ${preview.count > 0 ? C.green+'40' : C.yellow+'50'}` }}>
                  <span style={{ fontSize:18 }}>{preview.count > 0 ? '🎯' : '😕'}</span>
                  <span style={{ fontWeight:700, fontSize:13, color: preview.count > 0 ? C.green : C.yellow }}>
                    {preview.count > 0
                      ? `${preview.count} customer${preview.count !== 1 ? 's' : ''} match this filter`
                      : 'No customers found for this filter'}
                  </span>
                </div>
              )}

              <div style={{ fontSize:11, color:C.mute, marginTop:8 }}>
                Only customers (buyers) are included. Cancelled & returned orders are excluded from total spend.
              </div>
            </div>
          )}

          {/* Type */}
          <div>
            <label style={LabelStyle}>Notification Type</label>
            <select value={form.type} onChange={e=>set('type',e.target.value)} style={{ ...InpStyle, cursor:'pointer' }}>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Link */}
          <div>
            <label style={LabelStyle}>Clickable Link <span style={{ fontWeight:400, textTransform:'none', color:C.mute }}>— optional, e.g. /products</span></label>
            <input value={form.link} onChange={e=>set('link',e.target.value)} placeholder="/products?category=Electronics" style={InpStyle} />
          </div>

          {/* Coupon code */}
          <div style={{ gridColumn:'1/-1' }}>
            <label style={LabelStyle}>Coupon Code <span style={{ fontWeight:400, textTransform:'none', color:C.mute }}>— optional, user gets a Copy button in the notification</span></label>
            <div style={{ display:'flex', gap:8 }}>
              <input value={form.couponCode} onChange={e=>set('couponCode',e.target.value.toUpperCase())}
                placeholder="e.g. SAVE20" className="inp-dark"
                style={{ ...InpStyle, fontFamily:'monospace', fontWeight:700, letterSpacing:'.1em', flex:1 }} />
              {form.couponCode && (
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'0 14px', borderRadius:8,
                  background: C.green+'18', border:`1px solid ${C.green}40`, fontSize:13, fontWeight:700, color:C.green, whiteSpace:'nowrap' }}>
                  🎟️ {form.couponCode}
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div style={{ gridColumn:'1/-1' }}>
            <label style={LabelStyle}>Title *</label>
            <input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Your exclusive coupon is here! 🎉" style={InpStyle} />
          </div>

          {/* Message */}
          <div style={{ gridColumn:'1/-1' }}>
            <label style={LabelStyle}>Message *</label>
            <textarea value={form.message} onChange={e=>set('message',e.target.value)} rows={3}
              placeholder="Write your notification message here..."
              style={{ ...InpStyle, height:'auto', padding:'10px 12px', resize:'vertical', lineHeight:1.6 }} />
          </div>
        </div>

        {result && (
          <div style={{ marginTop:14, padding:'10px 14px', borderRadius:8, fontSize:13, fontWeight:700,
            background: result.ok ? C.green+'15' : C.red+'15', color: result.ok ? C.green : C.red }}>
            {result.text}
          </div>
        )}

        <div style={{ marginTop:18, display:'flex', gap:10 }}>
          <button onClick={handleSend} disabled={sending}
            style={{ padding:'11px 28px', borderRadius:8, background:C.accent, color:'white', border:'none', fontWeight:700, fontSize:14, cursor:'pointer', opacity:sending?0.6:1 }}>
            {sending ? 'Sending…' : '📤 Send Notification'}
          </button>
          <button onClick={() => { clearNotifDraft(); setResult(null); }}
            style={{ padding:'11px 18px', borderRadius:8, background: C.card, border:`1px solid ${C.line}`, fontWeight:600, fontSize:13, cursor:'pointer', color:C.mute }}>
            Clear
          </button>
        </div>
      </Card>

      {/* Send history */}
      {history.length > 0 && (
        <Card title="Recent Sends">
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {history.map((h, i) => (
              <div key={i} style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 14px', background: C.bg, borderRadius:8, fontSize:13 }}>
                <span style={{ fontSize:20 }}>{ {SYSTEM:'🔔',ORDER:'📦',OFFER:'🎁',PAYMENT:'💳',REFUND:'↩️'}[h.type] }</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700 }}>{h.title}</div>
                  <div style={{ color:C.mute, fontSize:12 }}>{h.message.slice(0,80)}{h.message.length>80?'…':''}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontWeight:700, color:C.green }}>{h.count} sent</div>
                  <div style={{ fontSize:11, color:C.mute }}>{new Date(h.sentAt).toLocaleString('en-IN',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'})}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ADMIN SUPPORT TAB
══════════════════════════════════════════════════════ */
const TICKET_STATUS_META = {
  OPEN:        { label: 'Open',        color: '#3b82f6', bg: '#3b82f625' },
  IN_PROGRESS: { label: 'In Progress', color: '#f59e0b', bg: '#f59e0b25' },
  RESOLVED:    { label: 'Resolved',    color: '#22c55e', bg: '#22c55e25' },
  CLOSED:      { label: 'Closed',      color: '#94a3b8', bg: '#94a3b825' },
};

function TicketStatusBadge({ status }) {
  const m = TICKET_STATUS_META[status] || TICKET_STATUS_META.OPEN;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700,
      padding:'3px 9px', borderRadius:99, background:m.bg, color:m.color }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:m.color }} />
      {m.label}
    </span>
  );
}

export function AdminSupportTab({ globalSearch = '' }) {
  const { user }                              = useAuth();
  const { lastSupportMsg, sseReconnectCount } = useNotifications();
  const [tickets, setTickets]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilterSt] = useState('');
  const [activeTicket, setActive]   = useState(null);
  const [reply, setReply]           = useState('');
  const [sending, setSend]          = useState(false);
  const [updatingStatus, setUpdSt]  = useState(false);
  const [search, setSearch]         = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const bottomRef = useRef(null);

  /* ── Always-fresh ref to avoid stale SSE closures ── */
  const activeRef = useRef(null);
  useEffect(() => { activeRef.current = activeTicket; }, [activeTicket]);

  useEffect(() => { setSearch(globalSearch); }, [globalSearch]);
  useEffect(() => { fetchAll(); }, [filterStatus]);

  /* ── SSE: append incoming message without stale closure ── */
  useEffect(() => {
    if (!lastSupportMsg || !activeRef.current) return;
    if (lastSupportMsg.ticketId !== activeRef.current._id) return;
    const alreadyExists = (activeRef.current.messages || []).some(
      m => m._id && m._id === lastSupportMsg.message?._id
    );
    if (alreadyExists) return;
    setActive(prev => ({
      ...prev,
      status:   lastSupportMsg.status,
      messages: [...(prev.messages || []), lastSupportMsg.message],
    }));
  }, [lastSupportMsg]);

  /* ── Re-fetch on SSE reconnect to catch messages missed during gap ── */
  useEffect(() => {
    if (sseReconnectCount === 0 || !activeRef.current) return;
    supportApi.getTicket(activeRef.current._id)
      .then(r => { const t = r.data?.data?.ticket; if (t) setActive(t); })
      .catch(() => {});
  }, [sseReconnectCount]);

  /* ── 25s polling fallback when a ticket is open ── */
  useEffect(() => {
    if (!activeTicket) return;
    const id = setInterval(() => {
      if (!activeRef.current) return;
      supportApi.getTicket(activeRef.current._id).then(r => {
        const fresh = r.data?.data?.ticket;
        if (!fresh) return;
        const curLen   = activeRef.current?.messages?.length ?? 0;
        const freshLen = fresh.messages?.length ?? 0;
        if (freshLen !== curLen || fresh.status !== activeRef.current?.status) {
          setActive(fresh);
        }
      }).catch(() => {});
    }, 25_000);
    return () => clearInterval(id);
  }, [activeTicket?._id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTicket?.messages?.length]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await supportApi.getAllTickets({ status: filterStatus || undefined, limit: 100 });
      setTickets(res.data?.data?.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const openTicket = async (id) => {
    try {
      const res = await supportApi.getTicket(id);
      setActive(res.data?.data?.ticket);
    } catch { /* ignore */ }
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeTicket) return;
    setSend(true);
    try {
      const res = await supportApi.replyToTicket(activeTicket._id, { message: reply.trim() });
      setReply('');
      const updated = res.data?.data?.ticket;
      setActive(updated);
      setTickets(prev => prev.map(t => t._id === updated._id ? { ...t, status: updated.status, updatedAt: updated.updatedAt } : t));
    } catch { /* ignore */ } finally { setSend(false); }
  };

  const changeStatus = async (status) => {
    if (!activeTicket) return;
    setUpdSt(true);
    try {
      const res = await supportApi.updateStatus(activeTicket._id, { status });
      const updated = res.data?.data?.ticket;
      setActive(prev => ({ ...prev, status: updated.status }));
      setTickets(prev => prev.map(t => t._id === updated._id ? { ...t, status: updated.status } : t));
    } catch { /* ignore */ } finally { setUpdSt(false); }
  };

  const isClosed = activeTicket && ['RESOLVED','CLOSED'].includes(activeTicket.status);

  if (activeTicket) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {/* Ticket header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <Btn onClick={() => { setActive(null); fetchAll(); }}>← Back to tickets</Btn>
          <div style={{ flex:1, fontWeight:800, fontSize:16 }}>{activeTicket.subject}</div>
          <TicketStatusBadge status={activeTicket.status} />
          <Select value={activeTicket.status} onChange={e => changeStatus(e.target.value)}
            style={{ opacity: updatingStatus ? 0.6 : 1 }}>
            {Object.keys(TICKET_STATUS_META).map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </Select>
        </div>

        <div style={{ fontSize:13, color:C.mute }}>
          From: <strong style={{ color: C.text }}>{activeTicket.user?.name}</strong> ({activeTicket.user?.email})
          {activeTicket.order && <> · Order #{activeTicket.order.orderNumber || activeTicket.order._id?.slice(-8).toUpperCase()}</>}
          {' · '}#{activeTicket._id?.slice(-8).toUpperCase()}
        </div>

        {/* Messages */}
        <Card>
          <div style={{ display:'flex', flexDirection:'column', gap:10, maxHeight:420, overflowY:'auto' }}>
            {(activeTicket.messages || []).map((msg, i) => {
              const isAdmin = msg.senderRole === 'admin';
              return (
                <div key={i} style={{ display:'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth:'72%' }}>
                    {!isAdmin && (
                      <div style={{ fontSize:11, fontWeight:700, color: C.mute, marginBottom:4, paddingLeft:4 }}>
                        {msg.sender?.name || activeTicket.user?.name}
                      </div>
                    )}
                    <div style={{
                      padding:'10px 14px',
                      borderRadius: isAdmin ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isAdmin ? C.accent : C.bg,
                      color: isAdmin ? 'white' : C.text,
                      border: isAdmin ? 'none' : `1px solid ${C.line}`,
                      fontSize:13, lineHeight:1.6,
                    }}>
                      {msg.text}
                    </div>
                    <div style={{ fontSize:10, color:'#aaa', marginTop:3,
                      textAlign: isAdmin ? 'right' : 'left', paddingLeft:4 }}>
                      {new Date(msg.createdAt).toLocaleString('en-IN',{ hour:'2-digit', minute:'2-digit', day:'numeric', month:'short' })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </Card>

        {/* Reply box */}
        {isClosed ? (
          <div style={{ background:C.surf, border:`1px solid ${C.line}`, borderRadius:10,
            padding:'12px 16px', textAlign:'center', color:C.mute, fontSize:13 }}>
            This ticket is {activeTicket.status.toLowerCase()}. No further replies.
          </div>
        ) : (
          <Card>
            <div style={{ marginBottom:8, fontWeight:700, fontSize:13 }}>Reply as Support Team</div>
            <textarea value={reply} onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
              placeholder="Type your reply… (Enter to send)"
              rows={4}
              style={{ width:'100%', border:`1px solid ${C.line}`, borderRadius:8, padding:'10px 12px',
                fontSize:13, resize:'vertical', outline:'none', fontFamily:'inherit', boxSizing:'border-box', marginBottom:10, background: C.bg, color: C.text }} />
            <Btn variant="primary" onClick={sendReply} disabled={sending || !reply.trim()}>
              {sending ? 'Sending…' : 'Send Reply'}
            </Btn>
          </Card>
        )}
      </div>
    );
  }

  const sq = search.trim().toLowerCase();
  const visibleTickets = tickets.filter(t => {
    if (!sq) return true;
    return (
      t._id?.toLowerCase().includes(sq) ||
      t._id?.slice(-8).toLowerCase().includes(sq) ||
      t.subject?.toLowerCase().includes(sq) ||
      t.user?.name?.toLowerCase().includes(sq) ||
      t.user?.email?.toLowerCase().includes(sq) ||
      t.user?.phone?.toLowerCase().includes(sq) ||
      t.order?.orderNumber?.toLowerCase().includes(sq) ||
      t.order?._id?.slice(-8).toLowerCase().includes(sq)
    );
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <Select value={filterStatus} onChange={e => setFilterSt(e.target.value)}>
          <option value="">All Status</option>
          {Object.keys(TICKET_STATUS_META).map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </Select>
        {/* Search */}
        <div style={{ display:'flex', alignItems:'center', gap:8, background:C.bg, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 10px', height:36, flex:1, maxWidth:340 }}>
          <span style={{ color:C.mute, display:'flex', alignItems:'center', flexShrink:0 }}><SvgAt el={Icon.search} size={14} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Name, email, phone, ticket ID, order #…"
            style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:12.5, color:C.text, fontFamily:'inherit', minWidth:0 }} />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ background:'none', border:'none', color:C.mute, cursor:'pointer', padding:0, fontSize:14, lineHeight:1 }}>✕</button>
          )}
        </div>
        <Btn onClick={fetchAll}>Refresh</Btn>
      </div>

      {loading ? <Loader /> : visibleTickets.length === 0 ? (
        <Empty text={sq ? 'No tickets match your search' : 'No support tickets found'} />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {visibleTickets.map(t => {
            const isExpanded = expandedId === t._id;
            return (
              <div key={t._id} style={{ border:`1px solid ${C.line}`, borderRadius:10, overflow:'hidden' }}>
                <div
                  onClick={() => setExpandedId(expandedId === t._id ? null : t._id)}
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
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.subject}</div>
                    <div style={{ fontSize:11, color:C.mute, marginTop:1 }}>#{t._id?.slice(-8).toUpperCase()}</div>
                  </div>
                  <span style={{ fontSize:13, fontWeight:600, color:C.text, flexShrink:0 }}>{t.user?.name||'—'}</span>
                  <TicketStatusBadge status={t.status} />
                  <span style={{ fontSize:11, color:C.mute, flexShrink:0 }}>
                    {new Date(t.updatedAt).toLocaleDateString('en-IN',{ day:'numeric', month:'short' })}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ width:16, height:16, transition:'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', color:C.mute, flexShrink:0 }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {isExpanded && (
                  <div style={{ background:C.card, borderTop:`1px solid ${C.line}`, padding:16 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:14 }}>
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:C.mute, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>User</div>
                        <div style={{ fontWeight:700, fontSize:13, color:C.text }}>{t.user?.name||'—'}</div>
                        <div style={{ fontSize:12, color:C.mute }}>{t.user?.email}</div>
                        <div style={{ fontSize:12, color:C.mute }}>{t.user?.phone}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:C.mute, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Order Reference</div>
                        <div style={{ fontSize:13, color:C.sub }}>
                          {t.order ? `#${t.order.orderNumber || t.order._id?.slice(-8).toUpperCase()}` : 'No linked order'}
                        </div>
                        <div style={{ fontSize:11, color:C.mute, marginTop:4 }}>
                          Last updated: {new Date(t.updatedAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                        </div>
                      </div>
                    </div>
                    <Btn variant="primary" onClick={() => openTicket(t._id)}>Open Ticket</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */

/* ════════════════════ SETTINGS TAB ════════════════════ */
function AdminSettingsTab() {
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
  const hint = { fontSize: 11, color: C.mute, marginTop: 5 };

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

  function SectionCard({ icon, title, sub, children, toggle }) {
    return (
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.line}`, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(249,115,22,.12)', color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: C.text }}>{title}</div>
            {sub && <div style={{ fontSize: 11.5, color: C.mute, marginTop: 1 }}>{sub}</div>}
          </div>
          {toggle}
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    );
  }

  const numVal = v => v === 0 ? '' : v;
  const numChg = (k) => (e) => set(k, e.target.value === '' ? 0 : Number(e.target.value));

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.line}`, overflow: 'hidden' }}>

        {/* ── Row: Order limits ── */}
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

        {/* ── Row: COD toggle + Booking toggle ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${C.line}` }}>
          {/* COD enabled */}
          <div style={{ padding: '18px 22px', borderRight: `1px solid ${C.line}` }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 2 }}>Cash on Delivery</div>
            <div style={{ fontSize: 11.5, color: C.mute, marginBottom: 14 }}>Allow customers to pay cash on delivery.</div>
            <Toggle on={cfg.codEnabled} onChange={() => set('codEnabled', !cfg.codEnabled)} />
          </div>
          {/* Booking enabled */}
          <div style={{ padding: '18px 22px' }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 2 }}>COD Booking Amount</div>
            <div style={{ fontSize: 11.5, color: C.mute, marginBottom: 14 }}>Collect non-refundable advance via Razorpay for COD orders.</div>
            <Toggle on={cfg.bookingEnabled} onChange={() => set('bookingEnabled', !cfg.bookingEnabled)} />
          </div>
        </div>

        {/* ── Row: Booking fields (only when booking enabled) ── */}
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

        {/* ── Footer ── */}
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

/* ════════════════════════════════════════════════════════════════ */

const NAV_SECTIONS = [
  {
    label: null,
    tabs: [
      { id: 'Overview',      iconEl: Icon.grid },
      { id: 'Users',         iconEl: Icon.users },
      { id: 'Employees',     iconEl: Icon.person },
      { id: 'Orders',        iconEl: Icon.orders },
      { id: 'Returns',        iconEl: Icon.refund },
      { id: 'Cancellations', iconEl: Icon.refund },
      { id: 'Products',      iconEl: Icon.bag },
      { id: 'Add Product',   iconEl: Icon.bag },
      { id: 'Delivery Areas',iconEl: Icon.box },
      { id: 'Inventory',     iconEl: Icon.box },
      { id: 'Coupons',       iconEl: Icon.coupon },
      { id: 'Notifications', iconEl: Icon.bell },
      { id: 'Support',       iconEl: Icon.support },
    ],
  },
  {
    label: 'CATALOG',
    tabs: [
      { id: 'Catalog',  iconEl: Icon.book },
      { id: 'Banners',  iconEl: Icon.bag },
      { id: 'Media',    iconEl: Icon.book },
    ],
  },
  {
    label: 'SETTINGS',
    tabs: [
      { id: 'Settings', iconEl: Icon.gear },
    ],
  },
];

const TABS = NAV_SECTIONS.flatMap(s => s.tabs);

export default function AdminDashboard() {
  const { isMobile, isTablet } = useResponsive();
  const { isLight, toggle: toggleTheme } = useDashboardTheme();
  const [tab, setTab]               = useState('Overview');
  // Keep-alive: track which tabs have ever been visited so we can CSS-hide instead of unmount
  const [mountedTabs, setMountedTabs] = useState(() => new Set(['Overview']));
  const navTo = (t) => { setTab(t); setMountedTabs(prev => { if (prev.has(t)) return prev; const n = new Set(prev); n.add(t); return n; }); };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openTicketCount, setOTC]   = useState(0);
  const [globalSearch, setGlobalSearch] = useState('');
  const [refreshKeys, setRefreshKeys]   = useState({});
  const [spinning, setSpinning]         = useState(false);
  const doRefresh = () => {
    setRefreshKeys(k => ({ ...k, [tab]: (k[tab] || 0) + 1 }));
    setSpinning(true);
    setTimeout(() => setSpinning(false), 700);
  };
  const navigate                    = useNavigate();
  const { user, logout }            = useAuth();
  const { notifications, unreadCount, markRead, markAllRead, remove: removeNotif } = useNotifications();
  const [notifOpen, setNotifOpen]   = useState(false);
  const notifRef                    = useRef(null);
  const [editProduct, setEditProduct] = useState(null);
  const [employeesForProduct, setEmployeesForProduct] = useState([]);

  // Load sellers/employees once — needed for the admin product form's seller picker
  useEffect(() => {
    adminApi.getEmployees({ limit: 500 })
      .then(r => setEmployeesForProduct(r.data?.data?.data || r.data?.data?.employees || []))
      .catch(() => {});
  }, []);

  const handleAdminAddProduct = async (data) => {
    await employeeApi.createProduct(data);
    setRefreshKeys(k => ({ ...k, Products: (k['Products'] || 0) + 1 }));
    handleTabClick('Products');
  };
  const handleAdminEditSave = async (data) => {
    await employeeApi.updateProduct(editProduct._id, data);
    setEditProduct(null);
    setRefreshKeys(k => ({ ...k, Products: (k['Products'] || 0) + 1 }));
    handleTabClick('Products');
  };

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  // Fetch open ticket count on mount
  useEffect(() => {
    supportApi.getAllTickets({ status: 'OPEN', limit: 1 })
      .then(res => setOTC(res.data?.data?.pagination?.total ?? 0))
      .catch(() => {});
  }, []);

  // Increment badge when a new support ticket SSE notification arrives
  useEffect(() => {
    const latest = notifications[0];
    if (latest && latest.title?.includes('Support Ticket') && tab !== 'Support') {
      setOTC(prev => prev + 1);
    }
  }, [notifications]);

  // Clear global search when tab changes
  const handleTabClick = (id) => {
    navTo(id);
    setGlobalSearch('');
    if (id === 'Support') setOTC(0);
    if (id !== 'Products' && id !== 'Add Product') setEditProduct(null);
    if (isMobile) setSidebarOpen(false);
  };

  // Overview "View all" shortcut links dispatch this event
  useEffect(() => {
    const handler = (e) => handleTabClick(e.detail);
    window.addEventListener('overview-nav', handler);
    return () => window.removeEventListener('overview-nav', handler);
  }, [isMobile]);

  if (user && user.role !== 'admin') { navigate('/'); return null; }

  const TAB_SUBTITLES = {
    Overview:      'Welcome back, Admin! Here\'s what\'s happening with your store today.',
    Users:         'Manage all registered accounts',
    Employees:     'Manage and verify employee accounts',
    Orders:        'View and manage all customer orders',
    Returns:         'Monitor and take action on all return & refund requests',
    Cancellations:   'View cancelled orders and manage Razorpay refunds',
    Products:        'View, edit and delete every product across all sellers',
    'Add Product':   'Create a new product listing on behalf of any seller',
    'Delivery Areas':'Manage serviceable cities and delivery charges',
    Coupons:         'Create and manage discount coupons for customers',
    Notifications: 'Broadcast notifications to customers, employees, or everyone',
    Support:       'View and respond to customer support tickets',
    Inventory:     'Stock levels, top-sellers, category breakdown, and order analytics',
    Catalog:       'Manage brands, categories, sub-categories, attributes and events',
    Banners:       'Upload, schedule, and link homepage banners — with text overlays and product links',
    Settings:      'Configure COD availability, order amount limits, and booking payments',
  };
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Mobile sidebar backdrop ── */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 99 }} />
      )}

      {/* ── Sidebar ── */}
      <div style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: 220,
        background: C.sidebar, display: 'flex', flexDirection: 'column',
        zIndex: 100, borderRight: `1px solid ${C.line}`,
        transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
        transition: 'transform .25s ease',
      }}>

        {/* Logo */}
        <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${C.line}` }}>
          <img src="/LOGO.png" alt="TradeEngine" style={{ height: 40, width: 'auto', display: 'block' }} />
          <div style={{ fontSize: 11, color: C.mute, marginTop: 6, fontWeight: 500, letterSpacing: '.02em' }}>Admin Panel</div>
        </div>

        {/* Nav sections */}
        <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} style={{ marginBottom: 4 }}>
              {section.label && (
                <div style={{ padding: '12px 10px 5px', fontSize: 10, fontWeight: 600, color: C.mute, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  {section.label}
                </div>
              )}
              {section.tabs.map(t => {
                const active = tab === t.id;
                const label = t.id === 'Support' ? 'Support Tickets' : t.id;
                return (
                  <button key={t.id} onClick={() => handleTabClick(t.id)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '9px 12px',
                      background: active ? C.active : 'transparent',
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                      color: active ? C.text : C.sub,
                      fontWeight: active ? 600 : 400,
                      fontSize: 13.5,
                      borderRadius: 8,
                      transition: 'all .12s',
                      marginBottom: 2,
                    }}>
                    <span style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: active ? C.accent : 'inherit',
                      opacity: active ? 1 : 0.75, flexShrink: 0,
                    }}>
                      <SvgAt el={t.iconEl} size={17} />
                    </span>
                    <span style={{ flex: 1 }}>{label}</span>
                    {t.id === 'Support' && openTicketCount > 0 && (
                      <span style={{
                        background: C.red, color: 'white', fontSize: 10, fontWeight: 700,
                        minWidth: 18, height: 18, borderRadius: 99, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                      }}>{openTicketCount > 99 ? '99+' : openTicketCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div style={{ padding: '12px 10px', borderTop: `1px solid ${C.line}` }}>
          {/* User row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Syne', sans-serif", fontWeight: 800, color: 'white', fontSize: 14, flexShrink: 0,
            }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: C.mute }}>Admin</div>
            </div>
          </div>
          {/* Back to store */}
          <button onClick={() => navigate('/')}
            style={{
              width: '100%', padding: '8px 12px',
              background: 'rgba(255,255,255,.04)', border: `1px solid ${C.line}`,
              borderRadius: 8, color: C.sub, fontWeight: 500, fontSize: 13,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'inherit',
            }}>
            <span style={{ flex: 1, textAlign: 'left' }}>Back to Store</span>
            <span style={{ color: C.mute, display: 'flex', alignItems: 'center' }}>{Icon.extlink}</span>
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ marginLeft: isMobile ? 0 : 220, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* ── Topbar ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 90,
          background: C.sidebar, borderBottom: `1px solid ${C.line}`,
          padding: isMobile ? '0 14px' : '0 24px', height: 58, display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14,
        }}>
          {/* Hamburger */}
          <div onClick={() => setSidebarOpen(s => !s)}
            style={{ color: C.mute, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {Icon.menu}
          </div>

          {/* Search — hidden on mobile */}
          {!isMobile && (
            <div style={{
              flex: 1, maxWidth: 380,
              display: 'flex', alignItems: 'center', gap: 8,
              background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8,
              padding: '0 12px', height: 36,
            }}>
              <span style={{ color: C.mute, display: 'flex', alignItems: 'center' }}>{Icon.search}</span>
              <input
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                placeholder={`Search ${tab.toLowerCase()}…`}
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: C.text, fontFamily: "'DM Sans', sans-serif" }}
              />
              {globalSearch && (
                <button onClick={() => setGlobalSearch('')}
                  style={{ background: 'none', border: 'none', color: C.mute, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center' }}>✕</button>
              )}
            </div>
          )}
          {/* Mobile: page title in topbar */}
          {isMobile && (
            <div style={{ flex: 1, fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tab}
            </div>
          )}

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 'auto' }}>
            {/* Day/Night theme toggle */}
            <button
              onClick={toggleTheme}
              title={isLight ? 'Switch to dark theme' : 'Switch to day theme'}
              aria-label="Toggle theme"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.mute, display: 'flex', alignItems: 'center', padding: 4 }}
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
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifOpen(v => !v)}
                style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: notifOpen ? C.accent : C.mute, display: 'flex', alignItems: 'center', padding: 4 }}>
                <SvgAt el={Icon.bell} size={20} />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: -3, right: -3, background: C.red, color: 'white', fontSize: 9, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div style={{ position: 'fixed', top: 62, right: isMobile ? 8 : 24, width: isMobile ? 'calc(100vw - 16px)' : 380, maxWidth: 380, background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: '0 20px 50px rgba(0,0,0,.55)', zIndex: 999, display: 'flex', flexDirection: 'column', maxHeight: 520, overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>
                      Notifications
                      {unreadCount > 0 && <span style={{ marginLeft: 8, background: C.red + '22', color: C.red, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{unreadCount} new</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} style={{ fontSize: 11, fontWeight: 600, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Mark all read</button>
                      )}
                      <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', color: C.mute, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>✕</button>
                    </div>
                  </div>

                  {/* List */}
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '40px 16px', textAlign: 'center', color: C.mute, fontSize: 13 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                        No notifications yet
                      </div>
                    ) : notifications.slice(0, 20).map(n => (
                      <div key={n._id}
                        onClick={() => { if (!n.isRead) markRead(n._id); }}
                        style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${C.line}`, background: n.isRead ? 'transparent' : C.accent + '0a', cursor: 'default', alignItems: 'flex-start' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: C.bg, border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                          {NOTIF_ICONS[n.type] || '🔔'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: n.isRead ? 500 : 700, fontSize: 13, color: n.isRead ? C.sub : C.text, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                          <div style={{ fontSize: 12, color: C.mute, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.message}</div>
                          {n.link && (
                            <a href={n.link.startsWith('http') ? n.link : `${window.location.origin}${n.link}`}
                              target="_blank" rel="noopener noreferrer"
                              onClick={e => { e.stopPropagation(); if (!n.isRead) markRead(n._id); }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '4px 10px', borderRadius: 6, background: C.accent + '18', border: `1px solid ${C.accent}44`, fontSize: 12, fontWeight: 700, color: C.accent, textDecoration: 'none' }}>
                              🔗 Click here ↗
                            </a>
                          )}
                          <div style={{ fontSize: 10, color: C.mute, marginTop: 4 }}>
                            {new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); removeNotif(n._id); }}
                          style={{ flexShrink: 0, background: 'none', border: 'none', color: C.mute, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', borderRadius: 4, opacity: .6 }} title="Delete">✕</button>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.line}`, textAlign: 'center', flexShrink: 0 }}>
                    <button onClick={() => { navigate('/notifications'); setNotifOpen(false); }}
                      style={{ fontSize: 13, fontWeight: 700, color: C.accent, background: 'none', border: 'none', cursor: 'pointer' }}>
                      View all notifications →
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* User chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Syne', sans-serif", fontWeight: 800, color: 'white', fontSize: 13, flexShrink: 0,
              }}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
              {!isMobile && (
                <>
                  <div style={{ lineHeight: 1.25 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{user?.name}</div>
                    <div style={{ fontSize: 11, color: C.mute }}>Administrator</div>
                  </div>
                </>
              )}
            </div>
            {/* Logout */}
            <button onClick={() => { logout(); navigate('/login'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.red + '18', border: `1px solid ${C.red}44`,
                borderRadius: 8, padding: '6px 14px', color: C.red, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              {!isMobile && 'Logout'}
            </button>
          </div>
        </div>

        {/* ── Page content ── */}
        <div style={{ padding: isMobile ? '18px 14px' : isTablet ? '22px 20px' : '28px 30px', flex: 1 }}>
          {/* Page title + Refresh button */}
          <div style={{ marginBottom: 22, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            {!isMobile && (
              <div>
                <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1 }}>{editProduct && tab === 'Products' ? 'Edit Product' : tab}</h1>
                <p style={{ color: C.mute, margin: '6px 0 0', fontSize: 13 }}>{editProduct && tab === 'Products' ? `Editing: ${editProduct.title}` : TAB_SUBTITLES[tab]}</p>
              </div>
            )}
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
          </div>

          {/* Keep-alive: mount once, CSS-hide when not active — preserves state across tab switches */}
          <div style={{ display: tab === 'Overview'      ? '' : 'none' }}>{mountedTabs.has('Overview')      && <OverviewTab       key={refreshKeys['Overview']      || 0} />}</div>
          <div style={{ display: tab === 'Users'         ? '' : 'none' }}>{mountedTabs.has('Users')         && <UsersTab          key={refreshKeys['Users']         || 0} globalSearch={globalSearch} />}</div>
          <div style={{ display: tab === 'Employees'     ? '' : 'none' }}>{mountedTabs.has('Employees')     && <EmployeesTab      key={refreshKeys['Employees']     || 0} globalSearch={globalSearch} />}</div>
          <div style={{ display: tab === 'Orders'        ? '' : 'none' }}>{mountedTabs.has('Orders')        && <OrdersTab         key={refreshKeys['Orders']        || 0} globalSearch={globalSearch} />}</div>
          <div style={{ display: tab === 'Returns'       ? '' : 'none' }}>{mountedTabs.has('Returns')       && <AdminReturnsTab   key={refreshKeys['Returns']       || 0} globalSearch={globalSearch} />}</div>
          <div style={{ display: tab === 'Cancellations' ? '' : 'none' }}>{mountedTabs.has('Cancellations') && <CancellationsTab   key={refreshKeys['Cancellations'] || 0} globalSearch={globalSearch} />}</div>
          <div style={{ display: tab === 'Products'      ? '' : 'none' }}>
            {mountedTabs.has('Products') && (
              editProduct
                ? <ProductForm initial={editProduct} onSave={handleAdminEditSave} onCancel={() => setEditProduct(null)} employees={employeesForProduct} />
                : <ProductsTab key={refreshKeys['Products'] || 0} onEdit={p => setEditProduct(p)} />
            )}
          </div>
          <div style={{ display: tab === 'Add Product'   ? '' : 'none' }}>
            {mountedTabs.has('Add Product') && (
              <ProductForm key={refreshKeys['Add Product'] || 0} onSave={handleAdminAddProduct} employees={employeesForProduct} />
            )}
          </div>
          <div style={{ display: tab === 'Delivery Areas'? '' : 'none' }}>{mountedTabs.has('Delivery Areas') && <DeliveryAreasTab key={refreshKeys['Delivery Areas'] || 0} />}</div>
          <div style={{ display: tab === 'Coupons'       ? '' : 'none' }}>{mountedTabs.has('Coupons')       && <AdminCouponsTab    key={refreshKeys['Coupons']       || 0} globalSearch={globalSearch} />}</div>
          <div style={{ display: tab === 'Notifications' ? '' : 'none' }}>{mountedTabs.has('Notifications') && <AdminNotificationsTab key={refreshKeys['Notifications'] || 0} />}</div>
          <div style={{ display: tab === 'Support'       ? '' : 'none' }}>{mountedTabs.has('Support')       && <AdminSupportTab   key={refreshKeys['Support']       || 0} globalSearch={globalSearch} />}</div>
          <div style={{ display: tab === 'Inventory'     ? '' : 'none' }}>{mountedTabs.has('Inventory')     && <InventoryTab      key={refreshKeys['Inventory']     || 0} globalSearch={globalSearch} />}</div>
          <div style={{ display: tab === 'Catalog'       ? '' : 'none' }}>{mountedTabs.has('Catalog')       && <AdminCatalogTab   key={refreshKeys['Catalog']       || 0} />}</div>
          <div style={{ display: tab === 'Banners'       ? '' : 'none' }}>{mountedTabs.has('Banners')       && <AdminBannersTab   key={refreshKeys['Banners']       || 0} />}</div>
          <div style={{ display: tab === 'Media'         ? '' : 'none' }}>{mountedTabs.has('Media')         && <AdminMediaTab     key={refreshKeys['Media']         || 0} />}</div>
          <div style={{ display: tab === 'Settings'      ? '' : 'none' }}>{mountedTabs.has('Settings')      && <AdminSettingsTab  key={refreshKeys['Settings']      || 0} />}</div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   CANCELLATIONS & REFUNDS TAB
══════════════════════════════════════════════════════ */
function ProofViewModalAdmin({ proofs, onClose }) {
  const [idx, setIdx] = useState(0);
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'white', borderRadius:12, padding:24, maxWidth:500, width:'90vw' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:15, color:'#111' }}>🧾 Refund Proof</div>
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

function CancellationsTab({ globalSearch = '' }) {
  const { isMobile } = useResponsive();
  const [all, setAll]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [refundF, setRefundF]   = useState('');
  const [payF, setPayF]         = useState('');
  const [expandId, setExpandId] = useState(null);
  const [proofFiles, setProofFiles] = useState({});
  const [processing, setProcessing] = useState(null);
  const [proofModal, setProofModal] = useState(null);

  useEffect(() => { setSearch(globalSearch); }, [globalSearch]);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getOrders({ status: 'CANCELLED', limit: 500 })
      .then(r => setAll(r.data?.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = all.filter(o => {
    const q = search.toLowerCase();
    const mQ = !q ||
      o.orderNumber?.toLowerCase().includes(q) ||
      o._id?.toLowerCase().includes(q) ||
      o.user?.name?.toLowerCase().includes(q) ||
      o.user?.email?.toLowerCase().includes(q) ||
      o.user?.phone?.includes(q) ||
      o.shippingAddress?.phone?.includes(q) ||
      o.shippingAddress?.name?.toLowerCase().includes(q) ||
      o.items?.some(i => i.product?.title?.toLowerCase().includes(q));
    const mR = !refundF || (
      refundF === 'COMPLETED' ? o.refundStatus === 'COMPLETED' :
      refundF === 'PENDING'   ? (o.paymentMethod === 'ONLINE' && o.refundStatus !== 'COMPLETED') :
      refundF === 'NA'        ? o.paymentMethod !== 'ONLINE' : true
    );
    const mP = !payF || o.paymentMethod === payF;
    return mQ && mR && mP;
  });

  const onlineOrders    = all.filter(o => o.paymentMethod === 'ONLINE');
  const completedCount  = all.filter(o => o.refundStatus === 'COMPLETED').length;
  const pendingCount    = onlineOrders.filter(o => o.refundStatus !== 'COMPLETED').length;
  const totalRefunded   = all.reduce((s, o) => s + (o.refundAmount || 0), 0);

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
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to process refund');
    } finally { setProcessing(null); }
  };

  if (loading) return <Loader />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
        <KpiCard label="Total Cancelled"  value={fmt(all.length)}         sub="All time"               colorKey="red"    iconEl={Icon.orders} />
        <KpiCard label="Refund Pending"   value={fmt(pendingCount)}       sub="Online — action needed" colorKey="yellow" iconEl={Icon.refund} />
        <KpiCard label="Refunds Done"     value={fmt(completedCount)}     sub="Manually processed"     colorKey="green"  iconEl={Icon.refund} />
        <KpiCard label="Total Refunded"   value={fmtShort(totalRefunded)} sub="Amount returned"        colorKey="blue"   iconEl={Icon.dollar} rawValue={totalRefunded} />
      </div>

      {/* Info banner if there are pending online refunds */}
      {pendingCount > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: C.yellow + '14', border: `1px solid ${C.yellow}33`, fontSize: 13, color: C.yellow, display: 'flex', gap: 10, alignItems: 'center' }}>
          <SvgAt el={Icon.refund} size={16} />
          <span><strong>{pendingCount} online order{pendingCount > 1 ? 's' : ''}</strong> awaiting manual refund. Expand each order card and use "Process Refund" to mark as completed.</span>
        </div>
      )}

      {/* Filters */}
      <Card>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Order #, name, email, phone, product…" style={{ flex: 1, minWidth: 220 }} />
          <Select value={payF} onChange={e => setPayF(e.target.value)}>
            <option value="">All Payment Methods</option>
            <option value="ONLINE">Online / UPI</option>
            <option value="COD">COD</option>
          </Select>
          <Select value={refundF} onChange={e => setRefundF(e.target.value)}>
            <option value="">All Refund Status</option>
            <option value="PENDING">Refund Pending</option>
            <option value="COMPLETED">Refunded</option>
            <option value="NA">N/A (COD)</option>
          </Select>
          {(search || refundF || payF) && <Btn onClick={() => { setSearch(''); setRefundF(''); setPayF(''); }}>Clear</Btn>}
          <span style={{ fontSize: 13, color: C.mute, marginLeft: 'auto' }}>
            <strong style={{ color: C.text }}>{filtered.length}</strong> of <strong style={{ color: C.text }}>{all.length}</strong>
          </span>
        </div>
      </Card>

      {/* Cards */}
      <Card title={`Cancelled Orders (${filtered.length})`}>
        {filtered.length === 0 ? <Empty text="No cancelled orders match your filters" /> : (
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
                      transition: 'background .15s',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: C.accent, flexShrink: 0 }}>{o.orderNumber}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text, minWidth: 100, flexShrink: 0 }}>{o.user?.name || '—'}</span>
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
                              {[['Name', bd.accountName], ['Bank', bd.bankName], ['Account #', bd.accountNumber], ['IFSC', bd.ifscCode]].map(([l, v]) => (
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

      {proofModal && <ProofViewModalAdmin proofs={proofModal} onClose={() => setProofModal(null)} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   INVENTORY TAB
══════════════════════════════════════════════════════ */
function InventoryTab({ globalSearch = '' }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [sortBy, setSortBy]       = useState('sold');
  const [catFilter, setCat]       = useState('ALL');
  const [stockFilter, setStock]   = useState('ALL');
  const [orderFilter, setOrder]   = useState('ALL');
  const [catSortBy, setCatSort]   = useState('sold_desc');
  const [catStockF, setCatStockF] = useState('ALL');
  const [catSearch, setCatSearch] = useState('');
  const [chartPeriod, setChartPeriod] = useState('month');
  const [expandedCat, setExpandedCat] = useState(null);   // category name string
  const [detailProduct, setDetailProduct] = useState(null); // product object for modal

  useEffect(() => { setSearch(globalSearch); }, [globalSearch]);

  useEffect(() => {
    adminApi.getInventoryAnalytics()
      .then(r => setData(r.data?.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 80, color: C.mute }}>
      <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 16px' }} />
      Loading inventory data…
    </div>
  );

  if (!data) return <div style={{ color: C.red, padding: 40 }}>Failed to load inventory analytics.</div>;

  const { orderSummary, stockHealth, allProducts, categoryBreakdown, paymentBreakdown, timeSeries } = data;

  // Local date string helpers (IST-aware)
  const localDateKey = (dt) => {
    const y = dt.getFullYear(), m = String(dt.getMonth()+1).padStart(2,'0'), d = String(dt.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  };
  const localMonthKey = (dt) => {
    const y = dt.getFullYear(), m = String(dt.getMonth()+1).padStart(2,'0');
    return `${y}-${m}`;
  };

  // Build chart data from time series
  const buildChartData = () => {
    if (chartPeriod === 'today') {
      return Array.from({ length: 24 }, (_, h) => {
        const d = (timeSeries?.hourly || []).find(x => x._id === h);
        return { label: `${h}:00`, revenue: d?.revenue || 0, orders: d?.orders || 0, net: (d?.revenue||0)-(d?.refunded||0) };
      });
    }
    if (chartPeriod === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const dt  = new Date(); dt.setDate(dt.getDate() - (6 - i)); dt.setHours(0,0,0,0);
        const key = localDateKey(dt);
        const d   = (timeSeries?.daily || []).find(x => x._id === key);
        return { label: dt.toLocaleDateString('en-IN', { weekday:'short', day:'numeric' }), revenue: d?.revenue||0, orders: d?.orders||0, net: (d?.revenue||0)-(d?.refunded||0) };
      });
    }
    if (chartPeriod === 'month') {
      const now  = new Date();
      const days = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
      return Array.from({ length: days }, (_, i) => {
        const dt  = new Date(now.getFullYear(), now.getMonth(), i+1);
        const key = localDateKey(dt);
        const d   = (timeSeries?.daily || []).find(x => x._id === key);
        return { label: `${i+1}`, revenue: d?.revenue||0, orders: d?.orders||0, net: (d?.revenue||0)-(d?.refunded||0) };
      });
    }
    // year — 12 months
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const dt  = new Date(now.getFullYear(), i, 1);
      const key = localMonthKey(dt);
      const d   = (timeSeries?.monthly || []).find(x => x._id === key);
      return { label: dt.toLocaleDateString('en-IN', { month:'short' }), revenue: d?.revenue||0, orders: d?.orders||0, net: (d?.revenue||0)-(d?.refunded||0) };
    });
  };
  const chartData   = buildChartData();
  const chartTotal  = chartData.reduce((s, d) => s + d.revenue, 0);
  const chartOrders = chartData.reduce((s, d) => s + d.orders, 0);

  const CHART_PERIODS = [
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'year',  label: 'This Year' },
  ];
  const cod    = paymentBreakdown?.cod    || { count: 0, revenue: 0, refunded: 0, deposit: { paid: { count: 0, amount: 0 }, pending: { count: 0, amount: 0 }, none: { count: 0 } } };
  const online = paymentBreakdown?.online || { count: 0, revenue: 0, refunded: 0 };
  const codDeposit = cod.deposit || { paid: { count: 0, amount: 0 }, pending: { count: 0, amount: 0 }, none: { count: 0 } };
  const totalDepositCollected = codDeposit.paid?.amount || 0;
  const totalDepositPending   = codDeposit.pending?.amount || 0;

  const categories = ['ALL', ...new Set((allProducts || []).map(p => p.category?.name).filter(Boolean))];

  const filtered = (allProducts || [])
    .filter(p => catFilter === 'ALL' || p.category?.name === catFilter)
    .filter(p => {
      if (stockFilter === 'out') return p.stock === 0;
      if (stockFilter === 'low') return p.stock > 0 && p.stock <= 10;
      if (stockFilter === 'ok')  return p.stock > 10;
      return true;
    })
    .filter(p => !search || p.title?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'sold')    return b.sold - a.sold;
      if (sortBy === 'stock')   return a.stock - b.stock;
      if (sortBy === 'revenue') return (b.sold * b.price) - (a.sold * a.price);
      if (sortBy === 'price')   return b.price - a.price;
      return a.title?.localeCompare(b.title);
    });

  const catRows = (() => {
    let rows = (categoryBreakdown || []).map(c => ({
      name: c.categoryName,
      products: c.productCount,
      sold: c.totalSold,
      stock: c.totalStock,
      revenue: Math.round(c.revenue),
    }));
    if (catSearch.trim()) {
      const q = catSearch.trim().toLowerCase();
      rows = rows.filter(r => r.name?.toLowerCase().includes(q));
    }
    if (catStockF !== 'ALL') {
      rows = rows.filter(r => {
        if (catStockF === 'out')     return r.stock === 0;
        if (catStockF === 'low')     return r.stock > 0 && r.stock <= 20;
        if (catStockF === 'healthy') return r.stock > 20;
        return true;
      });
    }
    rows.sort((a, b) => {
      if (catSortBy === 'sold_desc')    return b.sold - a.sold;
      if (catSortBy === 'sold_asc')     return a.sold - b.sold;
      if (catSortBy === 'revenue_desc') return b.revenue - a.revenue;
      if (catSortBy === 'revenue_asc')  return a.revenue - b.revenue;
      if (catSortBy === 'stock_desc')   return b.stock - a.stock;
      if (catSortBy === 'stock_asc')    return a.stock - b.stock;
      if (catSortBy === 'products')     return b.products - a.products;
      if (catSortBy === 'name')         return (a.name || '').localeCompare(b.name || '');
      return b.sold - a.sold;
    });
    return rows;
  })();

  const Stat = ({ label, value, color = C.text, sub, accent, rawValue }) => (
    <div style={{ background: C.card, border: `1px solid ${accent ? accent + '44' : C.line}`, borderRadius: 12, padding: '16px 18px', borderLeft: accent ? `3px solid ${accent}` : undefined }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.mute, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}
        title={rawValue !== undefined ? fmtRs(rawValue) : undefined}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.mute, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const TH = ({ children, right }) => (
    <th style={{ padding: '9px 12px', textAlign: right ? 'right' : 'left', color: C.mute, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap', borderBottom: `1px solid ${C.line}`, background: C.card2 }}>
      {children}
    </th>
  );

  const inputStyle = { height: 34, border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 11px', fontSize: 13, background: C.bg, color: C.text, outline: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Product Detail Modal ── */}
      {detailProduct && (() => {
        const p = detailProduct;
        const effPrice = p.discountPrice || p.price || 0;
        const grossRev = effPrice * p.sold;
        const st = p.stock === 0 ? { label:'Out of Stock', color:C.red } : p.stock <= 10 ? { label:'Low Stock', color:C.yellow } : { label:'In Stock', color:C.green };
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
            onClick={() => setDetailProduct(null)}>
            <div style={{ background:C.card, borderRadius:18, padding:28, maxWidth:540, width:'100%', border:`1px solid ${C.line}`, boxShadow:'0 24px 64px #000a' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:20 }}>
                {p.images?.[0]
                  ? <img src={p.images[0]} alt="" style={{ width:72, height:72, objectFit:'contain', borderRadius:10, border:`1px solid ${C.line}`, flexShrink:0 }} />
                  : <div style={{ width:72, height:72, borderRadius:10, background:C.card2, display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, flexShrink:0 }}>📦</div>
                }
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800, fontSize:16, color:C.text, lineHeight:1.3 }}>{p.title}</div>
                  <div style={{ fontSize:12, color:C.mute, marginTop:3 }}>{p.category?.name || '—'} · {p.brand || '—'}</div>
                  <span style={{ display:'inline-block', marginTop:6, fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:99, background:st.color+'22', color:st.color }}>{st.label}</span>
                </div>
                <button onClick={() => setDetailProduct(null)}
                  style={{ background:'transparent', border:'none', color:C.mute, fontSize:22, cursor:'pointer', lineHeight:1, padding:4 }}>✕</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
                {[
                  { label:'Selling Price', val: fmtRs(effPrice), color:C.accent },
                  { label:'MRP', val: fmtRs(p.price), color:C.text },
                  { label:'Units Sold', val: fmt(p.sold), color:C.green },
                  { label:'Stock Left', val: fmt(p.stock), color:st.color },
                  { label:'Gross Revenue', val: fmtRs(grossRev), color:C.blue },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background:C.card2, borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ fontSize:10, color:C.mute, marginBottom:3, textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</div>
                    <div style={{ fontSize:16, fontWeight:800, color }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11, color:C.mute, textAlign:'center' }}>Click outside to close</div>
            </div>
          </div>
        );
      })()}

      {/* ── Earnings Chart ── */}
      <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:14, padding:'18px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:16 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:C.text }}>Earnings Overview</div>
            <div style={{ fontSize:12, color:C.mute, marginTop:2 }}>
              <span style={{ color:C.accent, fontWeight:700 }}>{fmtRs(chartTotal)}</span>
              &nbsp;·&nbsp;{fmt(chartOrders)} orders&nbsp;·&nbsp;
              {CHART_PERIODS.find(p => p.key === chartPeriod)?.label}
            </div>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {CHART_PERIODS.map(p => (
              <button key={p.key} onClick={() => setChartPeriod(p.key)}
                style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
                  background: chartPeriod === p.key ? C.accent : C.bg2,
                  color:      chartPeriod === p.key ? 'white'  : C.mute }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {chartTotal === 0
          ? <div style={{ textAlign:'center', padding:'40px 0', color:C.mute, fontSize:13 }}>No orders in this period</div>
          : <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top:4, right:8, left:-10, bottom:0 }}>
                <defs>
                  <linearGradient id="invRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.accent} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="invNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.green} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize:10, fill:C.mute }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize:10, fill:C.mute }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip
                  contentStyle={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:10, fontSize:12 }}
                  formatter={(v, name) => [fmtRs(v), name === 'revenue' ? 'Gross Revenue' : name === 'net' ? 'Net Revenue' : 'Orders']}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11, paddingTop:8 }} formatter={v => v === 'revenue' ? 'Gross Revenue' : v === 'net' ? 'Net Revenue' : 'Orders'} />
                <Area type="monotone" dataKey="revenue" stroke={C.accent} strokeWidth={2} fill="url(#invRev)" dot={false} activeDot={{ r:4 }} />
                <Area type="monotone" dataKey="net"     stroke={C.green}  strokeWidth={2} fill="url(#invNet)" dot={false} activeDot={{ r:4 }} />
              </AreaChart>
            </ResponsiveContainer>
        }
      </div>

      {/* ── Order Summary KPIs ── */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.mute, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Order Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          <Stat label="Total Orders"   value={fmt(orderSummary.totalOrders)}             />
          <Stat label="Active Orders"  value={fmt(orderSummary.totalSold)}      color={C.green}  accent={C.green}  sub="Placed → Delivered" />
          <Stat label="Cancelled"      value={fmt(orderSummary.totalCancelled)} color={C.red}    accent={C.red}    />
          <Stat label="Returned"       value={fmt(orderSummary.totalReturned)}  color={C.yellow} accent={C.yellow} />
          <Stat label="Total Sales"    value={fmtShort(orderSummary.totalRevenue)}  color={C.accent} accent={C.accent} rawValue={orderSummary.totalRevenue} sub={totalDepositCollected > 0 ? `+ ${fmtShort(totalDepositCollected)} COD deposit` : undefined} />
          <Stat label="Total Refunded" value={fmtShort(orderSummary.totalRefunded)} color={C.red}    accent={C.red}    rawValue={orderSummary.totalRefunded} />
          {(orderSummary.totalShipping > 0) && (
            <Stat label="Delivery Collected" value={fmtShort(orderSummary.totalShipping)} color={C.blue} accent={C.blue} sub="Shipping charged to buyers" rawValue={orderSummary.totalShipping} />
          )}
          <Stat label="Net Revenue"
            value={fmtShort(Math.max(0, orderSummary.totalRevenue - orderSummary.totalRefunded - (orderSummary.totalShipping || 0)))}
            color={C.green} accent={C.green}
            rawValue={Math.max(0, orderSummary.totalRevenue - orderSummary.totalRefunded - (orderSummary.totalShipping || 0))}
            sub="After refunds & delivery" />
        </div>
      </div>

      {/* ── Payment Method Breakdown ── */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.mute, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Payment Method Breakdown</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* COD card */}
          <div style={{ background: C.card, border: `1px solid ${C.yellow}44`, borderLeft: `3px solid ${C.yellow}`, borderRadius: 12, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.yellow, textTransform: 'uppercase', letterSpacing: '.08em' }}>Cash on Delivery (COD)</div>
            {/* Main stats */}
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: C.mute, marginBottom: 2 }}>Orders</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.yellow }}>{fmt(cod.count)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.mute, marginBottom: 2 }}>Total Sales</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.yellow }} title={fmtRs(cod.revenue)}>{fmtShort(cod.revenue)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.mute, marginBottom: 2 }}>Refunded</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.red }} title={fmtRs(cod.refunded || 0)}>{fmtShort(cod.refunded || 0)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.mute, marginBottom: 2 }}>Net COD</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.green }} title={fmtRs(Math.max(0, (cod.revenue || 0) - (cod.refunded || 0)))}>{fmtShort(Math.max(0, (cod.revenue || 0) - (cod.refunded || 0)))}</div>
              </div>
            </div>
            {/* Deposit section */}
            <div style={{ borderTop: `1px dashed ${C.yellow}44`, paddingTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.yellow, textTransform: 'uppercase', letterSpacing: '.06em' }}>Booking Deposit</div>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: C.blue + '22', color: C.blue, border: `1px solid ${C.blue}44` }}>ONLINE ONLY · UPI / Transfer</span>
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 10, color: C.mute, marginBottom: 2 }}>Collected Online</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{fmtRs(totalDepositCollected)}</div>
                  <div style={{ fontSize: 10, color: C.mute }}>{fmt(codDeposit.paid?.count || 0)} orders</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.mute, marginBottom: 2 }}>Awaiting Payment</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.red }}>{fmtRs(totalDepositPending)}</div>
                  <div style={{ fontSize: 10, color: C.mute }}>{fmt(codDeposit.pending?.count || 0)} orders</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.mute, marginBottom: 2 }}>No Deposit Required</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.mute }}>{fmt(codDeposit.none?.count || 0)}</div>
                  <div style={{ fontSize: 10, color: C.mute }}>orders</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: C.mute, marginBottom: 2 }}>Total Expected</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.yellow }}>{fmtRs(totalDepositCollected + totalDepositPending)}</div>
                  <div style={{ fontSize: 10, color: C.blue, fontWeight: 600 }}>via online transfer</div>
                </div>
              </div>
            </div>
          </div>
          {/* Online / Razorpay card */}
          <div style={{ background: C.card, border: `1px solid ${C.blue}44`, borderLeft: `3px solid ${C.blue}`, borderRadius: 12, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Online / Razorpay</div>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: C.mute, marginBottom: 2 }}>Orders</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.blue }}>{fmt(online.count)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.mute, marginBottom: 2 }}>Total Sales</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.blue }} title={fmtRs(online.revenue)}>{fmtShort(online.revenue)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.mute, marginBottom: 2 }}>Refunded</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.red }} title={fmtRs(online.refunded)}>{fmtShort(online.refunded)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.mute, marginBottom: 2 }}>Net</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.green }} title={fmtRs(Math.max(0, online.revenue - online.refunded))}>{fmtShort(Math.max(0, online.revenue - online.refunded))}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stock Health KPIs ── */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.mute, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Stock Health</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          <Stat label="Total Products"   value={fmt(stockHealth.totalProducts)}        />
          <Stat label="Units in Stock"   value={fmt(stockHealth.totalUnits)}       color={C.blue}   accent={C.blue}   />
          <Stat label="Total Units Sold" value={fmt(stockHealth.totalProductsSold)} color={C.green}  accent={C.green}  />
          <Stat label="Low Stock ≤10"    value={fmt(stockHealth.lowStock)}          color={C.yellow} accent={C.yellow} sub="Need restock" />
          <Stat label="Out of Stock"     value={fmt(stockHealth.outOfStock)}        color={C.red}    accent={C.red}    sub="Zero units left" />
        </div>
      </div>

      {/* ── Category Breakdown Table ── */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>
            Category Breakdown
            <span style={{ fontWeight: 400, fontSize: 12, color: C.mute, marginLeft: 8 }}>{catRows.length} categories</span>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: C.card2 + '66' }}>
          <input
            value={catSearch} onChange={e => setCatSearch(e.target.value)}
            placeholder="Search category…"
            style={{ ...inputStyle, flex: 1, minWidth: 160 }}
          />
          <select value={catStockF} onChange={e => setCatStockF(e.target.value)} style={inputStyle}>
            <option value="ALL">All Stock Status</option>
            <option value="healthy">Healthy (&gt;20)</option>
            <option value="low">Low Stock (1–20)</option>
            <option value="out">Out of Stock</option>
          </select>
          <select value={catSortBy} onChange={e => setCatSort(e.target.value)} style={inputStyle}>
            <option value="sold_desc">Most Sold</option>
            <option value="sold_asc">Least Sold</option>
            <option value="revenue_desc">Highest Revenue</option>
            <option value="revenue_asc">Lowest Revenue</option>
            <option value="stock_desc">Most Stock</option>
            <option value="stock_asc">Lowest Stock</option>
            <option value="products">Most Products</option>
            <option value="name">A → Z</option>
          </select>
          {(catSearch || catStockF !== 'ALL' || catSortBy !== 'sold_desc') && (
            <button onClick={() => { setCatSearch(''); setCatStockF('ALL'); setCatSort('sold_desc'); }}
              style={{ ...inputStyle, padding: '0 12px', cursor: 'pointer', whiteSpace: 'nowrap', background: 'rgba(255,255,255,.06)', border: `1px solid ${C.line}`, color: C.sub, fontFamily: 'inherit' }}>
              Clear
            </button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <TH>Category</TH>
                <TH right>Products</TH>
                <TH right>Units Sold</TH>
                <TH right>Stock Left</TH>
                <TH right>Revenue</TH>
                <TH right>Stock Status</TH>
              </tr>
            </thead>
            <tbody>
              {catRows.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: C.mute }}>No data</td></tr>
              )}
              {catRows.map((row, i) => {
                const st = row.stock === 0 ? { label: 'Out of Stock', color: C.red }
                         : row.stock <= 20 ? { label: 'Low',          color: C.yellow }
                         : { label: 'Healthy', color: C.green };
                const isExpanded = expandedCat === row.name;
                const catProducts = (allProducts || []).filter(p => (p.category?.name || 'Uncategorised') === row.name);
                return (
                  <>
                    <tr key={i}
                      onClick={() => setExpandedCat(isExpanded ? null : row.name)}
                      style={{ borderBottom: `1px solid ${C.line}22`, background: isExpanded ? C.accent + '12' : i % 2 === 0 ? 'transparent' : C.card2 + '55', cursor: 'pointer', transition: 'background .15s' }}>
                      <td style={{ padding: '11px 12px', fontWeight: 700, color: isExpanded ? C.accent : C.text }}>
                        <span style={{ marginRight: 6, fontSize: 10 }}>{isExpanded ? '▼' : '▶'}</span>{row.name}
                      </td>
                      <td style={{ padding: '11px 12px', textAlign: 'right', color: C.mute }}>{fmt(row.products)}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: C.green }}>{fmt(row.sold)}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: st.color }}>{fmt(row.stock)}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: C.accent }}>{fmtRs(row.revenue)}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: st.color + '22', color: st.color }}>{st.label}</span>
                      </td>
                    </tr>
                    {isExpanded && catProducts.map((p, j) => {
                      const pst = p.stock === 0 ? { label:'Out', color:C.red } : p.stock <= 10 ? { label:'Low', color:C.yellow } : { label:'OK', color:C.green };
                      const effP = p.discountPrice || p.price || 0;
                      return (
                        <tr key={`cat-p-${j}`}
                          onClick={() => setDetailProduct(p)}
                          style={{ background: C.accent + '08', cursor:'pointer', borderBottom:`1px solid ${C.line}11` }}>
                          <td style={{ padding:'8px 12px 8px 28px', color:C.sub, fontSize:12 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              {p.images?.[0] ? <img src={p.images[0]} alt="" style={{ width:26, height:26, objectFit:'contain', borderRadius:5, border:`1px solid ${C.line}` }} /> : <span>📦</span>}
                              <span style={{ fontWeight:600 }}>{p.title}</span>
                            </div>
                          </td>
                          <td style={{ padding:'8px 12px', textAlign:'right', fontSize:12, color:C.mute }}>—</td>
                          <td style={{ padding:'8px 12px', textAlign:'right', fontSize:12, fontWeight:700, color:C.green }}>{fmt(p.sold)}</td>
                          <td style={{ padding:'8px 12px', textAlign:'right', fontSize:12, fontWeight:700, color:pst.color }}>{fmt(p.stock)}</td>
                          <td style={{ padding:'8px 12px', textAlign:'right', fontSize:12, fontWeight:700, color:C.accent }}>{fmtRs(effP * p.sold)}</td>
                          <td style={{ padding:'8px 12px', textAlign:'right' }}>
                            <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, background:pst.color+'22', color:pst.color }}>{pst.label}</span>
                            <span style={{ fontSize:10, color:C.mute, marginLeft:6 }}>→ details</span>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── All Products Table ── */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>
            All Products
            <span style={{ fontWeight: 400, fontSize: 12, color: C.mute, marginLeft: 8 }}>{filtered.length} of {allProducts?.length}</span>
          </div>
        </div>

        {/* Filters bar */}
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: C.card2 + '66' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search product name…"
            style={{ ...inputStyle, flex: 1, minWidth: 180 }} />

          <select value={catFilter} onChange={e => setCat(e.target.value)} style={inputStyle}>
            {categories.map(c => <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>)}
          </select>

          <select value={stockFilter} onChange={e => setStock(e.target.value)} style={inputStyle}>
            <option value="ALL">All Stock</option>
            <option value="ok">In Stock (&gt;10)</option>
            <option value="low">Low Stock (≤10)</option>
            <option value="out">Out of Stock</option>
          </select>

          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={inputStyle}>
            <option value="sold">Top Sellers</option>
            <option value="stock">Low Stock First</option>
            <option value="revenue">Top Revenue</option>
            <option value="price">Highest Price</option>
            <option value="name">A – Z</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <TH>#</TH>
                <TH>Product</TH>
                <TH>Category</TH>
                <TH right>Price</TH>
                <TH right>Units Sold</TH>
                <TH right>Stock Left</TH>
                <TH right>Revenue</TH>
                <TH right>Stock Status</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const effP    = p.discountPrice || p.price || 0;
                const revenue = p.sold * effP;
                const st = p.stock === 0 ? { label: 'Out of Stock', color: C.red }
                         : p.stock <= 10  ? { label: 'Low Stock',   color: C.yellow }
                         : { label: 'In Stock', color: C.green };
                return (
                  <tr key={p._id}
                    onClick={() => setDetailProduct(p)}
                    title="Click for full details"
                    style={{ borderBottom: `1px solid ${C.line}22`, background: i % 2 === 0 ? 'transparent' : C.card2 + '44', cursor: 'pointer', transition: 'background .12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.accent + '10'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : C.card2 + '44'}>
                    <td style={{ padding: '10px 12px', color: C.mute, fontSize: 11 }}>{i + 1}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        {p.images?.[0]
                          ? <img src={p.images[0]} alt="" style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 6, border: `1px solid ${C.line}`, flexShrink: 0 }} />
                          : <div style={{ width: 34, height: 34, borderRadius: 6, background: C.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📦</div>
                        }
                        <span style={{ fontWeight: 600, color: C.text, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: C.mute, whiteSpace: 'nowrap' }}>{p.category?.name || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: C.text, whiteSpace: 'nowrap' }}>{fmtRs(p.price)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: C.green }}>{fmt(p.sold)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: st.color }}>{fmt(p.stock)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: C.accent, whiteSpace: 'nowrap' }} title={fmtRs(revenue)}>{fmtShort(revenue)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: st.color + '22', color: st.color, whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: C.mute }}>No products match your filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}


