import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('Portal Header Identity & Account Dropdown', () => {
  const logoutMock = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.clearAllMocks();
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
    });

    expect(
      resolveUserIdentity(
        {
          email: 'dentist@toothcare.com',
          dentist: { first_name: 'Maria', last_name: 'Santos' },
        },
        'DENTIST'
      )
    ).toEqual({
      displayName: 'Dr. Maria Santos',
      initials: 'MS',
      roleLabel: 'Attending Dentist',
    });

    expect(resolveUserIdentity({ email: 'legacy.user@gmail.com' }, 'ADMIN')).toEqual({
      displayName: 'Administrator',
      initials: 'AD',
      roleLabel: 'Administrator',
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
});
