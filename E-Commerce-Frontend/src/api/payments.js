import client from './client';

export const paymentsApi = {
  // Customer uploads a FonePay payment screenshot for their order.
  // `formData` must contain a `screenshot` file field.
  submitProof: (orderId, formData) => client.post(`/payments/proof/${orderId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  // Admin/employee accept or reject the uploaded screenshot.
  reviewPayment: (orderId, data) => client.patch(`/payments/${orderId}/review`, data),
  getByOrder: (orderId) => client.get(`/payments/order/${orderId}`),
};
