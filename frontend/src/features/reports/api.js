import apiClient from '../../lib/apiClient';

/**
 * Clinical & Financial Analytics API
 */
export const reportsApi = {
  async getAppointmentReports(params = {}) {
    const response = await apiClient.get('/admin/reports/appointments', { params });
    return response.data?.data;
  },

  async getRevenueReports(params = {}) {
    const response = await apiClient.get('/admin/reports/revenue', { params });
    return response.data?.data;
  },

  async getDentistReports(params = {}) {
    const response = await apiClient.get('/admin/reports/dentists', { params });
    return response.data?.data;
  },
};
