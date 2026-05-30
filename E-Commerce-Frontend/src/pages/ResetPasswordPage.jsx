import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { toast('Passwords do not match', 'error'); return; }
    if (password.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      toast('Password reset successfully!');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-105">
        {done ? (
          <div className="text-center">
            <div className="text-[64px] mb-4">✅</div>
            <h2 className="font-serif text-[32px] mb-3 font-normal">Password reset!</h2>
            <p className="text-mute mb-8">Your password has been updated. You can now sign in.</p>
            <button className="btn btn-primary" onClick={() => navigate('/login')}>Sign In</button>
          </div>
        ) : (
          <>
            <h2 className="font-serif text-[40px] tracking-[-0.02em] mb-2 font-normal">Reset password</h2>
            <p className="text-mute mb-8">Enter your new password below.</p>
            <form onSubmit={handleSubmit} noValidate>
              <div className="field mb-4">
                <label>New Password</label>
                <input className="input" type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div className="field mb-6">
                <label>Confirm Password</label>
                <input className="input" type="password" placeholder="Re-enter password" value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary w-full h-12" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
