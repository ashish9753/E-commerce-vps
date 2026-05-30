import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
      toast('Password reset email sent!');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-2 min-h-screen max-md:grid-cols-1">
      <div className="bg-ink text-white px-15 py-15 flex flex-col justify-between relative overflow-hidden max-md:hidden">
        <div className="absolute -right-50 -bottom-50 w-125 h-125 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(255,90,31,.2) 0%,transparent 60%)' }} />
        <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
          <img src="/LOGO.png" alt="TradeEngine" style={{ height: 44, width: 'auto', display: 'block' }} />
        </div>
        <div>
          <div className="font-serif text-[80px] leading-[0.5] text-accent">"</div>
          <p className="font-serif text-[32px] leading-[1.2] mt-5 mb-5 tracking-[-0.01em]">
            Don't worry. It happens to the best of us.
          </p>
          <div className="text-[13px] text-white/50">— Trade Engine Support</div>
        </div>
        <div className="text-[13px] text-white/40">© 2024 Trade Engine Pvt. Ltd.</div>
      </div>

      <div className="flex flex-col justify-center px-15 max-md:px-6">
        <div className="max-w-105">
          {!sent ? (
            <>
              <h2 className="font-serif text-[40px] tracking-[-0.02em] mb-2 font-normal">Forgot password?</h2>
              <p className="text-mute mb-8">Enter your email and we'll send you a reset link.</p>
              <form onSubmit={handleSubmit} noValidate>
                <div className="field mb-6">
                  <label>Email address</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full h-12" disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="text-[64px] mb-4">📧</div>
              <h2 className="font-serif text-[32px] mb-3 font-normal">Check your inbox</h2>
              <p className="text-mute mb-8">We've sent a password reset link to <b>{email}</b>. It expires in 15 minutes.</p>
              <button className="btn btn-ghost" onClick={() => setSent(false)}>Try a different email</button>
            </div>
          )}
          <div className="mt-6 text-center text-sm text-mute">
            Remember it?{' '}
            <a onClick={() => navigate('/login')} className="text-ink font-semibold cursor-pointer hover:text-accent">Sign in</a>
          </div>
        </div>
      </div>
    </div>
  );
}
