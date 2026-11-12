import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StaffProfilePage } from '../../features/staff/pages/StaffProfilePage';

const staticUser = {
  id: 3,
  email: 'receptionist@toothcare.com',
  first_name: 'Clarisse',
  last_name: 'Mendoza',
  role: 'RECEPTIONIST',
  phone: '+63 917 800 1234',
  avatar_url: null,
};

const { mockAuthApi, mockRefreshUser } = vi.hoisted(() => {
  return {
    mockAuthApi: {
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

vi.mock('../../features/auth/api', () => ({
  authApi: mockAuthApi,
  default: mockAuthApi,
}));

describe('StaffProfilePage Component', () => {
  const mockStaffProfile = {
    id: 3,
    email: 'receptionist@toothcare.com',
    first_name: 'Clarisse',
    last_name: 'Mendoza',
    role: 'RECEPTIONIST',
    phone: '+63 917 800 1234',
    is_active: 1,
    permissions: ['appointments.view', 'appointments.manage'],
    avatar_url: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthApi.getMyProfile.mockResolvedValue(mockStaffProfile);
    mockAuthApi.updateMyProfile.mockResolvedValue({
      ...mockStaffProfile,
      phone: '+63 917 999 8888',
    });
    mockAuthApi.uploadMyAvatar.mockResolvedValue({
      ...mockStaffProfile,
      avatar_url: '/api/v1/users/3/avatar?v=123',
    });
    mockAuthApi.deleteMyAvatar.mockResolvedValue({
      ...mockStaffProfile,
      avatar_url: null,
    });
  });

  it('renders staff profile data cleanly', async () => {
    render(<StaffProfilePage onProfileUpdated={vi.fn()} />);

    expect(await screen.findByDisplayValue('Clarisse')).toBeDefined();
    expect(await screen.findByDisplayValue('Mendoza')).toBeDefined();
    expect(await screen.findByDisplayValue('receptionist@toothcare.com')).toBeDefined();
    expect(await screen.findByDisplayValue('+63 917 800 1234')).toBeDefined();
    expect(screen.getAllByText(/Front Desk Specialist/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Upload Photo/i })).toBeDefined();
  });

  it('updates staff profile and refreshes auth user state', async () => {
    const onProfileUpdatedMock = vi.fn();
    render(<StaffProfilePage onProfileUpdated={onProfileUpdatedMock} />);

    const phoneInput = await screen.findByDisplayValue('+63 917 800 1234');
    fireEvent.change(phoneInput, { target: { value: '+63 917 999 8888' } });

    const submitBtn = await screen.findByRole('button', { name: /Save Profile Changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockAuthApi.updateMyProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+63 917 999 8888',
        })
      );
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(onProfileUpdatedMock).toHaveBeenCalledWith('Your profile has been saved.');
    });
  });

  it('discards unsaved changes back to loaded snapshot', async () => {
    render(<StaffProfilePage onProfileUpdated={vi.fn()} />);

    const firstNameInput = await screen.findByDisplayValue('Clarisse');
    fireEvent.change(firstNameInput, { target: { value: 'Maria' } });
    expect(screen.getByText(/Unsaved changes/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Discard Changes/i }));
    expect(screen.getByDisplayValue('Clarisse')).toBeDefined();
    expect(screen.queryByText(/Unsaved changes/i)).toBeNull();
  });

  it('validates unsupported file type and oversize images before upload', async () => {
    render(<StaffProfilePage onProfileUpdated={vi.fn()} />);
    await screen.findByDisplayValue('Clarisse');

    const fileInput = document.getElementById('profile-avatar-input');
    expect(fileInput).toBeTruthy();

    const badFile = new File(['<svg></svg>'], 'avatar.svg', { type: 'image/svg+xml' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    expect(await screen.findByText(/Please choose a JPG, PNG, or WebP image file\./i)).toBeDefined();
    expect(mockAuthApi.uploadMyAvatar).not.toHaveBeenCalled();

    const oversizedFile = new File([new Uint8Array(2 * 1024 * 1024 + 10)], 'large.png', {
      type: 'image/png',
    });
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    expect(await screen.findByText(/Profile photo must be 2 MB or smaller\./i)).toBeDefined();
    expect(mockAuthApi.uploadMyAvatar).not.toHaveBeenCalled();
  });

  it('uploads and removes a staff profile picture and refreshes auth user state', async () => {
    const onProfileUpdatedMock = vi.fn();
    render(<StaffProfilePage onProfileUpdated={onProfileUpdatedMock} />);
    await screen.findByDisplayValue('Clarisse');

    const fileInput = document.getElementById('profile-avatar-input');
    const validPng = new File([new Uint8Array([137, 80, 78, 71])], 'clarisse.png', {
      type: 'image/png',
    });

    fireEvent.change(fileInput, { target: { files: [validPng] } });

    await waitFor(() => {
      expect(mockAuthApi.uploadMyAvatar).toHaveBeenCalledWith(validPng);
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(onProfileUpdatedMock).toHaveBeenCalledWith('Profile photo updated.');
    });

    expect(await screen.findByAltText('Clarisse Mendoza profile photo')).toBeDefined();
    const removeBtn = await screen.findByRole('button', { name: /Remove/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(mockAuthApi.deleteMyAvatar).toHaveBeenCalledTimes(1);
      expect(onProfileUpdatedMock).toHaveBeenCalledWith('Profile photo removed.');
    });

    expect(screen.queryByAltText('Clarisse Mendoza profile photo')).toBeNull();
  });
});
