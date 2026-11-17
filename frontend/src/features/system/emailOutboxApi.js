import apiClient from '../../lib/apiClient';

/**
 * Email outbox administration API (Phase 13).
 * The backend enforces DRBAC on every call; a 403 means the permission is not assigned.
 */
export const emailOutboxApi = {
  async getStats() {
    const response = await apiClient.get('/admin/email-outbox/stats');
    return response.data?.data;
  },

  async getJobs({ status = '', failuresOnly = true, page = 1, perPage = 10 } = {}) {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (status) params.set('status', status);
    if (failuresOnly) params.set('failures_only', 'true');
    const response = await apiClient.get(`/admin/email-outbox/jobs?${params.toString()}`);
    return { data: response.data?.data || [], meta: response.data?.meta || {} };
  },

  async retry(id, { confirm = false } = {}) {
    const response = await apiClient.post(`/admin/email-outbox/jobs/${id}/retry`, confirm ? { confirm: true } : {});
    return response.data?.data;
  },

  async abandon(id) {
    const response = await apiClient.post(`/admin/email-outbox/jobs/${id}/abandon`, {});
    return response.data?.data;
  },
};

export default emailOutboxApi;