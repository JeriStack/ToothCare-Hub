import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App, { resolveUserIdentity } from '../../app/App';

const mockUseAuth = vi.fn();

vi.mock('../../features/auth', () => ({
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: () => mockUseAuth(),
  LoginPage: () => <div>LoginPage</div>,
  RegisterPage: () => <div>RegisterPage</div>,
  ForgotPasswordPage: () => <div>ForgotPasswordPage</div>,
  ResetPasswordPage: () => <div>ResetPasswordPage</div>,
  VerifyEmailPage: () => <div>VerifyEmailPage</div>,
}));

vi.mock('../../features/dashboard/AdminDashboard', () => ({
  AdminDashboard: () => <div>AdminDashboardMock</div>,
}));
vi.mock('../../features/dashboard/ReceptionistDashboard', () => ({
  ReceptionistDashboard: () => <div>ReceptionistDashboardMock</div>,
}));
vi.mock('../../features/dashboard/DentistDashboard', () => ({
  DentistDashboard: () => <div>DentistDashboardMock</div>,
}));
vi.mock('../../features/dashboard/PatientDashboard', () => ({
  PatientDashboard: () => <div>PatientDashboardMock</div>,
}));
vi.mock('../../features/notifications/components/NotificationCenter', () => ({
  NotificationCenter: () => <div>NotificationCenterMock</div>,
}));
vi.mock('../../features/dentists/pages/DentistProfilePage', () => ({
  DentistProfilePage: () => <div>DentistProfilePageMock</div>,
}));
vi.mock('../../features/staff/pages/StaffProfilePage', () => ({
  StaffProfilePage: () => <div>StaffProfilePageMock</div>,
}));

