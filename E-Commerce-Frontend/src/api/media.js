import client from './client';

export const mediaApi = {
  getActive: ()        => client.get('/media/active'),
  getAll:    ()        => client.get('/media'),
  create:    (body)    => client.post('/media', body),
  update:    (id, body) => client.patch(`/media/${id}`, body),
  remove:    (id)      => client.delete(`/media/${id}`),
};
