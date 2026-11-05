import apiClient from '../../lib/apiClient';

/**
 * Service Management API
 * Interacts with /api/v1/admin/services and /api/v1/services
 */

export const servicesApi = {
  /**
   * Fetch paginated list of services for administration
   */
  async getAdminServices(params = {}) {
    const res = await apiClient.get('/admin/services', { params });
    return {
      data: res.data?.data || [],
      meta: res.data?.meta || {
        total: 0,
        page: 1,
        per_page: 10,
        last_page: 1,
      },
    };
  },

  /**
   * Fetch active services for public booking / dropdowns
   */
  async getPublicServices() {
    const res = await apiClient.get('/services');
    return res.data?.data || [];
  },

  /**
   * Get single service detail
   */
  async getService(id) {
    const res = await apiClient.get(`/admin/services/${id}`);
    return res.data?.data;
  },

  /**
   * Create a new service
   */
  async createService(payload) {
    const res = await apiClient.post('/admin/services', payload);
    return res.data?.data;
  },

  /**
   * Update an existing service
   */
  async updateService(id, payload) {
    const res = await apiClient.put(`/admin/services/${id}`, payload);
    return res.data?.data;
  },

  /**
   * Activate or deactivate a service (preserves appointment history)
   */
  async toggleServiceStatus(id, isActive) {
    const res = await apiClient.patch(`/admin/services/${id}/status`, {
      is_active: isActive ? 1 : 0,
    });
    return res.data?.data;
  },
};

export default servicesApi;

