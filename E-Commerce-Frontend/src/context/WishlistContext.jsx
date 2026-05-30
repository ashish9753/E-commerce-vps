import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usersApi } from '../api/users';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  const fetchWishlist = useCallback(async () => {
    if (!user) { setItems([]); return; }
    try {
      const { data } = await usersApi.getWishlist();
      setItems(data.data.wishlist || []);
    } catch {
      setItems([]);
    }
  }, [user]);

  useEffect(() => { fetchWishlist(); }, [fetchWishlist]);

  const toggle = async (product) => {
    const productId = product._id || product.id;
    try {
      await usersApi.toggleWishlist(productId);
      setItems((prev) => {
        const exists = prev.some((i) => (i._id || i) === productId);
        if (exists) return prev.filter((i) => (i._id || i) !== productId);
        return [...prev, product];
      });
    } catch { /* ignore */ }
  };

  const isWished = (productId) =>
    items.some((i) => (i._id || i) === productId || i === productId);

  const remove = async (productId) => {
    try {
      await usersApi.toggleWishlist(productId);
      setItems((prev) => prev.filter((i) => (i._id || i) !== productId));
    } catch { /* ignore */ }
  };

  return (
    <WishlistContext.Provider value={{ items, toggle, isWished, remove, count: items.length, fetchWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
