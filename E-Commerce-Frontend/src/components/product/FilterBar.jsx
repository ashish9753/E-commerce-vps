import { X } from 'lucide-react';
import { useCatalog } from '../../context/CatalogContext';

const FALLBACK_BRANDS = ['Samsung', 'LG', 'Sony', 'Bosch', 'Philips', 'Apple', 'Xiaomi', 'JBL', 'Asus'];
const PRICE_RANGES = [
  { label: 'Under Rs. 10,000', min: 0, max: 10000 },
  { label: 'Rs. 10,000 – 30,000', min: 10000, max: 30000 },
  { label: 'Rs. 30,000 – 60,000', min: 30000, max: 60000 },
  { label: 'Rs. 60,000 – 1,00,000', min: 60000, max: 100000 },
  { label: 'Above Rs. 1,00,000', min: 100000, max: Infinity },
];
const RATINGS = [4, 3, 2];

export default function FilterBar({ filters, onChange }) {
  const { brands: apiBrands, categories: apiCategories } = useCatalog();
  const BRANDS = apiBrands.length > 0 ? apiBrands.map(b => b.name) : FALLBACK_BRANDS;
  // Category options — de-duplicated by name so a product can always be
  // narrowed to its category. Single-select (see toggle below).
  const CATEGORIES = [...new Set((apiCategories || []).map(c => c.name).filter(Boolean))];
  // Single-select filter keys: the backend supports only one value for these,
  // so picking a new option replaces the previous one and clicking the active
  // option clears it. Brand/rating stay multi-select.
  const SINGLE = ['prices', 'categories'];
  const toggle = (key, val) => {
    const cur = filters[key] || [];
    const next = SINGLE.includes(key)
      ? (cur.includes(val) ? [] : [val])
      : (cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]);
    onChange({ ...filters, [key]: next });
  };

  const clearAll = () => onChange({ brands: [], prices: [], ratings: [], categories: [] });
  const activeCount = (filters.brands?.length || 0) + (filters.prices?.length || 0) + (filters.ratings?.length || 0) + (filters.categories?.length || 0);

  const Section = ({ title, items, filterKey }) => (
    <div className="border-t border-line py-5">
      <div className="text-[11px] font-bold uppercase tracking-widest text-mute mb-3">{title}</div>
      {items.map(({ key, label }) => {
        const on = (filters[filterKey] || []).includes(key);
        return (
          <div key={key} className={`flex items-center gap-2.5 py-1.25 cursor-pointer text-[13px] ${on ? '' : ''}`} onClick={() => toggle(filterKey, key)}>
            <div className={`w-4 h-4 border-[1.5px] rounded-sm shrink-0 flex items-center justify-center text-[11px] transition-all ${on ? 'bg-ink border-ink text-white' : 'border-line-2 bg-white'}`}>
              {on && '✓'}
            </div>
            <span className={on ? 'text-ink font-semibold flex-1' : 'text-mute flex-1'}>{label}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="sticky top-32.5 self-start max-h-[calc(100vh-9rem)] overflow-y-auto pr-1 -mr-1">
      <div>
        <h4 className="text-base font-bold mb-2 flex justify-between items-center">
          Filters {activeCount > 0 && <span className="tag tag-accent">{activeCount}</span>}
          {activeCount > 0 && <button className="text-[11px] text-accent font-semibold bg-transparent border-0 cursor-pointer" onClick={clearAll}>Clear all</button>}
        </h4>

        <Section title="Brand" filterKey="brands" items={BRANDS.map(b => ({ key: b, label: b }))} />
        {CATEGORIES.length > 0 && (
          <Section title="Category" filterKey="categories" items={CATEGORIES.map(c => ({ key: c, label: c }))} />
        )}
        <Section title="Price Range" filterKey="prices" items={PRICE_RANGES.map(r => ({ key: `${r.min}-${r.max}`, label: r.label }))} />
        <Section title="Minimum Rating" filterKey="ratings" items={RATINGS.map(r => ({ key: String(r), label: `${'★'.repeat(r)} & above` }))} />
      </div>
    </div>
  );
}
