import client from './client';

export const reviewsApi = {
  getForProduct: (productId) => client.get(`/reviews/product/${productId}`),
  create: (data) => client.post('/reviews', data),
  update: (id, data) => client.patch(`/reviews/${id}`, data),
  delete: (id) => client.delete(`/reviews/${id}`),
};
