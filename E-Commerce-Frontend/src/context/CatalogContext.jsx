import { createContext, useContext, useState, useEffect } from 'react';
import { brandsApi, categoriesApi, eventsApi } from '../api/catalog';
import { cached, invalidate } from '../utils/apiCache';

const CAT_EMOJI = {
  'Air Conditioners': '❄️', 'Refrigerators': '🧊', 'Televisions': '📺',
  'Washing Machines': '🧺', 'Kitchen Appliances': '🍳', 'Laptops': '💻',
  'Smartphones': '📱', 'Gaming': '🎮', 'Audio': '🔊', 'Fans & Coolers': '💨',
  'Microwaves': '📡', 'Cameras': '📷', 'Printers': '🖨️', 'Tablets': '📲',
};
export const getCatEmoji = (name) => CAT_EMOJI[name] || '🛒';

const CatalogContext = createContext(null);

// Catalog data changes infrequently — cache aggressively
const TTL_BRANDS     = 30 * 60 * 1000; // 30 min
const TTL_CATEGORIES = 30 * 60 * 1000; // 30 min
const TTL_EVENTS     = 10 * 60 * 1000; // 10 min (more time-sensitive)

const fetchBrands     = () => brandsApi.getAll().then(r => r.data?.data?.brands || []);
const fetchCategories = () => categoriesApi.getAll().then(r => r.data?.data?.categories || []);
const fetchEvents     = () => eventsApi.getAll().then(r => (r.data?.data?.events || []).filter(e => e.isActive));

export function CatalogProvider({ children }) {
  const [brands, setBrands]         = useState(() => []);
  const [categories, setCategories] = useState(() => []);
  const [events, setEvents]         = useState(() => []);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      cached('brands', TTL_BRANDS, fetchBrands).catch(() => []),
      cached('categories', TTL_CATEGORIES, fetchCategories).catch(() => []),
      cached('events', TTL_EVENTS, fetchEvents).catch(() => []),
    ]).then(([b, c, e]) => {
      if (cancelled) return;
      setBrands(b);
      setCategories(c);
      setEvents(e);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const topCategories = categories.filter(c => !c.parent);
  const subCategories = categories.filter(c => c.parent);
  const getSubcats    = (parentId) => subCategories.filter(c =>
    (c.parent?._id || c.parent) === parentId
  );

  const refresh = () => {
    invalidate('brands');
    invalidate('categories');
    invalidate('events');
    cached('brands', TTL_BRANDS, fetchBrands).then(setBrands).catch(() => {});
    cached('categories', TTL_CATEGORIES, fetchCategories).then(setCategories).catch(() => {});
    cached('events', TTL_EVENTS, fetchEvents).then(setEvents).catch(() => {});
  };

  return (
    <CatalogContext.Provider value={{ brands, categories, topCategories, subCategories, getSubcats, events, loading, refresh }}>
      {children}
    </CatalogContext.Provider>
  );
}

export const useCatalog = () => useContext(CatalogContext);
