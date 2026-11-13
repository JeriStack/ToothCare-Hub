import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../features/auth/context/AuthContext';
import { LoginForm } from '../../features/auth/components/LoginForm';
import authApi from '../../features/auth/api';

vi.mock('../../features/auth/api', () => {
  const mockApi = {
    getMe: vi.fn().mockRejectedValue(new Error('Network error: offline')),
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue({}),
    getCsrfToken: vi.fn().mockRejectedValue(new Error('Network error: offline')),
  };
  return {
    default: mockApi,
    authApi: mockApi,
  };
});

describe('LoginForm Component', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    authApi.getMe.mockRejectedValue(new Error('No active session'));
    authApi.login.mockImplementation(async ({ email, password }) => {
      if (email === 'patient.juan@example.com' && password === 'Password123!') {
        return {
          id: 6,
          email: 'patient.juan@example.com',
          role: 'PATIENT',
          patient: { id: 1, first_name: 'Juan', last_name: 'Dela Cruz' },
        };
      }
      const err = new Error('Invalid email or password.');
      err.response = { status: 401, data: { error: { message: 'Invalid email or password. Please try again.' } } };
      throw err;
    });
  });

  it('renders email, password inputs, submit button, and navigation options', async () => {
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

    expect(screen.getByRole('button', { name: /create an account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forgot password\?/i })).toBeInTheDocument();
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

  it('calls onSuccess callback upon successful database authentication', async () => {
    const handleSuccess = vi.fn();
    const { container } = render(
      <AuthProvider>
        <LoginForm onSuccess={handleSuccess} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeEnabled();
    });

    const emailInput = container.querySelector('input[name="email"]');
    const passwordInput = container.querySelector('input[name="password"]');

    fireEvent.change(emailInput, { target: { value: 'patient.juan@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
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

  it('displays error alert on invalid credentials', async () => {
    const { container } = render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeEnabled();
    });

    const emailInput = container.querySelector('input[name="email"]');
    const passwordInput = container.querySelector('input[name="password"]');

    fireEvent.change(emailInput, { target: { value: 'patient.juan@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPassword!' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });

  it('passes remember_me flag and saves non-sensitive remembered email without storing password', async () => {
    const { container, unmount } = render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeEnabled();
    });

    const emailInput = container.querySelector('input[name="email"]');
    const passwordInput = container.querySelector('input[name="password"]');
    const rememberCheckbox = container.querySelector('input[name="remember_me"]');

    expect(rememberCheckbox).not.toBeChecked();

    fireEvent.change(emailInput, { target: { value: 'patient.juan@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    fireEvent.click(rememberCheckbox);
    expect(rememberCheckbox).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'patient.juan@example.com',
          password: 'Password123!',
          remember_me: true,
        })
      );
    });

    expect(localStorage.getItem('toothcare_remember_email')).toBe('patient.juan@example.com');
    expect(JSON.stringify(localStorage)).not.toContain('Password123!');
    expect(JSON.stringify(sessionStorage)).not.toContain('Password123!');

    unmount();

    // Remount LoginForm: remembered email should prefill and checkbox should remain checked
    const remounted = render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(remounted.container.querySelector('input[name="email"]').value).toBe('patient.juan@example.com');
    });

    const remountCheckbox = remounted.container.querySelector('input[name="remember_me"]');
    expect(remountCheckbox).toBeChecked();

    // Unchecking clears remembered email immediately
    fireEvent.click(remountCheckbox);
    expect(remountCheckbox).not.toBeChecked();
    expect(localStorage.getItem('toothcare_remember_email')).toBeNull();
  });
});
