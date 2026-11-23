import apiClient from '../../lib/apiClient';

/**
 * Notifications API
 * Interacts with /api/v1/notifications endpoints (all authenticated roles).
 */
export const notificationsApi = {
  /**
   * Fetch paginated in-app notifications for authenticated user
   */
  async getNotifications(params = {}, options = {}) {
    const res = await apiClient.get('/notifications', { ...options, params });
    return res.data?.data || {
      items: [],
      total: 0,
      unread_count: 0,
      latest_id: 0,
      page: 1,
      per_page: 20,
      total_pages: 0,
    };
  },

  /**
   * Cursor-based incremental sync for reconnect / missed-notification recovery
   */
  async syncNotifications(params = {}, options = {}) {
    const res = await apiClient.get('/notifications/sync', { ...options, params });
    return res.data?.data || {
      items: [],
      unread_count: 0,
      latest_id: 0,
      has_more: false,
      server_time: null,
    };
  },

  /**
   * Retrieve a single authorized notification by ID
   */
  async getNotification(id, options = {}) {
    const res = await apiClient.get(`/notifications/${id}`, options);
    return res.data?.data || null;
  },

  /**
   * Retrieve total unread notifications count
   */
  async getUnreadCount(options = {}) {
    const res = await apiClient.get('/notifications/unread-count', options);
    return res.data?.data?.unread_count ?? 0;
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(id) {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data?.data;
  },

  /**
   * Mark all unread notifications as read
   */
  async markAllAsRead() {
    const res = await apiClient.post('/notifications/read-all');
    return res.data?.data;
  },
};

export default notificationsApi;
