import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    today_count: 3,
    upcoming_count: 8,
    pending_count: 2,
    completed_count: 14,
    today_appointments: [
      {
        id: 101,
        patient_first_name: 'Juan',
        patient_last_name: 'Dela Cruz',
        patient_medical_alerts: 'Penicillin allergy',
        service_name: 'Comprehensive Oral Prophylaxis',
        start_at: '2026-11-20 10:00:00',
        operatory_chair: 'Chair 1',
        status: 'CONFIRMED',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    appointmentsApi.getDentistDashboard.mockResolvedValue(mockDashboardData);
    schedulesApi.getDentistSchedules.mockResolvedValue([]);
    schedulesApi.getDentistTimeOff.mockResolvedValue([]);
  });

  it('renders clinical practice overview with doctor info and real metric counts', async () => {
    render(<DentistDashboard dentistId={1} onNavigateTab={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Dr\. Maria Santos/i)).toBeDefined();
      expect(screen.getByText(/PRC: PRC-0042189/i)).toBeDefined();
    });

    // 4 Live Metric Stat Cards
    expect(screen.getByText('3')).toBeDefined(); // Today's count
    expect(screen.getByText('8')).toBeDefined(); // Upcoming confirmed
    expect(screen.getByText('2')).toBeDefined(); // Pending review
    expect(screen.getByText('14')).toBeDefined(); // Completed care
  });

  it('renders today appointments with patient details and medical alerts', async () => {
    render(<DentistDashboard dentistId={1} onNavigateTab={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeDefined();
      expect(screen.getByText('Penicillin allergy')).toBeDefined();
      expect(screen.getByText(/Comprehensive Oral Prophylaxis/i)).toBeDefined();
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
});
