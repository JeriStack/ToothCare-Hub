import apiClient from '../../lib/apiClient';

/**
 * Treatment Records API Client (Phase 12)
 * Handles clinical documentation, FDI tooth notation charting,
 * and 24-hour compliance record locking.
 */
export const treatmentRecordsApi = {
  /**
   * List paginated treatment records authored by the authenticated dentist.
   */
  async list(params = {}) {
    const res = await apiClient.get('/treatment-records', { params });
    return res.data?.data || { items: [], meta: { total: 0, page: 1, per_page: 20, last_page: 1 } };
  },

  /**
   * Retrieve single treatment record by primary ID with clinical context.
   */
  async getById(id) {
    const res = await apiClient.get(`/treatment-records/${id}`);
    return res.data?.data;
  },

  /**
   * Retrieve treatment record attached to a specific appointment ID.
   */
  async getByAppointment(appointmentId) {
    const res = await apiClient.get(`/appointments/${appointmentId}/treatment-record`);
    return res.data?.data;
  },

  /**
   * Create a new clinical treatment record.
   * Enforces dentist ownership and CONFIRMED/COMPLETED appointment status.
   */
  async create(payload) {
    const res = await apiClient.post('/treatment-records', payload);
    return res.data?.data;
  },

  /**
   * Update an existing treatment record within the 24-hour compliance edit window.
   */
  async update(id, payload) {
    const res = await apiClient.patch(`/treatment-records/${id}`, payload);
    return res.data?.data;
  },
};
