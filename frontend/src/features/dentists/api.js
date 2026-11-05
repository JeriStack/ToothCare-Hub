import apiClient from '../../lib/apiClient';

/**
 * Dentist Profile & Roster API
 * Interacts with /api/v1/admin/dentists and /api/v1/dentists
 */

export const dentistsApi = {
  /**
   * Fetch paginated roster of dentists for administration
   */
  async getAdminDentists(params = {}) {
    const res = await apiClient.get('/admin/dentists', { params });
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
   * Fetch active dentists roster for public appointment scheduling
   */
  async getPublicDentists() {
    const res = await apiClient.get('/dentists');
    return res.data?.data || [];
  },

  /**
   * Get single dentist profile details
   */
  async getDentist(id) {
    const res = await apiClient.get(`/admin/dentists/${id}`);
    return res.data?.data;
  },

  /**
   * Create a new licensed dentist account & profile
   */
  async createDentist(payload) {
    const res = await apiClient.post('/admin/dentists', payload);
    return res.data?.data;
  },

  /**
   * Update licensed dentist profile
   */
  async updateDentist(id, payload) {
    const res = await apiClient.put(`/admin/dentists/${id}`, payload);
    return res.data?.data;
  },

  /**
   * Toggle dentist active practice status (synchronizes user login state)
   */
  async toggleDentistStatus(id, isActive) {
    const res = await apiClient.patch(`/admin/dentists/${id}/status`, {
      is_active: isActive ? 1 : 0,
    });
    return res.data?.data;
  },
};

export default dentistsApi;

