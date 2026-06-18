import { useState, useEffect } from 'react';
import { settingsApi } from '../api/settings';

// Mirrors the backend's DEFAULT_DELIVERY so the UI has a sensible value before
// (or if) the network request resolves.
export const DELIVERY_DEFAULTS = {
  defaultCharge: 50,
  freeThresholdEnabled: true,
  freeThreshold: 500,
};

// Module-level cache + in-flight promise so every consumer (product page,
// promise bar, announcement ticker, …) shares ONE network request per session
// instead of each refetching.
let _cache = null;
let _inflight = null;
// Mounted consumers, so a settings change can be pushed live (the CartProvider
// is mounted once at the app root and would otherwise never refetch).
const _subscribers = new Set();

function normalize(s) {
  return {
    defaultCharge:        Number(s?.defaultCharge) || 0,
    freeThresholdEnabled: s?.freeThresholdEnabled ?? true,
    freeThreshold:        Number(s?.freeThreshold) || 0,
  };
}

// Call after the admin/employee saves Delivery Settings so customer-facing
// surfaces (cart, checkout, product page, banners) pick up the new values
// without a hard page reload. Without this the stale module cache would keep
// showing the old charge/threshold for the rest of the SPA session.
export function invalidateDeliverySettings() {
  _cache = null;
  _inflight = null;
  // Refetch right away and push the fresh values to every mounted consumer so
  // cart/checkout totals update live, without waiting for a remount or reload.
  load().then((cfg) => { _subscribers.forEach((fn) => fn(cfg)); });
}

function load() {
  if (_cache) return Promise.resolve(_cache);
  if (_inflight) return _inflight;
  _inflight = settingsApi.getDeliverySettings()
    .then(r => {
      const s = r.data?.data?.deliverySettings;
      _cache = s ? normalize(s) : DELIVERY_DEFAULTS;
      return _cache;
    })
    .catch(() => DELIVERY_DEFAULTS)
    .finally(() => { _inflight = null; });
  return _inflight;
}

// Returns the current delivery settings, falling back to defaults until loaded.
export function useDeliverySettings() {
  const [cfg, setCfg] = useState(_cache || DELIVERY_DEFAULTS);
  useEffect(() => {
    let alive = true;
    const sub = (c) => { if (alive) setCfg(c); };
    _subscribers.add(sub);
    load().then(c => { if (alive) setCfg(c); });
    return () => { alive = false; _subscribers.delete(sub); };
  }, []);
  return cfg;
}
