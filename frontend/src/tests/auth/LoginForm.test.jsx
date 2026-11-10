import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../features/auth/context/AuthContext';
import { LoginForm } from '../../features/auth/components/LoginForm';

vi.mock('../../features/auth/api', () => {
  return {
    default: {
      getMe: vi.fn().mockRejectedValue(new Error('Network error: offline')),
      login: vi.fn().mockRejectedValue(new Error('Network error: offline')),
      logout: vi.fn().mockResolvedValue({}),
      getCsrfToken: vi.fn().mockRejectedValue(new Error('Network error: offline')),
    },
    authApi: {
      getMe: vi.fn().mockRejectedValue(new Error('Network error: offline')),
      login: vi.fn().mockRejectedValue(new Error('Network error: offline')),
      logout: vi.fn().mockResolvedValue({}),
      getCsrfToken: vi.fn().mockRejectedValue(new Error('Network error: offline')),
    },
  };
});

describe('LoginForm Component', () => {
  it('renders email, password inputs, submit button, and quick demo buttons', async () => {
    const { container } = render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );

    const emailInput = container.querySelector('input[name="email"]');
    const passwordInput = container.querySelector('input[name="password"]');
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Quick Demo Access:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^patient$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^dentist$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^admin$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^staff$/i })).toBeInTheDocument();
  });

  it('validates empty inputs and prevents submission', async () => {
    render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(screen.getByText('Email address is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
  });

  it('pre-fills credentials when clicking Quick Demo buttons', async () => {
    const { container } = render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );

    const emailInput = container.querySelector('input[name="email"]');
    const passwordInput = container.querySelector('input[name="password"]');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeEnabled();
    });

    // Click Patient
    fireEvent.click(screen.getByRole('button', { name: /^patient$/i }));
    expect(emailInput.value).toBe('patient.juan@example.com');
    expect(passwordInput.value).toBe('Password123!');

    // Click Dentist
    fireEvent.click(screen.getByRole('button', { name: /^dentist$/i }));
    expect(emailInput.value).toBe('dr.santos@toothcare.local');
    expect(passwordInput.value).toBe('Password123!');

    // Click Admin
    fireEvent.click(screen.getByRole('button', { name: /^admin$/i }));
    expect(emailInput.value).toBe('admin@toothcare.local');
    expect(passwordInput.value).toBe('Password123!');

    // Click Staff
    fireEvent.click(screen.getByRole('button', { name: /^staff$/i }));
    expect(emailInput.value).toBe('receptionist@toothcare.local');
    expect(passwordInput.value).toBe('Password123!');
  });

  it('toggles password visibility when clicking eye button', async () => {
    const { container } = render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeEnabled();
    });

    const passwordInput = container.querySelector('input[name="password"]');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByLabelText(/show password/i);
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByLabelText(/hide password/i));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('calls onSuccess callback upon successful demo authentication', async () => {
    const handleSuccess = vi.fn();
    render(
      <AuthProvider>
        <LoginForm onSuccess={handleSuccess} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeEnabled();
    });

    // Fill with Patient demo account
    fireEvent.click(screen.getByRole('button', { name: /^patient$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'patient.juan@example.com',
          role: 'PATIENT',
        })
      );
    });
  });
});
