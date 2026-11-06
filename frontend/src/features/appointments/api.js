import apiClient from '../../lib/apiClient';

/**
 * Appointments API Client
 * Manages patient booking, listing, cancellation, rescheduling, and administrative review actions.
 */
export const appointmentsApi = {
  /**
   * Book a new dental appointment (Patient)
   */
  async book(payload) {
    const res = await apiClient.post('/appointments', payload);
    return res.data?.data;
  },

  /**
   * List appointments for the authenticated patient
   */
  async list(params = {}) {
    const res = await apiClient.get('/appointments', { params });
    return res.data?.data;
  },

  /**
   * Get single appointment details (with status history)
   */
  async getById(id) {
    const res = await apiClient.get(`/appointments/${id}`);
    return res.data?.data;
  },

  /**
   * Cancel an appointment
   */
  async cancel(id, reason = '') {
    const res = await apiClient.post(`/appointments/${id}/cancel`, { reason });
    return res.data?.data;
  },

  /**
   * Reschedule an existing appointment
   */
  async reschedule(id, payload) {
    const res = await apiClient.post(`/appointments/${id}/reschedule`, payload);
    return res.data?.data;
  },

  /**
   * List appointments for administrators with filters and pagination
   */
  async listAdmin(params = {}) {
    const res = await apiClient.get('/admin/appointments', { params });
    return {
      data: res.data?.data || [],
      meta: res.data?.meta || { total: 0, page: 1, per_page: 15, last_page: 1 },
    };
  },

  /**
   * Get single appointment for administrative review
   */
  async getAdminById(id) {
    const res = await apiClient.get(`/admin/appointments/${id}`);
    return res.data?.data;
  },

  /**
   * Confirm a pending appointment (Admin)
   */
  async confirm(id) {
    const res = await apiClient.patch(`/admin/appointments/${id}/confirm`);
    return res.data?.data;
  },

  /**
   * Reject a pending appointment with reason (Admin)
   */
  async reject(id, reason = '') {
    const res = await apiClient.patch(`/admin/appointments/${id}/reject`, { reason });
    return res.data?.data;
  },

  /**
   * Mark a confirmed appointment as completed (Admin)
   */
  async complete(id) {
    const res = await apiClient.patch(`/admin/appointments/${id}/complete`);
    return res.data?.data;
  },
};
