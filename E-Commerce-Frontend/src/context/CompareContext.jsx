import { createContext, useContext, useState } from 'react';

const CompareContext = createContext(null);

export function CompareProvider({ children }) {
  const [items, setItems] = useState([]);

  const toggle = (product) => {
    const pid = product._id || product.id;
    setItems(prev => {
      const exists = prev.find(i => (i._id || i.id) === pid);
      if (exists) return prev.filter(i => (i._id || i.id) !== pid);
      if (prev.length >= 4) return prev;
      return [...prev, product];
    });
  };

  const isComparing = (productId) => items.some(i => (i._id || i.id) === productId);
  const remove = (productId) => setItems(prev => prev.filter(i => (i._id || i.id) !== productId));
  const clear = () => setItems([]);

  return (
    <CompareContext.Provider value={{ items, toggle, isComparing, remove, clear, count: items.length }}>
      {children}
    </CompareContext.Provider>
  );
}

export const useCompare = () => useContext(CompareContext);
