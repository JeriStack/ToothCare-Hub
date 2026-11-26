import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminDashboard } from '../../features/dashboard/AdminDashboard';
import { UserManagementPage } from '../../features/users/pages/UserManagementPage';
import { RolePermissionMatrixPage } from '../../features/roles/pages/RolePermissionMatrixPage';
import { AuditTrailPage } from '../../features/audit/pages/AuditTrailPage';
import { dashboardApi } from '../../features/dashboard/api';
import { usersApi } from '../../features/users/api';
import { rolesApi } from '../../features/roles/api';
import { auditApi } from '../../features/audit/api';

vi.mock('../../features/dashboard/api', () => ({
  dashboardApi: {
    getMetrics: vi.fn(),
  },
}));

vi.mock('../../features/users/api', () => ({
  usersApi: {
    getUsers: vi.fn(),
    createStaff: vi.fn(),
    updateStatus: vi.fn(),
    updateRole: vi.fn(),
  },
}));

vi.mock('../../features/roles/api', () => ({
  rolesApi: {
    getRoles: vi.fn(),
    getPermissions: vi.fn(),
    syncRolePermissions: vi.fn(),
  },
}));

vi.mock('../../features/audit/api', () => ({
  auditApi: {
    getLogs: vi.fn(),
    getSecurityEvents: vi.fn(),
    exportCsv: vi.fn(),
  },
}));

