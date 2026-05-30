import client from './client';

export const authApi = {
  register: (data) => client.post('/auth/register', data),
  login: (data) => client.post('/auth/login', data),
  logout: () => client.post('/auth/logout'),
  // Refresh token rides in the httpOnly cookie — no body argument needed.
  refreshToken: () => client.post('/auth/refresh-token'),
  forgotPassword: (email) => client.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => client.patch(`/auth/reset-password/${token}`, { password }),
  getMe: () => client.get('/auth/me'),
  // Google sign-in — two-step flow.
  //   googleAuth: verify token. Returns either a logged-in session OR
  //               { needsRegistration: true, profile } for new users.
  //   googleComplete: finish signup for new users with phone/password fields.
  googleAuth: (idToken) => client.post('/auth/google', { idToken }),
  googleComplete: (data) => client.post('/auth/google/complete', data),
};
