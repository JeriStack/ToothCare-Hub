import apiClient, { fetchCsrfToken, clearCsrfToken } from '../../lib/apiClient';

/**
 * Authentication Feature API Endpoints
 * Maps to backend /api/v1/auth/* routes.
 */

export const authApi = {
  /**
   * Register a new patient account
   */
  async register(payload) {
    const res = await apiClient.post('/auth/register', payload);
    return res.data?.data;
  },

  /**
   * Login user credentials and establish session
   */
  async login(credentials) {
    const res = await apiClient.post('/auth/login', credentials);
    return res.data?.data;
  },

  /**
   * Terminate active session
   */
  async logout() {
    try {
      const res = await apiClient.post('/auth/logout');
      return res.data?.data;
    } finally {
      clearCsrfToken();
    }
  },

  /**
   * Retrieve current authenticated user context
   */
  async getMe() {
    const res = await apiClient.get('/auth/me');
    return res.data?.data;
  },

  /**
   * Acquire CSRF token
   */
  async getCsrfToken() {
    return fetchCsrfToken();
  },

  /**
   * Verify email address using single-use token
   */
  async verifyEmail(token) {
    const res = await apiClient.post('/auth/verify-email', { token });
    return res.data?.data;
  },

  /**
   * Resend verification email
   */
  async resendVerification(email) {
    const res = await apiClient.post('/auth/resend-verification', { email });
    return res.data?.data;
  },

  /**
   * Request password reset instructions
   */
  async forgotPassword(email) {
    const res = await apiClient.post('/auth/forgot-password', { email });
    return res.data?.data;
  },

  /**
   * Complete password reset with token
   */
  async resetPassword(token, password) {
    const res = await apiClient.post('/auth/reset-password', { token, password });
    return res.data?.data;
  },
};

export default authApi;

