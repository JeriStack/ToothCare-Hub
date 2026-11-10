import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../features/auth/context/AuthContext';

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

function TestConsumer() {
  const { user, login, logout, isLoading } = useAuth();
  return (
    <div>
      <div data-testid="loading-state">{isLoading ? 'loading' : 'idle'}</div>
      <div data-testid="user-email">{user ? user.email : 'none'}</div>
      <div data-testid="user-role">{user ? user.role : 'none'}</div>
      <div data-testid="user-name">
        {user?.patient
          ? `${user.patient.first_name} ${user.patient.last_name}`
          : user?.dentist
          ? user.dentist.name
          : user?.first_name || 'none'}
      </div>
      <button
        type="button"
        onClick={() => login({ email: 'patient.juan@example.com', password: 'Password123!' })}
      >
        Login Patient
      </button>
      <button
        type="button"
        onClick={() => login({ email: 'dr.santos@toothcare.local', password: 'Password123!' })}
      >
        Login Dentist
      </button>
      <button
        type="button"
        onClick={() => login({ email: 'admin@toothcare.local', password: 'Password123!' })}
      >
        Login Admin
      </button>
      <button
        type="button"
        onClick={() => login({ email: 'receptionist@toothcare.local', password: 'Password123!' })}
      >
        Login Staff
      </button>
      <button
        type="button"
        onClick={() => login({ email: 'patient.juan@example.com', password: 'WrongPassword!' })}
      >
        Login Wrong PW
      </button>
      <button type="button" onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
}

describe('AuthContext Offline & Demo Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('authenticates Patient demo account and resolves patient profile', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('idle');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Login Patient' }));

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('patient.juan@example.com');
      expect(screen.getByTestId('user-role')).toHaveTextContent('PATIENT');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Juan Dela Cruz');
    });
  });

  it('authenticates Dentist demo account and resolves practitioner profile', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('idle');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Login Dentist' }));

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('dr.santos@toothcare.local');
      expect(screen.getByTestId('user-role')).toHaveTextContent('DENTIST');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Dr. Maria Santos, DMD');
    });
  });

  it('authenticates Admin demo account and grants ADMIN role', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('idle');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Login Admin' }));

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('admin@toothcare.local');
      expect(screen.getByTestId('user-role')).toHaveTextContent('ADMIN');
    });
  });

  it('authenticates Staff Receptionist demo account and grants ADMIN role', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('idle');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Login Staff' }));

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('receptionist@toothcare.local');
      expect(screen.getByTestId('user-role')).toHaveTextContent('ADMIN');
    });
  });

  it('rejects incorrect password for demo accounts', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('idle');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Login Wrong PW' }));

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('none');
      expect(screen.getByTestId('user-role')).toHaveTextContent('none');
    });
  });

  it('clears authenticated state and localStorage on logout', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('idle');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Login Patient' }));

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('patient.juan@example.com');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('none');
      expect(localStorage.getItem('toothcare_user')).toBeNull();
    });
  });
});
