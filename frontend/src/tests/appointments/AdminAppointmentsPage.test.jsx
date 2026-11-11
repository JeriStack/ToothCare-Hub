import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AdminAppointmentsPage } from '../../features/appointments/pages/AdminAppointmentsPage';
import { appointmentsApi } from '../../features/appointments/api';
import { dentistsApi } from '../../features/dentists/api';

vi.mock('../../features/appointments/api', () => ({
  appointmentsApi: {
    listAdmin: vi.fn(),
    getAdminById: vi.fn(),
    confirm: vi.fn(),
    reject: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
  },
}));

vi.mock('../../features/dentists/api', () => ({
  dentistsApi: {
    getPublicDentists: vi.fn(),
  },
}));

describe('AdminAppointmentsPage Component', () => {
  it('renders triage header and table with appointments', async () => {
    dentistsApi.getPublicDentists.mockResolvedValue([
      { id: 1, first_name: 'Sarah', last_name: 'Jenkins' },
    ]);

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
          dentist_room_number: 'Operatory 1',
          start_at: '2026-11-12 10:00:00',
          end_at: '2026-11-12 10:45:00',
          status: 'PENDING',
        },
      ],
      meta: { total: 1, page: 1, per_page: 15, last_page: 1 },
    });

    render(<AdminAppointmentsPage />);

    expect(screen.getByText('Appointment Triage & Management')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument();
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    });
  });

  it('renders correctly when appointment list is empty', async () => {
    dentistsApi.getPublicDentists.mockResolvedValue([]);
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
