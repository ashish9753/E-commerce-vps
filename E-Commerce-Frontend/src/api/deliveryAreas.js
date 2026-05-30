import client from './client';

export const deliveryAreasApi = {
  // `location` is a city/area name (Nepal doesn't really use pincodes)
  check:       (location) => client.get(`/delivery-areas/check/${encodeURIComponent(location)}`),
  getAll:      ()         => client.get('/delivery-areas'),
  getAllAdmin: ()         => client.get('/delivery-areas/admin/all'),
  create:      (data)     => client.post('/delivery-areas', data),
  update:      (id, data) => client.patch(`/delivery-areas/${id}`, data),
  remove:      (id)       => client.delete(`/delivery-areas/${id}`),
  bulkImport:  (areas)    => client.post('/delivery-areas/bulk', { areas }),
};
