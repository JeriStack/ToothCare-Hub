import apiClient from '../../lib/apiClient';

/**
 * Legal Documents & User Consent / Acceptance API Client
 * Maps to backend /api/v1/legal/* routes.
 */
export const legalApi = {
  /**
   * Fetch currently published active Terms of Service and Privacy Policy metadata (public)
   */
  async getPublicDocuments(options = {}) {
    const res = await apiClient.get('/legal/documents', options);
    return res.data?.data;
  },

  /**
   * Fetch currently published active Terms of Service full content (public)
   */
  async getTermsOfService(options = {}) {
    const res = await apiClient.get('/legal/terms-of-service', options);
    return res.data?.data;
  },

  /**
   * Fetch currently published active Privacy Policy full content (public)
   */
  async getPrivacyPolicy(options = {}) {
    const res = await apiClient.get('/legal/privacy-policy', options);
    return res.data?.data;
  },

  /**
   * Fetch authenticated user's legal acceptance history and pending re-acceptance documents
   */
  async getMyAcceptances(options = {}) {
    const res = await apiClient.get('/legal/acceptances/me', options);
    return res.data?.data;
  },

  /**
   * Submit acceptance/acknowledgment for required published document version(s)
   */
  async submitAcceptances(acceptances) {
    const res = await apiClient.post('/legal/acceptances', { acceptances });
    return res.data?.data;
  },
};

export default legalApi;
