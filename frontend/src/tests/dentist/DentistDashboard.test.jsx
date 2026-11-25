import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { DentistDashboard } from '../../features/dashboard/DentistDashboard';
import { appointmentsApi } from '../../features/appointments/api';
import { schedulesApi } from '../../features/schedules/api';

vi.mock('../../features/appointments/api', () => ({
  appointmentsApi: {
    getDentistDashboard: vi.fn(),
  },
}));

vi.mock('../../features/schedules/api', () => ({
  schedulesApi: {
    getDentistSchedules: vi.fn(),
    getDentistTimeOff: vi.fn(),
    requestTimeOff: vi.fn(),
  },
}));

describe('DentistDashboard Component', () => {
  const mockDashboardData = {
    dentist: {
      id: 1,
      first_name: 'Maria',
      last_name: 'Santos',
      specialization: 'General & Cosmetic Dentistry',
      license_number: 'PRC-0042189',
      default_operatory_chair: 'Chair 1',
    },
    clinic_time: '2026-11-20T10:00:00+08:00',
    today_count: 3,
    upcoming_count: 8,
    pending_count: 2,
    completed_count: 14,
    next_appointment: {
      id: 101,
      patient_first_name: 'Juan',
      patient_last_name: 'Dela Cruz',
      patient_phone: '+639175559999',
      patient_medical_alerts: 'Penicillin allergy',
      service_name: 'Comprehensive Oral Prophylaxis',
      start_at: '2026-11-20 10:00:00',
      operatory_chair: 'Operatory Chair 1',
      status: 'CONFIRMED',
    },
    activity_summary: {
      completed_this_week: 5,
      upcoming_this_week: 7,
      pending_documentation_count: 2,
      cancelled_this_week: 1,
    },
    today_appointments: [
      {
        id: 101,
        patient_first_name: 'Juan',
        patient_last_name: 'Dela Cruz',
        patient_medical_alerts: 'Penicillin allergy',
        service_name: 'Comprehensive Oral Prophylaxis',
        start_at: '2026-11-20 10:00:00',
        operatory_chair: 'Operatory Chair 1',
        status: 'CONFIRMED',
      },
      {
        id: 102,
        patient_first_name: 'Elena',
        patient_last_name: 'Reyes',
        patient_medical_alerts: null,
        service_name: 'Tooth Extraction',
        start_at: '2026-11-20 14:00:00',
        operatory_chair: 'Operatory Chair 2',
        status: 'PENDING',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    appointmentsApi.getDentistDashboard.mockResolvedValue(mockDashboardData);
    schedulesApi.getDentistSchedules.mockResolvedValue([
      {
        id: 1,
        dentist_id: 1,
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '17:00:00',
        operatory_chair: 'Operatory Chair 1',
      },
    ]);
    schedulesApi.getDentistTimeOff.mockResolvedValue([
      {
        id: 1,
        dentist_id: 1,
        start_at: '2026-12-01 00:00:00',
        end_at: '2026-12-03 00:00:00',
        reason: 'Dental Conference (CME)',
        approved_by_user_id: 10,
      },
    ]);
    schedulesApi.requestTimeOff.mockResolvedValue({ id: 2 });
  });

  it('renders clinical practice overview with doctor info and real metric counts', async () => {
    render(<DentistDashboard dentistId={1} onNavigateTab={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Dr\. Maria Santos/i)).toBeDefined();
      expect(screen.getByText(/PRC: PRC-0042189/i)).toBeDefined();
    });

    // 4 Live Metric Stat Cards verified via accessibility labels
    expect(screen.getByLabelText(/Today's Visits: 3/i)).toBeDefined();
    expect(screen.getByLabelText(/Upcoming Confirmed: 8/i)).toBeDefined();
    expect(screen.getByLabelText(/Awaiting Review: 2/i)).toBeDefined();
    expect(screen.getByLabelText(/Completed Care: 14/i)).toBeDefined();
  });

  it('renders next patient card with patient details, alerts, and CTA', async () => {
    const handleSelect = vi.fn();
    render(<DentistDashboard dentistId={1} onSelectAppointment={handleSelect} />);

    await waitFor(() => {
      expect(screen.getByText(/Next Scheduled Patient/i)).toBeDefined();
      expect(screen.getAllByText('Juan Dela Cruz').length).toBeGreaterThan(0);
      expect(screen.getByText(/Medical Alert: Penicillin allergy/i)).toBeDefined();
    });

    const ctaBtn = screen.getByText(/Start Consultation \/ View Details/i);
    fireEvent.click(ctaBtn);
    expect(handleSelect).toHaveBeenCalledWith(101);
  });

  it('renders today appointments queue with search and status filtering', async () => {
    render(<DentistDashboard dentistId={1} onNavigateTab={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('appointment-queue')).toBeDefined();
    });

    const queue = screen.getByTestId('appointment-queue');
    expect(within(queue).getByText('Juan Dela Cruz')).toBeDefined();
    expect(within(queue).getByText('Elena Reyes')).toBeDefined();

    // Filter by searching for Elena
    const searchInput = screen.getByPlaceholderText(/Search today's queue/i);
    fireEvent.change(searchInput, { target: { value: 'Elena' } });

    expect(within(queue).getByText('Elena Reyes')).toBeDefined();
    expect(within(queue).queryByText('Juan Dela Cruz')).toBeNull();

    // Reset search
    fireEvent.change(searchInput, { target: { value: '' } });

    // Filter by CONFIRMED tab
    const confirmedChip = screen.getByRole('button', { name: 'CONFIRMED' });
    fireEvent.click(confirmedChip);
    expect(within(queue).getByText('Juan Dela Cruz')).toBeDefined();
    expect(within(queue).queryByText('Elena Reyes')).toBeNull();
  });

  it('renders clinical activity summary and highlights pending documentation notice', async () => {
    render(<DentistDashboard dentistId={1} onNavigateTab={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Weekly Clinical Activity Summary/i)).toBeDefined();
      expect(screen.getByText(/Clinical Documentation Notice/i)).toBeDefined();
      expect(screen.getByText(/You have 2 completed visit\(s\) awaiting clinical procedure notes/i)).toBeDefined();
    });
  });

  it('opens leave request modal and submits to schedulesApi', async () => {
    render(<DentistDashboard dentistId={1} onNavigateTab={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Request Leave \/ Time Off/i })).toBeDefined();
    });

    const openModalBtn = screen.getByRole('button', { name: /Request Leave \/ Time Off/i });
    fireEvent.click(openModalBtn);

    expect(screen.getByText(/Submit your practitioner leave request/i)).toBeDefined();
    expect(screen.getByText(/Submit your practitioner leave request/i)).toHaveClass('text-justify');
    expect(
      screen.queryByText(/Reserve unavailability hours for administrative review and schedule blocking\./i)
    ).toBeNull();
    expect(screen.queryByText('*')).toBeNull();

    // Quick-select preset updates the leave reason field
    const medicalChip = screen.getByRole('button', { name: 'Medical / Sick Leave' });
    fireEvent.click(medicalChip);
    expect(screen.getByLabelText(/Reason \/ Leave Category/i)).toHaveValue('Medical / Sick Leave');

    const cmeChip = screen.getByRole('button', { name: 'Annual Dental Conference (CME)' });
    fireEvent.click(cmeChip);

    // Fill datetime inputs using accessible label queries
    const startInput = screen.getByLabelText(/Start Date & Time/i);
    const endInput = screen.getByLabelText(/End Date & Time/i);
    const submitBtn = screen.getByRole('button', { name: /Submit Request/i });

    fireEvent.change(startInput, { target: { value: '2026-12-05T09:00' } });
    fireEvent.change(endInput, { target: { value: '2026-12-07T17:00' } });
    expect(screen.getByText(/Requested Duration:/i)).toBeDefined();
    expect(screen.getByText(/2 days, 8 hours/i)).toBeDefined();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(schedulesApi.requestTimeOff).toHaveBeenCalledWith({
        start_at: '2026-12-05 09:00:00',
        end_at: '2026-12-07 17:00:00',
        reason: 'Annual Dental Conference (CME)',
      });
    });
  });

  it('triggers onNavigateTab when clicking shortcuts or stat cards', async () => {
    const handleNavigate = vi.fn();
    render(<DentistDashboard dentistId={1} onNavigateTab={handleNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(/Clinical Shortcuts/i)).toBeDefined();
    });

    const apptBtn = screen.getByText('Assigned Appointments');
    fireEvent.click(apptBtn);
    expect(handleNavigate).toHaveBeenCalledWith('appointments');
  });

  it('deduplicates repeated active shifts, filters inactive shifts, and displays formatted 12-hour shift ranges', async () => {
    schedulesApi.getDentistSchedules.mockResolvedValue([
      { id: 20, dentist_id: 1, day_of_week: 1, start_time: '09:00:00', end_time: '12:00:00', operatory_chair: 'Operatory Chair 1', is_active: 1 },
      { id: 30, dentist_id: 1, day_of_week: 1, start_time: '09:00:00', end_time: '12:00:00', operatory_chair: 'Operatory Chair 1', is_active: 1 },
      { id: 21, dentist_id: 1, day_of_week: 1, start_time: '13:00:00', end_time: '17:00:00', operatory_chair: 'Operatory Chair 1', is_active: 1 },
      { id: 99, dentist_id: 1, day_of_week: 2, start_time: '09:00:00', end_time: '12:00:00', operatory_chair: 'Operatory Chair 1', is_active: 0 },
    ]);

    render(<DentistDashboard dentistId={1} onNavigateTab={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('2 active shifts')).toBeDefined();
      expect(screen.getByText('9:00 AM – 12:00 PM')).toBeDefined();
      expect(screen.getByText('1:00 PM – 5:00 PM')).toBeDefined();
      expect(screen.getByText(/1 active day · 7h\/wk/i)).toBeDefined();
    });
  });
});
