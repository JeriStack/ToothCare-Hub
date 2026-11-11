import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReceptionistDashboard } from '../../features/dashboard/ReceptionistDashboard';
import { receptionistApi } from '../../features/receptionist/api';

vi.mock('../../features/receptionist/api', () => ({
  receptionistApi: {
    getDashboard: vi.fn(),
    checkIn: vi.fn(),
    updateAttendance: vi.fn(),
    registerPatient: vi.fn(),
  },
}));

const mockSummary = {
  clinic_date: '2026-11-11',
  clinic_time: 'Wednesday, November 11, 2026, 10:00 PM PST',
  counts: {
    today_total: 5,
    pending_requests: 3,
    confirmed_today: 4,
    checked_in: 1,
    waiting: 1,
    in_consultation: 0,
    completed_today: 0,
    cancelled_today: 0,
  },
  today_schedule: [
    {
      id: 701,
      patient_id: 10,
      dentist_id: 4,
      service_id: 1,
      start_at: '2026-11-11 14:00:00',
      end_at: '2026-11-11 14:45:00',
      duration_snapshot: 45,
      price_snapshot: '1500.00',
      appointment_status: 'CONFIRMED',
      chief_complaint: 'Routine prophylaxis',
      operatory_chair: 'Operatory Chair 1',
      patient_first_name: 'Maria',
      patient_last_name: 'Santos',
      patient_phone: '+639171234567',
      patient_medical_alerts: 'None recorded',
      dentist_first_name: 'Roberto',
      dentist_last_name: 'Reyes',
      service_name: 'Dental Cleaning',
      service_category: 'Preventive',
      attendance_status: 'NOT_ARRIVED',
      checked_in_at: null,
      waiting_minutes: null,
    },
  ],
  waiting_list: [],
  pending_review: [],
};

describe('ReceptionistDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders front desk overview header and live clinic time', async () => {
    receptionistApi.getDashboard.mockResolvedValue(mockSummary);

    render(
      <ReceptionistDashboard
        user={{ email: 'receptionist@toothcare.com', role: 'RECEPTIONIST' }}
        onNavigateTab={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Front Desk Operations')).toBeInTheDocument();
      expect(screen.getByText(/Wednesday, November 11, 2026/)).toBeInTheDocument();
    });
  });

  it('renders 7 operational KPI summary counts', async () => {
    receptionistApi.getDashboard.mockResolvedValue(mockSummary);

    render(
      <ReceptionistDashboard
        user={{ email: 'receptionist@toothcare.com', role: 'RECEPTIONIST' }}
        onNavigateTab={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Today's Visits")).toBeInTheDocument();
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
      expect(screen.getAllByText('Checked In')[0]).toBeInTheDocument();
      expect(screen.getByText('Waiting Room')).toBeInTheDocument();
    });
  });

  it('renders today schedule and opens check-in confirmation modal', async () => {
    receptionistApi.getDashboard.mockResolvedValue(mockSummary);

    render(
      <ReceptionistDashboard
        user={{ email: 'receptionist@toothcare.com', role: 'RECEPTIONIST' }}
        onNavigateTab={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      expect(screen.getByText('Dental Cleaning')).toBeInTheDocument();
    });

    const checkInBtn = screen.getByRole('button', { name: /Check In/i });
    expect(checkInBtn).toBeInTheDocument();
    fireEvent.click(checkInBtn);

    await waitFor(() => {
      expect(screen.getByText('Confirm Patient Arrival')).toBeInTheDocument();
      expect(screen.getByText('Confirm Check-In')).toBeInTheDocument();
    });
  });
});
