import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { notificationsApi } from '../api/notifications';
import { API_BASE_URL } from '../api/client';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications]   = useState([]);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [lastSupportMsg, setLastSupportMsg] = useState(null); // { ticketId, status, message }
  const [sseReconnectCount, setSseReconnect] = useState(0);   // increments on every reconnect
  const esRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) { setNotifications([]); setUnreadCount(0); return; }
    try {
      const { data } = await notificationsApi.getMy({ limit: 50 });
      setNotifications(data.data?.data || []);
      setUnreadCount(data.data?.unreadCount ?? 0);
    } catch { /* silent */ }
  }, [user]);

  // Initial load
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // SSE connection — one persistent connection, zero polling.
  // We exchange the access token for a short-lived single-use ticket so the
  // JWT never appears in the EventSource URL (where it would leak to logs/proxies).
  useEffect(() => {
    if (!user) { esRef.current?.close(); esRef.current = null; return; }
    let cancelled = false;

    const connect = async () => {
      if (cancelled) return;
      try {
        const { data } = await notificationsApi.streamTicket();
        const ticket = data?.data?.ticket;
        if (!ticket || cancelled) return;

        esRef.current?.close();
        // Absolute URL is required because the backend lives on a different
        // origin (Render). Same base URL the axios client uses.
        const es = new EventSource(
          `${API_BASE_URL}/notifications/stream?ticket=${encodeURIComponent(ticket)}`,
        );
        esRef.current = es;

        es.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload.type === 'notification') {
              setNotifications(prev => [payload.notification, ...prev]);
              setUnreadCount(prev => prev + 1);
            } else if (payload.type === 'support_message') {
              setLastSupportMsg(payload);
            }
          } catch { /* ignore malformed */ }
        };

        es.onerror = () => {
          es.close();
          setTimeout(() => {
            if (!cancelled && localStorage.getItem('accessToken')) {
              setSseReconnect(c => c + 1);
              connect();
            }
          }, 5_000);
        };
      } catch {
        // ticket request failed — retry shortly
        setTimeout(() => { if (!cancelled) connect(); }, 5_000);
      }
    };

    connect();
    return () => { cancelled = true; esRef.current?.close(); esRef.current = null; };
  }, [user]);

  const markRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const remove = async (id) => {
    const target = notifications.find(n => n._id === id);
    try {
      await notificationsApi.remove(id);
      setNotifications(prev => prev.filter(n => n._id !== id));
      if (target && !target.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, fetchNotifications, markRead, markAllRead, remove, lastSupportMsg, sseReconnectCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
