/**
 * Lightweight TTL cache + in-flight request dedupe for read-mostly API calls.
 *
 * - cached(key, ttlMs, fetcher): returns cached value if fresh, otherwise
 *   calls fetcher() once (concurrent callers share the promise) and caches it.
 * - invalidate(key): drops a specific cache entry (use after admin mutations).
 * - clearAll(): nukes every cached entry (use on logout / app reset).
 *
 * Values are stored in localStorage under `te_cache_<key>` as `{ t, v }`.
 * On parse / quota failure we fall back to a no-op cache, keeping the network
 * call working but skipping persistence — never throw to the caller.
 */

const PREFIX = 'te_cache_';
const inflight = new Map();

function readEntry(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.t !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeEntry(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    // quota exceeded — silently skip persistence
  }
}

export function getCached(key, ttlMs) {
  const entry = readEntry(key);
  if (!entry) return null;
  if (ttlMs && Date.now() - entry.t > ttlMs) return null;
  return entry.v;
}

export function setCached(key, value) {
  writeEntry(key, value);
}

export function invalidate(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* noop */ }
  inflight.delete(key);
}

export function clearAll() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* noop */ }
  inflight.clear();
}

/**
 * Return cached value if fresh; otherwise call fetcher and cache its result.
 * Concurrent calls for the same key share a single promise (no API spam).
 */
export async function cached(key, ttlMs, fetcher) {
  const fresh = getCached(key, ttlMs);
  if (fresh !== null) return fresh;

  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const value = await fetcher();
      writeEntry(key, value);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
