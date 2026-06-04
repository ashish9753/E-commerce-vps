import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { cartApi } from '../api/cart';
import { settingsApi } from '../api/settings';
import { getErrorMessage } from '../api/client';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

// A cart line is identified by product + color, so the same product in two
// colors stays as two independent lines.
const lineKey = (productId, color = '') => `${productId}::${color || ''}`;
const sameLine = (item, productId, color = '') => {
  const id = item.product?._id || item.product;
  return id?.toString() === productId?.toString() && (item.color || '') === (color || '');
};

// How long to wait after the last +/- click before firing the PATCH. Short
// enough to feel real-time, long enough to collapse rapid clicks (1→5 in
// half a second) into a single request.
const DEBOUNCE_MS = 350;

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);
  // Per-product debounce timers + latest pending value, keyed by productId.
  // We send `latest` after DEBOUNCE_MS of inactivity, then clear the entry.
  // 0 means "remove this line" — fired immediately, no debounce.
  const pendingRef = useRef({});  // pid -> { qty, timer }

  // Admin-configured delivery defaults (fallback estimate shown before an
  // address-specific rate is known). Mirrors the backend's DEFAULT_DELIVERY.
  const [deliveryCfg, setDeliveryCfg] = useState({
    defaultCharge: 50, freeThresholdEnabled: true, freeThreshold: 500,
  });
  useEffect(() => {
    settingsApi.getDeliverySettings()
      .then(r => {
        const s = r.data?.data?.deliverySettings;
        if (s) setDeliveryCfg({
          defaultCharge:        Number(s.defaultCharge) || 0,
          freeThresholdEnabled: s.freeThresholdEnabled ?? true,
          freeThreshold:        Number(s.freeThreshold) || 0,
        });
      })
      .catch(() => {});
  }, []);

  const fetchCart = useCallback(async () => {
    if (!user) { setCart(null); return; }
    setLoading(true);
    try {
      const { data } = await cartApi.get();
      setCart(data.data.cart);
      // Cancel any in-flight debounce — server is the source of truth now.
      Object.values(pendingRef.current).forEach(p => p?.timer && clearTimeout(p.timer));
      pendingRef.current = {};
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const addToCart = async (productId, quantity = 1, color = '') => {
    try {
      const { data } = await cartApi.addItem(productId, quantity, color);
      setCart(data.data.cart);
      const k = lineKey(productId, color);
      const entry = pendingRef.current[k];
      if (entry?.timer) clearTimeout(entry.timer);
      delete pendingRef.current[k];
      return { success: true };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  };

  // Fire the queued PATCH for a single product. Called from the debounce
  // timer below. On failure we re-fetch the cart so the UI lands on the
  // server's truth instead of an inconsistent optimistic value.
  const flushOne = async (key) => {
    const entry = pendingRef.current[key];
    if (!entry) return;
    const { productId, color, qty } = entry;
    delete pendingRef.current[key];
    try {
      if (qty === 0) await cartApi.removeItem(productId, color);
      else           await cartApi.updateItem(productId, qty, color);
    } catch {
      // Server rejected (stock issue, deleted product, etc.) — reload truth.
      fetchCart();
    }
  };

  // Optimistic local update + debounced PATCH. The user sees the change
  // immediately; the database catches up DEBOUNCE_MS after their last click.
  const updateQty = (productId, color, quantity) => {
    if (quantity < 1) return; // minimum is 1 — use Remove button to delete
    setCart(prev => {
      if (!prev) return prev;
      const items = prev.items.map(i => (sameLine(i, productId, color) ? { ...i, quantity } : i));
      return { ...prev, items };
    });

    const k = lineKey(productId, color);
    const existing = pendingRef.current[k];
    if (existing?.timer) clearTimeout(existing.timer);
    const timer = setTimeout(() => flushOne(k), DEBOUNCE_MS);
    pendingRef.current[k] = { productId, color: color || '', qty: quantity, timer };
  };

  // Optimistic local removal + immediate API call — no debounce because
  // delete is a deliberate one-shot action (Trash icon click).
  const removeFromCart = async (productId, color = '') => {
    setCart(prev => {
      if (!prev) return prev;
      const items = prev.items.filter(i => !sameLine(i, productId, color));
      return { ...prev, items };
    });
    const k = lineKey(productId, color);
    const existing = pendingRef.current[k];
    if (existing?.timer) clearTimeout(existing.timer);
    delete pendingRef.current[k];
    try {
      const { data } = await cartApi.removeItem(productId, color);
      setCart(data.data.cart);
      return { success: true };
    } catch (err) {
      fetchCart();
      return { success: false, error: getErrorMessage(err) };
    }
  };

  // Same behaviour as removeFromCart now — kept as a separate name for
  // existing callers (e.g. "Save for later" in CartPage).
  const removeFromCartNow = removeFromCart;

  // Force-flush any in-flight debounced PATCHes, then return the fresh
  // server cart. Called by CartPage when the user clicks Proceed to
  // Checkout — guarantees the order placement sees the latest quantities.
  const syncCart = async () => {
    const entries = Object.entries(pendingRef.current);
    if (entries.length > 0) {
      // Cancel timers and fire everything in parallel.
      entries.forEach(([, p]) => p?.timer && clearTimeout(p.timer));
      await Promise.all(
        entries.map(([, { productId, color, qty }]) =>
          qty === 0
            ? cartApi.removeItem(productId, color).catch(() => {})
            : cartApi.updateItem(productId, qty, color).catch(() => {})
        )
      );
      pendingRef.current = {};
    }
    try {
      const { data } = await cartApi.get();
      const freshCart = data.data.cart;
      setCart(freshCart);
      return freshCart?.items || [];
    } catch {
      return cart?.items || [];
    }
  };

  const clearCart = async () => {
    try {
      await cartApi.clear();
      setCart(null);
      pendingRef.current = {};
    } catch { /* ignore */ }
  };

  const applyCoupon = async (code) => {
    try {
      const { data } = await cartApi.applyCoupon(code);
      await fetchCart();
      return {
        success: true,
        discount:     data.data.discount,
        finalPrice:   data.data.finalPrice,
        freebie:      data.data.freebie || null,
        freeShipping: !!data.data.freeShipping,
        message:      data.message,
      };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  };

  const removeCoupon = async () => {
    try {
      await cartApi.removeCoupon();
      await fetchCart();
      return { success: true };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  };

  const items          = cart?.items || [];
  const count          = items.length;
  // Recompute subtotal live from items so +/- changes reflect instantly (no API call needed)
  const subtotal       = items.reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 0), 0);
  const discountAmount = cart?.discountAmount || 0;
  const finalPrice     = Math.max(0, subtotal - discountAmount);
  // Derive the active freebie / free-shipping flag from the populated coupon
  // so they survive page reloads.
  const freebie = cart?.coupon?.discountType === 'FREEBIE' && cart?.coupon?.freebieProduct
    ? {
        _id:      cart.coupon.freebieProduct._id,
        title:    cart.coupon.freebieProduct.title,
        image:    cart.coupon.freebieProduct.images?.[0] || '',
        quantity: cart.coupon.freebieQuantity || 1,
        price:    cart.coupon.freebieProduct.discountPrice || cart.coupon.freebieProduct.price || 0,
      }
    : null;
  const freeShipping   = cart?.coupon?.discountType === 'FREE_SHIPPING';
  const baseDelivery   = (deliveryCfg.freeThresholdEnabled && subtotal >= deliveryCfg.freeThreshold)
    ? 0
    : deliveryCfg.defaultCharge;
  const deliveryCharge = freeShipping ? 0 : baseDelivery;
  const total          = finalPrice + deliveryCharge;

  return (
    <CartContext.Provider value={{
      cart, items, count, subtotal, discountAmount, finalPrice, deliveryCharge, total, loading, freebie, freeShipping,
      deliveryCfg,
      addToCart, removeFromCart, removeFromCartNow, updateQty, clearCart,
      applyCoupon, removeCoupon, fetchCart, syncCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
