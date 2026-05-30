import client from './client';

export const cartApi = {
  get: () => client.get('/cart'),
  addItem: (productId, quantity = 1) => client.post('/cart/items', { productId, quantity }),
  updateItem: (productId, quantity) => client.patch('/cart/items', { productId, quantity }),
  removeItem: (productId) => client.delete(`/cart/items/${productId}`),
  clear: () => client.delete('/cart'),
  applyCoupon: (code) => client.post('/cart/coupon', { code }),
  removeCoupon: () => client.delete('/cart/coupon'),
};
