import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { cartApi } from '../api/cart';
import { getErrorMessage } from '../api/client';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

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

  const addToCart = async (productId, quantity = 1) => {
    try {
      const { data } = await cartApi.addItem(productId, quantity);
      setCart(data.data.cart);
      const entry = pendingRef.current[productId];
      if (entry?.timer) clearTimeout(entry.timer);
      delete pendingRef.current[productId];
      return { success: true };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  };

  // Fire the queued PATCH for a single product. Called from the debounce
  // timer below. On failure we re-fetch the cart so the UI lands on the
  // server's truth instead of an inconsistent optimistic value.
  const flushOne = async (productId) => {
    const entry = pendingRef.current[productId];
    if (!entry) return;
    const qty = entry.qty;
    delete pendingRef.current[productId];
    try {
      if (qty === 0) await cartApi.removeItem(productId);
      else           await cartApi.updateItem(productId, qty);
    } catch {
      // Server rejected (stock issue, deleted product, etc.) — reload truth.
      fetchCart();
    }
  };

  // Optimistic local update + debounced PATCH. The user sees the change
  // immediately; the database catches up DEBOUNCE_MS after their last click.
  const updateQty = (productId, quantity) => {
    if (quantity < 1) return; // minimum is 1 — use Remove button to delete
    setCart(prev => {
      if (!prev) return prev;
      const items = prev.items.map(i => {
        const id = i.product?._id || i.product;
        return id?.toString() === productId?.toString() ? { ...i, quantity } : i;
      });
      return { ...prev, items };
    });

    const existing = pendingRef.current[productId];
    if (existing?.timer) clearTimeout(existing.timer);
    const timer = setTimeout(() => flushOne(productId), DEBOUNCE_MS);
    pendingRef.current[productId] = { qty: quantity, timer };
  };

  // Optimistic local removal + immediate API call — no debounce because
  // delete is a deliberate one-shot action (Trash icon click).
  const removeFromCart = async (productId) => {
    setCart(prev => {
      if (!prev) return prev;
      const items = prev.items.filter(i => {
        const id = i.product?._id || i.product;
        return id?.toString() !== productId?.toString();
      });
      return { ...prev, items };
    });
    const existing = pendingRef.current[productId];
    if (existing?.timer) clearTimeout(existing.timer);
    delete pendingRef.current[productId];
    try {
      const { data } = await cartApi.removeItem(productId);
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
        entries.map(([pid, { qty }]) =>
          qty === 0
            ? cartApi.removeItem(pid).catch(() => {})
            : cartApi.updateItem(pid, qty).catch(() => {})
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
      }
    : null;
  const freeShipping   = cart?.coupon?.discountType === 'FREE_SHIPPING';
  const baseDelivery   = subtotal >= 5000 ? 0 : 120;
  const deliveryCharge = freeShipping ? 0 : baseDelivery;
  const total          = finalPrice + deliveryCharge;

  return (
    <CartContext.Provider value={{
      cart, items, count, subtotal, discountAmount, finalPrice, deliveryCharge, total, loading, freebie, freeShipping,
      addToCart, removeFromCart, removeFromCartNow, updateQty, clearCart,
      applyCoupon, removeCoupon, fetchCart, syncCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
