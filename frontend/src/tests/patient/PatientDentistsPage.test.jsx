import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PatientDentistsPage } from '../../features/dentists/pages/PatientDentistsPage';
import { dentistsApi } from '../../features/dentists/api';

vi.mock('../../features/dentists/api', () => ({
  dentistsApi: {
    getPublicDentists: vi.fn(),
  },
}));

describe('PatientDentistsPage Component', () => {
  const mockDentists = [
    {
      id: 1,
      first_name: 'Maria',
      last_name: 'Santos',
      specialization: 'General & Cosmetic Dentistry',
      license_number: 'PRC-0042189',
      default_operatory_chair: 'Operatory Chair 1',
      bio: 'Over 12 years of clinical experience in aesthetic dental restorations and veneers.',
      is_active: 1,
    },
    {
      id: 2,
      first_name: 'Roberto',
      last_name: 'Reyes',
      specialization: 'Orthodontics',
      license_number: 'PRC-0051280',
      default_operatory_chair: 'Operatory Chair 2',
      bio: 'Specialist in malocclusion and clear aligner therapies.',
      is_active: 1,
    },
    {
      id: 3,
      first_name: 'Inactive',
      last_name: 'Doctor',
      specialization: 'Periodontics',
      license_number: 'PRC-0099999',
      is_active: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders active licensed dentists and excludes inactive doctors', async () => {
    dentistsApi.getPublicDentists.mockResolvedValueOnce(mockDentists);

    render(<PatientDentistsPage onBookDentist={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Dr\. Maria Santos, DMD/i)).toBeDefined();
      expect(screen.getByText(/Dr\. Roberto Reyes, DMD/i)).toBeDefined();
      expect(screen.queryByText(/Dr\. Inactive Doctor/i)).toBeNull();
    });
  });

  it('filters dentists by search query', async () => {
    dentistsApi.getPublicDentists.mockResolvedValueOnce(mockDentists);

    render(<PatientDentistsPage onBookDentist={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Dr\. Maria Santos/i)).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText(/Search dentist or specialty/i);
    fireEvent.change(searchInput, { target: { value: 'Orthodontics' } });

    expect(screen.queryByText(/Dr\. Maria Santos/i)).toBeNull();
    expect(screen.getByText(/Dr\. Roberto Reyes/i)).toBeDefined();
  });

  it('opens dentist profile dialog when clicking View Profile', async () => {
    dentistsApi.getPublicDentists.mockResolvedValueOnce(mockDentists);

    render(<PatientDentistsPage onBookDentist={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Dr\. Maria Santos/i)).toBeDefined();
    });

    const profileBtns = screen.getAllByRole('button', { name: /View Profile/i });
    fireEvent.click(profileBtns[0]);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/About the Practitioner/i)).toBeDefined();
    expect(screen.getByText(/PRC Professional License #PRC-0042189/i)).toBeDefined();
  });

  it('triggers onBookDentist when patient clicks Book Visit', async () => {
    dentistsApi.getPublicDentists.mockResolvedValueOnce(mockDentists);
    const onBookMock = vi.fn();

    render(<PatientDentistsPage onBookDentist={onBookMock} />);

    await waitFor(() => {
      expect(screen.getByText(/Dr\. Maria Santos/i)).toBeDefined();
    });

    const bookBtns = screen.getAllByRole('button', { name: /Book Visit/i });
    fireEvent.click(bookBtns[0]);

    expect(onBookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Maria',
        last_name: 'Santos',
      })
    );
  });
});
