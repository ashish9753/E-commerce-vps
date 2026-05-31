// Maps a backend product document to a shape the UI can consume uniformly.
export function normalizeProduct(p) {
  if (!p) return null;
  const price = p.discountPrice || p.price || 0;
  const was = p.price || 0;
  const off = was > price ? Math.round(((was - price) / was) * 100) : 0;

  const categoryName =
    typeof p.category === 'object' ? p.category?.name : p.category || '';

  const specs = p.specifications
    ? Object.entries(p.specifications).map(([k, v]) => ({ k, v: String(v) }))
    : [];

  return {
    _id: p._id,
    id: p._id,       // keep both for backward compat
    slug: p.slug,
    name: p.title || p.name || '',
    title: p.title || p.name || '',
    brand: p.brand || '',
    sku: p.sku || '',
    category: categoryName,
    categoryObj: typeof p.category === 'object' ? p.category : null,
    price,
    was,
    off,
    images: Array.isArray(p.images) ? p.images : [],
    rating: p.rating || 0,
    reviews: p.numReviews || 0,
    stock: p.stock ?? 0,
    isFeatured: p.isFeatured || false,
    description: p.description || '',
    shortDescription: p.shortDescription || '',
    specs,
    employee: p.employee || null,
    badge: off >= 20 ? 'sale' : p.isFeatured ? 'featured' : null,
    returnable:   p.returnable !== false,
    returnWindow: p.returnWindow || 7,
  };
}

export function normalizeProducts(arr) {
  return (arr || []).map(normalizeProduct);
}
