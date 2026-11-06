import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../../components/ui/StatusBadge';

describe('StatusBadge Component', () => {
  it('renders PENDING status correctly with semantic text and role="status"', () => {
    render(<StatusBadge status="PENDING" />);
    const badge = screen.getByRole('status');
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain('Pending Review');
  });

  it('renders CONFIRMED status correctly', () => {
    render(<StatusBadge status="CONFIRMED" />);
    const badge = screen.getByRole('status');
    expect(badge.textContent).toContain('Confirmed');
  });

  it('renders COMPLETED status correctly', () => {
    render(<StatusBadge status="COMPLETED" />);
    const badge = screen.getByRole('status');
    expect(badge.textContent).toContain('Completed');
  });

  it('renders CANCELLED status correctly', () => {
    render(<StatusBadge status="CANCELLED" />);
    const badge = screen.getByRole('status');
    expect(badge.textContent).toContain('Cancelled');
  });

  it('renders REJECTED status correctly', () => {
    render(<StatusBadge status="REJECTED" />);
    const badge = screen.getByRole('status');
    expect(badge.textContent).toContain('Declined');
  });
});
