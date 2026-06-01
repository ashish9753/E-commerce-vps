import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import ProductListPage from './pages/ProductListPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProfilePage from './pages/ProfilePage';
import OrdersPage from './pages/OrdersPage';
import WishlistPage from './pages/WishlistPage';
import OrderTrackingPage from './pages/OrderTrackingPage';
import ReturnsPage from './pages/ReturnsPage';
import ReturnStatusPage from './pages/ReturnStatusPage';
import ComparePage from './pages/ComparePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import NotificationsPage from './pages/NotificationsPage';
import SupportPage from './pages/SupportPage';
import BrandsPage from './pages/BrandsPage';
import EventsPage from './pages/EventsPage';
import SocialMediaPage from './pages/SocialMediaPage';

const SITE = 'Trade Engine';

const PAGE_TITLES = {
  '/':                'Home',
  '/products':        'Products',
  '/brands':          'Brands',
  '/events':          'Events & Offers',
  '/social':          'Social Media',
  '/compare':         'Compare Products',
  '/cart':            'Cart',
  '/checkout':        'Checkout',
  '/profile':         'My Profile',
  '/orders':          'My Orders',
  '/wishlist':        'Wishlist',
  '/track':           'Track Order',
  '/returns':         'Returns',
  '/notifications':   'Notifications',
  '/support':         'Support',
  '/login':           'Login',
  '/register':        'Register',
  '/forgot-password': 'Forgot Password',
  '/admin':           'Admin Dashboard',
  '/employee':        'Employee Dashboard',
};

function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const exact = PAGE_TITLES[pathname];
    if (exact) {
      document.title = `${exact} — ${SITE}`;
      return;
    }
    if (pathname.startsWith('/product/')) { document.title = `Product — ${SITE}`; return; }
    if (pathname.startsWith('/return-status/')) { document.title = `Return Status — ${SITE}`; return; }
    if (pathname.startsWith('/reset-password/')) { document.title = `Reset Password — ${SITE}`; return; }
    document.title = SITE;
  }, [pathname]);
  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  return null;
}

const Spinner = () => <div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;

function getStoredAuthUser() {
  try {
    const token = localStorage.getItem('accessToken');
    const rawUser = localStorage.getItem('user');
    return token && rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

function getRoleHome(user) {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'admin') return '/admin';
  if (role === 'employee') return '/employee';
  return '/';
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (String(user.role || '').toLowerCase() !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function EmployeeRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  const role = String(user.role || '').toLowerCase();
  if (role !== 'employee' && role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  const sessionUser = user || getStoredAuthUser();
  if (sessionUser) return <Navigate to={getRoleHome(sessionUser)} replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <PageTitle />
      <Routes>
        {/* Guest-only auth pages */}
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

        {/* Public pages */}
        <Route path="/" element={<Layout><HomePage /></Layout>} />
        <Route path="/products" element={<Layout><ProductListPage /></Layout>} />
        <Route path="/product/:id" element={<Layout><ProductDetailPage /></Layout>} />
        <Route path="/brands" element={<Layout><BrandsPage /></Layout>} />
        <Route path="/events" element={<Layout><EventsPage /></Layout>} />
        <Route path="/social" element={<Layout><SocialMediaPage /></Layout>} />
        <Route path="/compare" element={<Layout><ComparePage /></Layout>} />

        {/* Auth-optional pages */}
        <Route path="/cart" element={<Layout><CartPage /></Layout>} />

        {/* Protected pages */}
        {/* Checkout has its own minimal header (logo + "Secure checkout"),
            so we skip the site Layout to keep the flow focused. */}
        <Route path="/checkout" element={<PrivateRoute><CheckoutPage /></PrivateRoute>} />
        <Route path="/profile" element={<Layout><PrivateRoute><ProfilePage /></PrivateRoute></Layout>} />
        <Route path="/orders" element={<Layout><PrivateRoute><OrdersPage /></PrivateRoute></Layout>} />
        <Route path="/wishlist" element={<Layout><PrivateRoute><WishlistPage /></PrivateRoute></Layout>} />
        <Route path="/track" element={<Layout><PrivateRoute><OrderTrackingPage /></PrivateRoute></Layout>} />
        <Route path="/returns" element={<Layout><PrivateRoute><ReturnsPage /></PrivateRoute></Layout>} />
        <Route path="/return-status/:returnId" element={<Layout><PrivateRoute><ReturnStatusPage /></PrivateRoute></Layout>} />
        <Route path="/notifications" element={<Layout><PrivateRoute><NotificationsPage /></PrivateRoute></Layout>} />
        <Route path="/support" element={<Layout><PrivateRoute><SupportPage /></PrivateRoute></Layout>} />

        {/* Admin */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

        {/* Employee */}
        <Route path="/employee" element={<EmployeeRoute><EmployeeDashboard /></EmployeeRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
