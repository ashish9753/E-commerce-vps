import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const timerRef = useRef(null);

  const showToast = useCallback((msg, type = 'success') => {
    if (!msg) return;
    clearTimeout(timerRef.current);
    setToast({ show: true, msg, type });
    timerRef.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 3200);
  }, []);

  // Global event channel so non-React code (e.g. axios interceptors) can fire
  // toasts. Any code can `window.dispatchEvent(new CustomEvent('app:toast', {
  // detail: { message, type } }))` and it'll show in the same bottom-right pill
  // as the success welcome toast.
  useEffect(() => {
    const handler = (e) => {
      const { message, type } = e.detail || {};
      showToast(message, type || 'error');
    };
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, [showToast]);

  const icons = { success: '✓', error: '✕', warn: '!' };
  const iconBg = { success: 'bg-ok', error: 'bg-bad', warn: 'bg-warn' };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={`fixed bottom-8 right-8 bg-ink text-white px-5.5 py-3.5 rounded-xl text-sm font-medium shadow-2xl flex items-center gap-2.5 max-w-90 z-9999 transition-all duration-350 ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}>
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${iconBg[toast.type]}`}>
          {icons[toast.type]}
        </div>
        {toast.msg}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
