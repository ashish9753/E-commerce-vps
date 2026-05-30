import client from './client';

// All Upaya endpoints go through our backend — the API key lives server-side.
// `skipErrorToast` prevents the global axios interceptor from showing a
// red toast when Upaya is unreachable / not configured — every call site
// already handles failures gracefully (silent fallback to legacy delivery
// areas list).
const opts = { skipErrorToast: true };

export const upayaApi = {
  getLocations:    ()              => client.get('/upaya/locations', opts),
  refreshLocations:()              => client.post('/upaya/locations/refresh', null, opts),
  getLocation:     (id)            => client.get(`/upaya/locations/${id}`, opts),
  getRate:         (body)          => client.post('/upaya/rate', body, opts),
  track:           (ref)           => client.get(`/upaya/track/${encodeURIComponent(ref)}`, opts),

  // Order-scoped — tracking by our internal orderId, retry dispatch
  trackOrder:      (orderId)       => client.get(`/orders/${orderId}/upaya/tracking`, opts),
  retryDispatch:   (orderId, data) => client.post(`/orders/${orderId}/upaya/retry`, data || {}, opts),
};
