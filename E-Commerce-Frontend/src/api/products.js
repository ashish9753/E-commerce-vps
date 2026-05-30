import client from './client';

export const productsApi = {
  getAll: (params) => client.get('/products', { params }),
  getFeatured: () => client.get('/products/featured'),
  getById: (id) => client.get(`/products/${id}`),
  getBySlug: (slug) => client.get(`/products/slug/${slug}`),
};
