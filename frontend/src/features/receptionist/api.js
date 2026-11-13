import apiClient from '../../lib/apiClient';

/**
 * Front Desk / Receptionist Operations API
 * Provides endpoints for practice overview, real-time schedule, check-in, waiting list,
 * walk-in patient intake, and front desk appointment booking.
 */
export const receptionistApi = {
  /**
   * Fetch front desk overview metrics, today's schedule, waiting list, and triage requests
   */
  async getDashboard() {
    const res = await apiClient.get('/receptionist/dashboard');
    return res.data?.data;
  },

  /**
   * Fetch today's chronological schedule with optional doctor and attendance filters
   */
  async getTodaySchedule(params = {}) {
    const res = await apiClient.get('/receptionist/schedule/today', { params });
    return res.data?.data;
  },

  /**
   * Check in an arriving patient for a scheduled appointment
   */
  async checkIn(appointmentId, notes = null) {
    const res = await apiClient.post(`/receptionist/appointments/${appointmentId}/check-in`, {
      notes,
    });
    return res.data?.data;
  },

  /**
   * Update operational attendance status (WAITING, IN_CONSULTATION, FINISHED, NO_SHOW)
   */
  async updateAttendance(appointmentId, status, notes = null) {
    const res = await apiClient.patch(`/receptionist/appointments/${appointmentId}/attendance`, {
      status,
      notes,
    });
    return res.data?.data;
  },

  /**
   * Fetch live waiting list of checked-in patients
   */
  async getWaitingList() {
    const res = await apiClient.get('/receptionist/waiting-list');
    return res.data?.data;
  },

  /**
   * Register a new walk-in patient at the front desk
   */
  async registerPatient(payload) {
    const res = await apiClient.post('/receptionist/patients', payload);
    return res.data;
  },

  /**
   * Book an appointment directly from the front desk
   */
  async createAppointment(payload) {
    const res = await apiClient.post('/receptionist/appointments', payload);
    return res.data;
  },
};

export default receptionistApi;
