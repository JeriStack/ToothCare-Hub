import apiClient from '../../lib/apiClient';

/**
 * Scheduling & Availability API Client
 * Interacts with /api/v1/availability, /api/v1/clinic/*, and /api/v1/admin/dentists/{id}/*
 */

export const schedulesApi = {
  /**
   * Fetch calculated appointment slots for a dentist, service, and date range
   */
  async getAvailability({ dentist_id, service_id, date, end_date }) {
    const params = {
      dentist_id,
      service_id,
      date,
      ...(end_date ? { end_date } : {}),
    };
    const res = await apiClient.get('/availability', { params });
    return res.data?.data;
  },

  /**
   * Get clinic facility weekly operating hours
   */
  async getClinicHours() {
    const res = await apiClient.get('/clinic/hours');
    return res.data?.data || [];
  },

  /**
   * Update clinic operating hours (single day or array of 7 days)
   */
  async updateClinicHours(payload) {
    const res = await apiClient.put('/admin/clinic/hours', payload);
    return res.data?.data || [];
  },

  /**
   * Get clinic closures (holidays, maintenance, etc.)
   */
  async getClinicClosures(params = {}) {
    const res = await apiClient.get('/clinic/closures', { params });
    return res.data?.data || [];
  },

  /**
   * Create a scheduled clinic closure
   */
  async createClinicClosure(payload) {
    const res = await apiClient.post('/admin/clinic/closures', payload);
    return res.data?.data;
  },

  /**
   * Delete a scheduled clinic closure
   */
  async deleteClinicClosure(id) {
    const res = await apiClient.delete(`/admin/clinic/closures/${id}`);
    return res.data;
  },

  /**
   * Get weekly recurring working shifts for a dentist
   */
  async getDentistSchedules(dentistId) {
    const res = await apiClient.get(`/dentists/${dentistId}/schedules`);
    return res.data?.data?.schedules || [];
  },

  /**
   * Create a recurring weekly shift for a dentist
   */
  async createDentistSchedule(dentistId, payload) {
    const res = await apiClient.post(`/admin/dentists/${dentistId}/schedules`, payload);
    return res.data?.data;
  },

  /**
   * Update an existing recurring shift
   */
  async updateDentistSchedule(dentistId, scheduleId, payload) {
    const res = await apiClient.put(`/admin/dentists/${dentistId}/schedules/${scheduleId}`, payload);
    return res.data?.data;
  },

  /**
   * Delete a recurring shift
   */
  async deleteDentistSchedule(dentistId, scheduleId) {
    const res = await apiClient.delete(`/admin/dentists/${dentistId}/schedules/${scheduleId}`);
    return res.data;
  },

  /**
   * Get time-off / leaves for a dentist
   */
  async getDentistTimeOff(dentistId, params = {}) {
    const res = await apiClient.get(`/dentists/${dentistId}/time-off`, { params });
    return res.data?.data?.time_off || [];
  },

  /**
   * Schedule time-off / leave for a dentist
   */
  async createDentistTimeOff(dentistId, payload) {
    const res = await apiClient.post(`/admin/dentists/${dentistId}/time-off`, payload);
    return res.data?.data;
  },

  /**
   * Delete a scheduled time-off record
   */
  async deleteDentistTimeOff(dentistId, timeOffId) {
    const res = await apiClient.delete(`/admin/dentists/${dentistId}/time-off/${timeOffId}`);
    return res.data;
  },
};

export default schedulesApi;

