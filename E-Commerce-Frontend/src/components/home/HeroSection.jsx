import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SLIDES = [
  {
    src: '/Banner1.png',
    offers: [
      { label: 'Up to 40% OFF', sub: 'On Top Electronics', color: '#FF5A1F' },
      { label: 'Free Delivery', sub: 'Orders above Rs. 499', color: '#16a34a' },
      { label: 'No Cost EMI', sub: 'On Select Products', color: '#2563eb' },
    ],
    badge: 'ELECTRONICS',
    cta: { text: 'Shop Electronics', path: '/products?category=Electronics' },
  },
  {
    src: '/Banner2.png',
    offers: [
      { label: 'Up to 35% OFF', sub: 'Home Appliances', color: '#7c3aed' },
      { label: 'Exchange Offer', sub: 'Up to Rs. 15,000 off', color: '#d97706' },
      { label: '1-Year Warranty', sub: 'On All Products', color: '#0891b2' },
    ],
    badge: 'HOME APPLIANCES',
    cta: { text: 'Shop Appliances', path: '/products' },
  },
  {
    src: '/Banner3.png',
    offers: [
      { label: 'New Arrivals', sub: 'Latest Tech Deals', color: '#db2777' },
      { label: 'Easy Returns', sub: '7-Day Return Policy', color: '#059669' },
      { label: 'Secure Pay', sub: '100% Safe Checkout', color: '#1d4ed8' },
    ],
    badge: 'NEW ARRIVALS',
    cta: { text: 'Explore Now', path: '/products' },
  },
];

export default function HeroSection() {
  const [slide, setSlide] = useState(0);
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (hovered) return;
    const id = setInterval(() => setSlide(s => (s + 1) % SLIDES.length), 4500);
    return () => clearInterval(id);
  }, [hovered]);

  const prev = () => setSlide(s => (s - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setSlide(s => (s + 1) % SLIDES.length);
  const cur  = SLIDES[slide];

  return (
    <div
      style={{ background: '#c8d6e0', width: '100%' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Amazon-style: [arrow] [banner] [arrow] ── */}
      <div style={{ display: 'flex', alignItems: 'stretch', width: '100%', height: 'clamp(200px, 38vw, 460px)' }}>

        {/* Left arrow strip */}
        <div style={{
          width: 14, flexShrink: 0,
          background: 'linear-gradient(to right, #c8d6e0, #dbe8ef)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'background .2s',
        }}
          onClick={prev}
          onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(to right,#b0c4cf,#c8d6e0)'}
          onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(to right,#c8d6e0,#dbe8ef)'}
        >
          <span style={{ fontSize: 13, color: '#555', fontWeight: 400, userSelect: 'none' }}>‹</span>
        </div>

        {/* Banner */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', lineHeight: 0 }}>
          {/* Slides */}
          <div style={{
            display: 'flex', height: '100%',
            transform: `translateX(-${slide * 100}%)`,
            transition: 'transform .6s cubic-bezier(.4,0,.2,1)',
          }}>
            {SLIDES.map((sl, i) => (
              <div key={i} style={{ width: '100%', flexShrink: 0, lineHeight: 0 }}>
                <img src={sl.src} alt={`Banner ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            ))}
          </div>

          {/* Left-side gradient for text readability */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: 'linear-gradient(90deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.2) 45%,transparent 100%)',
          }} />

          {/* Bottom fade */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', zIndex: 1, pointerEvents: 'none',
            background: 'linear-gradient(to top,rgba(0,0,0,.65) 0%,transparent 100%)',
          }} />

          {/* Badge + CTA — top-left */}
          <div style={{ position: 'absolute', top: '22%', left: 24, zIndex: 3 }}>
            <div style={{
              display: 'inline-block', background: '#FF5A1F', color: '#fff',
              fontSize: 9, fontWeight: 800, letterSpacing: 2.5,
              padding: '3px 10px', borderRadius: 3, marginBottom: 10,
            }}>
              {cur.badge}
            </div>
            <div>
              <button onClick={() => navigate(cur.cta.path)}
                style={{
                  background: 'rgba(255,255,255,.92)', color: '#111',
                  border: 'none', borderRadius: 4, padding: '7px 18px',
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}>
                {cur.cta.text} →
              </button>
            </div>
          </div>

          {/* Offer chips — bottom-left */}
          <div style={{
            position: 'absolute', bottom: 44, left: 20, zIndex: 3,
            display: 'flex', gap: 7, flexWrap: 'wrap', maxWidth: 520,
          }}>
            {cur.offers.map((o, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(6px)',
                border: `1px solid ${o.color}55`, borderLeft: `3px solid ${o.color}`,
                borderRadius: 5, padding: '5px 10px',
                animation: `fadeInUp .35s ease ${i * .07}s both`,
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 11, color: '#fff', lineHeight: 1.2 }}>{o.label}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.6)', lineHeight: 1.2 }}>{o.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Dots */}
          <div style={{
            position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 5, zIndex: 3,
          }}>
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => setSlide(i)} style={{
                width: i === slide ? 20 : 6, height: 6, borderRadius: 3,
                padding: 0, border: 'none', cursor: 'pointer',
                background: i === slide ? '#FF5A1F' : 'rgba(255,255,255,.35)',
                transition: 'all .3s',
              }} />
            ))}
          </div>
        </div>

        {/* Right arrow strip */}
        <div style={{
          width: 14, flexShrink: 0,
          background: 'linear-gradient(to left, #c8d6e0, #dbe8ef)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'background .2s',
        }}
          onClick={next}
          onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(to left,#b0c4cf,#c8d6e0)'}
          onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(to left,#c8d6e0,#dbe8ef)'}
        >
          <span style={{ fontSize: 13, color: '#555', fontWeight: 400, userSelect: 'none' }}>›</span>
        </div>
      </div>

      <style>{`
        .r-hero { height: clamp(200px, 38vw, 450px); }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
