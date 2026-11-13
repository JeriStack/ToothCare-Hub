import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ServicesSection } from '../../features/landing/components/ServicesSection';
import { servicesApi } from '../../features/services/api';

vi.mock('../../features/services/api', () => ({
  servicesApi: {
    getPublicServices: vi.fn(),
  },
}));

describe('ServicesSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    servicesApi.getPublicServices.mockResolvedValue([
      {
        id: 1,
        name: 'In-Office Teeth Whitening',
        category: 'Cosmetic',
        duration_minutes: 60,
        price: 7500,
        description: 'Chairside laser-activated hydrogen peroxide bleaching producing visible shade improvements.',
        is_active: 1,
      },
      {
        id: 2,
        name: 'Dental Prophylaxis (Cleaning)',
        category: 'Preventive',
        duration_minutes: 45,
        price: 1500,
        description: 'Comprehensive supra- and subgingival scaling, polishing, and topical fluoride application.',
        is_active: 1,
      },
      {
        id: 3,
        name: 'Deprecated Service',
        category: 'Preventive',
        duration_minutes: 30,
        price: 900,
        description: 'Inactive item that must stay hidden.',
        is_active: 0,
      },
    ]);
  });

  it('renders active services with justified descriptions, filters by category, and invokes onBookService', async () => {
    const handleBook = vi.fn();
    render(<ServicesSection onBookService={handleBook} />);

    await waitFor(() => {
      expect(screen.getByText('In-Office Teeth Whitening')).toBeInTheDocument();
    });

    expect(screen.getByText('Dental Prophylaxis (Cleaning)')).toBeInTheDocument();
    expect(screen.queryByText('Deprecated Service')).not.toBeInTheDocument();

    const desc = screen.getByText(/Chairside laser-activated/i);
    expect(desc.className).toContain('text-justify');

    fireEvent.click(screen.getByRole('button', { name: 'Cosmetic' }));
    expect(screen.getByText('In-Office Teeth Whitening')).toBeInTheDocument();
    expect(screen.queryByText('Dental Prophylaxis (Cleaning)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /book service/i }));
    expect(handleBook).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: 'In-Office Teeth Whitening' })
    );
  });
});
