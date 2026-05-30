import client from './client';

export const bannersApi = {
  getActive: ()           => client.get('/banners/active'),
  getAll:    ()           => client.get('/banners'),
  create:    (formData)   => client.post('/banners', formData),
  update:    (id, formData) => client.patch(`/banners/${id}`, formData),
  remove:    (id)         => client.delete(`/banners/${id}`),
};
