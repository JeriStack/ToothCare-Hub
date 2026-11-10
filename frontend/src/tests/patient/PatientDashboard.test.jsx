import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PatientDashboard } from '../../features/dashboard/PatientDashboard';
import { appointmentsApi } from '../../features/appointments/api';

vi.mock('../../features/appointments/api', () => ({
  appointmentsApi: {
    list: vi.fn(),
  },
}));

describe('PatientDashboard Component', () => {
  const mockUser = {
    id: 1,
    role: 'PATIENT',
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    patient: {
      id: 10,
      first_name: 'Juan',
      last_name: 'Dela Cruz',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders welcome section with patient name and Asia/Manila clinic time', async () => {
    appointmentsApi.list.mockResolvedValueOnce([]);

    render(
      <PatientDashboard
        user={mockUser}
        onNavigateToBook={vi.fn()}
        onNavigateToAppointments={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Juan!/i)).toBeDefined();
      expect(screen.getByText(/Clinic Time \(Asia\/Manila\)/i)).toBeDefined();
    });
  });

  it('renders dynamic statistics cards and next visit highlight with confirmed appointment', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString();
    const mockAppointments = [
      {
        id: 101,
        appointment_number: 'APT-202611-0101',
        service_name: 'Dental Prophylaxis',
        dentist_first_name: 'Maria',
        dentist_last_name: 'Santos',
        status: 'CONFIRMED',
        start_at: futureDate,
        date: futureDate.slice(0, 10),
        operatory_chair: 'Operatory Chair 1',
      },
      {
        id: 102,
        appointment_number: 'APT-202611-0102',
        service_name: 'Tooth Extraction',
        status: 'PENDING',
        start_at: futureDate,
        date: futureDate.slice(0, 10),
      },
      {
        id: 100,
        appointment_number: 'APT-202610-0100',
        service_name: 'Dental Consultation',
        status: 'COMPLETED',
        start_at: '2026-10-01 10:00:00',
        date: '2026-10-01',
      },
    ];

    appointmentsApi.list.mockResolvedValueOnce(mockAppointments);

    render(
      <PatientDashboard
        user={mockUser}
        onNavigateToBook={vi.fn()}
        onNavigateToAppointments={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Next Confirmed Visit')).toBeDefined();
      expect(screen.getAllByText('Dental Prophylaxis').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Dr\. Maria Santos/i).length).toBeGreaterThan(0);
    });
  });

  it('displays empty state when patient has no appointments and triggers book CTA', async () => {
    appointmentsApi.list.mockResolvedValueOnce([]);
    const onBookMock = vi.fn();

    render(
      <PatientDashboard
        user={mockUser}
        onNavigateToBook={onBookMock}
        onNavigateToAppointments={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/No upcoming visits scheduled/i)).toBeDefined();
    });

    const bookBtns = screen.getAllByRole('button', { name: /Book (an )?Appointment/i });
    expect(bookBtns.length).toBeGreaterThan(0);
    fireEvent.click(bookBtns[0]);
    expect(onBookMock).toHaveBeenCalledTimes(1);
  });
});
