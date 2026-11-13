import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../../components/ui/Button';

describe('Button Component', () => {
  it('renders children with default primary styles', () => {
    render(<Button>Book Appointment</Button>);
    const button = screen.getByRole('button', { name: /book appointment/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-[#0D9488]');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('supports custom variant classes', () => {
    const { rerender } = render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-[#CCFBF1]');

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button')).toHaveClass('border-slate-200');

    rerender(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-rose-600');

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-transparent');
  });

  it('supports sizing variants (sm, md, lg)', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('text-xs');

    rerender(<Button size="md">Medium</Button>);
    expect(screen.getByRole('button')).toHaveClass('text-sm');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('text-base');
  });

  it('renders loading spinner and sets aria-busy when isLoading is true', () => {
    render(<Button isLoading>Saving Profile</Button>);
    const button = screen.getByRole('button', { name: /saving profile/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('disables user interaction when disabled is true', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled Action</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('triggers onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    fireEvent.click(screen.getByRole('button', { name: /click me/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders left and right icons when provided', () => {
    render(
      <Button
        iconLeft={<span data-testid="left-icon">←</span>}
        iconRight={<span data-testid="right-icon">→</span>}
      >
        Navigate
      </Button>
    );
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });
});
