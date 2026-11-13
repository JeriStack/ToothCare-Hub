import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BenefitsSection } from '../../features/landing/components/BenefitsSection';

describe('BenefitsSection Component', () => {
  it('renders section heading, pillar tags, and all six patient care benefit cards', () => {
    render(<BenefitsSection />);

    expect(screen.getByRole('heading', { name: 'Designed for Modern Patient Care' })).toBeInTheDocument();

    const titles = [
      'Availability-Based Scheduling',
      'Turnaround Sanitization Buffers',
      'Complete Lifecycle History',
      'Immutable Price Snapshots',
      'Symptom & Chief Complaint Notes',
      'Accessible Mobile Interface',
    ];

    titles.forEach((title) => {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    });

    ['Real-Time', 'Hygiene', 'Auditability', 'Transparency', 'Clinical Prep', 'Responsive'].forEach((tag) => {
      expect(screen.getByText(tag)).toBeInTheDocument();
    });
  });
});
