import client from './client';

export const brandsApi = {
  getAll:      ()         => client.get('/brands'),
  getAllAdmin: ()         => client.get('/brands/all'),
  create:      (data)     => client.post('/brands', data),
  update:      (id, data) => client.patch(`/brands/${id}`, data),
  restore:     (id)       => client.patch(`/brands/${id}/restore`),
  remove:      (id)       => client.delete(`/brands/${id}`),
};

export const categoriesApi = {
  getAll:   ()           => client.get('/categories'),
  create:   (data)       => client.post('/categories', data),
  update:   (id, data)   => client.patch(`/categories/${id}`, data),
  remove:   (id)         => client.delete(`/categories/${id}`),
};

export const attributesApi = {
  getAll:   (params)     => client.get('/attributes', { params }),
  create:   (data)       => client.post('/attributes', data),
  update:   (id, data)   => client.patch(`/attributes/${id}`, data),
  remove:   (id)         => client.delete(`/attributes/${id}`),
};

export const eventsApi = {
  getAll:   ()           => client.get('/events'),
  create:   (data)       => client.post('/events', data),
  update:   (id, data)   => client.patch(`/events/${id}`, data),
  remove:   (id)         => client.delete(`/events/${id}`),
};
