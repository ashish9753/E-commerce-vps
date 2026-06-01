import { useCatalog } from '../../context/CatalogContext';

const FALLBACK = ['Samsung', 'LG', 'Sony', 'Bosch', 'Philips', 'Apple', 'Xiaomi', 'JBL', 'Asus', 'IFB', 'Prestige', 'Atomberg'];
export default function BrandStrip() {
  const { brands } = useCatalog();
  const list = brands.length > 0 ? brands.map(b => b.name) : FALLBACK;
  const doubled = [...list, ...list];

  return (
    <div style={{ background: 'white', borderRadius: 8, padding: '14px 0', marginBottom: 12,
      boxShadow: '0 1px 3px #0000000d', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 40, alignItems: 'center' }} className="animate-marquee">
        {doubled.map((b, i) => (
          <span key={i} style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: 13, fontWeight: 600,
            color: '#9ca3af', letterSpacing: '.04em' }}>{b}</span>
        ))}
      </div>
    </div>
  );
}
