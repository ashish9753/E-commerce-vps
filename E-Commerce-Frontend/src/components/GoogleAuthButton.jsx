import { GoogleLogin } from '@react-oauth/google';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { resolveLoginTarget } from '../utils/authRedirect';

/**
 * "Continue with Google" button used on both Login and Register pages.
 *
 *  - Existing account → log in and route by role.
 *  - New account     → either invoke `onNeedsRegistration({idToken, profile})`
 *                       if the parent wants to handle it inline (RegisterPage
 *                       fills its form), or stash in sessionStorage and route
 *                       to /register (LoginPage path — Google is the only way
 *                       to create a new account, so we send them there).
 */
export default function GoogleAuthButton({ text = 'continue_with', onNeedsRegistration }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { googleLogin } = useAuth();
  const toast = useToast();

  const handleSuccess = async (credentialResponse) => {
    const idToken = credentialResponse?.credential;
    if (!idToken) { toast('Google sign-in failed', 'error'); return; }

    const result = await googleLogin(idToken);
    if (!result.success) { toast(result.error || 'Google sign-in failed', 'error'); return; }

    if (result.needsRegistration) {
      const payload = { idToken: result.idToken, profile: result.profile };
      if (onNeedsRegistration) {
        onNeedsRegistration(payload);
      } else {
        // LoginPage path: persist briefly and bounce to /register, which
        // reads sessionStorage on mount and pre-fills its form.
        sessionStorage.setItem('pendingGoogleSignup', JSON.stringify(payload));
        toast('Email verified — finish creating your account', 'info');
        // Carry the return path through the detour so finishing signup still
        // drops them back on the page that sent them here.
        navigate('/register', { state: location.state });
      }
      return;
    }

    toast(`Welcome, ${result.user.name.split(' ')[0]}!`);
    // Same return-to rules as the password form — Google sign-in used to
    // always dump the user on the home page.
    const targetPath = resolveLoginTarget(result.user, location.state);
    navigate(targetPath, { replace: true });
    window.setTimeout(() => {
      if (window.location.pathname === '/login' || window.location.pathname === '/register') {
        window.location.replace(targetPath);
      }
    }, 250);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <div className="gauth-rainbow-wrap">
        <div className="gauth-rainbow-inner">
          {/* Subtle shimmer sweep behind the iframe. Google's widget itself
              renders the label (standard "Sign in with Google" or the
              personalised "Sign in as <name>" prompt when the user is
              already logged into Google in this browser) — we don't overlay
              our own text so it never fights with Google's content. */}
          <span className="gauth-shimmer" aria-hidden="true" />
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => toast('Google sign-in was cancelled', 'error')}
            text={text}                  // "continue_with" | "signup_with" | "signin_with"
            shape="rectangular"
            size="large"
            width="340"
            useOneTap={false}
          />
        </div>
      </div>
      <style>{`
        @keyframes gauth-rainbow-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes gauth-shimmer-sweep {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(120%); }
        }
        .gauth-rainbow-wrap {
          position: relative;
          padding: 3px;
          border-radius: 9999px;
          overflow: hidden;
          background: #fff;
          isolation: isolate;
          /* subtle glow that lifts the button off the page */
          box-shadow: 0 4px 18px rgba(66, 133, 244, .18),
                      0 2px 6px  rgba(234, 67, 53, .12);
          transition: transform .2s ease, box-shadow .2s ease;
        }
        .gauth-rainbow-wrap:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 22px rgba(66, 133, 244, .28),
                      0 4px 10px rgba(234, 67, 53, .18);
        }
        /* The colourful spinning ring sits in a pseudo-element behind the
           white inner pill. We size it well past the wrap so the conic
           gradient fills every corner as it rotates. */
        .gauth-rainbow-wrap::before {
          content: '';
          position: absolute;
          inset: -150%;
          z-index: -1;
          background: conic-gradient(
            from 0deg,
            #4285F4 0%,    /* Google blue */
            #34A853 25%,   /* Google green */
            #FBBC05 50%,   /* Google yellow */
            #EA4335 75%,   /* Google red */
            #4285F4 100%
          );
          animation: gauth-rainbow-spin 4s linear infinite;
        }
        /* White inner pill clips the Google iframe's square edges so the
           rainbow border reads as a continuous rounded stroke. */
        .gauth-rainbow-inner {
          position: relative;
          background: #fff;
          border-radius: 9999px;
          overflow: hidden;
          line-height: 0; /* removes the iframe's baseline gap */
        }
        /* Diagonal coloured shimmer sweeping left → right. Sits above the
           iframe but below pointer events so it never steals clicks. */
        .gauth-shimmer {
          position: absolute;
          top: 0;
          left: 0;
          width: 40%;
          height: 100%;
          background: linear-gradient(
            115deg,
            transparent 0%,
            rgba(66, 133, 244, .18)  25%,
            rgba(234, 67, 53,  .18)  45%,
            rgba(251, 188, 5,  .22)  60%,
            rgba(52, 168, 83,  .18)  75%,
            transparent 100%
          );
          filter: blur(6px);
          pointer-events: none;
          z-index: 2;
          animation: gauth-shimmer-sweep 3.2s ease-in-out infinite;
        }
        /* Honour reduced-motion preference — freeze every animation */
        @media (prefers-reduced-motion: reduce) {
          .gauth-rainbow-wrap::before { animation: none; }
          .gauth-shimmer { animation: none; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
