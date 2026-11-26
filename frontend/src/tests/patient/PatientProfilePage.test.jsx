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

const { mockPatientsApi, mockRefreshUser } = vi.hoisted(() => {
  return {
    mockPatientsApi: {
      getMyProfile: vi.fn(),
      updateMyProfile: vi.fn(),
      uploadMyAvatar: vi.fn(),
      deleteMyAvatar: vi.fn(),
    },
    mockRefreshUser: vi.fn().mockResolvedValue(null),
  };
});

vi.mock('../../features/auth', () => ({
  useAuth: () => ({
    user: staticUser,
    refreshUser: mockRefreshUser,
  }),
}));

vi.mock('../../features/auth/context/AuthContext', () => ({
  useAuth: () => ({
    user: staticUser,
    refreshUser: mockRefreshUser,
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
    avatar_url: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPatientsApi.getMyProfile.mockResolvedValue(mockPatientProfile);
    mockPatientsApi.updateMyProfile.mockResolvedValue({
      ...mockPatientProfile,
      phone: '09179998888',
    });
    mockPatientsApi.uploadMyAvatar.mockResolvedValue({
      ...mockPatientProfile,
      avatar_url: '/api/v1/patients/10/avatar?v=123',
    });
    mockPatientsApi.deleteMyAvatar.mockResolvedValue({
      ...mockPatientProfile,
      avatar_url: null,
    });
  });

  it('renders patient profile data correctly', async () => {
    render(<PatientProfilePage onProfileUpdated={vi.fn()} />);

    expect(await screen.findByDisplayValue('Juan')).toBeDefined();
    expect(await screen.findByDisplayValue('Dela Cruz')).toBeDefined();
    expect(await screen.findByDisplayValue('patient.juan@example.com')).toBeDefined();
    expect(await screen.findByDisplayValue('09171234567')).toBeDefined();
    expect(await screen.findByDisplayValue(/Penicillin allergy/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Upload Photo/i })).toBeDefined();
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

  it('discards unsaved changes back to the loaded snapshot', async () => {
    render(<PatientProfilePage onProfileUpdated={vi.fn()} />);

    const firstNameInput = await screen.findByDisplayValue('Juan');
    fireEvent.change(firstNameInput, { target: { value: 'Carlos' } });
    expect(screen.getByText(/Unsaved changes/i)).toBeDefined();

    const discardBtn = screen.getByRole('button', { name: /Discard Changes/i });
    fireEvent.click(discardBtn);

    expect(screen.getByDisplayValue('Juan')).toBeDefined();
    expect(screen.queryByText(/Unsaved changes/i)).toBeNull();
  });

  it('validates unsupported file type and oversize images before upload', async () => {
    render(<PatientProfilePage onProfileUpdated={vi.fn()} />);
    await screen.findByDisplayValue('Juan');

    const fileInput = document.getElementById('profile-avatar-input');
    expect(fileInput).toBeTruthy();

    const badFile = new File(['<svg></svg>'], 'avatar.svg', { type: 'image/svg+xml' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    expect(await screen.findByText(/Please choose a JPG, PNG, or WebP image file\./i)).toBeDefined();
    expect(mockPatientsApi.uploadMyAvatar).not.toHaveBeenCalled();

    const oversizedFile = new File([new Uint8Array(2 * 1024 * 1024 + 10)], 'large.png', {
      type: 'image/png',
    });
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    expect(await screen.findByText(/Profile photo must be 2 MB or smaller\./i)).toBeDefined();
    expect(mockPatientsApi.uploadMyAvatar).not.toHaveBeenCalled();
  });

  it('uploads and removes a patient profile picture and refreshes auth user state', async () => {
    const onProfileUpdatedMock = vi.fn();
    render(<PatientProfilePage onProfileUpdated={onProfileUpdatedMock} />);
    await screen.findByDisplayValue('Juan');

    const fileInput = document.getElementById('profile-avatar-input');
    const validPng = new File([new Uint8Array([137, 80, 78, 71])], 'portrait.png', {
      type: 'image/png',
    });

    fireEvent.change(fileInput, { target: { files: [validPng] } });

    await waitFor(() => {
      expect(mockPatientsApi.uploadMyAvatar).toHaveBeenCalledWith(validPng);
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(onProfileUpdatedMock).toHaveBeenCalledWith('Profile photo updated.');
    });

    expect(await screen.findByAltText('Juan Dela Cruz profile photo')).toBeDefined();
    const removeBtn = await screen.findByRole('button', { name: /Remove/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(mockPatientsApi.deleteMyAvatar).toHaveBeenCalledTimes(1);
      expect(onProfileUpdatedMock).toHaveBeenCalledWith('Profile photo removed.');
    });

    expect(screen.queryByAltText('Juan Dela Cruz profile photo')).toBeNull();
  });

  it('keeps Account Details minimized by default and toggles open/closed as a dropdown', async () => {
    render(<PatientProfilePage onProfileUpdated={vi.fn()} />);
    await screen.findByDisplayValue('Juan');

    const toggleBtn = screen.getByRole('button', { name: /Account Details/i });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Patient Record')).toBeNull();

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Patient Record')).toBeDefined();
    expect(screen.getByText('#10')).toBeDefined();

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Patient Record')).toBeNull();
  });
});
