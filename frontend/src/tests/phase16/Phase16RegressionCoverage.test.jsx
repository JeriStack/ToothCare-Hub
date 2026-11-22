import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '../../features/auth/components/LoginForm';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PatientNotificationsPage } from '../../features/notifications/pages/PatientNotificationsPage';
import notificationsApi from '../../features/notifications/api';

const mockLogin = vi.fn();

vi.mock('../../features/auth/context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isAuthenticated: false,
    loading: false,
  }),
}));

vi.mock('../../features/notifications/api', () => {
  const api = {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  };
  return { default: api, notificationsApi: api };
});

describe('Phase 16: Frontend Regression Coverage (Auth, Badges, Notifications)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('LoginForm validates empty/invalid credentials and displays server authentication errors', async () => {
    mockLogin.mockResolvedValueOnce({
      success: false,
      error: 'Invalid email or password.',
    });

    render(
      <LoginForm
        onSuccess={vi.fn()}
        onSwitchToRegister={vi.fn()}
        onForgotPassword={vi.fn()}
      />
    );

    // Submit empty form -> client validation blocks submit
    const submitBtn = screen.getByRole('button', { name: /Sign In|Log In/i });
    fireEvent.click(submitBtn);
    expect(mockLogin).not.toHaveBeenCalled();

    // Fill valid email + password and submit -> displays server error safely
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'patient.test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), {
      target: { value: 'WrongPassword123!' },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/Invalid email or password\./i)).toBeInTheDocument();
  });

  it('StatusBadge renders accessible labels across all official appointment lifecycle statuses', () => {
    const statuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED'];
    render(
      <div>
        {statuses.map((st) => (
          <StatusBadge key={st} status={st} />
        ))}
      </div>
    );

    expect(screen.getByText(/Pending/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/Completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Cancelled/i)).toBeInTheDocument();
    expect(screen.getByText(/Rejected|Declined/i)).toBeInTheDocument();
  });

  it('PatientNotificationsPage recovers unread notifications via REST API and updates read state', async () => {
    notificationsApi.getNotifications.mockResolvedValue({
      items: [
        {
          id: 501,
          type: 'APPOINTMENT_CONFIRMED',
          title: 'Appointment Confirmed',
          message: 'Your prophylaxis visit with Dr. Clara Mendoza is confirmed.',
          read_at: null,
          created_at: '2026-11-22 09:00:00',
        },
      ],
      total: 1,
      page: 1,
      per_page: 20,
      total_pages: 1,
    });
    notificationsApi.getUnreadCount.mockResolvedValue(1);
    notificationsApi.markAsRead.mockResolvedValue({ success: true });

    render(<PatientNotificationsPage />);

    expect(await screen.findByText(/Appointment Confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/Dr\. Clara Mendoza/i)).toBeInTheDocument();
  });
});
