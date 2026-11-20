import { useState, useEffect, useCallback, useRef } from 'react';
import notificationsApi from '../api';
import { useRealtimeNotifications } from '../../../hooks/useRealtimeNotifications';

/**
 * Custom React Hook for Managing User Notifications.
 * Combines authoritative MySQL/PHP REST persistence with live Socket.IO event synchronization,
 * duplicate suppression, and automatic REST recovery upon reconnect.
 */
export function useNotifications(pollIntervalMs = 30000) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seenNotificationIdsRef = useRef(new Set());

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const data = await notificationsApi.getNotifications({ per_page: 20 }, { background: true });
      const items = data.items || [];
      // Deduplicate by notification ID while preserving server order
      const unique = [];
      const seen = new Set();
      for (const item of items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          unique.push(item);
        }
      }
      seenNotificationIdsRef.current = seen;
      setNotifications(unique);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  const { status: realtimeStatus, isConnected } = useRealtimeNotifications({
    onEvent: (_eventType, payload) => {
      // Reconcile against authoritative PHP REST API so full notification details & unread counts stay exact
      const notifId = payload?.notificationId;
      if (notifId && seenNotificationIdsRef.current.has(notifId)) {
        return;
      }
      void fetchNotifications();
    },
    onReconnect: () => {
      // Recover any notifications missed while disconnected
      void fetchNotifications();
    },
  });

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (pollIntervalMs > 0) {
      // When live Socket.IO is connected, widen fallback polling to reduce redundant traffic;
      // when disconnected, poll normally so notifications remain functional during realtime outages.
      const effectiveInterval = isConnected ? Math.max(pollIntervalMs * 2, 60000) : pollIntervalMs;
      const interval = setInterval(fetchNotifications, effectiveInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [fetchNotifications, pollIntervalMs, isConnected]);

  const markAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
      setUnreadCount(0);
    } catch {
      fetchNotifications();
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    realtimeStatus,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
