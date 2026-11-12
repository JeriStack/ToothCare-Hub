import apiClient from '../../lib/apiClient';

/**
 * Notifications API
 * Interacts with /api/v1/notifications endpoints.
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
      page: 1,
      per_page: 20,
      total_pages: 0,
    };
  },

  /**
   * Retrieve total unread notifications count
   */
  async getUnreadCount() {
    const res = await apiClient.get('/notifications/unread-count');
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
