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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDentistsApi.getMyProfile.mockResolvedValue(mockDentistProfile);
    mockDentistsApi.updateMyProfile.mockResolvedValue({
      ...mockDentistProfile,
      phone: '+639179990000',
      specialization: 'Cosmetic Dentistry',
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
});
