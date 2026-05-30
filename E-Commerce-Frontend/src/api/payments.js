import client from './client';

export const paymentsApi = {
  createRazorpayOrder: (data) => client.post('/payments/razorpay/create-order', data),
  createBookingOrder: (data) => client.post('/payments/razorpay/create-booking', data),
  verifyPayment: (data) => client.post('/payments/razorpay/verify', data),
  initiateRefund: (orderId, data) => client.post(`/payments/razorpay/refund/${orderId}`, data),
  getByOrder: (orderId) => client.get(`/payments/order/${orderId}`),
};
