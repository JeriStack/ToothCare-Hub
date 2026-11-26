import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminAppointmentsPage } from '../../features/appointments/pages/AdminAppointmentsPage';
import { appointmentsApi } from '../../features/appointments/api';
import { dentistsApi } from '../../features/dentists/api';
import { servicesApi } from '../../features/services/api';
import { schedulesApi } from '../../features/schedules/api';

vi.mock('../../features/appointments/api', () => ({
  appointmentsApi: {
    listAdmin: vi.fn(),
    getAdminById: vi.fn(),
    checkAvailability: vi.fn(),
    confirm: vi.fn(),
    reject: vi.fn(),
    reschedule: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
  },
}));

vi.mock('../../features/schedules/api', () => ({
  schedulesApi: {
    getAvailability: vi.fn(),
  },
}));

vi.mock('../../features/dentists/api', () => ({
  dentistsApi: {
    getPublicDentists: vi.fn(),
  },
}));

vi.mock('../../features/services/api', () => ({
  servicesApi: {
    getPublicServices: vi.fn(),
  },
}));

describe('AdminAppointmentsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dentistsApi.getPublicDentists.mockResolvedValue([
      { id: 1, first_name: 'Sarah', last_name: 'Jenkins' },
      { id: 2, first_name: 'Roberto', last_name: 'Reyes' },
    ]);
    servicesApi.getPublicServices.mockResolvedValue([
      { id: 1, name: 'Dental Cleaning' },
    ]);
    schedulesApi.getAvailability.mockResolvedValue({
      availability: [
        {
          date: '2026-11-26',
          is_clinic_open: true,
          slots: [
            {
              start_at: '2026-11-26T09:00:00+08:00',
              end_at: '2026-11-26T09:45:00+08:00',
              duration_minutes: 45,
            },
          ],
        },
      ],
    });
  });

  it('renders triage header, operational summary cards, explicit date range labels, and table records', async () => {
    appointmentsApi.listAdmin.mockResolvedValue({
      data: [
        {
          id: 101,
          patient_first_name: 'Juan',
          patient_last_name: 'Dela Cruz',
          patient_phone: '09171234567',
          patient_email: 'juan@example.com',
          service_name: 'Dental Cleaning',
          price_snapshot: 1500,
          duration_snapshot: 45,
          dentist_first_name: 'Sarah',
          dentist_last_name: 'Jenkins',
          operatory_chair: 'Operatory Chair 1',
          start_at: '2026-11-12 10:00:00',
          end_at: '2026-11-12 10:45:00',
          status: 'PENDING',
          availability_check: {
            available: true,
            availability_status: 'AVAILABLE',
            reason_code: 'AVAILABLE',
            message: 'Dentist and clinic schedule are available for this appointment.',
          },
        },
      ],
      meta: {
        total: 1,
        page: 1,
        per_page: 15,
        last_page: 1,
        summary: {
          pending_review: 3,
          confirmed: 7,
          today_appointments: 2,
          scheduling_conflicts: 1,
          refreshed_at: '2026-11-24T10:00:00+08:00',
        },
      },
    });

    render(<AdminAppointmentsPage />);

    expect(screen.getByText('Appointment Triage & Management')).toBeInTheDocument();
    expect(screen.getByLabelText(/Appointment date/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument();
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
      expect(screen.getByText('Available')).toBeInTheDocument();
      expect(screen.getByText('Scheduling Conflicts')).toBeInTheDocument();
    });
  });

  it('filters appointments by a single selected calendar date and resets via Clear Filters', async () => {
    appointmentsApi.listAdmin.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, per_page: 15, last_page: 1 },
    });

    render(<AdminAppointmentsPage />);
    await waitFor(() => {
      expect(appointmentsApi.listAdmin).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText(/Appointment date/i), { target: { value: '2026-11-25' } });

    await waitFor(() => {
      expect(appointmentsApi.listAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ start_date: '2026-11-25', end_date: '2026-11-25', per_page: 15 }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Clear Filters/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/Appointment date/i)).toHaveValue('');
    });
  });

  it('disables Confirm on a conflicting pending appointment, shows conflict warning, and prefills editable rejection reason', async () => {
    const conflictCheck = {
      available: false,
      availability_status: 'SCHEDULING_CONFLICT',
      reason_code: 'APPOINTMENT_CONFLICT',
      message: 'Dr. Sarah Jenkins already has another scheduled appointment overlapping this time slot.',
      suggested_rejection_reason: 'The selected dentist has another appointment during your requested time. Please select another available time.',
      conflict_context: { window: 'Nov 25, 2026 10:00 AM – 10:45 AM' },
    };

    appointmentsApi.listAdmin.mockResolvedValue({
      data: [
        {
          id: 205,
          patient_first_name: 'Maria',
          patient_last_name: 'Garcia',
          patient_phone: '09170001111',
          service_name: 'Composite Tooth Filling',
          price_snapshot: 1800,
          duration_snapshot: 45,
          dentist_first_name: 'Sarah',
          dentist_last_name: 'Jenkins',
          operatory_chair: 'Operatory Chair 2',
          start_at: '2026-11-25 10:00:00',
          end_at: '2026-11-25 10:45:00',
          status: 'PENDING',
          availability_check: conflictCheck,
        },
      ],
      meta: { total: 1, page: 1, per_page: 15, last_page: 1 },
    });
    appointmentsApi.checkAvailability.mockResolvedValue(conflictCheck);
    appointmentsApi.reject.mockResolvedValue({ id: 205, status: 'REJECTED' });

    render(<AdminAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText('#205')).toBeInTheDocument();
      expect(screen.getByText('Scheduling Conflict')).toBeInTheDocument();
    });

    // Confirm button is disabled with clear explanation
    const blockedConfirmBtn = screen.getByRole('button', { name: /Confirm blocked for appointment #205/i });
    expect(blockedConfirmBtn).toBeDisabled();

    // Clicking Conflict opens the warning dialog
    fireEvent.click(screen.getByRole('button', { name: /Inspect conflict for appointment #205/i }));

    await waitFor(() => {
      expect(screen.getByText('Appointment Cannot Be Approved')).toBeInTheDocument();
      expect(screen.getByText(/This appointment remains pending and has not been approved/i)).toBeInTheDocument();
    });

    // Transition to Reject Appointment with automatically prefilled reason
    fireEvent.click(screen.getByRole('button', { name: /^Reject Appointment$/i }));

    const reasonInput = screen.getByLabelText(/Reason for Rejection/i);
    expect(reasonInput).toHaveValue(conflictCheck.suggested_rejection_reason);

    // Edit reason and confirm rejection
    fireEvent.change(reasonInput, {
      target: { value: 'Dr. Jenkins is fully booked at 10:00 AM. Please choose an afternoon slot.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm Rejection/i }));

    await waitFor(() => {
      expect(appointmentsApi.reject).toHaveBeenCalledWith(
        205,
        'Dr. Jenkins is fully booked at 10:00 AM. Please choose an afternoon slot.',
        'APPOINTMENT_CONFLICT'
      );
    });
  });

  it('allows receptionist to launch Reschedule / Reassign from the Conflict Warning dialog and submit validated slot', async () => {
    const conflictCheck = {
      available: false,
      availability_status: 'DENTIST_UNAVAILABLE',
      reason_code: 'APPROVED_LEAVE',
      message: 'Dr. Sarah Jenkins is on approved leave during the requested slot.',
      suggested_rejection_reason: 'The selected dentist is unavailable on your requested date.',
    };

    appointmentsApi.listAdmin.mockResolvedValue({
      data: [
        {
          id: 210,
          dentist_id: 1,
          service_id: 1,
          patient_first_name: 'Maria',
          patient_last_name: 'Garcia',
          patient_phone: '09170001111',
          service_name: 'Dental Cleaning',
          price_snapshot: 1500,
          duration_snapshot: 45,
          dentist_first_name: 'Sarah',
          dentist_last_name: 'Jenkins',
          operatory_chair: 'Operatory Chair 1',
          start_at: '2026-11-26 10:00:00',
          end_at: '2026-11-26 10:45:00',
          status: 'PENDING',
          availability_check: conflictCheck,
        },
      ],
      meta: { total: 1, page: 1, per_page: 15, last_page: 1 },
    });
    appointmentsApi.checkAvailability.mockResolvedValue(conflictCheck);
    appointmentsApi.reschedule.mockResolvedValue({ id: 211, status: 'PENDING', rescheduled_from_id: 210 });

    render(<AdminAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText('#210')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Inspect conflict for appointment #210/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reschedule \/ Reassign/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Reschedule \/ Reassign/i }));

    await waitFor(() => {
      expect(screen.getByText(/Reschedule \/ Reassign Appointment #210/i)).toBeInTheDocument();
    });

    // Explicitly reassign to Dr. Roberto Reyes (id: 2)
    fireEvent.change(screen.getByLabelText(/Assigned Dentist/i), { target: { value: '2' } });
    expect(screen.getByText(/Explicit dentist reassignment selected/i)).toBeInTheDocument();

    // Pick validated slot returned by AvailabilitySlotPicker
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /9:00 AM/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /9:00 AM/i }));

    fireEvent.click(screen.getByRole('button', { name: /Confirm Reschedule/i }));

    await waitFor(() => {
      expect(appointmentsApi.reschedule).toHaveBeenCalledWith(
        210,
        expect.objectContaining({
          dentist_id: 2,
          start_at: '2026-11-26T09:00:00+08:00',
        })
      );
    });
  });

  it('blocks approval when live availability verification fails with a backend error', async () => {
    appointmentsApi.listAdmin.mockResolvedValue({
      data: [
        {
          id: 301,
          patient_first_name: 'Elena',
          patient_last_name: 'Reyes',
          service_name: 'Dental Cleaning',
          price_snapshot: 1500,
          duration_snapshot: 30,
          dentist_first_name: 'Sarah',
          dentist_last_name: 'Jenkins',
          start_at: '2026-11-26 09:00:00',
          end_at: '2026-11-26 09:30:00',
          status: 'PENDING',
          availability_check: { available: true, availability_status: 'AVAILABLE' },
        },
      ],
      meta: { total: 1, page: 1, per_page: 15, last_page: 1 },
    });
    appointmentsApi.checkAvailability.mockRejectedValue(new Error('Availability service timeout'));

    render(<AdminAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText('#301')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirm appointment #301/i }));

    await waitFor(() => {
      expect(screen.getByText('Availability Validation Failed')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Approve & Confirm/i })).toBeDisabled();
  });

  it('renders correctly when appointment list is empty', async () => {
    appointmentsApi.listAdmin.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, per_page: 15, last_page: 1 },
    });

    render(<AdminAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText('No appointments matched the current filter criteria.')).toBeInTheDocument();
    });
  });

  it('renders gracefully when API throws an error', async () => {
    dentistsApi.getPublicDentists.mockRejectedValue(new Error('Network error'));
    appointmentsApi.listAdmin.mockRejectedValue(new Error('Failed to load appointments'));

    render(<AdminAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load appointments')).toBeInTheDocument();
    });
  });
});
