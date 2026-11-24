import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PatientNotificationsPage } from '../../features/notifications/pages/PatientNotificationsPage';

const { mockNotificationsApi } = vi.hoisted(() => {
  return {
    mockNotificationsApi: {
      getNotifications: vi.fn(),
      getUnreadCount: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
    },
  };
});

vi.mock('../../features/notifications/api', () => ({
  notificationsApi: mockNotificationsApi,
  default: mockNotificationsApi,
}));

describe('PatientNotificationsPage Component', () => {
  const mockNotificationsResponse = {
    items: [
      {
        id: 1,
        title: 'Appointment Confirmed',
        message: 'Your dental appointment for Dental Cleaning has been confirmed for Nov 15.',
        type: 'APPOINTMENT_CONFIRMED',
        appointment_id: 42,
        read_at: null,
        created_at: '2026-11-10 10:00:00',
      },
      {
        id: 2,
        title: 'Booking Request Received',
        message: 'Your appointment request is awaiting administrative clinic review.',
        type: 'APPOINTMENT_REQUESTED',
        appointment_id: 43,
        read_at: '2026-11-09 15:00:00',
        created_at: '2026-11-09 14:30:00',
      },
    ],
    total: 2,
    unread_count: 1,
    page: 1,
    per_page: 15,
    total_pages: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationsApi.getNotifications.mockResolvedValue(mockNotificationsResponse);
    mockNotificationsApi.getUnreadCount.mockResolvedValue(1);
    mockNotificationsApi.markAsRead.mockResolvedValue({ id: 1, read_at: new Date().toISOString() });
    mockNotificationsApi.markAllAsRead.mockResolvedValue({ success: true });
  });

  it('renders notifications list and shows unread badge', async () => {
    render(<PatientNotificationsPage onNavigateToAppointments={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeDefined();
      expect(screen.getByText('Appointment Confirmed')).toBeDefined();
      expect(screen.getByText('Booking Request Received')).toBeDefined();
    });
  });

  it('filters notifications by unread dropdown option', async () => {
    render(<PatientNotificationsPage onNavigateToAppointments={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Appointment Confirmed')).toBeDefined();
    });

    const filterSelect = screen.getByLabelText(/Filter notifications/i);
    fireEvent.change(filterSelect, { target: { value: 'UNREAD' } });

    expect(screen.getByText('Appointment Confirmed')).toBeDefined();
    expect(screen.queryByText('Booking Request Received')).toBeNull();
  });

  it('marks individual notification as read when clicking mark read button', async () => {
    render(<PatientNotificationsPage onNavigateToAppointments={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Appointment Confirmed')).toBeDefined();
    });

    const markReadBtn = screen.getByRole('button', { name: /Mark read/i });
    fireEvent.click(markReadBtn);

    expect(mockNotificationsApi.markAsRead).toHaveBeenCalledWith(1);
  });
});
