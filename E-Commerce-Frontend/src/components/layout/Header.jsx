import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Heart,
  User,
  Search,
  GitCompare,
  Bell,
  Package,
  Home as HomeIcon,
  Zap,
  Sparkles,
  Flame,
  Tags,
  Monitor,
  WashingMachine,
  Camera,
} from 'lucide-react';
import SupportIcon from '../icons/SupportIcon';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { useCompare } from '../../context/CompareContext';
import { useNotifications } from '../../context/NotificationContext';
import { productsApi } from '../../api/products';
import { normalizeProducts } from '../../utils/normalizers';
import { formatPriceShort } from '../../utils/formatters';
import { useCatalog, getCatEmoji } from '../../context/CatalogContext';
import { categories as FALLBACK_CATS } from '../../data/categories';

const TYPE_ICON = { ORDER:'📦', PAYMENT:'💳', OFFER:'🎁', REFUND:'↩️', SYSTEM:'🔔' };

function DrawerCategoryIcon({ name }) {
  const normalized = String(name || '').toLowerCase();
  if (normalized.includes('television') || normalized.includes('tv')) return <Monitor size={17} strokeWidth={2.1} />;
  if (normalized.includes('washing')) return <WashingMachine size={17} strokeWidth={2.1} />;
  return <ShoppingCart size={17} strokeWidth={2.1} />;
}

function CopyButton({ code }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6,
      background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, padding:'5px 10px', width:'fit-content' }}>
      <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:13, color:'#16a34a', letterSpacing:'.08em' }}>{code}</span>
      <button onClick={handleCopy}
        style={{ background: copied ? '#16a34a' : 'white', color: copied ? 'white' : '#16a34a',
          border:'1px solid #86efac', borderRadius:5, padding:'2px 8px', fontSize:11, fontWeight:700,
          cursor:'pointer', transition:'all .2s', whiteSpace:'nowrap' }}>
        {copied ? '✓ Copied!' : 'Copy'}
      </button>
    </div>
  );
}

