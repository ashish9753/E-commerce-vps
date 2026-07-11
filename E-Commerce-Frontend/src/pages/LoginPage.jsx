import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, Truck, RefreshCw, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { validators } from '../utils/validators';
import GoogleAuthButton from '../components/GoogleAuthButton';

const BENEFITS = [
  { icon: <Truck size={16} />,       text: 'Free delivery on orders above Rs. 499' },
  { icon: <RefreshCw size={16} />,   text: 'Hassle-free 7-day easy returns' },
  { icon: <ShieldCheck size={16} />, text: '100% genuine & warranty-backed products' },
  { icon: <Star size={16} />,        text: 'Exclusive member-only deals & offers' },
];

const STATS = [
  { val: '50K+',  label: 'Happy Customers' },
  { val: '10K+',  label: 'Products' },
  { val: '99%',   label: 'Satisfaction' },
  { val: '24/7',  label: 'Support' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Where to send the user after a successful sign-in. If a guard or a
  // "Sign in to continue" action bounced them here, `location.state.from`
  // holds the page they were trying to reach — return them there so they
  // don't have to hunt for the product again. Admin/employee always land
  // on their own dashboard.
  const from = location.state?.from;
  const returnTo = from
    ? `${from.pathname || '/'}${from.search || ''}${from.hash || ''}`
    : null;
  const toast = useToast();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: null })); };

  const validate = () => {
    const errs = {};
    const emailErr = validators.email(form.email);
    if (emailErr) errs.email = emailErr;
    if (!form.password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const result = await login(form.email, form.password);
    setLoading(false);
    if (result.success) {
      toast(`Welcome back, ${result.user.name.split(' ')[0]}!`);
      const role = String(result.user.role || '').toLowerCase();
      const targetPath = role === 'admin'
        ? '/admin'
        : role === 'employee'
          ? '/employee'
          : (returnTo || '/');
      navigate(targetPath, { replace: true });

      // Production fallback: if the SPA router is interrupted by a stale auth
      // render, leave /login using the token already stored by AuthContext.
      window.setTimeout(() => {
        if (window.location.pathname === '/login') window.location.replace(targetPath);
      }, 250);
    } else {
      toast(result.error, 'error');
      setErrors({ password: result.error });
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }} className="auth-grid">
      {/* ── Left panel ── */}
      <div style={{
        background: 'linear-gradient(145deg, #0d1117 0%, #131921 50%, #1a2332 100%)',
        padding: '40px 52px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,90,31,.18) 0%,transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle,rgba(1,102,178,.15) 0%,transparent 65%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img src="/LOGO.png" alt="TradeEngine" style={{ height: 44, width: 'auto', display: 'block' }} />
        </div>

        {/* Main content */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#FF5A1F', letterSpacing: 3, marginBottom: 16, textTransform: 'uppercase' }}>
            Nepal's #1 Electronics Store
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 14, letterSpacing: -.5 }}>
            Welcome<br />Back! 👋
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', marginBottom: 36, lineHeight: 1.6, maxWidth: 340 }}>
            Sign in to access your orders, wishlist and exclusive member deals.
          </p>

          {/* Benefits list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 40 }}>
            {BENEFITS.map(b => (
              <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(255,90,31,.15)', border: '1px solid rgba(255,90,31,.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#FF5A1F', flexShrink: 0,
                }}>
                  {b.icon}
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', lineHeight: 1.4 }}>{b.text}</span>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {STATS.map(s => (
              <div key={s.val} style={{
                background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 10, padding: '12px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#FF5A1F', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', marginTop: 3, lineHeight: 1.3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>
          © {new Date().getFullYear()} Trade Engine Pvt. Ltd.
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{
        background: '#f5f7fa',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{
          width: '100%', maxWidth: 420,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,.08)',
          padding: '36px 36px 32px',
        }}>
          {/* Card header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#131921,#1a2332)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <div className="logo-mark" style={{ width: 22, height: 22 }} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a', marginBottom: 4, letterSpacing: -.3 }}>Sign in to your account</h2>
            <p style={{ fontSize: 13, color: '#888' }}>Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                // `username` is the canonical login-identifier token the browser
                // pairs with the password so it offers to save + autofill it.
                autoComplete="username"
                style={{
                  width: '100%', height: 44, padding: '0 14px',
                  border: `1.5px solid ${errors.email ? '#e53935' : '#e0e0e0'}`,
                  borderRadius: 8, fontSize: 14, color: '#1a1a1a',
                  outline: 'none', background: '#fff', boxSizing: 'border-box',
                  transition: 'border-color .15s',
                }}
                onFocus={e => { if (!errors.email) e.target.style.borderColor = '#0166b2'; }}
                onBlur={e => { if (!errors.email) e.target.style.borderColor = '#e0e0e0'; }}
              />
              {errors.email && <div style={{ fontSize: 11, color: '#e53935', marginTop: 4 }}>{errors.email}</div>}
            </div>

            {/* Password */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Password</label>
                <a onClick={() => navigate('/forgot-password')}
                  style={{ fontSize: 12, color: '#FF5A1F', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                  Forgot password?
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  autoComplete="current-password"
                  style={{
                    width: '100%', height: 44, padding: '0 42px 0 14px',
                    border: `1.5px solid ${errors.password ? '#e53935' : '#e0e0e0'}`,
                    borderRadius: 8, fontSize: 14, color: '#1a1a1a',
                    outline: 'none', background: '#fff', boxSizing: 'border-box',
                    transition: 'border-color .15s',
                  }}
                  onFocus={e => { if (!errors.password) e.target.style.borderColor = '#0166b2'; }}
                  onBlur={e => { if (!errors.password) e.target.style.borderColor = '#e0e0e0'; }}
                />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <div style={{ fontSize: 11, color: '#e53935', marginTop: 4 }}>{errors.password}</div>}
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              style={{
                width: '100%', height: 46, borderRadius: 8, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? '#ccc' : 'linear-gradient(135deg, #FF5A1F, #e04a0f)',
                color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: .3,
                boxShadow: loading ? 'none' : '0 4px 14px rgba(255,90,31,.35)',
                transition: 'opacity .15s',
              }}>
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
                    Signing in…
                  </span>
                : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
            <span style={{ fontSize: 12, color: '#bbb', fontWeight: 500 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
          </div>

          {/* Google sign-in */}
          <div style={{ marginBottom: 18 }}>
            <GoogleAuthButton text="signin_with" />
          </div>

          {/* Register link */}
          <div style={{ textAlign: 'center', fontSize: 13, color: '#666' }}>
            New to Trade Engine?{' '}
            <a onClick={() => navigate('/register')}
              style={{ color: '#0166b2', fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
              Create a free account
            </a>
          </div>
        </div>

        {/* Trust badges */}
        <div style={{ display: 'flex', gap: 20, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['🔒 Secure Login', '✅ Verified Store', '🛡️ Data Protected'].map(t => (
            <span key={t} style={{ fontSize: 11, color: '#999', display: 'flex', alignItems: 'center', gap: 3 }}>{t}</span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .auth-grid { grid-template-columns: 1fr !important; }
          .auth-grid > div:first-child { display: none !important; }
        }
      `}</style>
    </div>
  );
}
