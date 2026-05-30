import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { validators } from '../../utils/validators';

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const toast = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validators.email(email);
    if (err) { toast(err, 'error'); return; }
    toast('Subscribed! Check your inbox for exclusive deals.');
    setEmail('');
  };

  return (
    <div style={{ background: 'white', borderRadius: 8, padding: '28px 24px', boxShadow: '0 1px 3px #0000000d',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#FF5A1F', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>Newsletter</div>
        <div style={{ fontWeight: 800, fontSize: 22, color: '#0f172a', lineHeight: 1.2, marginBottom: 8 }}>
          Get exclusive deals &amp; early access
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
          Join 50,000+ subscribers. Get the best deals, new arrivals, and exclusive offers right in your inbox.
        </p>
      </div>
      <div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ flex: 1, height: 40, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 6,
              fontSize: 13, outline: 'none' }}
          />
          <button type="submit"
            style={{ height: 40, padding: '0 20px', background: '#FF5A1F', color: 'white', border: 'none',
              borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Subscribe
          </button>
        </form>
        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
          No spam. Unsubscribe anytime. By subscribing you agree to our privacy policy.
        </p>
      </div>
    </div>
  );
}
