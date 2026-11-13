import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../../components/ui/Input';

describe('Input Component', () => {
  it('renders input with label properly associated via htmlFor', () => {
    render(<Input label="Email address" placeholder="youremail@example.com" />);
    const input = screen.getByLabelText(/email address/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'youremail@example.com');
  });

  it('renders required indicator when required is true', () => {
    render(<Input label="Full Name" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders error message and marks aria-invalid as true', () => {
    render(<Input label="Phone" error="Invalid phone number format" />);
    const input = screen.getByLabelText(/phone/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Invalid phone number format')).toBeInTheDocument();
  });

  it('renders helper text when provided', () => {
    render(<Input label="Password" helperText="Must be at least 8 characters." />);
    expect(screen.getByText('Must be at least 8 characters.')).toBeInTheDocument();
  });

  it('handles value changes via onChange handler', () => {
    const handleChange = vi.fn();
    render(<Input label="First Name" onChange={handleChange} />);
    const input = screen.getByLabelText(/first name/i);
    fireEvent.change(input, { target: { value: 'Maria' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('renders disabled state with appropriate attributes', () => {
    render(<Input label="Disabled Field" disabled />);
    const input = screen.getByLabelText(/disabled field/i);
    expect(input).toBeDisabled();
  });

  it('renders left and right icons inside container', () => {
    render(
      <Input
        label="Search"
        iconLeft={<span data-testid="search-icon">🔍</span>}
        iconRight={<span data-testid="clear-icon">✖</span>}
      />
    );
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    expect(screen.getByTestId('clear-icon')).toBeInTheDocument();
  });
});
