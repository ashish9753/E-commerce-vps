import { useEffect, useState } from 'react';

export default function MaintenancePage() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const id = setInterval(() => {
      setDots(d => (d.length >= 3 ? '' : d + '.'));
    }, 600);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{ fontFamily: "'Syne', sans-serif" }}
      className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center relative overflow-hidden px-6"
    >
      {/* Ambient glow blobs */}
      <div
        className="pointer-events-none absolute"
        style={{
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,90,31,0.18) 0%, transparent 70%)',
          top: '-120px',
          left: '-160px',
          filter: 'blur(30px)',
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,90,31,0.12) 0%, transparent 70%)',
          bottom: '-100px',
          right: '-120px',
          filter: 'blur(40px)',
        }}
      />

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Card */}
      <div
        className="relative z-10 flex flex-col items-center text-center"
        style={{ maxWidth: 640, width: '100%' }}
      >
        {/* Logo mark */}
        <div className="mb-8 flex items-center gap-3">
          <div
            style={{
              width: 44,
              height: 44,
              background: '#FF5A1F',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 6h18M3 12h18M3 18h12"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: '#fff',
            }}
          >
            Trade Engine
          </span>
        </div>

        {/* Divider line */}
        <div
          style={{
            width: 48,
            height: 3,
            background: '#FF5A1F',
            borderRadius: 99,
            marginBottom: 36,
          }}
        />

        {/* Headline */}
        <h1
          style={{
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-1.5px',
            marginBottom: 24,
          }}
        >
          We're leveling
          <br />
          <span style={{ color: '#FF5A1F' }}>things up</span>
        </h1>

        {/* Sub copy */}
        <p
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 'clamp(15px, 2.2vw, 18px)',
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.7,
            maxWidth: 480,
            marginBottom: 48,
          }}
        >
          Our store is currently undergoing improvements to bring you a
          better shopping experience. We'll be back very soon with
          something great.
        </p>

        {/* Status pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(255,90,31,0.12)',
            border: '1px solid rgba(255,90,31,0.3)',
            borderRadius: 99,
            padding: '10px 22px',
            marginBottom: 56,
          }}
        >
          {/* Pulse dot */}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#FF5A1F',
              display: 'inline-block',
              animation: 'pulse 1.6s ease-in-out infinite',
            }}
          />
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              color: '#FF5A1F',
              letterSpacing: '0.4px',
            }}
          >
            Maintenance in progress{dots}
          </span>
        </div>

        {/* Contact row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'rgba(255,255,255,0.35)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 8l9 5 9-5M3 8v10a1 1 0 001 1h16a1 1 0 001-1V8M3 8a1 1 0 011-1h16a1 1 0 011 1"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Questions? Reach us at</span>
          <a
            href="mailto:support@tradeengine.com.np"
            style={{ color: '#FF5A1F', textDecoration: 'none', fontWeight: 600 }}
          >
            support@tradeengine.com.np
          </a>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 28,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12,
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: '0.5px',
        }}
      >
        © {new Date().getFullYear()} Trade Engine · Nepal's Electronics & Appliances Store
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
