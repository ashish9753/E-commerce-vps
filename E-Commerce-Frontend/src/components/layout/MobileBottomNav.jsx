import { useNavigate, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, Heart, ShoppingCart, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { loginNavState } from '../../utils/authRedirect';

/**
 * Fixed bottom navigation for mobile, shown only on screens ≤ 768px.
 *
 * Five tabs (matches the standard set on Amazon, Flipkart, Myntra):
 *   Home · Categories/Shop · Wishlist · Cart · Account
 *
 * The bar is rendered for *all* pages because Layout wraps every public
 * route. The CSS @media query hides it on tablet/desktop, so the desktop
 * layout is untouched.
 *
 * Active state is derived from the URL — exact match for "/", prefix match
 * for everything else — so deep links like /products?category=Laptops still
 * light up "Shop".
 */
export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user }       = useAuth();
  const { count: cartCount = 0 } = useCart() || {};
  const { count: wishCount = 0 } = useWishlist() || {};

  // Routes where the bottom bar would compete with another navigation
  // surface (auth flows, admin/employee dashboards). Hide on those.
  const path = location.pathname;
  const hideOn = ['/login', '/register', '/forgot-password', '/admin', '/employee'];
  if (hideOn.some((p) => path === p || path.startsWith(`${p}/`))) return null;

  const tabs = [
    { key: 'home', icon: Home,         label: 'Home',     onClick: () => navigate('/'),                isActive: path === '/' },
    { key: 'shop', icon: LayoutGrid,   label: 'Shop',     onClick: () => navigate('/products'),        isActive: path.startsWith('/products') || path.startsWith('/product/') },
    { key: 'wish', icon: Heart,        label: 'Wishlist', onClick: () => navigate(user ? '/wishlist' : '/login', user ? undefined : loginNavState()), isActive: path.startsWith('/wishlist'), badge: wishCount },
    { key: 'cart', icon: ShoppingCart, label: 'Cart',     onClick: () => navigate('/cart'),            isActive: path.startsWith('/cart') || path.startsWith('/checkout'), badge: cartCount },
    { key: 'acct', icon: User,         label: user ? 'Account' : 'Sign In', onClick: () => navigate(user ? '/profile' : '/login', user ? undefined : loginNavState()), isActive: path.startsWith('/profile') || path.startsWith('/orders') },
  ];

  return (
    <nav className="te-bottomnav" role="navigation" aria-label="Primary">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={tab.onClick}
            className={`te-bottomnav-tab ${tab.isActive ? 'is-active' : ''}`}
            aria-current={tab.isActive ? 'page' : undefined}
            aria-label={tab.label}
          >
            <span className="te-bottomnav-iconwrap">
              <Icon size={22} strokeWidth={tab.isActive ? 2.4 : 2} />
              {tab.badge > 0 && (
                <span className="te-bottomnav-badge" aria-label={`${tab.badge} items`}>
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </span>
            <span className="te-bottomnav-label">{tab.label}</span>
          </button>
        );
      })}

      <style>{`
        .te-bottomnav {
          display: none;     /* desktop default — overridden in @media below */
        }
        @media (max-width: 768px) {
          .te-bottomnav {
            position: fixed;
            left: 0; right: 0; bottom: 0;
            z-index: 150;
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            background: #131921;
            border-top: 1px solid #273241;
            /* iOS safe-area: respect the home-indicator inset on iPhones */
            padding: 8px 8px calc(8px + env(safe-area-inset-bottom)) 8px;
            box-shadow: 0 -8px 24px rgba(0, 0, 0, .26);
          }
          .te-bottomnav-tab {
            background: none;
            border: 0;
            padding: 6px 2px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            color: #f8fafc;
            transition: color .15s;
            -webkit-tap-highlight-color: transparent;
          }
          .te-bottomnav-tab:active { transform: scale(.94); transition: transform .08s; }
          .te-bottomnav-tab.is-active {
            color: #FF5A1F;
          }
          .te-bottomnav-iconwrap {
            position: relative;
            display: inline-flex;
            align-items: center; justify-content: center;
            width: 28px; height: 26px;
          }
          .te-bottomnav-badge {
            position: absolute;
            top: -4px; right: -8px;
            min-width: 16px; height: 16px;
            padding: 0 4px;
            border-radius: 9px;
            background: #FF5A1F;
            color: #fff;
            font-size: 9.5px; font-weight: 800;
            display: inline-flex; align-items: center; justify-content: center;
            box-shadow: 0 0 0 2px #131921;
          }
          .te-bottomnav-label {
            position: absolute;
            width: 1px; height: 1px;
            padding: 0; margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }

          /* Reserve space at the bottom of every page so content isn't
             hidden behind the fixed nav. The 64px figure matches the bar's
             outer height (icon 22 + label 10 + padding 12 + a little). */
          body {
            padding-bottom: calc(64px + env(safe-area-inset-bottom));
          }
        }

        /* Dark theme support for forms that opt into a dark page bg */
        @media (max-width: 768px) and (prefers-color-scheme: dark) {
          /* Currently the site is light-only — keeping this hook in case
             you wire a dark mode later. No-op today. */
        }
      `}</style>
    </nav>
  );
}
