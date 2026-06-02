import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AirVent,
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  Camera,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Laptop,
  Monitor,
  PackageCheck,
  Refrigerator,
  ShieldCheck,
  Smartphone,
  Speaker,
  Sparkles,
  Truck,
  Tv,
  WashingMachine,
} from 'lucide-react';
import { productsApi } from '../api/products';
import { couponsApi } from '../api/coupons';
import { bannersApi } from '../api/banners';
import { useCatalog } from '../context/CatalogContext';
import { cached } from '../utils/apiCache';
import { normalizeProducts } from '../utils/normalizers';
import { toDirectImageUrl } from '../utils/imageUrl';

/* Fallback hero slides used until admin uploads real banners. Kept
   intentionally clean — no discount pill, no dark photo overlay — so the
   default storefront still feels polished without making promises the shop
   hasn't actually staged yet. */
const heroSlides = [
  {
    image: '/Banner1.png',
    title: 'Smartphones & audio essentials',
    subtitle: 'Curated picks for everyday tech',
    cta:   'Shop now',
    path:  '/products?category=Electronics',
  },
  {
    image: '/Banner2.png',
    title: 'Appliances for every room',
    subtitle: 'Upgrade your home, one room at a time',
    cta:   'Browse appliances',
    path:  '/products',
  },
  {
    image: '/Banner3.png',
    title: 'Premium gadgets, better prices',
    subtitle: 'Discover what people are loving right now',
    cta:   'See top picks',
    path:  '/products?sort=popular',
  },
];

const categoryIcons = {
  smartphones: Smartphone,
  mobiles: Smartphone,
  laptops: Laptop,
  televisions: Tv,
  tv: Tv,
  refrigerators: Refrigerator,
  'washing machines': WashingMachine,
  'air conditioners': AirVent,
  headphones: Headphones,
  audio: Speaker,
  speakers: Speaker,
  cameras: Camera,
  monitors: Monitor,
};

const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;

function getProductImage(product) {
  return product?.images?.[0] || '';
}

function getDiscountLabel(product, fallback = 'Min. 40% Off') {
  if (product?.off > 0) return `Min. ${product.off}% Off`;
  return fallback;
}

const fmtPrice = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;

function SectionTitle({ children }) {
  return <h2 className="myn-section-title">{children}</h2>;
}

function SectionHeader({ title, link }) {
  const navigate = useNavigate();
  return (
    <div className="myn-section-header">
      <h2 className="myn-section-header-title">{title}</h2>
      {link && (
        <button className="myn-view-all-btn" onClick={() => navigate(link)}>
          View All →
        </button>
      )}
    </div>
  );
}

/* ───────────────────────────── LIVE EVENTS ───────────────────────────── */
// Compact "X left" string for the countdown chip. Resolution drops as the
// remaining window shrinks so the chip stays punchy: days → hours → minutes.
function formatTimeLeft(endDate) {
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) return 'Ending soon';
  const minutes = Math.floor(ms / 60000);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);
  if (days >= 2)  return `${days} days left`;
  if (days === 1) return '1 day left';
  if (hours >= 1) return `${hours}h ${minutes % 60}m left`;
  return `${minutes}m left`;
}

// Deterministic palette per event so the same event always renders the
// same gradient (no flicker on refresh). Indexed by an id-derived hash.
const EVENT_PALETTES = [
  { from: '#fb7185', to: '#be123c' }, // rose
  { from: '#f59e0b', to: '#b45309' }, // amber
  { from: '#0ea5e9', to: '#0c4a6e' }, // sky
  { from: '#10b981', to: '#065f46' }, // emerald
  { from: '#8b5cf6', to: '#5b21b6' }, // violet
  { from: '#ef4444', to: '#7f1d1d' }, // red
];
function paletteFor(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return EVENT_PALETTES[Math.abs(h) % EVENT_PALETTES.length];
}

