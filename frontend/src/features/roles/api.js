import apiClient from '../../lib/apiClient';

/**
 * Dynamic Role-Based Access Control (DRBAC) API
 */
export const rolesApi = {
  /**
   * Fetch all roles with their assigned permission slugs and user counts
   */
  async getRoles() {
    const response = await apiClient.get('/admin/roles');
    return response.data?.data || [];
  },

  /**
   * Fetch system permissions catalog grouped by module
   */
  async getPermissions() {
    const response = await apiClient.get('/admin/permissions');
    return response.data?.data || { catalog: [], grouped: {} };
  },

  /**
   * Update permission assignments for a specific role
   */
  async syncRolePermissions(roleId, permissions) {
    const response = await apiClient.put(`/admin/roles/${roleId}/permissions`, {
      permissions,
    });
    return response.data?.data;
  },
};
