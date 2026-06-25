import client from './client';

export const paymentsApi = {
  // Generate a single-use dynamic Fonepay QR for an order.
  // purpose: 'full' (whole online amount) | 'booking' (COD advance).
  createQr: (orderId, purpose = 'full') =>
    client.post(`/payments/fonepay/${orderId}/qr`, { purpose }, { skipErrorToast: true }),

  // Live payment status — settles the order on success. Poll while the QR is up.
  getStatus: (orderId, purpose = 'full') =>
    client.get(`/payments/fonepay/${orderId}/status`, {
      params: { purpose },
      skipErrorToast: true, // polling — don't spam toasts on transient errors
    }),

  // Banks for the mobile intent flow (optional).
  getBanks: (mobileNo) =>
    client.get('/payments/fonepay/banks', { params: mobileNo ? { mobileNo } : {} }),

  getByOrder: (orderId) => client.get(`/payments/order/${orderId}`),
};
