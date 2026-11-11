import apiClient from '../../lib/apiClient';

/**
 * System Health & Clinic Settings API
 */
export const systemApi = {
  /**
   * Fetch comprehensive infrastructure and service diagnostics
   */
  async getHealth() {
    const response = await apiClient.get('/admin/system/health');
    return response.data?.data;
  },

  /**
   * Fetch all clinic configuration settings
   */
  async getSettings() {
    const response = await apiClient.get('/admin/clinic/settings');
    return response.data?.data || {};
  },

  /**
   * Update clinic operating configuration settings
   */
  async updateSettings(payload) {
    const response = await apiClient.put('/admin/clinic/settings', payload);
    return response.data?.data;
  },
};
