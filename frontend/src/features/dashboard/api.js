import apiClient from '../../lib/apiClient';

/**
 * Administrative Dashboard Intelligence & Operational Views API
 * Fetches real MySQL aggregate counts, outbox delivery health, and safe operational errors.
 */
export const dashboardApi = {
  async getMetrics() {
    const res = await apiClient.get('/admin/dashboard');
    return res.data?.data;
  },

  async getOutboxOperations(params = {}) {
    const res = await apiClient.get('/admin/operations/outbox', { params });
    return res.data?.data;
  },

  async getOperationalErrors(params = {}) {
    const res = await apiClient.get('/admin/operations/errors', { params });
    return {
      items: res.data?.data ?? [],
      meta: res.data?.meta ?? { total: 0, page: 1, per_page: 20, last_page: 1 },
    };
  },
};

export default dashboardApi;
