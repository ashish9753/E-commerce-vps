import { storage, session } from './storage';

const USERS_KEY = 'users';
const SESSION_KEY = 'auth_session';
const LOGIN_ATTEMPTS_KEY = 'login_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'te_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function generateToken(userId) {
  const payload = { userId, exp: Date.now() + 24 * 60 * 60 * 1000 };
  return btoa(JSON.stringify(payload));
}

function parseToken(token) {
  try {
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

function checkRateLimit(email) {
  const attempts = storage.get(LOGIN_ATTEMPTS_KEY) || {};
  const userAttempts = attempts[email] || { count: 0, lastAttempt: 0 };

  if (Date.now() - userAttempts.lastAttempt > LOCKOUT_DURATION) {
    userAttempts.count = 0;
  }

  if (userAttempts.count >= MAX_ATTEMPTS) {
    const remaining = Math.ceil((LOCKOUT_DURATION - (Date.now() - userAttempts.lastAttempt)) / 60000);
    return { allowed: false, message: `Too many attempts. Try again in ${remaining} minutes.` };
  }

  return { allowed: true };
}

function recordLoginAttempt(email, success) {
  const attempts = storage.get(LOGIN_ATTEMPTS_KEY) || {};
  if (success) {
    delete attempts[email];
  } else {
    const ua = attempts[email] || { count: 0, lastAttempt: 0 };
    ua.count += 1;
    ua.lastAttempt = Date.now();
    attempts[email] = ua;
  }
  storage.set(LOGIN_ATTEMPTS_KEY, attempts);
}

export const authService = {
  async register({ name, email, password, phone = '' }) {
    const users = storage.get(USERS_KEY) || [];
    const exists = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return { success: false, error: 'Email already registered' };

    const hash = await hashPassword(password);
    const user = {
      id: generateId(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      passwordHash: hash,
      createdAt: new Date().toISOString(),
      addresses: [],
    };

    users.push(user);
    storage.set(USERS_KEY, users);

    const token = generateToken(user.id);
    session.set(SESSION_KEY, { token, userId: user.id });

    const { passwordHash, ...safeUser } = user;
    return { success: true, user: safeUser, token };
  },

  async login(email, password) {
    const rateCheck = checkRateLimit(email);
    if (!rateCheck.allowed) return { success: false, error: rateCheck.message };

    const users = storage.get(USERS_KEY) || [];
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

    if (!user) {
      recordLoginAttempt(email, false);
      return { success: false, error: 'Invalid email or password' };
    }

    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) {
      recordLoginAttempt(email, false);
      return { success: false, error: 'Invalid email or password' };
    }

    recordLoginAttempt(email, true);
    const token = generateToken(user.id);
    session.set(SESSION_KEY, { token, userId: user.id });

    const { passwordHash, ...safeUser } = user;
    return { success: true, user: safeUser, token };
  },

  logout() {
    session.remove(SESSION_KEY);
  },

  getCurrentUser() {
    const sessionData = session.get(SESSION_KEY);
    if (!sessionData) return null;

    const payload = parseToken(sessionData.token);
    if (!payload || Date.now() > payload.exp) {
      session.remove(SESSION_KEY);
      return null;
    }

    const users = storage.get(USERS_KEY) || [];
    const user = users.find(u => u.id === payload.userId);
    if (!user) return null;

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  },

  updateProfile(updates) {
    const current = this.getCurrentUser();
    if (!current) return { success: false, error: 'Not authenticated' };

    const users = storage.get(USERS_KEY) || [];
    const idx = users.findIndex(u => u.id === current.id);
    if (idx === -1) return { success: false, error: 'User not found' };

    const allowedFields = ['name', 'phone', 'addresses'];
    allowedFields.forEach(f => {
      if (updates[f] !== undefined) users[idx][f] = updates[f];
    });

    storage.set(USERS_KEY, users);
    const { passwordHash, ...safeUser } = users[idx];
    return { success: true, user: safeUser };
  },

  async changePassword(currentPassword, newPassword) {
    const current = this.getCurrentUser();
    if (!current) return { success: false, error: 'Not authenticated' };

    const users = storage.get(USERS_KEY) || [];
    const idx = users.findIndex(u => u.id === current.id);
    if (idx === -1) return { success: false, error: 'User not found' };

    const hash = await hashPassword(currentPassword);
    if (hash !== users[idx].passwordHash) return { success: false, error: 'Current password is incorrect' };

    users[idx].passwordHash = await hashPassword(newPassword);
    storage.set(USERS_KEY, users);
    return { success: true };
  },
};
