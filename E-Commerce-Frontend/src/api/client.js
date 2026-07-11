import axios from 'axios';

// Single source of truth for the backend URL. Used by every src/api/* module
// (axios baseURL) and by NotificationContext (EventSource). Override via
// VITE_API_BASE_URL in `.env`.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://tradengine.com.np/api/v1';

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

    // A 401 from the auth endpoints themselves is NOT an expired access token,
    // so it must never trigger the refresh-retry dance. A 401 from /auth/login
    // means wrong credentials; from /auth/refresh-token it means the session is
    // genuinely gone. Let the real error surface to the caller (e.g. the login
    // page shows "User not found" instead of "Refresh token required").
    const isAuthEndpoint = /\/auth\/(login|register|refresh-token|google)/.test(original.url || '');
    if (error.response?.status === 401 && isAuthEndpoint) {
      return Promise.reject(error);
    }

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
        // Only sign the user out when the refresh was *definitively* rejected —
        // the server answered 401/403, meaning the refresh session is genuinely
        // gone (logout elsewhere, password reset, staff single-session takeover).
        //
        // A refresh can also fail transiently: no response at all (flaky mobile
        // network, request timeout) or a 5xx while the backend cold-starts. In
        // those cases the session is still valid server-side, so we must NOT
        // kick the user to /login — we keep them signed in and let the next
        // action retry. This transient case (amplified by the short access-token
        // lifetime) was the main reason users were bounced to login "after some
        // time", especially on phones.
        const rStatus = refreshError.response?.status;
        const definitiveAuthFailure = rStatus === 401 || rStatus === 403;
        // A stale request can also fail after the user has already logged in
        // again — only touch auth if the token that failed is still the active one.
        const stillActiveToken = !originalToken || localStorage.getItem('accessToken') === originalToken;
        if (definitiveAuthFailure && stillActiveToken) {
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
