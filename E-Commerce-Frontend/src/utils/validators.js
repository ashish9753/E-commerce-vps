export const validators = {
  required: (v, label = 'This field') => !v?.trim() ? `${label} is required` : null,

  email: (v) => {
    if (!v?.trim()) return 'Email is required';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(v) ? null : 'Enter a valid email address';
  },

  password: (v) => {
    if (!v) return 'Password is required';
    if (v.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(v)) return 'Password must contain at least one uppercase letter';
    if (!/[0-9]/.test(v)) return 'Password must contain at least one number';
    return null;
  },

  confirmPassword: (v, original) => {
    if (!v) return 'Please confirm your password';
    return v === original ? null : 'Passwords do not match';
  },

  // Mobile numbers must be exactly 10 digits.
  phone: (v) => {
    if (!v?.trim()) return 'Phone number is required';
    const cleaned = v.replace(/\D/g, '');
    if (cleaned.length !== 10) return 'Phone number must be exactly 10 digits';
    return null;
  },

  name: (v) => {
    if (!v?.trim()) return 'Name is required';
    return v.trim().length >= 2 ? null : 'Name must be at least 2 characters';
  },

  minLength: (min) => (v) => {
    if (!v?.trim()) return 'This field is required';
    return v.trim().length >= min ? null : `Must be at least ${min} characters`;
  },
};

export function validateForm(fields, rules) {
  const errors = {};
  let isValid = true;

  Object.keys(rules).forEach(field => {
    const rule = rules[field];
    const value = fields[field];
    const error = typeof rule === 'function' ? rule(value) : null;
    if (error) {
      errors[field] = error;
      isValid = false;
    }
  });

  return { isValid, errors };
}

// Strip everything that's not a digit, then cap at 10. Use this in onChange
// handlers so users physically cannot type an 11th character.
export function cleanPhone(v) {
  return String(v ?? '').replace(/\D/g, '').slice(0, 10);
}

// True iff `v` is a 10-digit phone number. Pass to disable buttons /
// for inline-error checks without re-running the full validator.
export function isValidPhone(v) {
  return /^\d{10}$/.test(String(v ?? '').replace(/\D/g, ''));
}

export function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}
