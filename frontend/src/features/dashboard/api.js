import apiClient from '../../lib/apiClient';

/**
 * Administrative Dashboard Intelligence API
 * Fetches real MySQL aggregate counts and recent activity streams.
 */

export const dashboardApi = {
  async getMetrics() {
    const res = await apiClient.get('/admin/dashboard');
    return res.data?.data;
  },
};

export default dashboardApi;

