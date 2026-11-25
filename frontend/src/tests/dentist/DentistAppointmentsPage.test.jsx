import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DentistAppointmentsPage } from '../../features/dentists/pages/DentistAppointmentsPage';
import { appointmentsApi } from '../../features/appointments/api';

vi.mock('../../features/appointments/api', () => ({
  appointmentsApi: {
    listDentist: vi.fn(),
  },
}));

describe('DentistAppointmentsPage Component', () => {
  const mockAppointments = [
    {
      id: 201,
      patient_first_name: 'Ana',
      patient_last_name: 'Reyes',
      patient_phone: '09171234567',
      patient_gender: 'FEMALE',
      patient_medical_alerts: 'Asthma',
      service_name: 'Root Canal Therapy',
      service_duration: 90,
      start_at: '2026-11-20 14:00:00',
      operatory_chair: 'Chair 1',
      status: 'CONFIRMED',
      chief_complaint: 'Severe molar ache',
    },
    {
      id: 202,
      patient_first_name: 'Carlos',
      patient_last_name: 'Tan',
      patient_phone: '09179876543',
      patient_gender: 'MALE',
      patient_medical_alerts: null,
      service_name: 'Dental Cleaning',
      service_duration: 45,
      start_at: '2026-11-21 11:00:00',
      operatory_chair: 'Chair 1',
      status: 'PENDING',
      chief_complaint: 'Routine cleaning request',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    appointmentsApi.listDentist.mockResolvedValue({
      items: mockAppointments,
      meta: { total: 2, page: 1, per_page: 20, last_page: 1 },
    });
  });

  it('renders assigned appointments list with patient details and medical alerts', async () => {
    render(<DentistAppointmentsPage onSelectAppointment={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Ana Reyes')).toBeDefined();
      expect(screen.getByText('Carlos Tan')).toBeDefined();
      expect(screen.getByText(/Asthma/i)).toBeDefined();
      expect(screen.getByText(/Root Canal Therapy/i)).toBeDefined();
    });
  });

  it('filters appointments when changing status dropdown', async () => {
    render(<DentistAppointmentsPage onSelectAppointment={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Ana Reyes')).toBeDefined();
    });

    const statusSelect = screen.getByLabelText(/Filter appointments by status/i);
    fireEvent.change(statusSelect, { target: { value: 'CONFIRMED' } });

    expect(appointmentsApi.listDentist).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CONFIRMED' })
    );
  });

  it('calls onSelectAppointment when clinician clicks Manage button', async () => {
    const handleSelect = vi.fn();
    render(<DentistAppointmentsPage onSelectAppointment={handleSelect} />);

    await waitFor(() => {
      expect(screen.getAllByText('Manage').length).toBeGreaterThan(0);
    });

    const manageButtons = screen.getAllByText('Manage');
    fireEvent.click(manageButtons[0]);

    expect(handleSelect).toHaveBeenCalledWith(201);
  });
});
