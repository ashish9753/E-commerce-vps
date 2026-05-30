import client from './client';

export const notificationsApi = {
  getMy:         (params) => client.get('/notifications', { params }),
  markRead:      (id)     => client.patch(`/notifications/${id}/read`),
  markAllRead:   ()       => client.patch('/notifications/read-all'),
  remove:        (id)     => client.delete(`/notifications/${id}`),
  broadcast:     (data)   => client.post('/notifications/broadcast', data),
  spendPreview:  (params) => client.get('/notifications/spend-preview', { params }),
  streamTicket:  ()       => client.post('/notifications/stream-ticket'),
};
