import { useState, useEffect, useCallback, useRef } from 'react';
import notificationsApi from '../api';
import { useRealtimeNotifications } from '../../../hooks/useRealtimeNotifications';

/**
 * Custom React Hook for Managing User Notifications across all four roles.
 * Combines authoritative MySQL/PHP REST persistence with live Socket.IO event synchronization,
 * duplicate suppression, cursor-based reconnect recovery, and safe optimistic read state.
 */
export function useNotifications(pollIntervalMs = 30000) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seenNotificationIdsRef = useRef(new Set());
  const latestIdRef = useRef(0);

  const mergeUniqueSorted = useCallback((incoming, existing = []) => {
    const byId = new Map();
    for (const item of [...incoming, ...existing]) {
      if (item && item.id != null && !byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }
    const merged = Array.from(byId.values()).sort((a, b) => Number(b.id) - Number(a.id));
    const maxId = merged.reduce((acc, item) => Math.max(acc, Number(item.id) || 0), latestIdRef.current);
    latestIdRef.current = maxId;
    seenNotificationIdsRef.current = new Set(merged.map((item) => item.id));
    return merged;
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const data = await notificationsApi.getNotifications({ per_page: 20 }, { background: true });
      const items = data.items || [];
      const unique = [];
      const seen = new Set();
      let maxId = Number(data.latest_id || 0);
      for (const item of items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          unique.push(item);
          maxId = Math.max(maxId, Number(item.id) || 0);
        }
      }
      seenNotificationIdsRef.current = seen;
      latestIdRef.current = Math.max(latestIdRef.current, maxId);
      setNotifications(unique);
      setUnreadCount(Math.max(0, Number(data.unread_count || 0)));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  const syncMissedNotifications = useCallback(async () => {
    // Use cursor-based sync when available and we already have a baseline; otherwise perform a full fetch
    if (typeof notificationsApi.syncNotifications !== 'function' || latestIdRef.current <= 0) {
      await fetchNotifications();
      return;
    }

    try {
      const data = await notificationsApi.syncNotifications(
        { after_id: latestIdRef.current, limit: 50 },
        { background: true }
      );
      if (data && Array.isArray(data.items)) {
        if (data.items.length > 0) {
          setNotifications((prev) => mergeUniqueSorted(data.items, prev).slice(0, 50));
        }
        latestIdRef.current = Math.max(latestIdRef.current, Number(data.latest_id || 0));
        setUnreadCount(Math.max(0, Number(data.unread_count ?? 0)));
        setError(null);
        return;
      }
      await fetchNotifications();
    } catch {
      await fetchNotifications();
    }
  }, [fetchNotifications, mergeUniqueSorted]);

  const { status: realtimeStatus, isConnected } = useRealtimeNotifications({
    onEvent: (_eventType, payload) => {
      const notifId = payload?.notificationId;
      if (notifId && seenNotificationIdsRef.current.has(notifId)) {
        return;
      }
      void fetchNotifications();
    },
    onReconnect: () => {
      void syncMissedNotifications();
    },
  });

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (pollIntervalMs > 0) {
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
        prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n))
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
    sync: syncMissedNotifications,
    markAsRead,
    markAllAsRead,
  };
}
