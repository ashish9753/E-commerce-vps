import { useState, useEffect } from 'react';
import Header from './Header';
import Footer from './Footer';
import MobileBottomNav from './MobileBottomNav';
import { useCatalog } from '../../context/CatalogContext';
import { couponsApi } from '../../api/coupons';
import { cached } from '../../utils/apiCache';

function AnnouncementBar() {
  const { events } = useCatalog();
  const [coupons, setCoupons] = useState([]);

  useEffect(() => {
    cached(
      'layout:announcementCoupons',
      10 * 60 * 1000,
      () => couponsApi.getPublic()
        .then(({ data }) => data.data?.coupons || [])
    ).then(all => {
      setCoupons(all.slice(0, 3));
    }).catch(() => {});
  }, []);

  const items = [
    ...events.slice(0, 3).map(e => `🎉 ${e.name}${e.discount ? ` — Up to ${e.discount}% OFF` : ''}`),
    ...coupons.map(c => `🏷️ Use code ${c.code} — ${c.discountType === 'PERCENTAGE' ? `${c.discountValue}% off` : `Rs. ${c.discountValue} off`}`),
    '🚚 Free Delivery on orders above Rs. 5,000',
    '🔥 Flash Sale Ends Tonight!',
  ];
  const doubled = [...items, ...items];

  return (
    <div style={{ background: '#0d0d0d', borderBottom: '1px solid #222', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden', padding: '0 24px' }}>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 60, whiteSpace: 'nowrap', animation: 'annBar 30s linear infinite', willChange: 'transform' }}>
          {doubled.map((t, i) => (
            <span key={i} style={{ fontSize: 12, color: '#d1d5db', flexShrink: 0 }}>{t}</span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20, flexShrink: 0, marginLeft: 24 }}>
        {['Track Order', 'Help Center', 'Store Locator'].map(l => (
          <span key={l} style={{ fontSize: 12, color: '#9ca3af', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.color = 'white'}
            onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}>
            {l}
          </span>
        ))}
      </div>
      <style>{`@keyframes annBar { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}

export default function Layout({ children }) {
  // Social content lives only on the dedicated Media page (/social) via
  // SocialMediaPage — no global teaser strip above the footer on other pages.
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <MobileBottomNav />
    </>
  );
}
