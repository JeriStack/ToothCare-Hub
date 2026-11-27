import apiClient from '../../lib/apiClient';

/**
 * History Records & Individual Record Timelines API Client
 * Uses centralized apiClient with cookie auth, CSRF protection, and AbortSignal cancellation.
 */
export const historyApi = {
  async list(params = {}, options = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.set(key, String(val));
      }
    });
    const qs = query.toString();
    const response = await apiClient.get(qs ? `/history?${qs}` : '/history', {
      signal: options.signal,
    });
    return {
      data: response.data?.data || [],
      meta: response.data?.meta || {},
    };
  },

  async getSummary() {
    const response = await apiClient.get('/history/summary');
    return response.data?.data || {};
  },

  async getDetail(id) {
    const response = await apiClient.get(`/history/${id}`);
    return response.data?.data || null;
  },

  async getPatientTimeline(patientId) {
    const response = await apiClient.get(`/history/patients/${patientId}`);
    return response.data?.data || null;
  },

  async getDentistTimeline(dentistId) {
    const response = await apiClient.get(`/history/dentists/${dentistId}`);
    return response.data?.data || null;
  },

  async getStaffTimeline(userId) {
    const response = await apiClient.get(`/history/staff/${userId}`);
    return response.data?.data || null;
  },

  async getAppointmentTimeline(appointmentId) {
    const response = await apiClient.get(`/history/appointments/${appointmentId}`);
    return response.data?.data || null;
  },
};

export default historyApi;
