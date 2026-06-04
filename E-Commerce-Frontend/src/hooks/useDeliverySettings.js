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

function normalize(s) {
  return {
    defaultCharge:        Number(s?.defaultCharge) || 0,
    freeThresholdEnabled: s?.freeThresholdEnabled ?? true,
    freeThreshold:        Number(s?.freeThreshold) || 0,
  };
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
    load().then(c => { if (alive) setCfg(c); });
    return () => { alive = false; };
  }, []);
  return cfg;
}
