const PREFIX = 'te_';

export const storage = {
  get: (key) => {
    try {
      const item = localStorage.getItem(PREFIX + key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch { /* noop */ }
  },
  clear: () => {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch { /* noop */ }
  },
};

export const session = {
  get: (key) => {
    try {
      const item = sessionStorage.getItem(PREFIX + key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch { /* noop */ }
  },
  remove: (key) => {
    try {
      sessionStorage.removeItem(PREFIX + key);
    } catch { /* noop */ }
  },
};
