import { useNavigate } from 'react-router-dom';
import { COMPANY, COMPANY_LINKS } from '../../config/company';
import { useCatalog } from '../../context/CatalogContext';

// Shown only until the real categories load (or if the fetch fails). These are
// the singular names the backend actually stores, so they still filter correctly.
const FALLBACK_SHOP = ['Air Conditioner', 'Refrigerator', 'Television', 'Washing Machine', 'Fan', 'Air Cooler'];

export default function Footer() {
  const navigate = useNavigate();
  const { topCategories } = useCatalog();
  const year = new Date().getFullYear();

  const link = 'block text-sm text-white/75 py-1 transition-colors cursor-pointer hover:text-accent';

  // Build the Shop column from the real top-level categories so a footer click
  // filters correctly — the backend matches the category name exactly, so
  // hardcoded/guessed names (e.g. plural "Air Conditioners") returned nothing.
  const shopCategoryNames = (topCategories.length > 0 ? topCategories.map(c => c.name) : FALLBACK_SHOP).slice(0, 6);
  const shopLinks = shopCategoryNames.map(name => ({
    label: name,
    fn: () => navigate(`/products?category=${encodeURIComponent(name)}`),
  }));

  return (
    <footer className="text-white mt-20" style={{ background: '#131921' }}>
      {/* Back to top — Amazon-style bar, shown on phones */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="hidden max-md:flex w-full items-center justify-center gap-2 py-3.5 text-xs font-semibold tracking-wide text-white/80 bg-white/5 hover:bg-white/10 transition-colors border-b border-white/10"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
        Back to top
      </button>

      <div className="wrap">
        <div className="grid grid-cols-[1.6fr_.8fr_.8fr_1fr] gap-12 py-18 pb-12 max-lg:grid-cols-[1fr_1fr] max-md:grid-cols-2 max-md:gap-x-6 max-md:gap-y-9 max-md:py-10">
          <div className="max-md:col-span-2 max-md:flex max-md:flex-col max-md:items-center max-md:text-center">
            <div className="flex items-center max-md:justify-center">
              <img src="/LOGO.png" alt="TradeEngine" style={{ height: 48, width: 'auto', display: 'block' }} />
            </div>
            <p className="text-white/55 text-sm mt-4.5 max-w-70 leading-relaxed max-md:max-w-sm">
              Nepal's most trusted destination for electronics and home appliances. Quality products, best prices, doorstep delivery.
            </p>
            <div className="flex gap-2 mt-6 max-md:justify-center">
              {[
                { label: 'Facebook', href: 'https://www.facebook.com/tradengin',
                  icon: <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
                { label: 'Instagram', href: 'https://www.instagram.com/trade_ngine',
                  icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg> },
                { label: 'TikTok', href: 'https://www.tiktok.com/@tradengine',
                  icon: <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M21 8.5a6.5 6.5 0 0 1-4.2-1.54v6.79a5.75 5.75 0 1 1-5.75-5.75c.2 0 .4.01.6.03v2.92a2.86 2.86 0 1 0 2.01 2.73V2h2.83a3.67 3.67 0 0 0 .06.67A3.68 3.68 0 0 0 18 5.42 3.65 3.65 0 0 0 21 5.6z"/></svg> },
              ].map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="w-9 h-9 rounded-full bg-white/6 flex items-center justify-center transition-colors hover:bg-accent">{s.icon}</a>
              ))}
            </div>
          </div>

          {[
            { title: 'Shop', links: shopLinks },
            { title: 'Account', links: [
              { label: 'My Profile', fn: () => navigate('/profile') },
              { label: 'My Orders', fn: () => navigate('/orders') },
              { label: 'Wishlist', fn: () => navigate('/wishlist') },
              { label: 'Return Request', fn: () => navigate('/returns') },
              { label: 'Track Order', fn: () => navigate('/track') },
            ]},
            { title: 'Contact', links: [
              { label: `Sales: ${COMPANY.salesPhone}`,     href: COMPANY_LINKS.salesTel },
              { label: `Support: ${COMPANY.supportPhone}`, href: COMPANY_LINKS.supportTel },
              { label: COMPANY.email,                       href: COMPANY_LINKS.emailLink },
              { label: COMPANY.office,                      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(COMPANY.office)}`, external: true },
            ]},
          ].map(col => (
            <div key={col.title}>
              <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-white/50 mb-4.5">{col.title}</div>
              {col.links.map(l => (
                l.fn
                  ? <a key={l.label} className={link} onClick={l.fn}>{l.label}</a>
                  : <a key={l.label} className={link} href={l.href}
                      {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{l.label}</a>
              ))}
              {col.title === 'Contact' && (
                <div className="mt-4 text-xs text-white/40 leading-relaxed">{COMPANY.hours}</div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-white/8 py-6 text-xs text-white/40 flex justify-between items-center max-md:flex-col max-md:items-center max-md:text-center max-md:gap-4">
          <span>© {year} Trade Engine Pvt. Ltd. All rights reserved.</span>
          <div className="flex gap-2.5 items-center max-md:justify-center max-md:flex-wrap">
            {['FONEPAY','COD','Upaya Delivery Service'].map(p => (
              <span key={p} className="px-2.5 py-1 border border-white/12 rounded-md text-[10px] font-bold tracking-[0.06em]">{p}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
