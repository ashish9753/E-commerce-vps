import client from './client';

export const ordersApi = {
  place: (data) => client.post('/orders', data),
  getMy: (params) => client.get('/orders/my', { params }),
  getById: (id) => client.get(`/orders/${id}`),
  cancel: (id, data = {}) => client.patch(`/orders/${id}/cancel`, data),
  processRefund: (id, formData) => client.patch(`/orders/${id}/process-refund`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};
