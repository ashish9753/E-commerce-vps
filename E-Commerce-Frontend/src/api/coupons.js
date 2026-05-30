import client from './client';

export const couponsApi = {
  getAll:    (params) => client.get('/coupons', { params }),
  getPublic: ()       => client.get('/coupons/public'),
  create:    (data)   => client.post('/coupons', data),
  update:    (id, data) => client.patch(`/coupons/${id}`, data),
  delete:    (id)     => client.delete(`/coupons/${id}`),
  validate:  (data)   => client.post('/coupons/validate', data),
};