describe('Portal Header Identity & Account Dropdown', () => {
  const logoutMock = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.history.pushState({}, '', '/admin');
  });

  it('resolves full user names without exposing email addresses across roles', () => {
    expect(
      resolveUserIdentity(
        { email: 'admin@toothcare.com', first_name: 'Marco', last_name: 'Villanueva' },
        'ADMIN'
      )
    ).toEqual({
      displayName: 'Marco Villanueva',
      initials: 'MV',
      roleLabel: 'Administrator',
      avatarUrl: null,
    });

    expect(
      resolveUserIdentity(
        { email: 'receptionist@toothcare.com', first_name: 'Clarisse', last_name: 'Mendoza' },
        'RECEPTIONIST'
      )
    ).toEqual({
      displayName: 'Clarisse Mendoza',
      initials: 'CM',
      roleLabel: 'Front Desk Specialist',
      avatarUrl: null,
    });

    expect(
      resolveUserIdentity(
        {
          email: 'dentist@toothcare.com',
          dentist: {
            first_name: 'Maria',
            last_name: 'Santos',
            avatar_url: '/api/v1/dentists/5/avatar?v=99',
          },
        },
        'DENTIST'
      )
    ).toEqual({
      displayName: 'Dr. Maria Santos',
      initials: 'MS',
      roleLabel: 'Dentist',
      avatarUrl: '/api/v1/dentists/5/avatar?v=99',
    });

    expect(resolveUserIdentity({ email: 'legacy.user@gmail.com' }, 'ADMIN')).toEqual({
      displayName: 'Administrator',
      initials: 'AD',
      roleLabel: 'Administrator',
      avatarUrl: null,
    });

    expect(
      resolveUserIdentity(
        {
          email: 'patient@toothcare.com',
          patient: {
            first_name: 'Juan',
            last_name: 'Dela Cruz',
            avatar_url: '/api/v1/patients/1/avatar?v=1',
          },
        },
        'PATIENT'
      )
    ).toEqual({
      displayName: 'Juan Dela Cruz',
      initials: 'JD',
      roleLabel: 'Patient',
      avatarUrl: '/api/v1/patients/1/avatar?v=1',
    });
  });

  it('displays the user name (not email), moves Sign Out into the account dropdown, and handles Escape and Sign Out', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 10,
        email: 'admin@toothcare.com',
        first_name: 'Marco',
        last_name: 'Villanueva',
        role: 'ADMIN',
        permissions: ['dashboard.view', 'users.view'],
      },
      isAuthenticated: true,
      isLoading: false,
      logout: logoutMock,
      hasPermission: () => true,
      refreshUser: vi.fn(),
    });

    render(<App />);

    // Real name shown in topbar; email NOT used as display name; redundant portal badge, clinic footer & standalone Sign Out removed
    expect(screen.getByText('Marco Villanueva')).toBeInTheDocument();
    expect(screen.queryByText('admin@toothcare.com')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin Portal')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back to Website/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Call the clinic/i)).not.toBeInTheDocument();
    expect(screen.queryByText('(02) 8123-4567')).not.toBeInTheDocument();
    expect(screen.queryByText(/Mon - Sat: 9:00 AM - 5:00 PM/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sign Out/i })).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: 'Marco Villanueva account menu' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Open dropdown — email and Back to Website must remain hidden
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('admin@toothcare.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back to Website/i })).not.toBeInTheDocument();
    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    expect(signOutBtn).toBeInTheDocument();

    // Escape closes dropdown cleanly
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /Sign Out/i })).not.toBeInTheDocument();

    // Reopen and sign out
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: /Sign Out/i }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
    });
  });

  it('hides patient email, Back to Website, and Call the clinic footer across the patient portal', () => {
    window.history.pushState({}, '', '/patient');
    mockUseAuth.mockReturnValue({
      user: {
        id: 22,
        email: 'patient@toothcare.com',
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        role: 'PATIENT',
        permissions: [],
      },
      isAuthenticated: true,
      isLoading: false,
      logout: logoutMock,
      hasPermission: () => false,
      refreshUser: vi.fn(),
    });

    render(<App />);

    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.queryByText('patient@toothcare.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back to Website/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Call the clinic/i)).not.toBeInTheDocument();
    expect(screen.queryByText('(02) 8123-4567')).not.toBeInTheDocument();
    expect(screen.queryByText(/Mon - Sat: 9:00 AM - 5:00 PM/i)).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: 'Juan Dela Cruz account menu' });
    fireEvent.click(trigger);

    expect(screen.queryByText('patient@toothcare.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back to Website/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();
  });

  it('uses fluid dashboard shell width and toggles persistent sidebar minimize state', () => {
    window.history.pushState({}, '', '/patient');
    mockUseAuth.mockReturnValue({
      user: {
        id: 22,
        email: 'patient@toothcare.com',
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        role: 'PATIENT',
        permissions: [],
      },
      isAuthenticated: true,
      isLoading: false,
      logout: logoutMock,
      hasPermission: () => false,
      refreshUser: vi.fn(),
    });

    const { container, unmount } = render(<App />);

    // Full-width responsive shell instead of fixed max-w-7xl container
    expect(container.querySelector('.max-w-7xl')).toBeNull();
    const main = screen.getByRole('main');
    expect(main).toHaveClass('portal-main-shell', 'flex-1', 'min-w-0', 'w-full');

    const sidebar = container.querySelector('#portal-sidebar');
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');

    const toggleBtn = screen.getByRole('button', { name: 'Toggle sidebar' });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(toggleBtn).toHaveAttribute('aria-controls', 'portal-sidebar-nav');

    // Minimize sidebar
    fireEvent.click(toggleBtn);
    expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem('toothcare_sidebar_collapsed')).toBe('true');

    // Labels remain accessible to assistive tech even when minimized
    expect(screen.getByRole('button', { name: 'Services' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');

    // Mobile drawer button exposes aria-expanded state
    const mobileToggle = screen.getByRole('button', { name: 'Navigation menu' });
    expect(mobileToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(mobileToggle);
    expect(mobileToggle).toHaveAttribute('aria-expanded', 'true');

    // Persists across remount and expands back
    unmount();
    const remounted = render(<App />);
    expect(remounted.container.querySelector('#portal-sidebar')).toHaveAttribute('data-collapsed', 'true');
    const expandBtn = screen.getByRole('button', { name: 'Toggle sidebar' });
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(expandBtn);
    expect(remounted.container.querySelector('#portal-sidebar')).toHaveAttribute('data-collapsed', 'false');
    expect(window.localStorage.getItem('toothcare_sidebar_collapsed')).toBe('false');
  });

  it('renders patient profile picture in header and dropdown when avatar_url is set and falls back on error', () => {
    window.history.pushState({}, '', '/patient');
    mockUseAuth.mockReturnValue({
      user: {
        id: 23,
        email: 'patient@toothcare.com',
        role: 'PATIENT',
        patient: {
          id: 9,
          first_name: 'Juan',
          last_name: 'Dela Cruz',
          avatar_url: '/api/v1/patients/9/avatar?v=42',
        },
        permissions: [],
      },
      isAuthenticated: true,
      isLoading: false,
      logout: logoutMock,
      hasPermission: () => false,
      refreshUser: vi.fn(),
    });

    render(<App />);

    const trigger = screen.getByRole('button', { name: 'Juan Dela Cruz account menu' });
    const headerImg = trigger.querySelector('img');
    expect(headerImg).not.toBeNull();
    expect(headerImg).toHaveAttribute('src', '/api/v1/patients/9/avatar?v=42');

    fireEvent.click(trigger);
    const menuImgs = document.getElementById('user-account-menu')?.querySelectorAll('img');
    expect(menuImgs?.length).toBe(1);
    expect(menuImgs?.[0]).toHaveAttribute('src', '/api/v1/patients/9/avatar?v=42');

    // Graceful fallback to initials if image fails to load
    fireEvent.error(headerImg);
    expect(trigger.querySelector('img')).toBeNull();
    expect(trigger).toHaveTextContent('JD');
  });

  it('omits redundant My Shifts & Leaves item from dentist sidebar navigation', () => {
    window.history.pushState({}, '', '/dentist/shifts');
    mockUseAuth.mockReturnValue({
      user: {
        id: 30,
        email: 'dentist@toothcare.com',
        role: 'DENTIST',
        dentist: {
          id: 5,
          first_name: 'Maria',
          last_name: 'Santos',
        },
        permissions: [],
      },
      isAuthenticated: true,
      isLoading: false,
      logout: logoutMock,
      hasPermission: () => false,
      refreshUser: vi.fn(),
    });

    render(<App />);

    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assigned Appointments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Treatment Records' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Profile' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /My Shifts & Leaves/i })).toBeNull();
    expect(screen.getByText('DentistDashboardMock')).toBeInTheDocument();

    const accountMenuTrigger = screen.getByRole('button', { name: /Dr\. Maria Santos account menu/i });
    expect(accountMenuTrigger).toHaveTextContent('Dentist');
    expect(accountMenuTrigger).not.toHaveTextContent('Attending Dentist');

    fireEvent.click(accountMenuTrigger);
    const accountMenu = document.getElementById('user-account-menu');
    expect(accountMenu).not.toBeNull();
    expect(within(accountMenu).queryByText('Portal Overview')).toBeNull();

    const profileMenuItem = within(accountMenu).getByRole('button', { name: /My Profile/i });
    fireEvent.click(profileMenuItem);
    expect(screen.getByText('DentistProfilePageMock')).toBeInTheDocument();
  });

  it('renders My Profile in receptionist navigation and replaces Portal Overview in account dropdown', () => {
    window.history.pushState({}, '', '/receptionist');
    mockUseAuth.mockReturnValue({
      user: {
        id: 3,
        email: 'receptionist@toothcare.com',
        first_name: 'Clarisse',
        last_name: 'Mendoza',
        role: 'RECEPTIONIST',
        avatar_url: '/api/v1/users/3/avatar?v=45',
        permissions: ['appointments.view'],
      },
      isAuthenticated: true,
      isLoading: false,
      logout: logoutMock,
      hasPermission: (perm) => perm === 'appointments.view',
      refreshUser: vi.fn(),
    });

    render(<App />);

    expect(screen.getByRole('button', { name: 'My Profile' })).toBeInTheDocument();

    const accountMenuTrigger = screen.getByRole('button', { name: /Clarisse Mendoza account menu/i });
    expect(accountMenuTrigger).toHaveTextContent('Front Desk Specialist');
    fireEvent.click(accountMenuTrigger);

    const accountMenu = document.getElementById('user-account-menu');
    expect(accountMenu).not.toBeNull();
    expect(within(accountMenu).queryByText('Portal Overview')).toBeNull();

    const profileMenuItem = within(accountMenu).getByRole('button', { name: /My Profile/i });
    fireEvent.click(profileMenuItem);
    expect(screen.getByText('StaffProfilePageMock')).toBeInTheDocument();
  });
});
