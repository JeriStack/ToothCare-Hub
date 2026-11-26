import apiClient from '../../lib/apiClient';

/**
 * Forensic Audit Trail & Security Events API
 */
export const auditApi = {
  /**
   * Fetch paginated audit log events
   */
  async getLogs(params = {}) {
    const response = await apiClient.get('/admin/audit-logs', { params });
    return response.data;
  },

  /**
   * Fetch security-focused authentication / authorization failure events (paginated)
   */
  async getSecurityEvents(params = {}) {
    const response = await apiClient.get('/admin/security/events', { params });
    return response.data;
  },

  /**
   * Download audit trail CSV export
   */
  async exportCsv(params = {}) {
    const response = await apiClient.get('/admin/audit-logs/export', { params });
    const csvContent = typeof response.data === 'string' ? response.data : '';

    const url = window.URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `toothcare-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
