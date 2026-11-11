import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PatientProfilePage } from '../../features/patients/pages/PatientProfilePage';

const staticUser = {
  id: 1,
  email: 'patient.juan@example.com',
  role: 'PATIENT',
  patient: { id: 10, first_name: 'Juan', last_name: 'Dela Cruz' },
};

const { mockPatientsApi } = vi.hoisted(() => {
  return {
    mockPatientsApi: {
      getMyProfile: vi.fn(),
      updateMyProfile: vi.fn(),
    },
  };
});

vi.mock('../../features/auth', () => ({
  useAuth: () => ({
    user: staticUser,
  }),
}));

vi.mock('../../features/patients/api', () => ({
  patientsApi: mockPatientsApi,
  default: mockPatientsApi,
}));

describe('PatientProfilePage Component', () => {
  const mockPatientProfile = {
    id: 10,
    user_id: 1,
    email: 'patient.juan@example.com',
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    phone: '09171234567',
    gender: 'MALE',
    date_of_birth: '1990-05-15',
    address: '123 Rizal Ave, Manila',
    emergency_contact_name: 'Maria Dela Cruz',
    emergency_contact_phone: '09181234567',
    medical_alerts: 'Penicillin allergy; hypertension under medication.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPatientsApi.getMyProfile.mockResolvedValue(mockPatientProfile);
    mockPatientsApi.updateMyProfile.mockResolvedValue({
      ...mockPatientProfile,
      phone: '09179998888',
    });
  });

  it('renders patient profile data correctly', async () => {
    render(<PatientProfilePage onProfileUpdated={vi.fn()} />);

    expect(await screen.findByDisplayValue('Juan')).toBeDefined();
    expect(await screen.findByDisplayValue('Dela Cruz')).toBeDefined();
    expect(await screen.findByDisplayValue('patient.juan@example.com')).toBeDefined();
    expect(await screen.findByDisplayValue('09171234567')).toBeDefined();
    expect(await screen.findByDisplayValue(/Penicillin allergy/i)).toBeDefined();
  });

  it('updates patient profile and triggers onProfileUpdated callback', async () => {
    const onProfileUpdatedMock = vi.fn();

    render(<PatientProfilePage onProfileUpdated={onProfileUpdatedMock} />);

    const phoneInput = await screen.findByDisplayValue('09171234567');
    fireEvent.change(phoneInput, { target: { value: '09179998888' } });

    const submitBtn = await screen.findByRole('button', { name: /Save Profile/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPatientsApi.updateMyProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '09179998888',
        })
      );
      expect(onProfileUpdatedMock).toHaveBeenCalledTimes(1);
    });
  });
});
