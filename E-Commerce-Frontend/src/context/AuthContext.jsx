import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';
import { usersApi } from '../api/users';
import { getErrorMessage } from '../api/client';
import { clearAll as clearApiCache } from '../utils/apiCache';

const AuthContext = createContext(null);

function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  // `loading` blocks route guards. We only need to actually block when we
  // have a leftover token but no cached user — every other case we already
  // know who the user is (or know we're logged out) from localStorage, so
  // routing can proceed instantly. This avoids the blank-page wait while
  // a sleeping Render backend cold-starts during the initial getMe call.
  const [loading, setLoading] = useState(() => {
    return !!localStorage.getItem('accessToken') && !getStoredUser();
  });

  const logout = useCallback(() => {
    // Backend clears the httpOnly refresh cookie when /auth/logout runs.
    authApi.logout().catch(() => {});
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    clearApiCache(); // drop cached catalog/product data so the next user starts clean
    setUser(null);
  }, []);

  // Listen for token-expiry forced logout
  useEffect(() => {
    const handler = (event) => {
      const failedToken = event.detail?.token;
      if (failedToken && localStorage.getItem('accessToken') !== failedToken) return;
      logout();
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [logout]);

  // Background session validation. Runs on mount but does NOT block routing
  // unless we genuinely had no cached user to fall back on. If the token is
  // invalid the 401-refresh interceptor in client.js handles the cleanup.
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setLoading(false); return; }
    authApi.getMe()
      .then(({ data }) => {
        const u = data.data.user;
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
      })
      .catch(() => {
        // Only clear if we never had a cached user — if we did, trust it and
        // let a *real* 401 on a *real* request trigger the auth:logout path.
        // This stops a transient cold-start failure from kicking people out.
        if (!getStoredUser()) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await authApi.login({ email, password });
      const { user: u, accessToken } = data.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(u));
      setUser(u);
      return { success: true, user: u };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  };

  const register = async ({ name, email, phone, password }) => {
    try {
      const { data } = await authApi.register({ name, email, phone, password });
      const { user: u, accessToken } = data.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(u));
      setUser(u);
      return { success: true, user: u };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  };

  // Google sign-in (step 1). Existing users come back logged in. New users
  // come back with needsRegistration=true and a verified profile preview —
  // the caller routes them to /complete-signup.
  const googleLogin = async (idToken) => {
    try {
      const { data } = await authApi.googleAuth(idToken);
      const payload = data.data;
      if (payload.needsRegistration) {
        return { success: true, needsRegistration: true, profile: payload.profile, idToken };
      }
      const { user: u, accessToken } = payload;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(u));
      setUser(u);
      return { success: true, needsRegistration: false, user: u };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  };

  // Google sign-in (step 2). Creates the account with the user-supplied
  // name/phone/password and the already-verified Google email.
  const googleComplete = async ({ idToken, name, phone, password }) => {
    try {
      const { data } = await authApi.googleComplete({ idToken, name, phone, password });
      const { user: u, accessToken } = data.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(u));
      setUser(u);
      return { success: true, user: u };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  };

  const updateProfile = async (updates) => {
    try {
      const { data } = await usersApi.updateProfile(updates);
      const u = data.data.user;
      setUser(u);
      localStorage.setItem('user', JSON.stringify(u));
      return { success: true, user: u };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await usersApi.changePassword({ currentPassword, newPassword });
      return { success: true };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, googleComplete, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
