import { client } from './client';

export const notesApi = {
  list: () => client.get('/notes', { skipErrorToast: true }),
  create: (note) => client.post('/notes', note),
  delete: (id) => client.delete(`/notes/${id}`),
};
