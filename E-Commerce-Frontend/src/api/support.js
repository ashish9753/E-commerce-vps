import client from './client';

export const supportApi = {
  createTicket:  (data)     => client.post('/support', data),
  getMyTickets:  (params)   => client.get('/support/my', { params }),
  getTicket:     (id)       => client.get(`/support/${id}`),
  replyToTicket: (id, data) => client.post(`/support/${id}/reply`, data),
  // admin
  getAllTickets:  (params)   => client.get('/support', { params }),
  updateStatus:  (id, data) => client.patch(`/support/${id}/status`, data),
};
