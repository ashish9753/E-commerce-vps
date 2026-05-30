import { useNavigate } from 'react-router-dom';

const deals = [
  { label: 'Up to 50% off', sub: 'On Samsung & LG Appliances', visual: '🧊', bg: 'linear-gradient(135deg,#FFF4EE,#FFE0CC)', color: '#c45500', badgeBg: '#FF5A1F', badge: '−50%', link: '/products?category=Refrigerators' },
  { label: 'Up to 30% off', sub: 'Smart TVs — Sony, Samsung, LG', visual: '📺', bg: 'linear-gradient(135deg,#f0f9ff,#dbeafe)', color: '#1d4ed8', badgeBg: '#3b82f6', badge: '−30%', link: '/products?category=Televisions' },
  { label: 'Up to 25% off', sub: 'Laptops & Smartphones', visual: '💻', bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', color: '#166534', badgeBg: '#22c55e', badge: '−25%', link: '/products?category=Laptops' },
  { label: 'DASHAIN50', sub: 'Flat 50% off select appliances', visual: '🪔', bg: 'linear-gradient(135deg,#fefce8,#fef9c3)', color: '#854d0e', badgeBg: '#f59e0b', badge: 'COUPON', link: '/products' },
];

export default function SchemesSection() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
      {deals.map((d, i) => (
        <div key={i} onClick={() => navigate(d.link)}
          style={{ background: d.bg, borderRadius: 8, padding: '18px 16px', cursor: 'pointer',
            boxShadow: '0 1px 3px #0000000d', position: 'relative', overflow: 'hidden', minHeight: 140 }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
          <span style={{ display: 'inline-block', background: d.badgeBg, color: 'white', fontSize: 10,
            fontWeight: 800, padding: '2px 8px', borderRadius: 4, letterSpacing: '.06em', marginBottom: 8 }}>
            {d.badge}
          </span>
          <div style={{ fontWeight: 800, fontSize: 16, color: d.color, lineHeight: 1.2, marginBottom: 4 }}>{d.label}</div>
          <div style={{ fontSize: 11, color: d.color, opacity: .8, marginBottom: 12 }}>{d.sub}</div>
          <div style={{ fontSize: 12, color: d.color, fontWeight: 700 }}>Shop now →</div>
          <span style={{ position: 'absolute', right: -8, bottom: -8, fontSize: 72, lineHeight: 1, opacity: .5, userSelect: 'none' }}>{d.visual}</span>
        </div>
      ))}
    </div>
  );
}
