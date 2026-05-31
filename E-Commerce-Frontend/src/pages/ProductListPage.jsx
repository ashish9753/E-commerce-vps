import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ProductCard from '../components/product/ProductCard';
import FilterBar from '../components/product/FilterBar';
import CompareBar from '../components/product/CompareBar';
import { productsApi } from '../api/products';
import { normalizeProducts } from '../utils/normalizers';

const SORT_OPTIONS = [
  { label: 'Popularity', value: 'popular' },
  { label: 'Newest', value: 'newest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Rating', value: 'rating' },
];

// Pagination controls — rendered both above and below the grid.
function Pager({ page, totalPages, onChange, className = '' }) {
  if (totalPages <= 1) return null;
  return (
    <div className={`flex justify-center gap-2 ${className}`}>
      <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => onChange(page - 1)}>← Prev</button>
      <span className="text-sm text-mute self-center">Page {page} of {totalPages}</span>
      <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next →</button>
    </div>
  );
}

export default function ProductListPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Seed the brand filter from ?brand=… so clicking a brand on /brands
  // pre-ticks the matching checkbox in the FilterBar.
  const urlBrand = searchParams.get('brand') || '';
  const [filters, setFilters] = useState({
    brands: urlBrand ? [urlBrand] : [],
    prices: [],
    ratings: [],
  });
  // Sort defaults to whatever the URL says (so /products?sort=newest works
  // from the navbar). Falls back to 'popular' when no sort is given.
  const urlSort = searchParams.get('sort') || 'popular';
  const [sort, setSort] = useState(urlSort);
  // Re-sync local sort when the URL changes (e.g. user clicks another nav link
  // while already on the products page).
  useEffect(() => { setSort(urlSort); }, [urlSort]);
  // Re-sync the brand checkbox when ?brand=… changes (e.g. user navigates from
  // Sony's brand page to Samsung's). Empty URL brand clears just the brand list
  // so other filters the user picked manually stay intact.
  useEffect(() => {
    setFilters((f) => {
      const next = urlBrand ? [urlBrand] : [];
      const same = f.brands.length === next.length && f.brands.every((b, i) => b === next[i]);
      return same ? f : { ...f, brands: next };
    });
  }, [urlBrand]);
  const [showFilter, setShowFilter] = useState(false);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const category = searchParams.get('category') || '';
  const query = searchParams.get('q') || '';
  const onSale = searchParams.get('onSale') === 'true';
  const limit = 18;

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit, sort };
      if (category) params.category = category;
      if (query) params.search = query;
      if (onSale) params.onSale = 'true';
      if (filters.brands.length > 0) params.brand = filters.brands.join(',');

      // Price range: pick the widest span of selected ranges
      if (filters.prices.length > 0) {
        const mins = filters.prices.map((r) => parseInt(r.split('-')[0]));
        const maxs = filters.prices.map((r) => {
          const v = r.split('-')[1];
          return v === 'Infinity' ? undefined : parseInt(v);
        });
        params.minPrice = Math.min(...mins);
        const finite = maxs.filter(Boolean);
        if (finite.length > 0 && finite.length === maxs.length) params.maxPrice = Math.max(...finite);
      }

      if (filters.ratings.length > 0) {
        // handled client-side after fetch for simplicity
      }

      const { data } = await productsApi.getAll(params);
      let normalized = normalizeProducts(data.data?.products || data.data?.data || []);

      // Client-side brand filter — covers multi-brand and backends that only regex-match one brand
      if (filters.brands.length > 0) {
        const lc = filters.brands.map(b => b.toLowerCase());
        normalized = normalized.filter(p => lc.includes((p.brand || '').toLowerCase()));
      }

      // Client-side rating filter
      if (filters.ratings.length > 0) {
        const minRating = Math.min(...filters.ratings.map(Number));
        normalized = normalized.filter((p) => p.rating >= minRating);
      }

      setProducts(normalized);
      // Total count lives under pagination.total (buildPaginatedResponse).
      // Falling back to the page length here is what hid extra pages before.
      setTotal(
        data.data?.pagination?.total ??
        data.data?.total ??
        data.data?.totalItems ??
        normalized.length
      );
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [category, query, sort, filters, page, onSale]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [category, query, sort, filters, onSale]);

  // On page change, jump back to the top so the new page starts from the top
  // of the list instead of leaving the user scrolled at the bottom.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [page]);

  const title = query
    ? `Search: "${query}"`
    : category
    ? category
    : onSale
    ? (sort === 'price_asc' ? 'Flash Sale' : 'Events & Offers')
    : 'All Products';

  return (
    <div className="wrap">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-soft py-6">
        <a className="text-mute font-medium cursor-pointer hover:text-ink" onClick={() => navigate('/')}>Home</a>
        <span>›</span>
        <span className="text-ink font-semibold">{title}</span>
      </div>

      <div className="grid grid-cols-[240px_1fr] gap-9 pb-20 max-md:grid-cols-1">
        <div className={!showFilter ? 'max-md:hidden' : ''}>
          <FilterBar filters={filters} onChange={setFilters} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button className="md:hidden btn btn-ghost btn-sm" onClick={() => setShowFilter(v => !v)}>
                {showFilter ? '✕ Hide Filters' : '⊞ Filters'}
                {!showFilter && (filters.brands.length + filters.prices.length + filters.ratings.length) > 0 &&
                  <span className="tag tag-accent ml-1">{filters.brands.length + filters.prices.length + filters.ratings.length}</span>}
              </button>
              <div className="text-[13px] text-mute">
                Showing <b className="text-ink">{products.length}</b>{total > products.length ? ` of ${total}` : ''} products
                {category && ` in ${category}`}
              </div>
            </div>
            <select className="select w-50" value={sort} onChange={e => setSort(e.target.value)}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Skeletons only on the very first load. For later filter/sort
              changes we keep the current grid visible (just dimmed) so applying
              a filter feels instant instead of a hard page reload. */}
          {loading && products.length === 0 ? (
            <div className="grid grid-cols-3 gap-5 max-md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-surface rounded-2xl mb-3" />
                  <div className="h-3 bg-surface rounded w-1/2 mb-2" />
                  <div className="h-4 bg-surface rounded mb-2" />
                  <div className="h-3 bg-surface rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-[80px]">🔍</div>
              <h3 className="text-2xl font-bold mt-4 mb-2">No products found</h3>
              <p className="text-mute mb-6">Try adjusting your search or filters.</p>
              <button className="btn btn-primary" onClick={() => { setFilters({ brands: [], prices: [], ratings: [] }); navigate('/products'); }}>
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <Pager page={page} totalPages={Math.ceil(total / limit)} onChange={setPage} className="mb-6" />
              <div
                className="grid grid-cols-3 gap-5 max-md:grid-cols-2 transition-opacity duration-200"
                style={{ opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto' }}
              >
                {products.map(p => <ProductCard key={p._id} product={p} />)}
              </div>
              <Pager page={page} totalPages={Math.ceil(total / limit)} onChange={setPage} className="mt-10" />
            </>
          )}
        </div>
      </div>
      <CompareBar />
    </div>
  );
}
