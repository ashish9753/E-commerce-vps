import client from './client';

export const employeeApi = {
  getMyProfile:  () => client.get('/employees/me'),
  updateProfile: (data) => client.patch('/employees/me', data),
  uploadShopLogo:(formData) => client.patch('/employees/me/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getMySalary:   () => client.get('/employees/me/salary'),

  getMyProducts: (params) => client.get('/products/employee/my-products', { params }),
  createProduct: (data) => client.post('/products', data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
  updateProduct: (id, data) => client.patch(`/products/${id}`, data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
  deleteProduct: (id) => client.delete(`/products/${id}`),

  getMyOrders:         (params)     => client.get('/orders/employee/my-orders', { params }),
  updateOrderStatus:   (id, data)   => client.patch(`/orders/${id}/employee-status`, data),
};
