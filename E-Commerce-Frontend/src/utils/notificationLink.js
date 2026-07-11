// Turns an order-related notification into a deep link that both opens the
// right Orders view AND pre-searches the specific order, so one click lands
// the user on that exact order.
//
// Notifications are saved with a bare destination link ("/admin", "/orders",
// "/employee"). The order number lives in the message text
// (e.g. "Order #ORD-1783743882733-6466 has been cancelled…"), so we pull it
// out here — which means this also works retroactively on already-saved
// notifications, no backend migration needed.
export function resolveNotificationLink(n) {
  const link = n?.link;
  if (!link) return link;
  // Already order-specific (customer tracking page) — leave it alone.
  if (link.startsWith('/track')) return link;

  // Order numbers look like ORD-1783743882733-6466.
  const orderNo = n?.message?.match(/ORD-[0-9A-Za-z-]+/)?.[0];
  if (!orderNo) return link; // non-order notification → unchanged

  const q = encodeURIComponent(orderNo);
  if (link === '/admin'    || link.startsWith('/admin'))    return `/admin?tab=Orders&search=${q}`;
  if (link === '/orders'   || link.startsWith('/orders'))   return `/orders?search=${q}`;
  if (link === '/employee' || link.startsWith('/employee')) return `/employee?tab=Orders&search=${q}`;
  return link;
}
