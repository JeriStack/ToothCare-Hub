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

  it('renders welcome section with patient name, non-duplicated clinic date/time, and refresh action', async () => {
    appointmentsApi.list.mockResolvedValue([]);

    const { container } = render(
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

    const headingEl = screen.getByRole('heading', { name: /Welcome back, Juan!/i });
    const clinicTimeEl = screen.getByText(/Clinic Time \(Asia\/Manila\)/i);
    const subtitleEl = screen.getByText(/Track your appointments, discover clinical services/i);
    expect(headingEl.compareDocumentPosition(clinicTimeEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(clinicTimeEl.compareDocumentPosition(subtitleEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const timeNodes = container.querySelectorAll('time');
    expect(timeNodes.length).toBe(2);
    expect(timeNodes[1].textContent).toMatch(/^\d{2}:\d{2}:\d{2}\s?(AM|PM)$/i);

    const refreshBtn = screen.getByRole('button', { name: /Refresh appointments/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(appointmentsApi.list).toHaveBeenCalledTimes(2);
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

  it('uses native stat filter buttons, surfaces pending request shortcut, and navigates discovery cards', async () => {
    appointmentsApi.list.mockResolvedValueOnce([
      {
        id: 201,
        appointment_number: 'APT-202611-0201',
        service_name: 'Dental Consultation',
        status: 'PENDING',
        start_at: '2026-11-15 09:00:00',
        date: '2026-11-15',
      },
    ]);

    const onServices = vi.fn();
    const onDentists = vi.fn();
    const onProfile = vi.fn();

    render(
      <PatientDashboard
        user={mockUser}
        onNavigateToBook={vi.fn()}
        onNavigateToAppointments={vi.fn()}
        onNavigateToServices={onServices}
        onNavigateToDentists={onDentists}
        onNavigateToProfile={onProfile}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/1 pending request awaiting review/i)).toBeDefined();
    });

    const upcomingCard = screen.getByRole('button', { name: /Upcoming Visits: 0 confirmed scheduled/i });
    const pendingCard = screen.getByRole('button', { name: /Pending Requests: 1 awaiting triage/i });
    expect(upcomingCard.getAttribute('aria-pressed')).toBe('true');
    expect(pendingCard.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: /View Pending/i }));
    expect(pendingCard.getAttribute('aria-pressed')).toBe('true');
    expect(upcomingCard.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: /Explore Services/i }));
    fireEvent.click(screen.getByRole('button', { name: /Our Dentists/i }));
    fireEvent.click(screen.getByRole('button', { name: /My Medical Profile/i }));

    expect(onServices).toHaveBeenCalledTimes(1);
    expect(onDentists).toHaveBeenCalledTimes(1);
    expect(onProfile).toHaveBeenCalledTimes(1);
  });
});
