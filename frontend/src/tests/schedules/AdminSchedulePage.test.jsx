import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminSchedulePage } from '../../features/schedules/pages/AdminSchedulePage';
import { schedulesApi } from '../../features/schedules/api';
import { dentistsApi } from '../../features/dentists/api';
import { servicesApi } from '../../features/services/api';

const mockUseAuth = vi.fn();

vi.mock('../../features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../features/schedules/api', () => ({
  schedulesApi: {
    getClinicHours: vi.fn(),
    updateClinicHours: vi.fn(),
    getClinicClosures: vi.fn(),
    createClinicClosure: vi.fn(),
    deleteClinicClosure: vi.fn(),
    getDentistSchedules: vi.fn(),
    createDentistSchedule: vi.fn(),
    updateDentistSchedule: vi.fn(),
    deleteDentistSchedule: vi.fn(),
    getDentistTimeOff: vi.fn(),
    createDentistTimeOff: vi.fn(),
    deleteDentistTimeOff: vi.fn(),
  },
}));

vi.mock('../../features/dentists/api', () => ({
  dentistsApi: {
    getAdminDentists: vi.fn(),
  },
}));

vi.mock('../../features/services/api', () => ({
  servicesApi: {
    getPublicServices: vi.fn(),
  },
}));

const sampleHours = [
  { day_of_week: 1, opening_time: '08:00:00', closing_time: '17:00:00', is_closed: 0 },
  { day_of_week: 2, opening_time: '08:00:00', closing_time: '17:00:00', is_closed: 0 },
  { day_of_week: 3, opening_time: '08:00:00', closing_time: '17:00:00', is_closed: 0 },
  { day_of_week: 4, opening_time: '08:00:00', closing_time: '17:00:00', is_closed: 0 },
  { day_of_week: 5, opening_time: '08:00:00', closing_time: '17:00:00', is_closed: 0 },
  { day_of_week: 6, opening_time: '08:00:00', closing_time: '12:00:00', is_closed: 0 },
  { day_of_week: 7, opening_time: '08:00:00', closing_time: '17:00:00', is_closed: 1 },
];

describe('AdminSchedulePage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schedulesApi.getClinicHours.mockResolvedValue(sampleHours);
    schedulesApi.getClinicClosures.mockResolvedValue([]);
    schedulesApi.updateClinicHours.mockResolvedValue(sampleHours);
    schedulesApi.getDentistSchedules.mockResolvedValue([
      { id: 10, day_of_week: 1, start_time: '08:00:00', end_time: '17:00:00', operatory_chair: 'Chair 1', is_active: 1 },
    ]);
    schedulesApi.getDentistTimeOff.mockResolvedValue([]);
    dentistsApi.getAdminDentists.mockResolvedValue({
      data: [{ id: 1, first_name: 'Maria', last_name: 'Santos', specialization: 'General Dentistry' }],
    });
    servicesApi.getPublicServices.mockResolvedValue([
      { id: 1, name: 'Dental Cleaning', duration_minutes: 45, price: 1500 },
    ]);
  });

  it('renders view-only clinic hours and hides admin write controls for Receptionists without settings.manage', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 3, role: 'RECEPTIONIST', first_name: 'Clarisse', last_name: 'Mendoza' },
      hasPermission: (perm) => ['appointments.view', 'dentists.view'].includes(perm),
    });

    render(<AdminSchedulePage />);

    await waitFor(() => {
      expect(screen.getByText('Weekly Facility Operating Hours')).toBeInTheDocument();
    });

    expect(screen.getByText('View-Only Access')).toBeInTheDocument();
    expect(screen.getByText('Managed by Clinic Administrator')).toBeInTheDocument();
    expect(screen.getAllByText('8:00 AM – 5:00 PM').length).toBe(5);
    expect(screen.getByText('Closed All Day')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Facility Hours/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Schedule Closure/i })).not.toBeInTheDocument();

    // Switch to Dentist Weekly Shifts tab — write buttons remain hidden for Receptionist
    fireEvent.click(screen.getByRole('tab', { name: /Dentist Weekly Shifts/i }));
    await waitFor(() => {
      expect(screen.getByText('View-Only Shifts')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Add Recurring Shift/i })).not.toBeInTheDocument();
  });

  it('supports intuitive Open/Closed switches, validation, Copy Mon to Weekdays, and saving for Admins', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 'ADMIN', first_name: 'Admin', last_name: 'User' },
      hasPermission: () => true,
    });

    render(<AdminSchedulePage />);

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /Monday clinic open status/i })).toBeInTheDocument();
    });

    const monSwitch = screen.getByRole('switch', { name: /Monday clinic open status/i });
    const sunSwitch = screen.getByRole('switch', { name: /Sunday clinic open status/i });
    expect(monSwitch).toHaveAttribute('aria-checked', 'true');
    expect(sunSwitch).toHaveAttribute('aria-checked', 'false');

    const saveBtn = screen.getByRole('button', { name: /Save Facility Hours/i });
    expect(saveBtn).toBeDisabled();

    // Invalid time range blocks saving
    const monClose = screen.getByLabelText(/Monday closing time/i);
    fireEvent.change(monClose, { target: { value: '07:00' } });
    expect(screen.getByText('Closing time must be after opening time.')).toBeInTheDocument();
    expect(saveBtn).toBeDisabled();

    // Fix Monday closing time to 18:00 and copy to weekdays
    fireEvent.change(monClose, { target: { value: '18:00' } });
    expect(screen.queryByText('Closing time must be after opening time.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Copy Mon to Weekdays/i }));

    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(schedulesApi.updateClinicHours).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Clinic weekly operating hours saved.')).toBeInTheDocument();
    });
  });
});