function LiveEvents({ events }) {
  const navigate = useNavigate();
  // `copiedKey` is the event id of the badge that was just copied — used to
  // swap the "Code: XYZ" pill for a green "✓ Copied!" pill for ~1.5s.
  const [copiedKey, setCopiedKey] = useState(null);

  // Only events that are currently live: server-side "isActive" AND inside
  // the [start, end] window. The Catalog context already filters to
  // isActive=true, but we re-check date so an active-but-not-yet-started
  // event doesn't leak onto the home page.
  const now = Date.now();
  const live = (events || []).filter((ev) => {
    if (ev.isActive === false) return false;
    const start = new Date(ev.startDate).getTime();
    const end   = new Date(ev.endDate).getTime();
    return start <= now && end >= now;
  });
  if (!live.length) return null;       // no live events → no section at all

  // Copy the badge code to the clipboard. e.stopPropagation prevents the
  // surrounding card's "navigate to /products" handler from firing.
  const copyCode = async (e, ev) => {
    e.stopPropagation();
    if (!ev.badge) return;
    const key = ev._id || ev.name;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ev.badge);
      } else {
        // Fallback for older browsers / non-secure contexts (clipboard API
        // is gated behind https + user activation).
        const ta = document.createElement('textarea');
        ta.value = ev.badge;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      // silent — worst case the user sees no feedback and types it manually
    }
  };

  // Keyboard activation for the card (the card is a <div role="button">
  // because we have a nested <button> for copy, which can't live inside a
  // real <button>).
  const onCardKeyDown = (e, fn) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
  };

  return (
    <section className="myn-events-wrap">
      <div className="myn-events-head">
        <div>
          <span className="myn-events-eyebrow">🎉 Live Right Now</span>
          <h2 className="myn-events-title">Festive Events &amp; Schemes</h2>
        </div>
        <button className="myn-events-allbtn" onClick={() => navigate('/products')}>
          View all deals →
        </button>
      </div>

      <div className="myn-events-grid">
        {live.map((ev) => {
          const palette  = paletteFor(ev._id || ev.name);
          const key      = ev._id || ev.name;
          const isCopied = copiedKey === key;
          const goShop   = () => navigate(`/products?event=${encodeURIComponent(ev.badge || ev.name)}`);
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              className="myn-event-card"
              onClick={goShop}
              onKeyDown={(e) => onCardKeyDown(e, goShop)}
            >
              {/* Background: uploaded image overlays the gradient if present */}
              <div className="myn-event-bg"
                style={{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}>
                {ev.image && <img src={ev.image} alt="" className="myn-event-img" />}
                <div className="myn-event-shade" />
              </div>

              {/* Foreground */}
              <div className="myn-event-fg">
                <div className="myn-event-top">
                  <span className="myn-event-countdown">⏰ {formatTimeLeft(ev.endDate)}</span>
                  {ev.discountPercent > 0 && (
                    <span className="myn-event-discount">
                      <strong>{ev.discountPercent}%</strong>
                      <span>OFF</span>
                    </span>
                  )}
                </div>

                <div className="myn-event-body">
                  <h3>{ev.name}</h3>
                  {ev.description && <p>{ev.description}</p>}
                </div>

                <div className="myn-event-foot">
                  {ev.badge && (
                    <button
                      type="button"
                      className={`myn-event-copy ${isCopied ? 'is-copied' : ''}`}
                      onClick={(e) => copyCode(e, ev)}
                      title={isCopied ? 'Copied!' : 'Click to copy code'}
                      aria-label={isCopied ? `Code ${ev.badge} copied` : `Copy code ${ev.badge}`}
                    >
                      {isCopied ? (
                        <>✓ <strong>Copied!</strong></>
                      ) : (
                        <>
                          <span className="myn-event-copy-label">Code:</span>
                          <strong>{ev.badge}</strong>
                          <span className="myn-event-copy-icon" aria-hidden="true">⧉</span>
                        </>
                      )}
                    </button>
                  )}
                  <span className="myn-event-cta">Shop Now →</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HeroMyntraStyle({ banners = [] }) {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();

  // Use admin-managed banners when present, else fall back to the bundled
  // slides. Fallback slides set `clean: true` so the JSX skips the dark
  // photo overlay and offer pill — that decoration is for promotional
  // admin-set banners, not the always-on default.
  const slides = banners.length > 0
    ? banners.map((b) => ({
        _id:        b._id,
        image:      b.image,
        title:      b.title,
        subtitle:   b.subtitle,
        overlay:    b.overlayText,
        cta:        b.ctaLabel ?? '',
        textColor:  b.textColor || '#ffffff',
        textPosition: b.textPosition || 'left',
        fontFamily: b.fontFamily || 'Syne',
        fontSize:   b.fontSize ?? 48,
        fontWeight: b.fontWeight || '800',
        fontStyle:  b.fontStyle || 'normal',
        path:       b.product?._id
                      ? `/product/${b.product._id}`
                      : (b.link || '/products'),
        clean:      false,
      }))
    : heroSlides.map((s) => ({
        image:        s.image,
        title:        s.title,
        subtitle:     s.subtitle,
        overlay:      '',                // no promo pill on defaults
        cta:          s.cta || 'Shop now',
        textColor:    '#0f172a',         // dark text on the (clean) photo
        textPosition: 'left',
        fontFamily:   'Syne',
        fontSize:     48,
        fontWeight:   '800',
        fontStyle:    'normal',
        path:         s.path,
        clean:        true,
      }));

  const current = slides[index % slides.length];

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % slides.length), 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  // Reset to first slide if the list changes
  useEffect(() => { setIndex(0); }, [banners.length]);

  const move = (direction) => {
    setIndex((value) => (value + direction + slides.length) % slides.length);
  };

  if (!current) return null;

  const align = current.textPosition === 'center' ? 'center'
              : current.textPosition === 'right'  ? 'flex-end'
              : 'flex-start';

  return (
    <section className={`myn-hero myn-hero-banner${current.clean ? ' myn-hero-clean' : ''}`}>
      {/* Arrows live INSIDE the image wrapper so they always vertically center
          on the image — on phones the text band sits below the image, and the
          arrows must track the image, not the whole stacked banner. */}
      <div
        className="myn-hero-bgmedia"
        style={{ cursor: 'pointer' }}
        onClick={() => navigate(current.path)}
      >
        <img src={current.image} alt={current.title} />
        <button
          className="myn-hero-arrow left"
          onClick={(e) => { e.stopPropagation(); move(-1); }}
          aria-label="Previous banner"
        >
          <ChevronLeft size={32} strokeWidth={2.5} />
        </button>
        <button
          className="myn-hero-arrow right"
          onClick={(e) => { e.stopPropagation(); move(1); }}
          aria-label="Next banner"
        >
          <ChevronRight size={32} strokeWidth={2.5} />
        </button>
      </div>
      {/* Overlay copy: a transparent layer over the image on desktop, and a
          solid band below the image on phones (see the mobile CSS). */}
      <div
        className="myn-hero-overlay"
        style={{
          color: current.textColor,
          alignItems: align,
          textAlign: current.textPosition,
          fontFamily: `'${current.fontFamily}', sans-serif`,
          fontStyle: current.fontStyle,
          cursor: 'pointer',
        }}
        onClick={() => navigate(current.path)}
      >
        <div className="myn-hero-overlay-inner">
          {current.overlay && <span className="myn-hero-tag">{current.overlay}</span>}
          {current.title && (
            <h1 style={{
              fontFamily: `'${current.fontFamily}', sans-serif`,
              fontSize: `clamp(24px, ${current.fontSize * 0.55}px, ${current.fontSize}px)`,
              fontWeight: current.fontWeight,
              fontStyle: current.fontStyle,
            }}>{current.title}</h1>
          )}
          {current.subtitle && <p>{current.subtitle}</p>}
          {current.cta && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(current.path); }}
              className="myn-hero-cta"
            >
              {current.cta} <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="myn-dots" aria-label="Banner slides">
        {slides.map((slide, slideIndex) => (
          <button
            key={slide._id || slide.title || slideIndex}
            className={slideIndex === index ? 'active' : ''}
            onClick={() => setIndex(slideIndex)}
            aria-label={`Show banner ${slideIndex + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

function HotDeals({ products }) {
  const navigate = useNavigate();
  // Real "hot deals": only discounted items, biggest discount first. Falls back
  // to whatever we have if nothing is on sale, so the section is never empty
  // when there are products to show.
  const onSale = products.filter((p) => p.off > 0).sort((a, b) => b.off - a.off);
  const items = (onSale.length ? onSale : products).slice(0, 15);
  if (!items.length) return null;

  return (
    <section className="hd">
      <div className="hd-head">
        <div className="hd-head-left">
          <span className="hd-flame" aria-hidden="true">🔥</span>
          <div>
            <h2 className="hd-title">Hot Deals</h2>
            <p className="hd-sub">Biggest discounts, limited stock — grab them before they're gone</p>
          </div>
        </div>
        <button className="hd-viewall" onClick={() => navigate('/products?onSale=true&sort=price_asc')}>
          View All →
        </button>
      </div>

      <div className="hd-row">
        {items.map((product) => (
          <button className="hd-card" key={product._id} onClick={() => navigate(`/product/${product._id}`)}>
            {product.off > 0 && <div className="hd-badge">{product.off}% OFF</div>}
            <div className="hd-img">
              {getProductImage(product) ? (
                <img src={getProductImage(product)} alt={product.name} draggable={false} />
              ) : (
                <PackageCheck size={54} />
              )}
            </div>
            <div className="hd-info">
              <span className="hd-brand">{product.brand || product.category || 'Featured'}</span>
              <p className="hd-name">{product.name}</p>
              <div className="hd-price">
                <strong>{fmtPrice(product.price)}</strong>
                {product.was > product.price && <s>{fmtPrice(product.was)}</s>}
              </div>
              {product.was > product.price && (
                <div className="hd-save">You save {fmtPrice(product.was - product.price)}</div>
              )}
            </div>
          </button>
        ))}
      </div>

      <style>{`
        .hd { margin-bottom: 28px; }
        .hd-head {
          display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
          background: linear-gradient(100deg, #ff5a1f 0%, #ff8a3d 55%, #ffb056 100%);
          border-radius: 16px 16px 0 0; padding: 15px 22px;
        }
        .hd-head-left { display: flex; align-items: center; gap: 14px; }
        .hd-flame { font-size: 30px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,.22)); }
        .hd-title { margin: 0; color: #fff; font-family: 'Syne', sans-serif; font-weight: 800;
          font-size: clamp(20px, 2.6vw, 28px); letter-spacing: .01em; }
        .hd-sub { margin: 2px 0 0; color: rgba(255,255,255,.92); font-size: 12.5px; font-weight: 500; }
        .hd-viewall { background: #fff; color: #d9480f; border: 0; font-weight: 800; font-size: 13px;
          padding: 9px 18px; border-radius: 999px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,.14); white-space: nowrap; }
        .hd-viewall:hover { background: #fff3ea; }

        .hd-row {
          display: flex; gap: 14px; overflow-x: auto; padding: 18px;
          background: linear-gradient(180deg, #fff6f0, #fff); border: 1px solid #ffe0cc; border-top: 0;
          border-radius: 0 0 16px 16px; scrollbar-width: none; scroll-snap-type: x mandatory;
        }
        .hd-row::-webkit-scrollbar { display: none; }

        .hd-card {
          position: relative; flex: 0 0 clamp(200px, 19vw, 240px); scroll-snap-align: start;
          background: #fff; border: 1px solid #eee; border-radius: 14px; overflow: hidden; cursor: pointer;
          text-align: left; padding: 0; display: flex; flex-direction: column; transition: transform .18s, box-shadow .18s, border-color .18s;
        }
        .hd-card:hover { transform: translateY(-4px); box-shadow: 0 14px 30px rgba(255,90,31,.18); border-color: #ffd0b3; }

        .hd-badge {
          position: absolute; top: 10px; left: 10px; z-index: 2;
          background: linear-gradient(135deg, #e8222a, #ff5a1f); color: #fff;
          font-weight: 800; font-size: 12px; padding: 5px 10px; border-radius: 8px;
          box-shadow: 0 4px 10px rgba(232,34,42,.35); letter-spacing: .02em;
        }

        .hd-img { height: 240px; background: linear-gradient(135deg,#f3f6f9,#fafafa);
          display: flex; align-items: center; justify-content: center; overflow: hidden; color: #9aa4b2; }
        .hd-img img { width: 100%; height: 100%; object-fit: contain; padding: 14px; }

        .hd-info { padding: 12px 14px 16px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .hd-brand { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: #FF5A1F; }
        .hd-name { margin: 0; font-size: 13px; font-weight: 600; color: #1f2430; line-height: 1.35;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 35px; }
        .hd-price { display: flex; align-items: baseline; gap: 8px; margin-top: 4px; }
        .hd-price strong { font-size: 17px; font-weight: 800; color: #131921; }
        .hd-price s { font-size: 12.5px; color: #9aa4b2; }
        .hd-save { font-size: 11.5px; font-weight: 700; color: #1a7f37; margin-top: 2px; }

        @media (max-width: 640px) {
          .hd-head { padding: 13px 16px; }
          .hd-card { flex: 0 0 64vw; }
          .hd-img { height: 200px; }
        }
      `}</style>
    </section>
  );
}

function MedalBrands({ brands }) {
  const navigate = useNavigate();
  const viewportRef = useRef(null);
  const autoRef = useRef(true);      // is the auto-scroll currently allowed?
  const dragRef = useRef(null);      // active pointer-drag state, or null
  const movedRef = useRef(false);    // did the last pointer interaction drag?
  const resumeRef = useRef(null);    // timer that re-enables auto-scroll

  const list = brands.filter((brand) => brand.isActive !== false);

  // Pad to at least ~10 cards so the strip fills wide screens, then duplicate
  // the whole set. Auto-scroll wraps at the halfway point so it loops with no
  // visible jump; the duplicate also gives the manual drag room on both sides.
  const minItems = Math.max(list.length, 10);
  const base = Array.from({ length: minItems }, (_, i) => list[i % list.length]);
  const loop = list.length ? [...base, ...base] : [];

  // Auto right→left scroll, driven by scrollLeft so the user can also drag the
  // strip by hand (a CSS transform animation would fight manual scrolling).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || !loop.length) return;
    const SPEED = 0.5; // px/frame ≈ the old 38s sweep
    let raf;
    const tick = () => {
      if (autoRef.current && !dragRef.current && !document.hidden) {
        vp.scrollLeft += SPEED;
        const half = vp.scrollWidth / 2;
        if (vp.scrollLeft >= half) vp.scrollLeft -= half; // seamless wrap
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loop.length]);

  useEffect(() => () => clearTimeout(resumeRef.current), []);

  if (!list.length) return null;

  // Keep scrollLeft inside one set so the strip never reaches a hard edge.
  const normalize = (vp) => {
    const half = vp.scrollWidth / 2;
    if (vp.scrollLeft >= half) vp.scrollLeft -= half;
    else if (vp.scrollLeft < 0) vp.scrollLeft += half;
  };

  const scheduleResume = () => {
    clearTimeout(resumeRef.current);
    resumeRef.current = setTimeout(() => { autoRef.current = true; }, 1500);
  };

  const onPointerDown = (e) => {
    const vp = viewportRef.current;
    autoRef.current = false;
    movedRef.current = false;
    // Don't capture the pointer yet — capturing on pointerdown swallows the
    // child card's click, making the logos un-clickable. We only capture once
    // the user actually starts dragging (see onPointerMove).
    dragRef.current = { x: e.clientX, scroll: vp.scrollLeft, pointerId: e.pointerId, captured: false };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const vp = viewportRef.current;
    const dx = e.clientX - d.x;
    if (!d.captured) {
      if (Math.abs(dx) <= 4) return;   // still a tap, not a drag — let the click happen
      d.captured = true;
      movedRef.current = true;
      vp.setPointerCapture?.(d.pointerId);
    }
    vp.scrollLeft = d.scroll - dx;
    normalize(vp);
    d.scroll = vp.scrollLeft + dx; // keep the anchor consistent after a wrap
  };
  const endDrag = (e) => {
    const d = dragRef.current;
    const vp = viewportRef.current;
    if (d?.captured) vp?.releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    scheduleResume();
  };

  // Arrow buttons: nudge by roughly one card and pause auto-scroll briefly.
  const nudge = (dir) => {
    const vp = viewportRef.current;
    autoRef.current = false;
    vp.scrollBy({ left: dir * 210, behavior: 'smooth' });
    scheduleResume();
  };

  return (
    <section>
      <SectionHeader title="Medal Worthy Brands To Bag" link="/brands" />
      <div className="myn-brand-marquee">
        <button className="myn-medal-arrow left" onClick={() => nudge(-1)} aria-label="Previous brands">
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <div
          className="myn-brand-marquee-viewport"
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onMouseEnter={() => { autoRef.current = false; }}
          onMouseLeave={() => { if (!dragRef.current) autoRef.current = true; }}
        >
          <div className="myn-brand-marquee-track">
            {loop.map((brand, i) => (
              <button
                className="myn-medal-card"
                key={`${brand._id || brand.name}-${i}`}
                onClick={() => {
                  if (movedRef.current) { movedRef.current = false; return; } // ignore drag, not a click
                  navigate(`/products?brand=${encodeURIComponent(brand.name)}`);
                }}
                aria-hidden={i >= base.length ? true : undefined}
                tabIndex={i >= base.length ? -1 : undefined}
              >
                <div className="myn-medal-img">
                  {brand.logo ? (
                    <img
                      src={toDirectImageUrl(brand.logo)}
                      alt={brand.name}
                      draggable={false}
                      onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                    />
                  ) : null}
                  <div style={{
                    display: brand.logo ? 'none' : 'flex',
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#FF5A1F22,#FF5A1F44)',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 36, fontWeight: 900, color: '#FF5A1F', letterSpacing: '-1px',
                  }}>
                    {brand.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="myn-medal-copy">
                  <span>{brand.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <button className="myn-medal-arrow right" onClick={() => nudge(1)} aria-label="Next brands">
          <ChevronRight size={22} strokeWidth={2.5} />
        </button>
      </div>
    </section>
  );
}

function ShopByCategory({ categories, products = [] }) {
  const navigate = useNavigate();
  // Paginate ALL categories into pages of 12 (6×2) and let the user swipe /
  // swap left-right between pages. No hardcoded fallback list and no fabricated
  // "% OFF" overlay — the Category model has no offer field.
  const PAGE_SIZE = 12;
  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < categories.length; i += PAGE_SIZE) out.push(categories.slice(i, i + PAGE_SIZE));
    return out;
  }, [categories]);

  const [page, setPage] = useState(0);
  const dragX = useRef(null);
  const pageCount = pages.length;

  // Keep the active page valid if the category list changes.
  useEffect(() => { setPage((p) => (p > pageCount - 1 ? 0 : p)); }, [pageCount]);

  if (!categories.length) return null;

  const getCategoryImage = (categoryName) => {
    const needle = categoryName.toLowerCase();
    const match = products.find(
      (p) => (p.category || '').toLowerCase().includes(needle) || needle.includes((p.category || '').toLowerCase())
    );
    return match ? getProductImage(match) : '';
  };

  const goPrev = () => setPage((p) => (p - 1 + pageCount) % pageCount);
  const goNext = () => setPage((p) => (p + 1) % pageCount);
  const onTouchStart = (e) => { dragX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (dragX.current == null) return;
    const delta = e.changedTouches[0].clientX - dragX.current;
    if (Math.abs(delta) > 40) (delta < 0 ? goNext() : goPrev());
    dragX.current = null;
  };

  return (
    <section>
      <SectionHeader title="Shop By Category" link="/products" />
      <div className="myn-cat-carousel">
        {pageCount > 1 && (
          <button className="myn-cat-arrow left" onClick={goPrev} aria-label="Previous categories">
            <ChevronLeft size={26} strokeWidth={2.5} />
          </button>
        )}
        <div className="myn-cat-viewport" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="myn-cat-track" style={{ transform: `translateX(-${page * 100}%)` }}>
            {pages.map((pageCats, pi) => (
              <div className="myn-category-grid myn-cat-page" key={pi}>
                {pageCats.map((category, index) => {
                  const key = category.name.toLowerCase();
                  const Icon = categoryIcons[key] || categoryIcons[key.replace('&', '').trim()] || PackageCheck;
                  const categoryImg = toDirectImageUrl(category.image) || getCategoryImage(category.name);
                  return (
                    <button
                      className="myn-category-card"
                      key={category._id || category.name}
                      onClick={() => navigate(`/products?category=${encodeURIComponent(category.name)}`)}
                    >
                      <div className={`myn-category-visual tone-${index % 6}`}>
                        {categoryImg ? <img src={categoryImg} alt={category.name} /> : <Icon size={70} strokeWidth={1.5} />}
                      </div>
                      <div className="myn-category-label">
                        <span>{category.name}</span>
                        <p>Shop Now</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {pageCount > 1 && (
          <button className="myn-cat-arrow right" onClick={goNext} aria-label="Next categories">
            <ChevronRight size={26} strokeWidth={2.5} />
          </button>
        )}
      </div>
      {pageCount > 1 && (
        <div className="myn-cat-dots" aria-label="Category pages">
          {pages.map((_, i) => (
            <button key={i} className={i === page ? 'active' : ''} onClick={() => setPage(i)} aria-label={`Category page ${i + 1}`} />
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryProductRow({ category, products }) {
  const navigate = useNavigate();
  const items = (products || []).slice(0, 12);
  if (!items.length) return null;

  return (
    <section>
      <SectionHeader
        title={category.name}
        link={`/products?category=${encodeURIComponent(category.name)}`}
      />
      <div className="myn-brand-row">
        {items.map((product) => (
          <button className="myn-star-card" key={product._id} onClick={() => navigate(`/product/${product._id}`)}>
            <div className="myn-star-img">
              {getProductImage(product) ? (
                <img src={getProductImage(product)} alt={product.name} />
              ) : (
                <PackageCheck size={58} />
              )}
            </div>
            <div className="myn-star-offer">
              <span>{product.brand || category.name}</span>
              <p>{product.name}</p>
              {product.price > 0 && (
                <div className="myn-star-price">
                  {fmtPrice(product.price)}
                  {product.was > product.price && <s>{fmtPrice(product.was)}</s>}
                </div>
              )}
              <strong>{getDiscountLabel(product)}</strong>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function CouponStrip({ coupons }) {
  const [copied, setCopied] = useState('');
  if (!coupons.length) return null;

  const copyCoupon = (code) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(''), 1800);
  };

  return (
    <section className="myn-coupons">
      <div>
        <BadgePercent size={22} />
        <span>Deal Desk</span>
        <strong>Extra savings on electronics and appliances</strong>
      </div>
      <div className="myn-coupon-list">
        {coupons.slice(0, 4).map((coupon) => (
          <button key={coupon._id || coupon.code} onClick={() => copyCoupon(coupon.code)}>
            <span>{coupon.code}</span>
            <strong>
              {coupon.discountType === 'PERCENTAGE'
                ? `${coupon.discountValue}% OFF`
                : `${money(coupon.discountValue)} OFF`}
            </strong>
            {coupon.discountType === 'PERCENTAGE' && coupon.maximumDiscount > 0 && (
              <em>Grab up to {money(coupon.maximumDiscount)} OFF</em>
            )}
            <small>{copied === coupon.code ? 'Copied' : 'Tap to copy'}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function TrustBand() {
  const items = [
    { icon: Truck, title: 'Fast Delivery', text: 'Quick shipping on top cities' },
    { icon: ShieldCheck, title: 'Secure Checkout', text: 'Protected payments every time' },
    { icon: PackageCheck, title: 'Easy Returns', text: 'Simple returns on eligible items' },
  ];

  return (
    <section className="myn-trust-band">
      {items.map(({ icon: Icon, title, text }) => (
        <div key={title}>
          <Icon size={26} />
          <span>{title}</span>
          <p>{text}</p>
        </div>
      ))}
    </section>
  );
}

export default function HomePage() {
  const { brands, topCategories, events } = useCatalog();
  const [products, setProducts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [banners, setBanners] = useState([]);
  const [categoryProducts, setCategoryProducts] = useState({});

  useEffect(() => {
    cached(
      'home:myntraStyleProducts',
      10 * 60 * 1000,
      () => productsApi.getAll({ sort: 'popular', limit: 36 })
        .then(({ data }) => normalizeProducts(data.data?.products || data.data?.data || [])),
    ).then(setProducts).catch(() => {});

    couponsApi.getPublic()
      .then(({ data }) => setCoupons(data.data?.coupons || []))
      .catch(() => {});

    bannersApi.getActive()
      .then(({ data }) => setBanners(data.data?.banners || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!topCategories.length) return;
    topCategories.forEach((cat) => {
      cached(
        `home:catrow:${cat.name}`,
        10 * 60 * 1000,
        () => productsApi.getAll({ category: cat.name, sort: 'popular', limit: 12 })
          .then(({ data }) => normalizeProducts(data.data?.products || data.data?.data || [])),
      ).then((prods) => {
        if (prods.length > 0) {
          setCategoryProducts((prev) => ({ ...prev, [cat.name]: prods }));
        }
      }).catch(() => {});
    });
  }, [topCategories]);

  return (
    <main className="myn-home">
      <HeroMyntraStyle banners={banners} />
      <LiveEvents events={events} />
      <CouponStrip coupons={coupons} />
      <div className="myn-content">
        <HotDeals products={products} />
        <MedalBrands brands={brands} />
        <ShopByCategory categories={topCategories} products={products} />
        {topCategories.map((cat) => (
          <CategoryProductRow
            key={cat._id || cat.name}
            category={cat}
            products={categoryProducts[cat.name]}
          />
        ))}
        <TrustBand />
      </div>

      <style>{`
        .myn-home {
          min-height: 100vh;
          background: #ffffff;
          color: #202436;
        }

        .myn-hero {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1.9fr) minmax(320px, .9fr);
          /* Lock the hero to a fixed height so a different image's intrinsic
             size — or longer slide copy on the right — can't reflow the rest
             of the page when the carousel auto-rotates. */
          height: clamp(330px, 38vw, 510px);
          background: #f7f6f4;
          overflow: hidden;
          /* contain: tells the browser that nothing inside this section can
             affect layout, paint, or style of anything outside it. Cheap and
             effective firewall against the auto-slide jitter. */
          contain: layout paint style;
        }

        /* Banner-style hero — full-width image with text overlay (Amazon-style).
           Admin banners are authored at ~1200×400 (3:1), so we size the hero to
           that same 3:1 ratio rather than a fixed height. This way object-fit:
           cover has nothing to crop and the artwork stays fully visible while
           scaling proportionally on big screens. max-height keeps it from
           growing absurdly tall on ultra-wide monitors (a 1920px-wide hero is
           exactly 640px tall at 3:1, so 1080p/1440p screens show the full art). */
        .myn-hero-banner {
          display: block;
          height: auto;
          aspect-ratio: 3 / 1;
          max-height: 640px;
          min-height: 300px;
        }

        .myn-hero-bgmedia {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .myn-hero-bgmedia img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: opacity .35s ease;
        }
        /* No full-image darkening — keep the banner artwork crisp and real.
           A soft gradient sits only behind the text safe-zone (left third)
           so admin overlay text stays legible without dimming the product. */
        .myn-hero-bgmedia::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(0,0,0,.28) 0%, rgba(0,0,0,.05) 30%, transparent 55%);
          pointer-events: none;
        }
        .myn-hero-overlay {
          position: absolute;
          inset: 0;
          z-index: 2;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 5vw 6vw;
          text-shadow: 0 2px 12px rgba(0,0,0,.55);
        }
        /* Inner wrapper groups the tag/title/subtitle/CTA so they can be given
           a contained, readable backdrop on small screens (where overlay text
           would otherwise merge into artwork that already contains text). */
        .myn-hero-overlay-inner {
          display: flex;
          flex-direction: column;
          gap: 14px;
          align-items: inherit;
          text-align: inherit;
          max-width: 100%;
        }
        .myn-hero-overlay h1 {
          margin: 0;
          max-width: 620px;
          font-family: 'Syne', Georgia, serif;
          font-weight: 800;
          font-size: clamp(28px, 4.2vw, 58px);
          line-height: 1.02;
        }
        .myn-hero-overlay p {
          margin: 0;
          max-width: 540px;
          font-size: clamp(13px, 1.4vw, 18px);
          font-weight: 500;
          opacity: .96;
        }
        .myn-hero-tag {
          display: inline-block;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .18em;
          text-transform: uppercase;
          background: rgba(0,0,0,.35);
          padding: 5px 12px;
          border-radius: 999px;
          backdrop-filter: blur(6px);
        }
        .myn-hero-cta {
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 44px;
          padding: 0 22px;
          border: 0;
          border-radius: 999px;
          background: #f97316;
          color: #fff;
          font-weight: 800;
          font-size: 14px;
          letter-spacing: .04em;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(0,0,0,.25);
          font: inherit;
          font-weight: 800;
        }
        .myn-hero-banner .myn-hero-overlay[style*="flex-end"] .myn-hero-cta { align-self: flex-end; }
        .myn-hero-banner .myn-hero-overlay[style*="center"] .myn-hero-cta   { align-self: center; }

        /* ── Clean default banner ──
           When the storefront falls back to bundled slides (no admin banners
           uploaded yet) we drop the dark photo gradient + text shadow so the
           product photography reads as professional product imagery, not a
           promo poster. Title gets a wider cap so a phrase like
           "Smartphones & audio essentials" doesn't break mid-line. */
        .myn-hero-clean .myn-hero-bgmedia::after { display: none; }
        .myn-hero-clean .myn-hero-overlay        { text-shadow: none; }
        .myn-hero-clean .myn-hero-overlay-inner  { gap: 10px; }
        /* Cap the title to the left "safe zone" of the photo so it wraps
           naturally instead of running into the product imagery on the right. */
        .myn-hero-clean .myn-hero-overlay h1     { max-width: min(440px, 42%); letter-spacing: -0.01em; font-size: clamp(24px, 3.2vw, 44px); line-height: 1.08; }
        .myn-hero-clean .myn-hero-overlay p      { max-width: min(380px, 38%); opacity: .78; }
        .myn-hero-clean .myn-hero-cta            { box-shadow: 0 4px 12px rgba(249,115,22,.18); }

        .myn-hero-media {
          min-width: 0;
          background: #edf1f4;
          /* The image is absolutely positioned inside so a swap to a
             different aspect ratio doesn't push the grid track around. */
          position: relative;
          overflow: hidden;
        }

        .myn-hero-media img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          /* Soft crossfade when src swaps — the browser paints the new image
             over the old one for 350ms. Stops the "snap" the user reads as
             shaking even when no layout actually shifts. */
          transition: opacity .35s ease;
        }

        .myn-hero-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          gap: 22px;
          padding: 54px 6vw 74px 52px;
          background: linear-gradient(90deg, #ffffff 0%, #fbfaf8 100%);
          border-left: 1px solid #ece7df;
          /* Allow flex children to shrink below their content size and clip
             overflow so a long title can't push the hero taller. */
          min-width: 0;
          min-height: 0;
          overflow: hidden;
        }

        /* Clamp the title to 3 lines so a longer slide name can't change the
           column's height between slides. */
        .myn-hero-copy h1 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .myn-hero-copy p {
          margin: 0;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: .24em;
          text-transform: uppercase;
          color: #0f766e;
        }

        .myn-hero-copy h1 {
          margin: 0;
          max-width: 470px;
          font-size: clamp(34px, 4vw, 64px);
          line-height: .96;
          font-family: Georgia, 'Times New Roman', serif;
          font-weight: 500;
          color: #171923;
        }

        .myn-hero-copy strong {
          font-size: clamp(24px, 2.3vw, 38px);
          font-family: Georgia, 'Times New Roman', serif;
          font-weight: 500;
          color: #55545c;
        }

        .myn-hero-copy button,
        .myn-star-card,
        .myn-medal-card,
        .myn-category-card,
        .myn-coupon-list button {
          font: inherit;
        }

        .myn-hero-copy button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 42px;
          padding: 0;
          border: 0;
          border-top: 1px solid #dfdedb;
          background: transparent;
          color: #71717a;
          font-weight: 800;
          cursor: pointer;
        }

        /* Amazon-style clean chevron arrows — circular, semi-transparent,
           floating just inside the banner edges. No solid gray block. */
        .myn-hero-arrow {
          position: absolute;
          top: 50%;
          z-index: 4;
          width: 46px;
          height: 46px;
          border-radius: 50%;
          border: 0;
          background: rgba(255, 255, 255, .55);
          color: #1a1a1a;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, .18);
          transition: background .2s, box-shadow .2s, transform .15s;
        }
        .myn-hero-arrow:hover {
          background: rgba(255, 255, 255, .95);
          box-shadow: 0 4px 14px rgba(0, 0, 0, .28);
        }

        .myn-hero-arrow.left  { left: 16px;  transform: translateY(-50%); }
        .myn-hero-arrow.right { right: 16px; transform: translateY(-50%); }
        .myn-hero-arrow.left:hover  { transform: translateY(-50%) scale(1.08); }
        .myn-hero-arrow.right:hover { transform: translateY(-50%) scale(1.08); }

        .myn-dots {
          position: absolute;
          left: 50%;
          bottom: 18px;
          transform: translateX(-50%);
          display: flex;
          gap: 12px;
          z-index: 5;
        }

        .myn-dots button {
          width: 9px;
          height: 9px;
          border: 0;
          border-radius: 50%;
          background: #d7d8dd;
          padding: 0;
          cursor: pointer;
        }

        .myn-dots button.active { background: #8c909a; }

        .myn-content {
          max-width: 1560px;
          margin: 0 auto;
          padding: 44px 0 60px;
        }

        .myn-section-title {
          margin: 38px 38px 100px;
          font-size: clamp(26px, 2.5vw, 38px);
          line-height: 1.1;
          letter-spacing: .22em;
          text-transform: uppercase;
          font-weight: 800;
          color: #30384f;
        }

        /* Section header with title + View All button */
        .myn-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 38px 38px 20px;
        }
        .myn-section-header-title {
          font-size: clamp(22px, 2.2vw, 32px);
          line-height: 1.1;
          letter-spacing: .18em;
          text-transform: uppercase;
          font-weight: 800;
          color: #30384f;
          margin: 0;
        }
        .myn-view-all-btn {
          background: transparent;
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          cursor: pointer;
          font-family: inherit;
          transition: background .15s, border-color .15s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .myn-view-all-btn:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .myn-brand-row,
        .myn-medal-row {
          display: flex;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          gap: 10px;
          padding-bottom: 22px;
        }

        /* ── Brands marquee: auto right→left scroll the user can also drag ── */
        .myn-brand-marquee {
          position: relative;
          padding-bottom: 22px;
        }
        .myn-brand-marquee-viewport {
          overflow-x: auto;
          overflow-y: hidden;
          cursor: grab;
          scrollbar-width: none;        /* Firefox */
          -ms-overflow-style: none;     /* IE/Edge */
          touch-action: pan-y;          /* let our pointer handler own horizontal */
          /* Soft fade at both edges so cards appear/disappear gracefully. */
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent);
          mask-image: linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent);
        }
        .myn-brand-marquee-viewport::-webkit-scrollbar { display: none; } /* Chrome/Safari */
        .myn-brand-marquee-viewport:active { cursor: grabbing; }
        .myn-brand-marquee-track {
          display: flex;
          gap: 10px;
          width: max-content;
        }
        .myn-brand-marquee .myn-medal-card { flex: 0 0 200px; }
        /* Don't let logos hijack the drag as a native image drag. */
        .myn-brand-marquee-viewport img { user-select: none; -webkit-user-drag: none; }

        /* Manual swap arrows, matching the category carousel controls. */
        .myn-medal-arrow {
          position: absolute;
          top: calc(50% - 11px);
          transform: translateY(-50%);
          z-index: 2;
          width: 40px;
          height: 40px;
          border: 0;
          border-radius: 50%;
          background: #fff;
          color: #1f2937;
          box-shadow: 0 2px 10px #0000002e;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .myn-medal-arrow.left { left: 4px; }
        .myn-medal-arrow.right { right: 4px; }
        .myn-medal-arrow:hover { background: #f3f4f6; }

        @media (prefers-reduced-motion: reduce) {
          .myn-brand-marquee-viewport { scroll-behavior: auto; }
        }

        /* Rising Stars: horizontal carousel so all items are reachable by
           scrolling sideways instead of being squeezed into a fixed grid. */
        .myn-brand-row {
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
        }

        /* Keep the original card size: 5 across filling the row. Once there are
           more than 5 items they overflow and the row scrolls sideways. */
        .myn-brand-row .myn-star-card {
          flex: 0 0 max(240px, calc((100% - 40px) / 5));
          scroll-snap-align: start;
        }

        .myn-medal-row .myn-medal-card {
          flex: 0 0 max(200px, calc((100% - 50px) / 6));
          scroll-snap-align: start;
        }

        .myn-star-card,
        .myn-medal-card {
          border: 0;
          background: #fff;
          padding: 0;
          text-align: center;
          cursor: pointer;
          min-width: 0;
        }

        .myn-star-img,
        .myn-medal-img {
          height: 330px;
          background: linear-gradient(135deg, #dfeaf0, #fafafa);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          color: #566176;
        }

        .myn-medal-img { height: 260px; }

        .myn-star-img img,
        .myn-medal-img img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 22px;
          transition: transform .25s ease;
        }

        .myn-star-card:hover img,
        .myn-medal-card:hover img,
        .myn-category-card:hover img,
        .myn-category-card:hover svg {
          transform: scale(1.04);
        }

        .myn-star-offer,
        .myn-medal-copy {
          margin: -64px 12px 0;
          min-height: 126px;
          position: relative;
          background: rgba(255, 255, 255, .94);
          border: 1px solid #e6e3df;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 16px 12px;
          box-shadow: 0 3px 12px rgba(19, 22, 31, .12);
        }

        .myn-medal-copy {
          margin: 0;
          min-height: 116px;
          border: 0;
          box-shadow: none;
          align-items: flex-start;
          text-align: left;
          padding: 16px;
        }

        .myn-star-offer span,
        .myn-medal-copy span {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: #202436;
        }

        .myn-star-offer p,
        .myn-medal-copy p {
          margin: 7px 0 5px;
          color: #1f2937;
          font-size: 16px;
          line-height: 1.25;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .myn-star-price {
          margin: 2px 0 6px;
          display: flex;
          gap: 8px;
          align-items: baseline;
          justify-content: center;
          font-size: 18px;
          font-weight: 800;
          color: #13161f;
        }

        .myn-star-price s {
          font-size: 13px;
          font-weight: 600;
          color: #98a1ad;
        }

        .myn-star-offer strong,
        .myn-medal-copy strong {
          font-size: 26px;
          line-height: 1.1;
          color: #050505;
        }

        .myn-medal-copy strong {
          font-size: 20px;
        }

        .myn-category-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(130px, 1fr));
          gap: 46px 42px;
          padding: 0 68px 20px;
        }

        /* ── Shop-by-category carousel (paged 12 per view, swipe / arrows) ── */
        .myn-cat-carousel { position: relative; }
        .myn-cat-viewport { overflow: hidden; }
        .myn-cat-track {
          display: flex;
          transition: transform .45s cubic-bezier(.4, 0, .2, 1);
        }
        .myn-cat-page {
          flex: 0 0 100%;
          width: 100%;
        }
        .myn-cat-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 4;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid #e6e7eb;
          background: #ffffff;
          color: #1a1a1a;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0, 0, 0, .12);
          transition: background .2s, box-shadow .2s, transform .15s;
        }
        .myn-cat-arrow:hover { box-shadow: 0 6px 18px rgba(0, 0, 0, .2); }
        .myn-cat-arrow.left  { left: 14px; }
        .myn-cat-arrow.right { right: 14px; }
        .myn-cat-arrow.left:hover  { transform: translateY(-50%) scale(1.06); }
        .myn-cat-arrow.right:hover { transform: translateY(-50%) scale(1.06); }
        .myn-cat-dots {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 6px;
        }
        .myn-cat-dots button {
          width: 8px;
          height: 8px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: #d7d8dd;
          cursor: pointer;
          transition: width .25s, background .25s;
        }
        .myn-cat-dots button.active { width: 22px; border-radius: 4px; background: #f97316; }

        .myn-category-card {
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
          min-width: 0;
        }

        .myn-category-visual {
          aspect-ratio: 1 / 1.18;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          color: #fff;
        }

        .myn-category-visual img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
          background: #fff;
          transition: transform .25s ease;
        }

        .myn-category-visual svg {
          transition: transform .25s ease;
        }

        .tone-0 { background: #1f6f78; }
        .tone-1 { background: #8a3f2d; }
        .tone-2 { background: #5b6f47; }
        .tone-3 { background: #31568a; }
        .tone-4 { background: #8d2244; }
        .tone-5 { background: #6a553f; }

        .myn-category-label {
          margin: -84px 10px 0;
          min-height: 106px;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 12px 8px;
          background: rgba(193, 70, 37, .9);
          color: #fff;
          text-align: center;
        }

        .myn-category-label span {
          font-size: 18px;
          line-height: 1.15;
          font-weight: 800;
        }

        .myn-category-label strong {
          margin-top: 6px;
          font-size: 25px;
          line-height: 1;
          font-family: Georgia, 'Times New Roman', serif;
          font-weight: 500;
        }

        .myn-category-label p {
          margin: 7px 0 0;
          font-size: 16px;
          font-weight: 700;
        }

        .myn-coupons {
          display: grid;
          grid-template-columns: minmax(240px, .55fr) minmax(0, 1.45fr);
          gap: 18px;
          align-items: center;
          max-width: 1480px;
          margin: 22px auto 0;
          padding: 14px 22px;
          background: #252b3d;
          color: #fff;
        }

        .myn-coupons > div:first-child {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .myn-coupons span {
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .myn-coupons strong {
          color: rgba(255, 255, 255, .78);
          font-size: 13px;
          font-weight: 700;
        }

        .myn-coupon-list {
          display: grid;
          grid-template-columns: repeat(4, minmax(130px, 1fr));
          gap: 10px;
        }

        .myn-coupon-list button {
          min-width: 0;
          border: 1px dashed rgba(255, 255, 255, .36);
          background: rgba(255, 255, 255, .08);
          color: #fff;
          padding: 9px 12px;
          text-align: left;
          cursor: pointer;
        }

        .myn-coupon-list button span,
        .myn-coupon-list button strong,
        .myn-coupon-list button em,
        .myn-coupon-list button small {
          display: block;
        }

        .myn-coupon-list button em {
          color: rgba(255, 255, 255, .82);
          font-size: 11px;
          font-style: normal;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .myn-coupon-list button strong {
          color: #fff;
          font-size: 17px;
          margin: 3px 0;
        }

        .myn-coupon-list button small {
          color: rgba(255, 255, 255, .58);
          font-size: 11px;
        }

        .myn-trust-band {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          margin: 42px 38px 0;
          background: #e7e8ec;
        }

        .myn-trust-band div {
          min-height: 120px;
          background: #fafafa;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 7px;
          text-align: center;
          padding: 18px;
          color: #30384f;
        }

        .myn-trust-band span {
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
          font-size: 13px;
        }

        .myn-trust-band p {
          margin: 0;
          color: #666b78;
          font-size: 13px;
        }

        @media (max-width: 1180px) {
          .myn-brand-row,
          .myn-medal-row {
            padding: 0 18px 20px;
          }

          .myn-section-header { margin: 32px 18px 16px; }

          .myn-category-grid {
            grid-template-columns: repeat(4, minmax(140px, 1fr));
            padding: 0 28px 20px;
            gap: 32px 24px;
          }
        }

        @media (max-width: 820px) {
          .myn-hero {
            /* Stack on mobile: image row above, copy row below. Override the
               desktop fixed height so the two rows can each have a sane size
               instead of squeezing into 330px together. */
            grid-template-columns: 1fr;
            grid-template-rows: clamp(190px, 52vw, 300px) auto;
            height: auto;
          }

          /* On phones we show the WHOLE uploaded banner — no cropping. Instead
             of a fixed height + object-fit: cover (which zooms/crops the art),
             we let the image flow in at its natural size so the banner box
             takes the image's exact height. Works for any aspect ratio the
             admin uploads. */
          .myn-hero-banner {
            height: auto;
            aspect-ratio: auto;
            min-height: 0;
            max-height: none;
          }
          /* The image normally sits absolutely (inset:0). Put it back in flow on
             phones so it defines the banner's height — full image, no crop. */
          .myn-hero-banner .myn-hero-bgmedia {
            position: relative;
          }
          .myn-hero-banner .myn-hero-bgmedia img {
            position: relative;
            width: 100%;
            height: auto;
            object-fit: contain;
          }
          /* Text now lives in a band BELOW the image, not over it, so the
             over-image fade is no longer needed. */
          .myn-hero-banner .myn-hero-bgmedia::after {
            display: none;
          }

          /* Move the offer text + Shop Now button OUT of the artwork and into a
             solid band pinned directly beneath the full image (the "down side"
             of the banner). position:static makes the overlay flow below the
             in-flow image instead of covering it — so the image is never hidden
             and the copy reads as a clean promo bar. */
          .myn-hero-banner .myn-hero-overlay {
            position: static;
            inset: auto;
            justify-content: flex-start;
            padding: 13px 16px 15px;
            background: #131921;
            color: #fff !important;
            text-shadow: none;
          }
          /* Lay the band out in two columns — offer copy on the left, the Shop
             Now button on the right (vertically centered) — so the empty
             right-hand space is used instead of stacking everything on the left.
             The button spans all text rows in the right column via grid areas.
             Higher-specificity selector so it also wins over the :not(.clean)
             rule that styled the floating card. */
          .myn-hero-banner .myn-hero-overlay .myn-hero-overlay-inner,
          .myn-hero-banner:not(.myn-hero-clean) .myn-hero-overlay-inner {
            display: grid;
            grid-template-columns: 1fr auto;
            grid-template-areas:
              "tag   cta"
              "title cta"
              "sub   cta";
            align-items: center;
            justify-items: start;
            column-gap: 14px;
            row-gap: 3px;
            width: 100%;
            max-width: 100%;
            background: none;
            border-radius: 0;
            box-shadow: none;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            padding: 0;
          }
          .myn-hero-banner .myn-hero-tag       { grid-area: tag; }
          .myn-hero-banner .myn-hero-overlay h1 { grid-area: title; }
          .myn-hero-banner .myn-hero-overlay p  { grid-area: sub; }
          .myn-hero-banner .myn-hero-cta {
            grid-area: cta;
            align-self: center;
            justify-self: end;
            margin: 0;
            white-space: nowrap;
          }
          .myn-hero-banner .myn-hero-overlay h1 {
            font-size: clamp(15px, 4.4vw, 22px) !important;
            line-height: 1.12 !important;
            max-width: 100%;
          }
          .myn-hero-banner .myn-hero-overlay p {
            font-size: 11.5px;
            max-width: 100%;
          }
          .myn-hero-banner .myn-hero-tag {
            font-size: 10px;
            padding: 3px 9px;
          }
          .myn-hero-banner .myn-hero-cta {
            height: 32px;
            padding: 0 14px;
            font-size: 11.5px;
            gap: 4px;
          }
          .myn-hero-banner .myn-hero-cta svg {
            width: 14px;
            height: 14px;
          }

          .myn-hero-copy {
            padding: 22px 22px 56px;
            border-left: 0;
            border-top: 1px solid #ece7df;
            gap: 14px;
          }

          .myn-hero-copy h1 {
            font-size: clamp(22px, 6vw, 32px);
            max-width: 100%;
            line-height: 1.08;
          }

          .myn-hero-copy strong {
            font-size: clamp(18px, 4.5vw, 26px);
          }

          /* Arrows now live inside the image wrapper, so the base top:50%
             centers them on the image itself — no fixed pixel offset needed,
             and they stay centered whatever the image's height. */
          .myn-hero-arrow {
            top: 50%;
          }

          /* Dots get their own strip BELOW the text band — never over the
             image. The dark background matches the band so the copy, button and
             dots read as one continuous footer. */
          .myn-dots {
            position: static;
            top: auto;
            bottom: auto;
            left: auto;
            transform: none;
            justify-content: center;
            width: 100%;
            padding: 9px 0 11px;
            background: #131921;
          }

          .myn-section-title {
            margin: 34px 18px 42px;
            letter-spacing: .14em;
          }

          .myn-section-header { margin: 28px 16px 14px; }

          .myn-brand-row,
          .myn-medal-row {
            padding: 0 16px 18px;
          }

          .myn-star-card,
          .myn-medal-card {
            width: 260px;
            flex: 0 0 260px;
          }

          /* Tighter brand cards in the marquee on phones. */
          .myn-brand-marquee .myn-medal-card {
            width: 150px;
            flex: 0 0 150px;
          }

          .myn-star-img {
            height: 260px;
          }

          .myn-medal-img {
            height: 220px;
          }

          .myn-category-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 24px 14px;
            padding: 0 16px 20px;
          }

          /* On phones the side arrows would cover the 2-column cards — rely on
             swipe + dots instead. */
          .myn-cat-arrow { display: none; }

          .myn-coupons {
            grid-template-columns: 1fr;
            margin: 12px 12px 0;
          }

          .myn-coupon-list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .myn-trust-band {
            grid-template-columns: 1fr;
            margin: 28px 16px 0;
          }
        }

        @media (max-width: 520px) {
          .myn-hero-arrow {
            width: 38px;
            height: 38px;
          }
          .myn-hero-arrow.left  { left: 10px; }
          .myn-hero-arrow.right { right: 10px; }

          .myn-category-label {
            margin: -74px 8px 0;
            min-height: 96px;
          }

          .myn-category-label span {
            font-size: 15px;
          }

          .myn-category-label strong {
            font-size: 20px;
          }

          .myn-category-label p {
            font-size: 13px;
          }
        }

        /* ─────────────── Live Events / Schemes ─────────────── */
        .myn-events-wrap {
          max-width: 1560px;
          margin: 0 auto;
          padding: 36px 38px 8px;
        }
        .myn-events-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }
        .myn-events-eyebrow {
          display: inline-block;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .22em;
          text-transform: uppercase;
          color: #d97706;
          margin-bottom: 6px;
        }
        .myn-events-title {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-weight: 500;
          font-size: clamp(24px, 2.4vw, 36px);
          color: #171923;
        }
        .myn-events-allbtn {
          background: transparent;
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          cursor: pointer;
          transition: background .15s, border-color .15s;
        }
        .myn-events-allbtn:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }
        .myn-events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }
        .myn-event-card {
          position: relative;
          border: 0;
          padding: 0;
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          min-height: 220px;
          text-align: left;
          box-shadow: 0 6px 18px rgba(15, 23, 42, .12);
          transform: translateZ(0);
          transition: transform .25s ease, box-shadow .25s ease;
        }
        .myn-event-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 28px rgba(15, 23, 42, .22);
        }
        .myn-event-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
        }
        .myn-event-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: .55;
          mix-blend-mode: luminosity;
        }
        .myn-event-shade {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.55) 100%),
            radial-gradient(circle at top right, rgba(255,255,255,.18), transparent 55%);
        }
        .myn-event-fg {
          position: relative;
          z-index: 1;
          height: 100%;
          min-height: 220px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 18px 20px;
          color: #fff;
        }
        .myn-event-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }
        .myn-event-countdown {
          background: rgba(0,0,0,.4);
          border: 1px solid rgba(255,255,255,.25);
          backdrop-filter: blur(4px);
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: .04em;
        }
        .myn-event-discount {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          line-height: 1;
          background: rgba(255,255,255,.95);
          color: #b91c1c;
          border-radius: 10px;
          padding: 6px 10px;
        }
        .myn-event-discount strong {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: -.02em;
        }
        .myn-event-discount span {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .18em;
          margin-top: 2px;
        }
        .myn-event-body h3 {
          margin: 18px 0 6px;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -.01em;
          line-height: 1.15;
        }
        .myn-event-body p {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          opacity: .88;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .myn-event-foot {
          margin-top: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        /* Copy-code pill — a real button so it has its own click/keyboard
           handling separate from the card's "Shop Now" navigation.        */
        .myn-event-copy {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          color: #fff;
          background: rgba(255,255,255,.18);
          border: 1px dashed rgba(255,255,255,.55);
          border-radius: 6px;
          padding: 5px 9px;
          letter-spacing: .04em;
          cursor: pointer;
          transition: background .15s, border-color .15s, transform .1s;
          font-family: inherit;
        }
        .myn-event-copy:hover {
          background: rgba(255,255,255,.28);
          border-color: rgba(255,255,255,.85);
        }
        .myn-event-copy:active {
          transform: scale(.97);
        }
        .myn-event-copy:focus-visible {
          outline: 2px solid #fff;
          outline-offset: 2px;
        }
        .myn-event-copy strong {
          font-weight: 800;
          font-family: 'SF Mono', Menlo, monospace;
        }
        .myn-event-copy-label {
          opacity: .85;
        }
        .myn-event-copy-icon {
          font-size: 13px;
          opacity: .9;
          margin-left: 2px;
        }
        .myn-event-copy.is-copied {
          background: rgba(34, 197, 94, .25);
          border-color: rgba(187, 247, 208, .9);
          border-style: solid;
          color: #ecfdf5;
        }
        .myn-event-card[role="button"] {
          cursor: pointer;
        }
        .myn-event-card[role="button"]:focus-visible {
          outline: 3px solid #f97316;
          outline-offset: 3px;
        }
        .myn-event-cta {
          margin-left: auto;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: .04em;
        }
        @media (max-width: 720px) {
          .myn-events-wrap { padding: 24px 16px 4px; }
          .myn-events-head { flex-direction: column; align-items: flex-start; }
          .myn-events-allbtn { align-self: stretch; text-align: center; }
        }
      `}</style>
    </main>
  );
}