function NotificationDropdown({ onClose }) {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, fetchNotifications } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const recent = notifications.slice(0, 8);

  // Fetch fresh notifications and auto-mark all read every time the dropdown opens
  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    fetchNotifications().then(() => {
      if (!cancelled) markAllRead();
    }).finally(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
  }, [fetchNotifications]);

  return (
    <div className="notif-dropdown" style={{
      position:'absolute', top:'calc(100% + 10px)', right:0,
      width:380, background:'white', borderRadius:14,
      boxShadow:'0 8px 32px #0000001a',
      border:'1px solid rgba(0,0,0,0.1)',
      zIndex:200, overflow:'hidden',
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid #f0f0f0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:800, fontSize:15 }}>
          Notifications
          {unreadCount > 0 && <span style={{ fontSize:12, fontWeight:700, color:'#FF5A1F', background:'#FF5A1F15', padding:'1px 7px', borderRadius:99 }}>{unreadCount} new</span>}
          {refreshing && (
            <span style={{ display:'inline-block', width:12, height:12, border:'2px solid #e5e7eb', borderTopColor:'#FF5A1F', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={async () => { setRefreshing(true); await fetchNotifications(); setRefreshing(false); }}
            title="Refresh" style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#9ca3af', lineHeight:1, padding:'2px 4px' }}>↻</button>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{ fontSize:12, fontWeight:700, color:'#007185', background:'none', border:'none', cursor:'pointer' }}>Mark all read</button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ maxHeight:400, overflowY:'auto' }}>
        {recent.length === 0 ? (
          <div style={{ padding:'40px 20px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🔔</div>
            No notifications yet
          </div>
        ) : recent.map(n => {
          const handleOpen = () => {
            if (!n.isRead) markRead(n._id);
            if (n.link) navigate(n.link);
            onClose();
          };
          return (
            <div key={n._id}
              style={{
                display:'flex', gap:12, padding:'12px 18px',
                background: n.isRead ? 'white' : '#FFF8F5',
                borderBottom:'1px solid #f5f5f5',
              }}
            >
              <div style={{ width:36, height:36, borderRadius:'50%', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, marginTop:2 }}>
                {TYPE_ICON[n.type] || '🔔'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight: n.isRead ? 600 : 800, fontSize:13, marginBottom:2 }}>{n.title}</div>
                <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{n.message}</div>

                {/* Coupon code copy button */}
                {n.couponCode && <CopyButton code={n.couponCode} />}

                {/* Link button */}
                {n.link && (
                  <a
                    href={n.link.startsWith('http') ? n.link : `${window.location.origin}${n.link}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={() => { if (!n.isRead) markRead(n._id); onClose(); }}
                    style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:7, padding:'5px 10px',
                      borderRadius:6, background:'#eff6ff', border:'1px solid #bfdbfe',
                      fontSize:12, fontWeight:700, color:'#1d4ed8', cursor:'pointer', textDecoration:'none' }}>
                    🔗 Click here ↗
                  </a>
                )}

                <div style={{ fontSize:11, color:'#9ca3af', marginTop:6 }}>
                  {new Date(n.createdAt).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>
              {!n.isRead && (
                <button onClick={() => markRead(n._id)}
                  style={{ width:8, height:8, borderRadius:'50%', background:'#FF5A1F', flexShrink:0,
                    marginTop:4, border:'none', cursor:'pointer', padding:0 }} title="Mark read" />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding:'12px 18px', borderTop:'1px solid #f0f0f0', textAlign:'center' }}>
        <button onClick={() => { navigate('/notifications'); onClose(); }}
          style={{ fontSize:13, fontWeight:700, color:'#007185', background:'none', border:'none', cursor:'pointer' }}>
          View all notifications →
        </button>
      </div>
    </div>
  );
}

function CategoryBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', height: 36, background: 'transparent', border: `1px solid ${active ? 'white' : 'transparent'}`,
      borderRadius: 3, color: 'white', fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'pointer',
      whiteSpace: 'nowrap', flexShrink: 0,
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'white'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'transparent'; }}>
      {label}
    </button>
  );
}

export default function Header() {
  const navigate = useNavigate();
  const { count: cartCount } = useCart();
  const { count: wishCount } = useWishlist();
  const { count: compareCount } = useCompare();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { topCategories } = useCatalog();
  const navCats = topCategories.length > 0
    ? topCategories.map(c => ({ id: c._id, name: c.name, emo: getCatEmoji(c.name) }))
    : FALLBACK_CATS;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showNotifs, setShowNotifs] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 769);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navTo = (path) => {
    setMobileOpen(false);
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Smooth-scroll to the "Social Footprints" section on the home page. If we're
  // on another route, go home first, then scroll once the section mounts (it
  // loads its media async, so we retry briefly until the anchor exists).
  const goToSocial = () => {
    setMobileOpen(false);
    const scrollToSocial = (tries = 0) => {
      const el = document.getElementById('social-footprints');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (tries < 20) setTimeout(() => scrollToSocial(tries + 1), 150);
    };
    if (window.location.pathname === '/') {
      scrollToSocial();
    } else {
      navigate('/');
      setTimeout(() => scrollToSocial(), 250); // let Home mount + ScrollToTop run first
    }
  };
  const searchRef = useRef(null);
  const bellRef   = useRef(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handler = (e) => {
      if (!searchRef.current?.contains(e.target)) setShowResults(false);
      if (!bellRef.current?.contains(e.target)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80) { setHidden(false); }
      else if (y > lastScrollY.current + 5) { setHidden(true); }
      else if (y < lastScrollY.current - 5) { setHidden(false); }
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 769;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleSearch = (e) => {
    const q = e.target.value;
    setQuery(q);
    if (q.trim().length > 1) {
      productsApi.getAll({ search: q.trim(), limit: 6 })
        .then(({ data }) => {
          const prods = normalizeProducts(data.data?.products || data.data?.data || []);
          setResults(prods);
          setShowResults(prods.length > 0);
        })
        .catch(() => setResults([]));
    } else {
      setShowResults(false);
      setResults([]);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setShowResults(false);
      navigate(`/products?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const selectResult = (product) => {
    setShowResults(false);
    setQuery('');
    navigate(`/product/${product._id || product.id}`);
  };

  const iconBtn = (onClick, children) => (
    <button onClick={onClick} style={{
      position: 'relative', display: 'flex', alignItems: 'center', gap: 5,
      padding: '6px 10px', borderRadius: 4, background: 'transparent', border: '1px solid transparent',
      color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'white'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
      {children}
    </button>
  );

  return (
    <>
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
      transition: 'transform 0.25s ease',
    }}>
      {!isMobile ? (
        <>
          {/* Main dark bar — desktop */}
          <div style={{ background: '#131921', borderBottom: '1px solid #2a2a2a' }}>
            <div style={{ maxWidth: 1500, margin: '0 auto', padding: '0 16px',
              display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', gap: 16, alignItems: 'center', height: 76 }}>

              {/* Logo */}
              <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center',
                cursor: 'pointer', padding: '4px 10px', borderRadius: 4, border: '1px solid transparent', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'white'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                <img src="/LOGO.png" alt="TradeEngine" style={{ height: 48, width: 'auto', display: 'block' }} />
              </div>

              {/* Deliver to widget */}
              {(() => {
                const addr = user?.addresses?.[0];
                return (
                  <div onClick={() => navigate('/profile?tab=addresses')}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                      padding: '5px 10px', borderRadius: 4, border: '1px solid transparent', flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'white'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                      <span style={{ fontSize: 11, color: '#ccc' }}>
                        {addr ? `Delivering to ${addr.city || addr.state || ''}` : 'Deliver to'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                        {addr ? addr.pincode : 'Update location'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Search */}
              <div style={{ position: 'relative', maxWidth: 700, width: '100%', margin: '0 auto' }} ref={searchRef}>
                <form onSubmit={handleSearchSubmit} style={{ display: 'flex' }}>
                  <input
                    style={{ flex: 1, height: 46, padding: '0 12px 0 16px', border: 'none', borderRadius: '4px 0 0 4px',
                      fontSize: 14, outline: 'none', background: 'white', color: '#0f172a' }}
                    placeholder="Search products, brands & categories…"
                    value={query}
                    onChange={handleSearch}
                    onFocus={() => query.trim().length > 1 && setShowResults(true)}
                    autoComplete="off"
                  />
                  <button type="submit" style={{ height: 46, padding: '0 18px', background: '#FF5A1F',
                    border: 'none', borderRadius: '0 4px 4px 0', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Search size={20} color="white" />
                  </button>
                </form>
                {showResults && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white',
                    border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px #00000022', zIndex: 200,
                    overflow: 'hidden', maxHeight: 320, overflowY: 'auto' }}>
                    {results.length > 0 ? results.map(p => (
                      <div key={p._id || p.id} onClick={() => selectResult(p)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                        <div style={{ width: 40, height: 40, background: '#f4f6f8', borderRadius: 6, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {p.images?.[0] ? <img src={p.images[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : '🛍️'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.brand}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{formatPriceShort(p.price)}</div>
                      </div>
                    )) : (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No products found for "{query}"</div>
                    )}
                  </div>
                )}
              </div>

              {/* Right icons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {compareCount > 0 && iconBtn(() => navigate('/compare'), (
                  <>
                    <GitCompare size={22} />
                    <span style={{ position: 'absolute', top: 2, right: 2, width: 17, height: 17, borderRadius: '50%',
                      background: '#FF5A1F', color: 'white', fontSize: 10, fontWeight: 800, display: 'flex',
                      alignItems: 'center', justifyContent: 'center' }}>{compareCount}</span>
                  </>
                ))}
                {iconBtn(() => navigate('/wishlist'), (
                  <>
                    <Heart size={22} />
                    {wishCount > 0 && <span style={{ position: 'absolute', top: 2, right: 2, width: 17, height: 17,
                      borderRadius: '50%', background: '#FF5A1F', color: 'white', fontSize: 10, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{wishCount}</span>}
                  </>
                ))}
                {user && (
                  <div style={{ position: 'relative' }} ref={bellRef}>
                    {iconBtn(() => setShowNotifs(v => !v), (
                      <>
                        <Bell size={22} />
                        {unreadCount > 0 && <span style={{ position: 'absolute', top: 2, right: 2, width: 17, height: 17,
                          borderRadius: '50%', background: '#FF5A1F', color: 'white', fontSize: 10, fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>}
                      </>
                    ))}
                    {showNotifs && <NotificationDropdown onClose={() => setShowNotifs(false)} />}
                  </div>
                )}
                {iconBtn(() => navigate('/cart'), (
                  <>
                    <ShoppingCart size={22} />
                    {cartCount > 0 && <span style={{ position: 'absolute', top: 2, right: 2, width: 17, height: 17,
                      borderRadius: '50%', background: '#FF5A1F', color: 'white', fontSize: 10, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cartCount}</span>}
                  </>
                ))}
                {user ? (
                  <>
                    {iconBtn(() => navigate('/orders'), <Package size={22} />)}
                    {user.role === 'admin' && iconBtn(() => navigate('/admin'), (
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
                        background: '#7c3aed33', color: '#c4b5fd' }}>ADMIN</span>
                    ))}
                    {user.role === 'employee' && iconBtn(() => navigate('/employee'), (
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
                        background: '#f59e0b22', color: '#fcd34d' }}>EMPLOYEE</span>
                    ))}
                    {iconBtn(() => navigate('/support'), <SupportIcon size={22} color="white" />)}
                    {iconBtn(() => navigate('/profile'), (
                      <>
                        <User size={22} />
                        <span>{user.name.split(' ')[0]}</span>
                      </>
                    ))}
                  </>
                ) : (
                  <button onClick={() => navigate('/login')} style={{ padding: '8px 18px', background: 'transparent',
                    border: '1px solid white', borderRadius: 4, color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    Sign In
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Nav bar — desktop */}
          <div style={{ background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}>
            <div style={{ maxWidth: 1500, margin: '0 auto', padding: '0 16px',
              display: 'flex', alignItems: 'center', gap: 0, height: 44 }}>
              <button onClick={() => navigate('/products')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FF5A1F', color: 'white',
                  border: 'none', borderRadius: 4, padding: '0 16px', height: 34, fontWeight: 700, fontSize: 13,
                  cursor: 'pointer', flexShrink: 0, marginRight: 4 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ display: 'block', width: 16, height: 2, background: 'white', borderRadius: 1 }} />
                  <span style={{ display: 'block', width: 16, height: 2, background: 'white', borderRadius: 1 }} />
                  <span style={{ display: 'block', width: 16, height: 2, background: 'white', borderRadius: 1 }} />
                </span>
                All Categories
              </button>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflowX: 'auto', scrollbarWidth: 'none', gap: 2 }}>
                {[
                  { label: 'Brands',          path: '/brands' },
                  { label: 'Events & Offers', path: '/events' },
                  { label: 'Flash Sale',      path: '/products?onSale=true&sort=price_asc' },
                  { label: 'New Arrivals',    path: '/products?sort=newest' },
                  { label: 'Top Selling',     path: '/products?sort=popular' },
                  { label: 'Social',          onClick: goToSocial },
                ].map(item => (
                  <button key={item.label} onClick={() => (item.onClick ? item.onClick() : navigate(item.path))}
                    style={{ background: 'none', border: 'none', color: '#d1d5db', fontSize: 13, fontWeight: 500,
                      cursor: 'pointer', padding: '0 14px', height: 44, whiteSpace: 'nowrap', flexShrink: 0,
                      borderBottom: '2px solid transparent', transition: 'all .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderBottomColor = '#FF5A1F'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#d1d5db'; e.currentTarget.style.borderBottomColor = 'transparent'; }}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Mobile top bar — minimal: Hamburger ・ Logo ・ Bell.
              Cart, Wishlist, Account live in the bottom tab bar (the modern
              Amazon/Flipkart pattern), so the top bar can stay clean. */}
          <div style={{ background: '#131921', borderBottom: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', height: 56, gap: 6 }}>
              {/* Hamburger (left) — bigger tap target than before */}
              <button
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                style={{
                  background: 'none', border: 'none', color: 'white', cursor: 'pointer',
                  width: 40, height: 40, display: 'flex', flexDirection: 'column',
                  gap: 5, alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8,
                }}
              >
                <span style={{ display: 'block', width: 22, height: 2, background: 'white', borderRadius: 1 }} />
                <span style={{ display: 'block', width: 22, height: 2, background: 'white', borderRadius: 1 }} />
                <span style={{ display: 'block', width: 22, height: 2, background: 'white', borderRadius: 1 }} />
              </button>

              {/* Logo (center, takes remaining space) */}
              <div
                onClick={() => navigate('/')}
                style={{ cursor: 'pointer', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                <img src="/LOGO.png" alt="TradeEngine" style={{ height: 36, width: 'auto', display: 'block' }} />
              </div>

              {/* Bell (right) — only when logged in */}
              {user ? (
                <div style={{ position: 'relative' }} ref={bellRef}>
                  <button
                    onClick={() => setShowNotifs(v => !v)}
                    aria-label="Notifications"
                    style={{
                      position: 'relative', background: 'none', border: 'none',
                      color: 'white', cursor: 'pointer',
                      width: 40, height: 40, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', borderRadius: 8,
                    }}
                  >
                    <Bell size={22} />
                    {unreadCount > 0 && (
                      <span style={{
                        position: 'absolute', top: 4, right: 4,
                        minWidth: 16, height: 16, padding: '0 4px',
                        borderRadius: 9, background: '#FF5A1F', color: 'white',
                        fontSize: 9, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 0 2px #131921',
                      }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  {showNotifs && <NotificationDropdown onClose={() => setShowNotifs(false)} />}
                </div>
              ) : (
                /* Spacer so the logo stays visually centered when no bell. */
                <div style={{ width: 40, height: 40 }} aria-hidden="true" />
              )}
            </div>

            {/* Mobile search row */}
            <div style={{ padding: '0 12px 10px', position: 'relative' }} ref={searchRef}>
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex' }}>
                <input
                  style={{ flex: 1, height: 40, padding: '0 12px', border: 'none', borderRadius: '4px 0 0 4px',
                    fontSize: 14, outline: 'none', background: 'white', color: '#0f172a' }}
                  placeholder="Search products…"
                  value={query}
                  onChange={handleSearch}
                  onFocus={() => query.trim().length > 1 && setShowResults(true)}
                  autoComplete="off"
                />
                <button type="submit" style={{ height: 40, padding: '0 14px', background: '#FF5A1F',
                  border: 'none', borderRadius: '0 4px 4px 0', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Search size={18} color="white" />
                </button>
              </form>
              {showResults && (
                <div style={{ position: 'absolute', left: 12, right: 12, top: 'calc(100% - 0px)', background: 'white',
                  border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px #00000022', zIndex: 200,
                  overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
                  {results.map(p => (
                    <div key={p._id || p.id} onClick={() => selectResult(p)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                      <div style={{ width: 36, height: 36, background: '#f4f6f8', borderRadius: 6, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {p.images?.[0] ? <img src={p.images[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : '🛍️'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{formatPriceShort(p.price)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </>
      )}
    </nav>
    {isMobile && mobileOpen && (
      <>
        {/* Backdrop — slightly darker for stronger focus on the drawer */}
        <div
          onClick={() => setMobileOpen(false)}
          className="te-drawer-backdrop"
          aria-hidden="true"
        />

        {/* Slide-in drawer. Width is responsive — 84vw on tiny phones, capped
            at 340px on larger devices — so menu labels never get clipped. */}
        <aside
          className="te-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Main navigation"
        >
          {/* Header: avatar / name on left, close button on right. */}
          <div className="te-drawer-head">
            {user ? (
              <div className="te-drawer-userblock">
                <div className="te-drawer-avatar">
                  {user.profileImage ? (
                    <img src={user.profileImage} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span>{(user.name || '?').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="te-drawer-usermeta">
                  <span className="te-drawer-hi">Hello,</span>
                  <strong>{user.name.split(' ')[0]}</strong>
                  {(user.role === 'admin' || user.role === 'employee') && (
                    <span
                      className="te-drawer-rolebadge"
                      style={{
                        background: user.role === 'admin' ? '#7c3aed33' : '#f59e0b22',
                        color:      user.role === 'admin' ? '#c4b5fd' : '#fcd34d',
                      }}
                    >
                      {user.role}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="te-drawer-userblock guest">
                <div className="te-drawer-avatar guest">
                  <span>👋</span>
                </div>
                <div className="te-drawer-usermeta">
                  <span className="te-drawer-hi">Welcome</span>
                  <strong>Sign in for the best deals</strong>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="te-drawer-close"
            >✕</button>
          </div>

          {/* Sign-in CTA right under the header for guests — fastest path. */}
          {!user && (
            <button
              type="button"
              onClick={() => navTo('/login')}
              className="te-drawer-signincta"
            >
              Sign In / Register
            </button>
          )}

          {/* Sections */}
          <div className="te-drawer-body">
            <div className="te-drawer-sectionlabel">Shop</div>
            {[
              { label: 'Home',            icon: HomeIcon,     path: '/',                                       color: '#22d3ee' },
              { label: 'All Products',    icon: ShoppingCart, path: '/products',                               color: '#c4b5fd' },
              { label: 'Brands',          icon: Tags,         path: '/brands',                                 color: '#fbbf24' },
              { label: 'Events & Offers', icon: Sparkles,     path: '/events',                                 color: '#a78bfa' },
              { label: 'Flash Sale',      icon: Zap,          path: '/products?onSale=true&sort=price_asc',    color: '#fb923c' },
              { label: 'New Arrivals',    icon: Sparkles,     path: '/products?sort=newest',                   color: '#60a5fa' },
              { label: 'Top Selling',     icon: Flame,        path: '/products?sort=popular',                  color: '#f97316' },
              { label: 'Social',          icon: Camera,       onClick: goToSocial,                             color: '#ec4899' },
            ].map(item => {
              const Icon = item.icon;
              return (
              <button
                key={item.label}
                type="button"
                onClick={() => (item.onClick ? item.onClick() : navTo(item.path))}
                className="te-drawer-item"
              >
                <span className="te-drawer-itemicon" style={{ color: item.color }} aria-hidden="true">
                  <Icon size={17} strokeWidth={2.1} />
                </span>
                <span className="te-drawer-itemlabel">{item.label}</span>
                <span className="te-drawer-itemchev" aria-hidden="true">›</span>
              </button>
              );
            })}

            {navCats.length > 0 && (
              <>
                <div className="te-drawer-divider" />
                <div className="te-drawer-sectionlabel">Categories</div>
                {navCats.slice(0, 8).map(c => (
                  <button
                    key={c.id || c.name}
                    type="button"
                    onClick={() => navTo(`/products?category=${encodeURIComponent(c.name)}`)}
                    className="te-drawer-item"
                  >
                    <span className="te-drawer-itemicon te-drawer-categoryicon" aria-hidden="true">
                      <DrawerCategoryIcon name={c.name} />
                    </span>
                    <span className="te-drawer-itemlabel">{c.name}</span>
                    <span className="te-drawer-itemchev" aria-hidden="true">›</span>
                  </button>
                ))}
              </>
            )}

            {user && (
              <>
                <div className="te-drawer-divider" />
                <div className="te-drawer-sectionlabel">Your Account</div>
                {[
                  { label: 'My Orders',      icon: '📦', path: '/orders' },
                  { label: 'Wishlist',       icon: '❤️', path: '/wishlist' },
                  { label: 'Profile',        icon: '👤', path: '/profile' },
                  { label: 'Support',        icon: '💬', path: '/support' },
                  ...(user.role === 'admin'    ? [{ label: 'Admin Panel',    icon: '⚙️', path: '/admin'    }] : []),
                  ...(user.role === 'employee' ? [{ label: 'Employee Panel', icon: '🖥️', path: '/employee' }] : []),
                ].map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navTo(item.path)}
                    className="te-drawer-item"
                  >
                    <span className="te-drawer-itemicon" aria-hidden="true">{item.icon}</span>
                    <span className="te-drawer-itemlabel">{item.label}</span>
                    <span className="te-drawer-itemchev" aria-hidden="true">›</span>
                  </button>
                ))}
              </>
            )}
          </div>

          <style>{`
            @keyframes te-drawer-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }
            @keyframes te-drawer-fade { from { opacity: 0; } to { opacity: 1; } }

            .te-drawer-backdrop {
              position: fixed; inset: 0;
              background: rgba(0,0,0,.55);
              z-index: 200;
              animation: te-drawer-fade .18s ease;
            }
            .te-drawer {
              position: fixed; top: 0; bottom: 0; left: 0;
              width: min(84vw, 340px);
              background: linear-gradient(180deg, #131921 0%, #0d1218 100%);
              z-index: 201;
              display: flex;
              flex-direction: column;
              overflow-y: auto;
              overflow-x: hidden;
              animation: te-drawer-in .22s cubic-bezier(.2,.8,.2,1);
              box-shadow: 4px 0 24px rgba(0,0,0,.45);
            }
            .te-drawer-head {
              position: sticky; top: 0; z-index: 2;
              display: flex; align-items: center; justify-content: space-between;
              gap: 12px;
              padding: 16px 14px;
              background: linear-gradient(135deg, #1a2332 0%, #131921 100%);
              border-bottom: 1px solid #2a3445;
            }
            .te-drawer-userblock {
              display: flex; align-items: center; gap: 12px;
              min-width: 0;
              flex: 1;
            }
            .te-drawer-avatar {
              width: 40px; height: 40px;
              border-radius: 50%;
              background: linear-gradient(135deg, #FF5A1F, #e04a0f);
              color: #fff;
              display: flex; align-items: center; justify-content: center;
              font-weight: 800; font-size: 16px;
              flex-shrink: 0;
              overflow: hidden;
            }
            .te-drawer-avatar.guest {
              background: linear-gradient(135deg, #334155, #1e293b);
              font-size: 20px;
            }
            .te-drawer-avatar img { width: 100%; height: 100%; object-fit: cover; }
            .te-drawer-usermeta {
              display: flex; flex-direction: column; gap: 1px;
              min-width: 0;
              line-height: 1.2;
            }
            .te-drawer-hi {
              font-size: 11px; color: #9ca3af;
              text-transform: uppercase; letter-spacing: .08em;
            }
            .te-drawer-usermeta strong {
              color: #fff; font-size: 15px; font-weight: 700;
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
              max-width: 100%;
            }
            .te-drawer-rolebadge {
              align-self: flex-start;
              margin-top: 4px;
              font-size: 9.5px; font-weight: 800;
              padding: 2px 7px; border-radius: 4px;
              text-transform: uppercase; letter-spacing: .04em;
            }
            .te-drawer-close {
              background: rgba(255,255,255,.06);
              border: 1px solid rgba(255,255,255,.08);
              color: #d1d5db; font-size: 16px; line-height: 1;
              padding: 0; cursor: pointer;
              width: 32px; height: 32px;
              border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              flex-shrink: 0;
              transition: background .15s, color .15s;
            }
            .te-drawer-close:hover { background: rgba(255,90,31,.15); color: #FF5A1F; }

            .te-drawer-signincta {
              margin: 14px 14px 4px;
              padding: 12px 14px;
              background: linear-gradient(135deg, #FF5A1F, #e04a0f);
              color: #fff; border: none; border-radius: 10px;
              font-weight: 800; font-size: 14px; letter-spacing: .02em;
              cursor: pointer;
              box-shadow: 0 4px 14px rgba(255,90,31,.35);
            }
            .te-drawer-signincta:active { transform: scale(.98); }

            .te-drawer-body { padding: 8px 0 24px; }
            .te-drawer-sectionlabel {
              padding: 14px 18px 6px;
              font-size: 10.5px; font-weight: 800;
              color: #64748b;
              text-transform: uppercase; letter-spacing: .14em;
            }
            .te-drawer-divider {
              height: 1px; margin: 6px 14px;
              background: linear-gradient(90deg, transparent, #2a3445, transparent);
            }
            .te-drawer-item {
              display: flex; align-items: center; gap: 12px;
              width: 100%;
              padding: 12px 18px;
              background: none; border: none;
              text-align: left; cursor: pointer;
              color: #d1d5db; font-size: 14.5px; font-weight: 500;
              box-sizing: border-box;
              transition: background .12s, color .12s;
            }
            .te-drawer-item:hover,
            .te-drawer-item:active {
              background: rgba(255,255,255,.05);
              color: #fff;
            }
            .te-drawer-itemicon {
              width: 22px; flex-shrink: 0;
              display: inline-flex; align-items: center; justify-content: center;
              font-size: 16px; text-align: center; line-height: 1;
            }
            .te-drawer-categoryicon {
              color: #c4b5fd;
            }
            .te-drawer-itemlabel {
              flex: 1; min-width: 0;
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .te-drawer-itemchev {
              color: #4b5563; font-size: 16px; line-height: 1;
              flex-shrink: 0;
            }
          `}</style>
        </aside>
      </>
    )}
    </>
  );
}
