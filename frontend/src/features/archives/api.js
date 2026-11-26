import apiClient from '../../lib/apiClient';

/**
 * Role-Aware Archive & Retention API Client
 * Uses the centralized apiClient with cookie auth, CSRF protection, and AbortSignal cancellation.
 */
export const archivesApi = {
  /**
   * Server-side paginated, searchable, sortable, role-scoped archive listing.
   */
  async list(params = {}, options = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.set(key, String(val));
      }
    });
    const qs = query.toString();
    const response = await apiClient.get(qs ? `/archives?${qs}` : '/archives', {
      signal: options.signal,
    });
    return {
      data: response.data?.data || [],
      meta: response.data?.meta || {},
    };
  },

  /**
   * Role-scoped archive summary metrics and actor capabilities.
   */
  async getSummary() {
    const response = await apiClient.get('/archives/summary');
    return response.data?.data || {};
  },

  /**
   * Inspect a single archive record with SHA-256 tamper verification & sanitized snapshot.
   */
  async getDetail(id) {
    const response = await apiClient.get(`/archives/${id}`);
    return response.data?.data || null;
  },

  /**
   * Pre-check whether a live entity can safely be archived (unresolved appointments, last-admin, duplicates).
   */
  async checkEligibility(entityType, entityId) {
    const response = await apiClient.get('/archives/eligibility', {
      params: { entity_type: entityType, entity_id: entityId },
    });
    return response.data?.data || null;
  },

  /**
   * Retrieve multi-cycle archival & restoration history for an archived record's entity.
   */
  async getCycleHistory(id) {
    const response = await apiClient.get(`/archives/${id}/history`);
    return response.data?.data || null;
  },

  /**
   * Archive an eligible live entity with a mandatory compliance reason.
   */
  async archiveEntity(payload) {
    const response = await apiClient.post('/archives', payload);
    return response.data?.data || null;
  },

  /**
   * Restore a reversible soft-archived record (Admin only).
   */
  async restore(id, reason) {
    const response = await apiClient.post(`/archives/${id}/restore`, { reason });
    return response.data?.data || null;
  },

  /**
   * Download filtered role-scoped archive records as CSV (Admin / Receptionist).
   * Uses centralized apiClient so base URL, CSRF/cookie auth, and 401 refresh retries apply consistently.
   */
  async exportCsv(params = {}) {
    const cleanParams = {};
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        cleanParams[key] = String(val);
      }
    });
    const response = await apiClient.get('/archives/export', { params: cleanParams });
    const csvContent = typeof response.data === 'string' ? response.data : '';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `toothcare_archives_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },
};

export default archivesApi;
