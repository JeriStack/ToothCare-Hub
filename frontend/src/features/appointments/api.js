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
    const rawData = res.data?.data;
    if (Array.isArray(rawData)) {
      return rawData;
    }
    if (Array.isArray(rawData?.items)) {
      return rawData.items;
    }
    return [];
  },

  /**
   * Fetch patient dashboard metrics, next appointment, pending triage requests, and activity.
   */
  async getPatientDashboard() {
    const res = await apiClient.get('/patient/dashboard');
    return res.data?.data;
  },

  /**
   * List assigned appointments for the authenticated dentist
   */
  async listDentist(params = {}) {
    const res = await apiClient.get('/dentist/appointments', { params });
    return res.data?.data || { items: [], meta: { total: 0, page: 1, per_page: 20, last_page: 1 } };
  },

  /**
   * Retrieve single assigned appointment for the authenticated dentist with patient context.
   */
  async getDentistAppointment(id) {
    const res = await apiClient.get(`/dentist/appointments/${id}`);
    return res.data?.data;
  },

  /**
   * Fetch dentist dashboard metrics and today's schedule summary.
   */
  async getDentistDashboard() {
    const res = await apiClient.get('/dentist/dashboard');
    return res.data?.data;
  },

  /**
   * Mark assigned appointment as COMPLETED with optional clinical notes.
   */
  async completeDentistAppointment(id, payload = {}) {
    const res = await apiClient.post(`/dentist/appointments/${id}/complete`, payload);
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
   * List appointments for administrators with filters, server-side sorting, pagination,
   * and optional AbortSignal for cancelling stale requests.
   */
  async listAdmin(params = {}, options = {}) {
    const reqOptions = { params };
    if (options && options.signal) {
      reqOptions.signal = options.signal;
    }
    const res = await apiClient.get('/admin/appointments', reqOptions);
    const rawData = res.data?.data;
    const items = Array.isArray(rawData) ? rawData : (Array.isArray(rawData?.items) ? rawData.items : []);
    const meta = res.data?.meta || rawData?.meta || {
      total: items.length,
      total_records: items.length,
      filtered_records: items.length,
      page: 1,
      current_page: 1,
      per_page: 15,
      last_page: 1,
      total_pages: 1,
    };
    return {
      data: items,
      meta,
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
   * Revalidate dentist & clinic availability for a pending appointment prior to approval
   */
  async checkAvailability(id) {
    const res = await apiClient.get(`/admin/appointments/${id}/availability`);
    return res.data?.data;
  },

  /**
   * Confirm a pending appointment (Admin / Receptionist)
   */
  async confirm(id) {
    const res = await apiClient.patch(`/admin/appointments/${id}/confirm`);
    return res.data?.data;
  },

  /**
   * Reject a pending appointment with reason and optional conflict category (Admin / Receptionist)
   */
  async reject(id, reason = '', conflictReasonCode = null) {
    const payload = { reason };
    if (conflictReasonCode) {
      payload.conflict_reason_code = conflictReasonCode;
    }
    const res = await apiClient.patch(`/admin/appointments/${id}/reject`, payload);
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
