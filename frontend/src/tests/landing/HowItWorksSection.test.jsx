import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HowItWorksSection } from '../../features/landing/components/HowItWorksSection';

describe('HowItWorksSection Component', () => {
  it('renders all 4 workflow steps with justified descriptions and invokes onBookAppointment', () => {
    const handleBook = vi.fn();
    render(<HowItWorksSection onBookAppointment={handleBook} />);

    expect(screen.getByRole('heading', { name: 'How It Works' })).toBeInTheDocument();

    ['Explore Services', 'Choose Your Dentist', 'Select Live Time Slot', 'Submit & Track Request'].forEach((title, idx) => {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
      expect(screen.getByText(`Step ${idx + 1} of 4`)).toBeInTheDocument();
    });

    const firstDesc = screen.getByText(/Review standard clinic procedures/i);
    expect(firstDesc.className).toContain('text-justify');

    fireEvent.click(screen.getByRole('button', { name: /start booking request/i }));
    expect(handleBook).toHaveBeenCalledTimes(1);
  });
});
