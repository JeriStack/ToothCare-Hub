import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stethoscope } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';

describe('EmptyState Component', () => {
  it('renders default title and description', () => {
    render(<EmptyState />);
    expect(screen.getByText('No records found')).toBeInTheDocument();
    expect(screen.getByText('There are no items to display at this time.')).toBeInTheDocument();
  });

  it('renders custom title, description, and custom icon', () => {
    render(
      <EmptyState
        title="No Available Appointments"
        description="Please select another date on the calendar."
        icon={Stethoscope}
      />
    );
    expect(screen.getByText('No Available Appointments')).toBeInTheDocument();
    expect(screen.getByText('Please select another date on the calendar.')).toBeInTheDocument();
  });

  it('renders call to action element when provided', () => {
    render(
      <EmptyState
        title="No Registered Patients"
        action={<button type="button">Register New Patient</button>}
      />
    );
    expect(screen.getByRole('button', { name: /register new patient/i })).toBeInTheDocument();
  });

  it('has region role and aria-label matching title for accessibility', () => {
    render(<EmptyState title="Dental Procedures Catalog" />);
    const region = screen.getByRole('region', { name: /dental procedures catalog/i });
    expect(region).toBeInTheDocument();
  });
});
