import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeliverySettings } from '../../hooks/useDeliverySettings';

export default function BigBanner() {
  const navigate = useNavigate();
  const dlv = useDeliverySettings();
  const deliveryLine = dlv.freeThresholdEnabled
    ? `Free delivery on all orders above Rs. ${Number(dlv.freeThreshold || 0).toLocaleString('en-IN')}.`
    : `Flat Rs. ${Number(dlv.defaultCharge || 0).toLocaleString('en-IN')} delivery on all orders.`;
  const TARGET = Date.now() + (2 * 24 + 7) * 3600 * 1000 + 42 * 60 * 1000;
  const [time, setTime] = useState({ d: '02', h: '07', m: '42', s: '00' });

  useEffect(() => {
    const z = n => String(n).padStart(2, '0');
    const tick = () => {
      const left = Math.max(0, TARGET - Date.now());
      setTime({ d: z(Math.floor(left / 86400000)), h: z(Math.floor(left % 86400000 / 3600000)), m: z(Math.floor(left % 3600000 / 60000)), s: z(Math.floor(left % 60000 / 1000)) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: '#131921', borderRadius: 8, padding: '28px 32px', marginBottom: 12,
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center',
      boxShadow: '0 1px 3px #0000000d', position: 'relative', overflow: 'hidden' }}>
      {/* Glow */}
      <div style={{ position: 'absolute', right: -80, top: -80, width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle,rgba(255,90,31,.18) 0%,transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'inline-block', background: '#FF5A1F', color: 'white', fontSize: 10,
          fontWeight: 800, padding: '3px 10px', borderRadius: 4, letterSpacing: '.1em', marginBottom: 12 }}>
          FLASH SALE
        </div>
        <h2 style={{ color: 'white', fontWeight: 800, fontSize: 32, margin: '0 0 8px', lineHeight: 1.15 }}>
          Best deals, <span style={{ color: '#FF5A1F' }}>limited</span> time
        </h2>
        <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 14, margin: '0 0 20px', maxWidth: 400 }}>
          Up to 50% off on top brands. {deliveryLine}
        </p>
        <button onClick={() => navigate('/products')}
          style={{ background: '#FF5A1F', color: 'white', border: 'none', borderRadius: 6,
            padding: '11px 24px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          Shop the Sale →
        </button>
      </div>

      {/* Countdown */}
      <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
        {[['Days', time.d], ['Hrs', time.h], ['Min', time.m], ['Sec', time.s]].map(([label, val]) => (
          <div key={label} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 8, padding: '14px 16px', minWidth: 64, textAlign: 'center' }}>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 32, lineHeight: 1 }}>{val}</div>
            <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 10, fontWeight: 600, letterSpacing: '.1em', marginTop: 6 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
