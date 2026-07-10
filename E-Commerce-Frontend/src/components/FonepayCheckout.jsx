import { useState, useEffect, useRef, useCallback } from 'react';
import { paymentsApi } from '../api/payments';
import { getErrorMessage } from '../api/client';
import { formatPriceShort } from '../utils/formatters';

/**
 * Fonepay Checkout Intent panel.
 *
 * Requests a single-use dynamic QR for `orderId`/`purpose`, renders it, and
 * polls the backend for live status. The backend settles the order the moment
 * Fonepay confirms (driven by both a server-side WebSocket and this poll), so
 * when status flips to SUCCESS we fire `onSuccess`.
 *
 *   purpose = 'full'    → whole online order amount
 *   purpose = 'booking' → COD non-refundable advance
 */
const POLL_MS = 3000;
const DEFAULT_TTL_SEC = 300; // QR stays active for 5 minutes, then auto-expires

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function FonepayCheckout({
  orderId,
  purpose = 'full',
  amount,
  accent = '#e2117b',
  ttlSeconds = DEFAULT_TTL_SEC,
  onSuccess,
  onCancel,
}) {
  const [phase, setPhase] = useState('loading'); // loading | waiting | success | failed | unavailable | expired
  const [qr, setQr] = useState(null);            // { qrImage, prn, amount }
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(ttlSeconds); // seconds left before the QR expires
  const pollRef = useRef(null);
  const doneRef = useRef(false);                 // guard against double onSuccess
  const expiryRef = useRef(0);                   // absolute expiry time (ms)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const succeed = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    stopPolling();
    setPhase('success');
    setTimeout(() => onSuccess?.(), 900);
  }, [onSuccess]);

  const generate = useCallback(async () => {
    setPhase('loading');
    setError('');
    try {
      const { data } = await paymentsApi.createQr(orderId, purpose);
      // Customer may have already paid on a previous visit/QR — the backend
      // reconciles and tells us, so we go straight to success.
      if (data.data?.alreadyPaid) { succeed(); return; }
      setQr(data.data);
      expiryRef.current = Date.now() + ttlSeconds * 1000;
      setRemaining(ttlSeconds);
      setPhase('waiting');
    } catch (err) {
      if (err?.response?.status === 503) {
        setPhase('unavailable');
        setError('Online payment is temporarily unavailable. Please try again shortly.');
      } else {
        setPhase('failed');
        setError(getErrorMessage(err));
      }
    }
  }, [orderId, purpose, succeed]);

  // Initial QR generation.
  useEffect(() => { generate(); }, [generate]);

  // Poll for live status while we're waiting for the customer to pay.
  const checkStatus = useCallback(async () => {
    if (doneRef.current) return;
    try {
      const { data } = await paymentsApi.getStatus(orderId, purpose);
      const status = data.data?.status;
      if (status === 'SUCCESS') {
        succeed();
      } else if (status === 'FAILED') {
        stopPolling();
        setPhase('failed');
        setError(data.data?.message || 'The payment did not go through. Please try again.');
      }
    } catch { /* transient — keep polling */ }
  }, [orderId, purpose, succeed]);

  // Countdown → auto-expire the QR when the timer runs out (stops polling and
  // shows an expired state so the customer can generate a fresh QR).
  useEffect(() => {
    if (phase !== 'waiting') return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((expiryRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) { stopPolling(); setPhase('expired'); }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'waiting') return;
    pollRef.current = setInterval(checkStatus, POLL_MS);
    // Re-check immediately when the customer returns to the tab (e.g. back from
    // their banking app) or the page becomes visible again — Amazon-style.
    const onWake = () => { if (!document.hidden) checkStatus(); };
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    return () => {
      stopPolling();
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [phase, checkStatus]);

  const payAmount = qr?.amount ?? amount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {phase === 'loading' && (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#6b7280' }}>
          <div style={{ fontSize: 30 }}>⏳</div>
          <div style={{ marginTop: 8, fontWeight: 600 }}>Generating your secure QR…</div>
        </div>
      )}

      {phase === 'unavailable' && (
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 30 }}>🚧</div>
          <div style={{ marginTop: 8, fontWeight: 700, color: '#b45309' }}>{error}</div>
          <button onClick={onCancel}
            style={{ marginTop: 14, padding: '8px 18px', border: '1px solid #d1d5db', background: 'white', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
            Back
          </button>
        </div>
      )}

      {phase === 'waiting' && qr && (
        <>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ width: 200, flexShrink: 0, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: 'white', textAlign: 'center' }}>
              <img src={qr.qrImage} alt="Fonepay payment QR" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Scan &amp; pay with Fonepay
              </div>
              {payAmount > 0 && (
                <div style={{ fontSize: 30, fontWeight: 900, color: accent, margin: '2px 0 8px' }}>{formatPriceShort(payAmount)}</div>
              )}
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#444', lineHeight: 1.7 }}>
                <li>Open Fonepay or any mobile banking / wallet app.</li>
                <li>Scan this QR and pay the exact amount.</li>
                <li>Keep this page open — it confirms automatically.</li>
              </ol>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, color: accent, fontWeight: 700, fontSize: 13 }}>
                <span className="fonepay-pulse" style={{ width: 10, height: 10, borderRadius: '50%', background: accent, display: 'inline-block' }} />
                Waiting for your payment…
              </div>
              <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: remaining <= 60 ? '#dc2626' : '#6b7280' }}>
                ⏱ QR expires in {mmss(remaining)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={checkStatus}
              style={{ flex: 1, minWidth: 140, padding: '10px 16px', border: `1px solid ${accent}`, background: 'white', color: accent, borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
              I&apos;ve paid — check now
            </button>
            {onCancel && (
              <button onClick={() => { stopPolling(); onCancel(); }}
                style={{ padding: '10px 16px', border: '1px solid #d1d5db', background: 'white', color: '#6b7280', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                Pay later
              </button>
            )}
          </div>
          {qr.prn && <div style={{ fontSize: 11, color: '#9ca3af' }}>Reference: {qr.prn}</div>}
        </>
      )}

      {phase === 'success' && (
        <div style={{ textAlign: 'center', padding: '28px 16px' }}>
          <div style={{ fontSize: 40 }}>✅</div>
          <div style={{ marginTop: 8, fontWeight: 800, fontSize: 18, color: '#16a34a' }}>Payment received!</div>
          <div style={{ marginTop: 4, color: '#6b7280', fontSize: 13 }}>Confirming your order…</div>
        </div>
      )}

      {phase === 'expired' && (
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 34 }}>⌛</div>
          <div style={{ marginTop: 8, fontWeight: 700, color: '#b45309' }}>This QR has expired</div>
          <div style={{ marginTop: 4, color: '#6b7280', fontSize: 13 }}>Generate a fresh QR to complete your payment.</div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={generate}
              style={{ padding: '9px 20px', background: accent, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
              Generate new QR
            </button>
            {onCancel && (
              <button onClick={onCancel}
                style={{ padding: '9px 18px', background: 'white', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontWeight: 600, color: '#555' }}>
                Pay later
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'failed' && (
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 34 }}>⚠️</div>
          <div style={{ marginTop: 8, fontWeight: 700, color: '#dc2626' }}>{error || 'Payment failed'}</div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={generate}
              style={{ padding: '9px 20px', background: accent, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
              Try again
            </button>
            {onCancel && (
              <button onClick={onCancel}
                style={{ padding: '9px 18px', background: 'white', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontWeight: 600, color: '#555' }}>
                Pay later
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes fonepayPulse{0%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.7)}100%{opacity:1;transform:scale(1)}}.fonepay-pulse{animation:fonepayPulse 1.1s ease-in-out infinite}`}</style>
    </div>
  );
}
