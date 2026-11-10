import apiClient from '../../lib/apiClient';

/**
 * Patient Registry API
 * Interacts with /api/v1/admin/patients and /api/v1/patients
 */

export const patientsApi = {
  /**
   * Fetch authenticated patient's own profile
   */
  async getMyProfile() {
    const res = await apiClient.get('/patients/me');
    return res.data?.data;
  },

  /**
   * Update authenticated patient's own profile
   */
  async updateMyProfile(payload) {
    const res = await apiClient.patch('/patients/me', payload);
    return res.data?.data;
  },

  /**
   * Fetch paginated patient registry for administration
   */
  async getAdminPatients(params = {}) {
    const res = await apiClient.get('/admin/patients', { params });
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
   * Get single patient record details (includes demographics, medical alerts, user account info)
   */
  async getPatient(id) {
    const res = await apiClient.get(`/admin/patients/${id}`);
    return res.data?.data;
  },

  /**
   * Update patient demographic, emergency contact, or medical alert profile
   */
  async updatePatient(id, payload) {
    const res = await apiClient.put(`/admin/patients/${id}`, payload);
    return res.data?.data;
  },

  /**
   * Toggle patient account status (active / disabled) preserving clinical history
   */
  async togglePatientStatus(id, isActive) {
    const res = await apiClient.patch(`/admin/patients/${id}/status`, {
      is_active: isActive ? 1 : 0,
    });
    return res.data?.data;
  },
};

export default patientsApi;

