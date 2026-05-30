import axios from 'axios';

// Single source of truth for the backend URL. Used by every src/api/* module
// (axios baseURL) and by NotificationContext (EventSource). Override via
// VITE_API_BASE_URL in `.env`.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'http://82.29.164.26/api/v1';

const BASE_URL = API_BASE_URL;

// withCredentials so the httpOnly refresh-token cookie is sent along with
// /auth/refresh-token requests. The access token still rides in the
// Authorization header on every other request.
export const client = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Attach access token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

// Fire a global toast for any API error with a server message. Non-React
// code (this interceptor) reaches the ToastProvider via a window CustomEvent.
const fireErrorToast = (error) => {
  const status = error.response?.status;
  // 401 has its own retry/logout dance — skip to avoid noise; auth pages
  // surface their own inline error.
  if (status === 401) return;
  // Allow callers to opt out per-request: `client.get(url, { skipErrorToast: true })`
  if (error.config?.skipErrorToast) return;
  const message = error.response?.data?.message || error.message;
  if (!message) return;
  // Pick the right toast tone: warn for permission/validation, error otherwise.
  const type = status === 403 || status === 400 ? 'warn' : 'error';
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  }
};

// Tag returned by the backend when an admin/employee account was used to
// sign in elsewhere — the previously-open browser must be logged out
// immediately, without attempting a refresh (which would also fail).
const SESSION_REPLACED_TAG = 'SESSION_REPLACED';

// On 401: try to refresh, then replay request
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (!original) { fireErrorToast(error); return Promise.reject(error); }

    const originalToken = original.headers?.Authorization?.replace('Bearer ', '') || null;
    const serverMessage = error.response?.data?.message || '';

    // Server-side single-session enforcement: the account was just used to
    // log in on another device. Skip the refresh dance and force a clean
    // logout with a clear toast so the user knows what happened.
    if (error.response?.status === 401 && serverMessage.includes(SESSION_REPLACED_TAG)) {
      localStorage.removeItem('accessToken');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: {
            message: 'Your account was used to sign in elsewhere. You have been logged out.',
            type: 'warn',
          },
        }));
        window.dispatchEvent(new CustomEvent('auth:logout', { detail: { token: originalToken, reason: 'session_replaced' } }));
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return client(original);
        });
      }

      isRefreshing = true;
      try {
        // The refresh token is in an httpOnly cookie — sent automatically via
        // withCredentials. We never see or store it in JS.
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true },
        );
        const newAccess = data.data.accessToken;
        localStorage.setItem('accessToken', newAccess);
        client.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
        processQueue(null, newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return client(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // A stale request can fail after the user has already logged in again.
        // Only clear auth if the token that failed is still the active token.
        if (!originalToken || localStorage.getItem('accessToken') === originalToken) {
          localStorage.removeItem('accessToken');
          window.dispatchEvent(new CustomEvent('auth:logout', {
            detail: { token: originalToken },
          }));
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    fireErrorToast(error);
    return Promise.reject(error);
  }
);

// Helper to extract error message from backend ApiError format
export function getErrorMessage(err) {
  return err?.response?.data?.message || err?.message || 'Something went wrong';
}

export default client;
