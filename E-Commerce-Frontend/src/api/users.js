import client from './client';

export const usersApi = {
  getProfile: () => client.get('/users/profile'),
  updateProfile: (data) => client.patch('/users/profile', data),
  changePassword: (data) => client.patch('/users/change-password', data),
  getWishlist: () => client.get('/users/wishlist'),
  toggleWishlist: (productId) => client.patch(`/users/wishlist/${productId}`),
  addAddress: (data) => client.post('/users/addresses', data),
  updateAddress: (id, data) => client.patch(`/users/addresses/${id}`, data),
  deleteAddress: (id) => client.delete(`/users/addresses/${id}`),
  getRefundDetails: () => client.get('/users/refund-details'),
  updateRefundDetails: (data) => client.patch('/users/refund-details', data),
};
