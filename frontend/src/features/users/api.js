import apiClient from '../../lib/apiClient';

/**
 * Administrative User & Staff Management API
 */
export const usersApi = {
  /**
   * Fetch paginated users with optional search, role, and status filters
   */
  async getUsers(params = {}) {
    const response = await apiClient.get('/admin/users', { params });
    return response.data;
  },

  /**
   * Retrieve a specific user record with profile details
   */
  async getUser(id) {
    const response = await apiClient.get(`/admin/users/${id}`);
    return response.data?.data;
  },

  /**
   * Create a new staff account (ADMIN, DENTIST, RECEPTIONIST)
   */
  async createStaff(payload) {
    const response = await apiClient.post('/admin/users', payload);
    return response.data?.data;
  },

  /**
   * Activate or deactivate a user account
   */
  async updateStatus(id, isActive) {
    const response = await apiClient.patch(`/admin/users/${id}/status`, {
      is_active: isActive,
    });
    return response.data?.data;
  },

  /**
   * Reassign a user's system role
   */
  async updateRole(id, role) {
    const response = await apiClient.patch(`/admin/users/${id}/role`, {
      role,
    });
    return response.data?.data;
  },
};
