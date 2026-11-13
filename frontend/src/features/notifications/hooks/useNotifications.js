import { useState, useEffect, useCallback } from 'react';
import notificationsApi from '../api';

/**
 * Custom React Hook for Managing User Notifications
 */
export function useNotifications(pollIntervalMs = 30000) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const data = await notificationsApi.getNotifications({ per_page: 20 }, { background: true });
      setNotifications(data.items || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    if (pollIntervalMs > 0) {
      const interval = setInterval(fetchNotifications, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchNotifications, pollIntervalMs]);

  const markAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Refresh on error to re-sync
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
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
