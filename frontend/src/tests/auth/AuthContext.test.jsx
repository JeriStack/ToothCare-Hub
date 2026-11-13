import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../features/auth/context/AuthContext';
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
        onClick={() => login({ email: 'patient.juan@example.com', password: 'Password123!', remember_me: true })}
      >
        Login Remembered
      </button>
      <button
        type="button"
        onClick={() => login({ email: 'patient.juan@example.com', password: 'Password123!', remember_me: false })}
      >
        Login Ephemeral
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

describe('AuthContext Backend Verification & State Lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    authApi.getMe.mockRejectedValue(new Error('No active session'));
    authApi.login.mockImplementation(async ({ email, password }) => {
      if (password === 'WrongPassword!') {
        const err = new Error('Invalid email or password.');
        err.response = { status: 401, data: { error: { message: 'Invalid email or password. Please verify your credentials.' } } };
        throw err;
      }
      if (email === 'patient.juan@example.com') {
        return {
          id: 6,
          email: 'patient.juan@example.com',
          role: 'PATIENT',
          first_name: 'Juan',
          last_name: 'Dela Cruz',
          patient: {
            id: 1,
            user_id: 6,
            first_name: 'Juan',
            last_name: 'Dela Cruz',
            date_of_birth: '1994-05-18',
            phone: '+639171234567',
          },
        };
      }
      if (email === 'dr.santos@toothcare.local') {
        return {
          id: 3,
          email: 'dr.santos@toothcare.local',
          role: 'DENTIST',
          first_name: 'Maria',
          last_name: 'Santos',
          dentist: {
            id: 1,
            user_id: 3,
            name: 'Dr. Maria Santos, DMD',
            specialization: 'General & Cosmetic Dentistry',
          },
        };
      }
      if (email === 'admin@toothcare.local') {
        return {
          id: 1,
          email: 'admin@toothcare.local',
          role: 'ADMIN',
          first_name: 'System',
          last_name: 'Administrator',
        };
      }
      if (email === 'receptionist@toothcare.local') {
        return {
          id: 2,
          email: 'receptionist@toothcare.local',
          role: 'ADMIN',
          first_name: 'Staff',
          last_name: 'Receptionist',
        };
      }
      throw new Error('User not found');
    });
  });

  it('authenticates Patient through backend API and resolves patient profile', async () => {
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

  it('authenticates Dentist through backend API and resolves practitioner profile', async () => {
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

  it('authenticates Admin through backend API and grants ADMIN role', async () => {
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

  it('authenticates Staff Receptionist through backend API and grants ADMIN role', async () => {
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

  it('rejects incorrect password from backend API', async () => {
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
      expect(sessionStorage.getItem('toothcare_user')).toBeNull();
    });
  });

  it('persists auth user in localStorage when remember_me is true and sessionStorage when false', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('idle');
    });

    // Ephemeral login (remember_me: false)
    fireEvent.click(screen.getByRole('button', { name: 'Login Ephemeral' }));

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('patient.juan@example.com');
    });
    expect(sessionStorage.getItem('toothcare_user')).not.toBeNull();
    expect(localStorage.getItem('toothcare_user')).toBeNull();

    // Persistent login (remember_me: true)
    fireEvent.click(screen.getByRole('button', { name: 'Login Remembered' }));

    await waitFor(() => {
      expect(localStorage.getItem('toothcare_user')).not.toBeNull();
    });
    expect(sessionStorage.getItem('toothcare_user')).toBeNull();
  });
});
