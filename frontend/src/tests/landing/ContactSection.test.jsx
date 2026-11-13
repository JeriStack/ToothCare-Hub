import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContactSection } from '../../features/landing/components/ContactSection';

describe('ContactSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders operating hours, live clinic status badge, and emergency alert', () => {
    render(<ContactSection onBookAppointment={vi.fn()} />);

    expect(screen.getByText('Practice Operating Hours')).toBeInTheDocument();
    expect(screen.getByTestId('clinic-live-status')).toBeInTheDocument();
    expect(screen.getByText('Monday – Friday')).toBeInTheDocument();
    expect(screen.getByText('Saturday')).toBeInTheDocument();
    expect(screen.getByText('Sunday')).toBeInTheDocument();
    expect(screen.getByText('Closed (Facility Sanitization)')).toBeInTheDocument();
    expect(screen.getByText('Dental Emergencies')).toBeInTheDocument();
  });

  it('provides interactive tel/mailto links, copy buttons, and booking CTA', async () => {
    const handleBook = vi.fn();
    render(<ContactSection onBookAppointment={handleBook} />);

    const phoneLink = screen.getByRole('link', { name: /reception desk/i });
    const emailLink = screen.getByRole('link', { name: /clinic support email/i });

    expect(phoneLink).toHaveAttribute('href', 'tel:+63281234567');
    expect(emailLink).toHaveAttribute('href', 'mailto:reception@toothcarehub.local');

    fireEvent.click(screen.getByRole('button', { name: /copy clinic support email/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('reception@toothcarehub.local');
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /book consultation online/i }));
    expect(handleBook).toHaveBeenCalledTimes(1);
  });
});
