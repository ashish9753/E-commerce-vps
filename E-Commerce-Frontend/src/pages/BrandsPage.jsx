import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { brandsApi } from '../api/catalog';
import { toDirectImageUrl } from '../utils/imageUrl';

export default function BrandsPage() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    brandsApi.getAll()
      .then((res) => { if (!cancelled) setBrands(res.data?.data?.brands || []); })
      .catch(() => { if (!cancelled) setBrands([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return brands;
    const q = search.trim().toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, search]);

  /* Group alphabetically — Amazon/Flipkart style brand directory. */
  const grouped = useMemo(() => {
    const map = new Map();
    for (const b of filtered) {
      const k = (b.name?.[0] || '#').toUpperCase();
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(b);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const goToBrand = (name) =>
    navigate(`/products?brand=${encodeURIComponent(name)}`);

  return (
    <div className="wrap">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-soft py-6">
        <a className="text-mute font-medium cursor-pointer hover:text-ink" onClick={() => navigate('/')}>Home</a>
        <span>›</span>
        <span className="text-ink font-semibold">Brands</span>
      </div>

      {/* Hero */}
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-extrabold text-ink leading-tight">Shop by Brand</h1>
          <p className="text-mute text-sm mt-1">Pick a brand to see its products.</p>
        </div>
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brands…"
            className="input w-[260px]"
          />
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="grid grid-cols-6 gap-4 pb-20 max-md:grid-cols-3 max-sm:grid-cols-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse aspect-square bg-surface rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-[60px]">🏷️</div>
          <p className="text-mute mt-2">No brands {search ? `matching “${search}”` : 'available'} yet.</p>
        </div>
      ) : (
        <div className="pb-20 space-y-10">
          {grouped.map(([letter, list]) => (
            <section key={letter}>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-lg font-extrabold text-ink">{letter}</div>
                <div className="h-px bg-line-2 flex-1" />
                <div className="text-xs text-mute">{list.length} brand{list.length === 1 ? '' : 's'}</div>
              </div>
              <div className="grid grid-cols-6 gap-4 max-md:grid-cols-3 max-sm:grid-cols-2">
                {list.map((b) => (
                  <button
                    key={b._id}
                    onClick={() => goToBrand(b.name)}
                    className="group bg-white border border-line-2 rounded-2xl p-4 flex flex-col items-center justify-center aspect-square hover:border-accent hover:shadow-lg transition-all"
                  >
                    {b.logo ? (
                      <img
                        src={toDirectImageUrl(b.logo)}
                        alt={b.name}
                        className="max-h-[60%] max-w-[80%] object-contain mb-2 transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center text-2xl font-extrabold text-mute mb-2">
                        {b.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="text-[13px] font-semibold text-ink text-center line-clamp-2">{b.name}</div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
