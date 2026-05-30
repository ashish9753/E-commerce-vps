import client from './client';

export const adminApi = {
  // Users
  getUsers: (params) => client.get('/users', { params }),
  getUserById: (id) => client.get(`/users/${id}`),
  getUserOrders: (userId, params) => client.get('/orders', { params: { userId, limit: 50, ...params } }),
  blockUser: (id) => client.patch(`/users/${id}/block`),
  deleteUser: (id) => client.delete(`/users/${id}`),

  // Employees
  getEmployees: (params) => client.get('/employees', { params }),
  verifyEmployee: (id) => client.patch(`/employees/${id}/verify`),
  getEmployeeById: (id) => client.get(`/employees/${id}`),
  createEmployee: (data) => client.post('/employees/admin/create', data),
  registerExistingUserAsEmployee: (data) => client.post('/employees/admin/register-existing', data),
  updateEmployee: (id, data) => client.patch(`/employees/${id}`, data),
  blockEmployee: (id) => client.patch(`/employees/${id}/block`),
  deleteEmployee: (id) => client.delete(`/employees/${id}`),
  getEmployeeSalary: (id) => client.get(`/employees/${id}/salary`),
  addSalaryRecord: (id, data) => client.post(`/employees/${id}/salary`, data),
  updateSalaryRecord: (recordId, data) => client.patch(`/employees/salary/${recordId}`, data),
  deleteSalaryRecord: (recordId) => client.delete(`/employees/salary/${recordId}`),

  // Orders
  getOrders: (params) => client.get('/orders', { params }),
  getOrderStats: () => client.get('/orders/admin/stats'),
  updateOrderStatus: (id, data) => client.patch(`/orders/${id}/status`, data),
  forceRefund: (id, data) => client.post(`/orders/${id}/force-refund`, data),

  // Payments
  getPayments: () => client.get('/payments'),

  // Inventory
  getInventoryAnalytics: () => client.get('/inventory/analytics'),
  getLowStock: (threshold) => client.get('/inventory/low-stock', { params: { threshold } }),
  getInventoryLogs: (params) => client.get('/inventory/logs', { params }),
};