describe('Administrator Control Center Frontend Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders AdminDashboard with all 11 executive metrics and operational streams', async () => {
    dashboardApi.getMetrics.mockResolvedValue({
      counts: {
        patients: { total: 12, active: 11, inactive: 1 },
        dentists: { total: 4, active: 3, inactive: 1 },
        services: { total: 8, active: 7, inactive: 1 },
        appointments: { total: 25, today: 4, pending: 3, confirmed: 10, completed: 8, cancelled: 4 },
      },
      recent: { patients: [], services: [] },
      today_schedule: [
        {
          id: 101,
          patient_name: 'Juan Dela Cruz',
          service_name: 'Prophylaxis',
          dentist_name: 'Dr. Santos',
          start_at: '2026-11-11 09:00:00',
          status: 'CONFIRMED',
        },
      ],
      review_queue_peek: [
        {
          id: 102,
          patient_name: 'Elena Gomez',
          service_name: 'Tooth Extraction',
          start_at: '2026-11-12 10:00:00',
        },
      ],
      recent_activity: [
        {
          id: 501,
          action: 'ROLE_PERMISSIONS_UPDATED',
          actor_email: 'admin@toothcare.com',
          actor_role: 'ADMIN',
          created_at: '2026-11-11 10:15:00',
        },
      ],
      system_alerts: {
        pending_triage: 3,
        unverified_users: 0,
        recent_security_events: 1,
        active_rate_limits: 0,
      },
    });

    const mockNav = vi.fn();
    render(<AdminDashboard onNavigateTab={mockNav} />);

    await waitFor(() => {
      expect(screen.getByText('Clinic Executive Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
      expect(screen.getByText('Elena Gomez')).toBeInTheDocument();
      expect(screen.getByText('ROLE PERMISSIONS UPDATED')).toBeInTheDocument();
      expect(screen.getByText('Asia/Manila (UTC+8):')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('User Accounts'));
    expect(mockNav).toHaveBeenCalledWith('users');
  });

  it('supports interactive lifecycle deep-linking, 14-day trend inspection, and activity filtering on AdminDashboard', async () => {
    dashboardApi.getMetrics.mockResolvedValue({
      counts: {
        patients: { total: 8, active: 8, inactive: 0 },
        dentists: { total: 4, active: 4, inactive: 0 },
        services: { total: 5, active: 5, inactive: 0 },
        appointments: { total: 16, today: 0, upcoming: 2, pending: 4, confirmed: 2, completed: 3, cancelled: 4, rejected: 1 },
      },
      appointment_trends: [
        { date: '2026-11-25', total: 0, completed: 0, pending: 0 },
        { date: '2026-11-26', total: 5, completed: 3, pending: 2 },
      ],
      outbox_summary: {
        email_outbox: { sent: 10 },
        realtime_outbox: { published: 168 },
        totals: { pending: 0, processing: 0, completed: 178, failed: 0 },
      },
      recent: { patients: [], services: [] },
      today_schedule: [],
      review_queue_peek: [],
      recent_activity: [
        {
          id: 1,
          action: 'AUTH_LOGIN_SUCCESS',
          actor_email: 'admin@toothcare.com',
          actor_role: 'ADMIN',
          created_at: '2026-11-26 09:00:00',
        },
        {
          id: 2,
          action: 'DENTIST_SELF_PROFILE_UPDATED',
          actor_email: 'dentist@toothcare.com',
          actor_role: 'DENTIST',
          created_at: '2026-11-26 09:15:00',
        },
      ],
      recent_errors: [],
      system_alerts: { pending_triage: 4, recent_security_events: 0, active_rate_limits: 0, failed_outbox_jobs: 0 },
    });

    const mockNav = vi.fn();
    render(<AdminDashboard onNavigateTab={mockNav} />);

    expect(await screen.findByText('100% OK')).toBeInTheDocument();
    expect(screen.getByText('5 visits')).toBeInTheDocument();

    // Clicking Pending lifecycle tile deep-links into triage with PENDING filter
    fireEvent.click(screen.getByRole('button', { name: /^Pending\s*4$/i }));
    expect(mockNav).toHaveBeenCalledWith('triage', { statusFilter: 'PENDING' });

    // Switching Recent Activity filter to "Changes" hides noisy AUTH_LOGIN_SUCCESS rows
    expect(screen.getByText('AUTH LOGIN SUCCESS')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Changes$/i }));
    expect(screen.queryByText('AUTH LOGIN SUCCESS')).not.toBeInTheDocument();
    expect(screen.getByText('DENTIST SELF PROFILE UPDATED')).toBeInTheDocument();
  });

  it('renders UserManagementPage and provisions a new staff account', async () => {
    usersApi.getUsers.mockResolvedValue({
      data: [
        {
          id: 1,
          email: 'admin@toothcare.com',
          display_name: 'Clinic Admin',
          role: 'ADMIN',
          is_active: true,
          email_verified: true,
          created_at: '2026-11-01 08:00:00',
        },
      ],
      meta: { total: 1, page: 1, per_page: 15, last_page: 1 },
    });
    usersApi.createStaff.mockResolvedValue({ id: 2, email: 'new.staff@toothcare.com', role: 'RECEPTIONIST' });

    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('admin@toothcare.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Provision Staff Account'));
    expect(screen.getByText('Provision Clinic Staff Account')).toBeInTheDocument();
  });

  it('renders RolePermissionMatrixPage and guards locked admin permissions', async () => {
    rolesApi.getRoles.mockResolvedValue([
      {
        id: 1,
        name: 'Administrator',
        slug: 'admin',
        description: 'Full access',
        users_count: 1,
        permissions: ['users.view', 'users.manage'],
      },
      {
        id: 4,
        name: 'Receptionist',
        slug: 'receptionist',
        description: 'Front desk',
        users_count: 2,
        permissions: ['patients.view'],
      },
    ]);
    rolesApi.getPermissions.mockResolvedValue({
      grouped: {
        users: [
          { id: 1, name: 'View Users', slug: 'users.view' },
          { id: 2, name: 'Manage Users', slug: 'users.manage' },
        ],
        patients: [{ id: 3, name: 'View Patients', slug: 'patients.view' }],
      },
    });

    render(<RolePermissionMatrixPage />);

    await waitFor(() => {
      expect(screen.getByText('Dynamic Role-Based Access Control (DRBAC)')).toBeInTheDocument();
      expect(screen.getByText('View Users')).toBeInTheDocument();
    });

    // Verify protected button for Administrator cannot be disabled
    const lockedBtns = screen.getAllByTitle('Protected super-admin permission');
    expect(lockedBtns[0]).toBeDisabled();

    // Toggle permission for Receptionist
    const recToggleBtn = screen.getByTitle('Toggle users.view for Receptionist');
    fireEvent.click(recToggleBtn);
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });
  });

  it('supports roles.manage lockout guard, search filtering, module bulk toggle, and batch Save All Changes', async () => {
    rolesApi.getRoles.mockResolvedValue([
      {
        id: 1,
        name: 'Administrator',
        slug: 'admin',
        description: 'Full access',
        users_count: 1,
        permissions: ['roles.manage', 'patients.view'],
      },
      {
        id: 4,
        name: 'Receptionist',
        slug: 'receptionist',
        description: 'Front desk',
        users_count: 2,
        permissions: ['patients.view'],
      },
    ]);
    rolesApi.getPermissions.mockResolvedValue({
      protected_admin_permissions: ['users.view', 'users.manage', 'roles.manage', 'audit_logs.view', 'settings.manage'],
      grouped: {
        security: [{ id: 10, name: 'Manage Roles & Permissions', slug: 'roles.manage' }],
        patients: [
          { id: 3, name: 'View Patients', slug: 'patients.view' },
          { id: 4, name: 'Manage Patients', slug: 'patients.manage' },
        ],
      },
    });
    rolesApi.syncRolePermissions.mockResolvedValue({ ok: true });

    const refreshSpy = vi.fn();
    window.addEventListener('toothcare:permissions-refresh', refreshSpy);

    render(<RolePermissionMatrixPage />);

    await waitFor(() => {
      expect(screen.getByText('Manage Roles & Permissions')).toBeInTheDocument();
      expect(screen.getByText('Manage Patients')).toBeInTheDocument();
    });

    // roles.manage must be locked on Administrator
    const lockedRolesManage = screen.getByRole('button', {
      name: 'Manage Roles & Permissions locked for Administrator',
    });
    expect(lockedRolesManage).toBeDisabled();

    // Search narrows down visible capabilities
    const searchInput = screen.getByLabelText('Search permissions');
    fireEvent.change(searchInput, { target: { value: 'patients' } });
    expect(screen.queryByText('Manage Roles & Permissions')).not.toBeInTheDocument();
    expect(screen.getByText('Manage Patients')).toBeInTheDocument();
    fireEvent.change(searchInput, { target: { value: '' } });

    // Bulk toggle patients module for Receptionist grants remaining patients.manage
    const bulkBtn = screen.getByTitle('Grant all patients permissions for Receptionist');
    fireEvent.click(bulkBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save All Changes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Discard All' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save All Changes' }));

    await waitFor(() => {
      expect(rolesApi.syncRolePermissions).toHaveBeenCalledWith(
        4,
        expect.arrayContaining(['patients.view', 'patients.manage'])
      );
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    window.removeEventListener('toothcare:permissions-refresh', refreshSpy);
  });

  it('renders AuditTrailPage and inspects event payloads with Before/After diffs', async () => {
    auditApi.getLogs.mockResolvedValue({
      data: [
        {
          id: 901,
          action: 'ROLE_PERMISSIONS_UPDATED',
          target_type: 'roles',
          target_id: 4,
          actor_email: 'admin@toothcare.com',
          actor_role: 'ADMIN',
          ip_address: '192.168.1.50',
          payload: {
            role: 'Receptionist',
            before: { permissions: ['patients.view'], granted_count: 1 },
            after: { permissions: ['patients.view', 'reports.view'], granted_count: 2 },
          },
          created_at: '2026-11-11 11:00:00',
        },
      ],
      meta: { total: 1, page: 1, per_page: 25, last_page: 1 },
    });
    auditApi.getSecurityEvents.mockResolvedValue([]);

    render(<AuditTrailPage />);

    await waitFor(() => {
      expect(screen.getByText('ROLE_PERMISSIONS_UPDATED')).toBeInTheDocument();
      expect(screen.getByText('admin@toothcare.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Inspect'));
    await waitFor(() => {
      expect(screen.getByText(/Audit Payload Details/)).toBeInTheDocument();
      expect(screen.getByText('Before vs. After Change Comparison')).toBeInTheDocument();
      expect(screen.getByText('patients.view, reports.view')).toBeInTheDocument();
    });
  });

  it('uses a single calendar date filter, supports Security stream pagination, and exports filtered CSV', async () => {
    auditApi.getLogs.mockResolvedValue({
      data: [
        {
          id: 902,
          action: 'APPOINTMENT_COMPLETED',
          target_type: 'appointment',
          target_id: 104,
          actor_email: 'dentist@toothcare.com',
          actor_role: 'DENTIST',
          ip_address: '127.0.0.1',
          payload: null,
          created_at: '2026-11-24 16:36:17',
        },
      ],
      meta: { total: 1, page: 1, per_page: 25, last_page: 1 },
    });
    auditApi.getSecurityEvents.mockResolvedValue({
      data: [
        {
          id: 903,
          action: 'AUTH_LOGIN_FAILED',
          target_type: 'users',
          target_id: 12,
          actor_email: 'System / Anonymous',
          actor_role: 'SYSTEM',
          ip_address: '172.21.0.1',
          payload: { reason: 'INVALID_CREDENTIALS' },
          created_at: '2026-11-24 12:48:46',
        },
      ],
      meta: { total: 1, page: 1, per_page: 25, last_page: 1 },
    });
    auditApi.exportCsv.mockResolvedValue();

    const { container } = render(<AuditTrailPage />);

    await waitFor(() => {
      expect(screen.getByText('APPOINTMENT_COMPLETED')).toBeInTheDocument();
    });

    // Verify only ONE calendar date input is rendered
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs).toHaveLength(1);

    // Selecting a date sends matching single-day date_from & date_to
    fireEvent.change(dateInputs[0], { target: { value: '2026-11-24' } });
    await waitFor(() => {
      expect(auditApi.getLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          date_from: '2026-11-24',
          date_to: '2026-11-24',
        })
      );
    });

    // Switch to Security & Failed Logins stream and export CSV
    fireEvent.click(screen.getByRole('tab', { name: /Security & Failed Logins/i }));
    await waitFor(() => {
      expect(screen.getByText('AUTH_LOGIN_FAILED')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Export CSV Log/i }));
    await waitFor(() => {
      expect(auditApi.exportCsv).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: '2026-11-24',
          date_to: '2026-11-24',
          security_only: 1,
        })
      );
    });
  });
});
