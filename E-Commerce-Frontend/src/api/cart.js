import client from './client';

export const cartApi = {
  get: () => client.get('/cart'),
  addItem: (productId, quantity = 1, color = '') => client.post('/cart/items', { productId, quantity, color }),
  updateItem: (productId, quantity, color = '') => client.patch('/cart/items', { productId, quantity, color }),
  removeItem: (productId, color = '') => client.delete(`/cart/items/${productId}`, { params: { color } }),
  clear: () => client.delete('/cart'),
  applyCoupon: (code) => client.post('/cart/coupon', { code }),
  removeCoupon: () => client.delete('/cart/coupon'),
};
