export function formatPrice(amount) {
  if (amount >= 100000) {
    return (amount / 100000).toFixed(2).replace(/\.00$/, '') + ' Lakh';
  }
  return amount.toLocaleString('en-IN');
}

export function formatPriceShort(amount) {
  return 'Rs. ' + amount.toLocaleString('en-IN');
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function stars(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export function generateOrderId() {
  return 'TE' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
}

export function calcDeliveryCharge(total, deliveryType = 'valley') {
  if (total >= 5000) return 0;
  return deliveryType === 'valley' ? 120 : 250;
}
