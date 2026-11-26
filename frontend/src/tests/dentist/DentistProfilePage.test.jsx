import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DentistProfilePage } from '../../features/dentists/pages/DentistProfilePage';

const staticUser = {
  id: 2,
  email: 'dentist.santos@example.com',
  role: 'DENTIST',
  dentist: { id: 5, first_name: 'Maria', last_name: 'Santos' },
};

const { mockDentistsApi, mockRefreshUser } = vi.hoisted(() => {
  return {
    mockDentistsApi: {
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

vi.mock('../../features/dentists/api', () => ({
  dentistsApi: mockDentistsApi,
  default: mockDentistsApi,
}));

describe('DentistProfilePage Component', () => {
  const mockDentistProfile = {
    id: 5,
    user_id: 2,
    email: 'dentist.santos@example.com',
    first_name: 'Maria',
    last_name: 'Santos',
    specialization: 'General Dentistry',
    license_number: 'PRC-2026-001',
    phone: '+639171112222',
    default_operatory_chair: 'Chair 1',
    bio: 'Focused on restorative and preventive care.',
    is_active: 1,
    appointment_count: 14,
    avatar_url: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDentistsApi.getMyProfile.mockResolvedValue(mockDentistProfile);
    mockDentistsApi.updateMyProfile.mockResolvedValue({
      ...mockDentistProfile,
      phone: '+639179990000',
      specialization: 'Cosmetic Dentistry',
    });
    mockDentistsApi.uploadMyAvatar.mockResolvedValue({
      ...mockDentistProfile,
      avatar_url: '/api/v1/dentists/5/avatar?v=123',
    });
    mockDentistsApi.deleteMyAvatar.mockResolvedValue({
      ...mockDentistProfile,
      avatar_url: null,
    });
  });

  it('renders practitioner profile data cleanly', async () => {
    render(<DentistProfilePage onProfileUpdated={vi.fn()} />);

    expect(await screen.findByDisplayValue('Maria')).toBeDefined();
    expect(await screen.findByDisplayValue('Santos')).toBeDefined();
    expect(await screen.findByDisplayValue('PRC-2026-001')).toBeDefined();
    expect(await screen.findByDisplayValue('dentist.santos@example.com')).toBeDefined();
    expect(await screen.findByDisplayValue('+639171112222')).toBeDefined();
  });

  it('updates practitioner profile and refreshes auth user state', async () => {
    const onProfileUpdatedMock = vi.fn();
    render(<DentistProfilePage onProfileUpdated={onProfileUpdatedMock} />);

    const phoneInput = await screen.findByDisplayValue('+639171112222');
    const specInput = await screen.findByDisplayValue('General Dentistry');

    fireEvent.change(phoneInput, { target: { value: '+639179990000' } });
    fireEvent.change(specInput, { target: { value: 'Cosmetic Dentistry' } });

    const submitBtn = await screen.findByRole('button', { name: /Save Profile Changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockDentistsApi.updateMyProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+639179990000',
          specialization: 'Cosmetic Dentistry',
        })
      );
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(onProfileUpdatedMock).toHaveBeenCalledTimes(1);
    });
  });

  it('discards unsaved changes back to loaded snapshot', async () => {
    render(<DentistProfilePage onProfileUpdated={vi.fn()} />);

    const specInput = await screen.findByDisplayValue('General Dentistry');
    fireEvent.change(specInput, { target: { value: 'Orthodontics' } });
    expect(screen.getByText(/Unsaved changes/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Discard Changes/i }));
    expect(screen.getByDisplayValue('General Dentistry')).toBeDefined();
    expect(screen.queryByText(/Unsaved changes/i)).toBeNull();
  });

  it('validates unsupported file types and oversize images before upload', async () => {
    render(<DentistProfilePage onProfileUpdated={vi.fn()} />);
    await screen.findByDisplayValue('Maria');

    const fileInput = document.getElementById('profile-avatar-input');
    expect(fileInput).toBeTruthy();

    const badFile = new File(['<svg></svg>'], 'avatar.svg', { type: 'image/svg+xml' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    expect(await screen.findByText(/Please choose a JPG, PNG, or WebP image file\./i)).toBeDefined();
    expect(mockDentistsApi.uploadMyAvatar).not.toHaveBeenCalled();

    const oversizedFile = new File([new Uint8Array(2 * 1024 * 1024 + 10)], 'large.png', {
      type: 'image/png',
    });
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    expect(await screen.findByText(/Profile photo must be 2 MB or smaller\./i)).toBeDefined();
    expect(mockDentistsApi.uploadMyAvatar).not.toHaveBeenCalled();
  });

  it('uploads and removes a dentist profile picture and refreshes auth user state', async () => {
    const onProfileUpdatedMock = vi.fn();
    render(<DentistProfilePage onProfileUpdated={onProfileUpdatedMock} />);
    await screen.findByDisplayValue('Maria');

    expect(screen.getByRole('button', { name: /Upload Photo/i })).toBeDefined();

    const fileInput = document.getElementById('profile-avatar-input');
    const validPng = new File([new Uint8Array([137, 80, 78, 71])], 'doctor.png', {
      type: 'image/png',
    });

    fireEvent.change(fileInput, { target: { files: [validPng] } });

    await waitFor(() => {
      expect(mockDentistsApi.uploadMyAvatar).toHaveBeenCalledWith(validPng);
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(onProfileUpdatedMock).toHaveBeenCalledWith('Profile photo updated.');
    });

    expect(await screen.findByAltText('Dr. Maria Santos profile photo')).toBeDefined();
    const removeBtn = await screen.findByRole('button', { name: /Remove/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(mockDentistsApi.deleteMyAvatar).toHaveBeenCalledTimes(1);
      expect(onProfileUpdatedMock).toHaveBeenCalledWith('Profile photo removed.');
    });

    expect(screen.queryByAltText('Dr. Maria Santos profile photo')).toBeNull();
  });

  it('keeps Account Details minimized by default and toggles open/closed as a dropdown', async () => {
    render(<DentistProfilePage onProfileUpdated={vi.fn()} />);
    await screen.findByDisplayValue('Maria');

    const toggleBtn = screen.getByRole('button', { name: /Account Details/i });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Practice Status')).toBeNull();

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Practice Status')).toBeDefined();
    expect(screen.getByText('Active & Licensed')).toBeDefined();

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Practice Status')).toBeNull();
  });
});
