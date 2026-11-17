import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeroSection } from '../../features/landing/components/HeroSection';

describe('HeroSection Component', () => {
  it('renders headline, justified copy, upgraded stat cards, and CTAs', () => {
    const handleBook = vi.fn();
    const handleExplore = vi.fn();

    render(<HeroSection onBookAppointment={handleBook} onExploreServices={handleExplore} />);

    expect(
      screen.getByRole('heading', { name: 'Your trusted partner in dental health' })
    ).toBeInTheDocument();

    expect(screen.getByText('12K')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Smiles Protected' })).toBeInTheDocument();
    expect(screen.getByText('99%')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Schedule Precision' })).toBeInTheDocument();

    const smilesDesc = screen.getByText(/Trusted by families for reliable/i);
    const scheduleDesc = screen.getByText(/Delivering comfortable, on-time visits/i);
    expect(smilesDesc.className).toContain('text-justify');
    expect(scheduleDesc.className).toContain('text-justify');

    fireEvent.click(screen.getByRole('button', { name: /book your appointment/i }));
    expect(handleBook).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('link', { name: /explore services/i }));
    expect(handleExplore).toHaveBeenCalledTimes(1);
  });
});
