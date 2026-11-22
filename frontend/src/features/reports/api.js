import apiClient from '../../lib/apiClient';

/**
 * Clinic Operational Reports & Analytics API
 */
export const reportsApi = {
  async getAppointmentReports(params = {}) {
    const response = await apiClient.get('/admin/reports/appointments', { params });
    return response.data?.data;
  },

  async getServiceReports(params = {}) {
    const response = await apiClient.get('/admin/reports/services', { params });
    return response.data?.data;
  },

  async getPatientReports(params = {}) {
    const response = await apiClient.get('/admin/reports/patients', { params });
    return response.data?.data;
  },

  async getDentistReports(params = {}) {
    const response = await apiClient.get('/admin/reports/dentists', { params });
    return response.data?.data;
  },
};
