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
  async getPublicDentists(options = {}) {
    const res = await apiClient.get('/dentists', options);
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
   * Fetch authenticated dentist's own clinical profile
   */
  async getMyProfile() {
    const res = await apiClient.get('/dentist/profile');
    return res.data?.data;
  },

  /**
   * Update authenticated dentist's own clinical profile
   */
  async updateMyProfile(payload) {
    const res = await apiClient.patch('/dentist/profile', payload);
    return res.data?.data;
  },

  /**
   * Upload or replace authenticated dentist's profile picture
   */
  async uploadMyAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await apiClient.post('/dentist/profile/avatar', formData);
    return res.data?.data;
  },

  /**
   * Remove authenticated dentist's profile picture
   */
  async deleteMyAvatar() {
    const res = await apiClient.delete('/dentist/profile/avatar');
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

