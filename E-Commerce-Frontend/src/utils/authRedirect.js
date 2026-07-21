// Where to send a user once they finish signing in.
//
// A guard or a "Sign in to continue" action bounces the user to /login with
// `state.from` set to the page they were on. Router state alone isn't enough:
// it's lost on a hard reload and on the Google → /register detour, so we also
// mirror the path in sessionStorage. Both sources are read back here.

const KEY = 'postLoginReturnTo';

// Never bounce back to an auth screen (that would loop) or to a staff area.
const BLOCKED = [/^\/login/, /^\/register/, /^\/forgot-password/, /^\/reset-password/, /^\/admin/, /^\/employee/];

function isSafePath(path) {
  // Same-origin, relative paths only — `//evil.com` is a protocol-relative URL.
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return false;
  return !BLOCKED.some(re => re.test(path));
}

// Router location object (or `location.state.from`) → "/path?query#hash".
export function pathFromLocation(loc) {
  if (!loc) return null;
  const path = `${loc.pathname || ''}${loc.search || ''}${loc.hash || ''}`;
  return isSafePath(path) ? path : null;
}

// Call right before navigating to /login so the destination survives a reload.
export function rememberReturnTo(loc) {
  const path = typeof loc === 'string' ? loc : pathFromLocation(loc);
  try {
    if (path && isSafePath(path)) sessionStorage.setItem(KEY, path);
    else sessionStorage.removeItem(KEY);
  } catch { /* storage unavailable — router state still covers the common case */ }
  return path;
}

export function clearReturnTo() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Router state wins (it's the freshest); sessionStorage is the fallback for
// reloads and the Google signup detour.
export function getReturnTo(locationState) {
  const fromState = pathFromLocation(locationState?.from);
  if (fromState) return fromState;
  try {
    const stored = sessionStorage.getItem(KEY);
    return isSafePath(stored) ? stored : null;
  } catch {
    return null;
  }
}

// Final post-login destination. Staff always land on their own dashboard —
// a customer-facing return path is meaningless for them.
export function resolveLoginTarget(user, locationState) {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'admin')    { clearReturnTo(); return '/admin'; }
  if (role === 'employee') { clearReturnTo(); return '/employee'; }
  const target = getReturnTo(locationState) || '/';
  clearReturnTo();
  return target;
}

// Ready-made `navigate('/login', …)` options that also persist the path.
// Defaults to the current URL, so call sites without a `useLocation()` handy
// can just do `navigate('/login', loginNavState())`.
// `state.from` is kept as a plain object — router state must be serializable,
// and a raw `window.location` is not.
export function loginNavState(loc = window.location) {
  const path = rememberReturnTo(loc);
  return { state: { from: path ? { pathname: path, search: '', hash: '' } : null } };
}
