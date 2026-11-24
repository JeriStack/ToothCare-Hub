import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PatientServicesPage } from '../../features/services/pages/PatientServicesPage';
import { servicesApi } from '../../features/services/api';

vi.mock('../../features/services/api', () => ({
  servicesApi: {
    getPublicServices: vi.fn(),
  },
}));

describe('PatientServicesPage Component', () => {
  const mockServices = [
    {
      id: 1,
      name: 'Dental Cleaning (Prophylaxis)',
      description: 'Comprehensive plaque and tartar removal for optimal oral hygiene.',
      price: '1500.00',
      duration_minutes: 45,
      category: 'Preventive Care',
      is_active: 1,
    },
    {
      id: 2,
      name: 'Composite Tooth Filling',
      description: 'Tooth-colored resin filling for cavities and minor tooth decay.',
      price: '1800.00',
      duration_minutes: 60,
      category: 'Restorative',
      is_active: 1,
    },
    {
      id: 3,
      name: 'Archived Dental Whitening',
      description: 'Old discontinued service.',
      price: '5000.00',
      duration_minutes: 60,
      category: 'Cosmetic',
      is_active: 0, // Inactive service should be excluded from active catalog
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders active dental services and excludes inactive services', async () => {
    servicesApi.getPublicServices.mockResolvedValueOnce(mockServices);

    render(<PatientServicesPage onBookService={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Dental Cleaning (Prophylaxis)')).toBeDefined();
      expect(screen.getByText('Composite Tooth Filling')).toBeDefined();
      expect(screen.queryByText('Archived Dental Whitening')).toBeNull();
    });
  });

  it('filters services by search query', async () => {
    servicesApi.getPublicServices.mockResolvedValueOnce(mockServices);

    render(<PatientServicesPage onBookService={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Dental Cleaning (Prophylaxis)')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText(/Search procedure or treatment/i);
    fireEvent.change(searchInput, { target: { value: 'Filling' } });

    expect(screen.queryByText('Dental Cleaning (Prophylaxis)')).toBeNull();
    expect(screen.getByText('Composite Tooth Filling')).toBeDefined();
  });

  it('filters services by category dropdown beside the search bar', async () => {
    servicesApi.getPublicServices.mockResolvedValueOnce(mockServices);

    render(<PatientServicesPage onBookService={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Dental Cleaning (Prophylaxis)')).toBeDefined();
      expect(screen.getByText('Composite Tooth Filling')).toBeDefined();
    });

    const categorySelect = screen.getByLabelText(/Filter by category/i);
    fireEvent.change(categorySelect, { target: { value: 'Restorative' } });

    expect(screen.queryByText('Dental Cleaning (Prophylaxis)')).toBeNull();
    expect(screen.getByText('Composite Tooth Filling')).toBeDefined();
  });

  it('triggers onBookService when patient clicks Book This Service', async () => {
    servicesApi.getPublicServices.mockResolvedValueOnce(mockServices);
    const onBookMock = vi.fn();

    render(<PatientServicesPage onBookService={onBookMock} />);

    await waitFor(() => {
      expect(screen.getByText('Dental Cleaning (Prophylaxis)')).toBeDefined();
    });

    const bookButtons = screen.getAllByRole('button', { name: /Book/i });
    fireEvent.click(bookButtons[0]);

    expect(onBookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Dental Cleaning (Prophylaxis)',
      })
    );
  });
});
