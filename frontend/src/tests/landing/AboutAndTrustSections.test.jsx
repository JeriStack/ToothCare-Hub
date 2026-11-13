import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AboutSection } from '../../features/landing/components/AboutSection';
import { TrustSection } from '../../features/landing/components/TrustSection';

describe('AboutSection & TrustSection Components', () => {
  it('renders AboutSection mission, justified paragraphs, quality pillars, and booking CTA', () => {
    const handleBook = vi.fn();
    render(<AboutSection onBookAppointment={handleBook} />);

    expect(
      screen.getByRole('heading', { name: 'A Better Way to Manage Your Dental Appointments' })
    ).toBeInTheDocument();

    const intro = screen.getByText(/ToothCare Hub brings essential dental appointment information/i);
    expect(intro.className).toContain('text-justify');

    const pillarDesc = screen.getByText(/Pessimistic transaction locking serializes requests/i);
    expect(pillarDesc.className).toContain('text-justify');

    fireEvent.click(screen.getByRole('button', { name: /schedule a consultation/i }));
    expect(handleBook).toHaveBeenCalledTimes(1);
  });

  it('renders all 4 TrustSection value proposition cards with justified text and pillar tags', () => {
    render(<TrustSection />);

    [
      'Convenient Scheduling',
      'Dentist Information',
      'Clear Appointment Updates',
      'Organized Dental Services',
    ].forEach((title) => {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    });

    ['Scheduling', 'Doctors', 'Tracking', 'Pricing'].forEach((tag) => {
      expect(screen.getByText(tag)).toBeInTheDocument();
    });

    const trustDesc = screen.getByText(/Request appointments online with real-time slot calculation/i);
    expect(trustDesc.className).toContain('text-justify');
  });
});
