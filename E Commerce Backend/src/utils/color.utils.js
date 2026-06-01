// Resolve the effective color/price/stock/image for a product + requested color
// name. Single source of truth used by the cart and order flows.
//
// - Color-less product → the product's own price/stock and first image, color "".
// - Colored product → the color is required and must match by name; returns that
//   color's effective price (its discountPrice → price → product fallback), its
//   stock, and its image (falling back to the product's first image).
// Returns null when a colored product is requested with a missing/invalid color.
export const resolveColor = (product, colorName = "") => {
  if (!product.colors || product.colors.length === 0) {
    return {
      color: "",
      price: product.discountPrice || product.price,
      stock: product.stock ?? 0,
      image: product.images?.[0] || "",
    };
  }
  const c = product.colors.find((x) => x.name === colorName);
  if (!c) return null;
  return {
    color: c.name,
    price: c.discountPrice || c.price || product.discountPrice || product.price,
    stock: c.stock ?? 0,
    image: c.image || product.images?.[0] || "",
  };
};

// Build Product.bulkWrite ops that RESTORE stock for cancelled/returned order
// items. Adds back the top-level stock + sold, and — when the line had a color —
// the specific color's stock too (via arrayFilters), keeping per-color and the
// summed total consistent.
export const buildRestockOps = (orderItems = []) =>
  orderItems.map((item) => {
    const update = { $inc: { stock: item.quantity, sold: -item.quantity } };
    const op = { updateOne: { filter: { _id: item.product }, update } };
    if (item.color) {
      update.$inc["colors.$[c].stock"] = item.quantity;
      op.updateOne.arrayFilters = [{ "c.name": item.color }];
    }
    return op;
  });
