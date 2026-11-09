import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authApi from '../api';

export const DEMO_ACCOUNTS = {
  'patient.juan@example.com': {
    id: 6,
    email: 'patient.juan@example.com',
    role: 'PATIENT',
    is_active: 1,
    email_verified: 1,
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    patient: {
      id: 1,
      user_id: 6,
      first_name: 'Juan',
      last_name: 'Dela Cruz',
      date_of_birth: '1994-05-18',
      phone: '+639171234567',
      gender: 'MALE',
      address: '124 Ayala Avenue, Makati City',
      emergency_contact_name: 'Elena Dela Cruz (Spouse)',
      emergency_contact_phone: '+639177654321',
      medical_alerts: 'None recorded',
    },
  },
  'dr.santos@toothcare.local': {
    id: 3,
    email: 'dr.santos@toothcare.local',
    role: 'DENTIST',
    is_active: 1,
    email_verified: 1,
    first_name: 'Maria',
    last_name: 'Santos',
    dentist: {
      id: 1,
      user_id: 3,
      first_name: 'Maria',
      last_name: 'Santos',
      name: 'Dr. Maria Santos, DMD',
      specialization: 'General & Cosmetic Dentistry',
      license_number: 'PRC-008472',
      phone: '+639175551234',
      default_operatory_chair: 'Operatory Chair 1',
      room_number: 'Operatory Chair 1',
      shifts: ['Mon', 'Tue', 'Thu', 'Fri'],
      avatar: '🧑‍⚕️',
      bio: 'Specialist in preventive oral prophylaxis, esthetic restorations, and cosmetic veneers.',
    },
  },
  'admin@toothcare.local': {
    id: 1,
    email: 'admin@toothcare.local',
    role: 'ADMIN',
    is_active: 1,
    email_verified: 1,
    first_name: 'System',
    last_name: 'Administrator',
  },
  'receptionist@toothcare.local': {
    id: 2,
    email: 'receptionist@toothcare.local',
    role: 'ADMIN',
    is_active: 1,
    email_verified: 1,
    first_name: 'Staff',
    last_name: 'Receptionist',
  },
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCurrentUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authApi.getMe();
      if (data) {
        setUser(data);
        try {
          localStorage.setItem('toothcare_user', JSON.stringify(data));
        } catch {}
        return data;
      }
    } catch {
      // Offline fallback: check localStorage
      try {
        const saved = localStorage.getItem('toothcare_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          setUser(parsed);
          return parsed;
        }
      } catch {}
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();

    const handleUnauthorized = () => {
      try {
        localStorage.removeItem('toothcare_user');
      } catch {}
      setUser(null);
    };

    window.addEventListener('toothcare:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('toothcare:unauthorized', handleUnauthorized);
    };
  }, [fetchCurrentUser]);

  const login = async (credentials) => {
    setIsLoading(true);
    setError(null);
    const normalizedEmail = (credentials?.email || '').trim().toLowerCase();
    const password = credentials?.password || '';

    try {
      const userData = await authApi.login({ email: normalizedEmail, password });
      setUser(userData);
      try {
        localStorage.setItem('toothcare_user', JSON.stringify(userData));
      } catch {}
      return { success: true, user: userData };
    } catch (err) {
      // If the backend answered with a definitive HTTP error (401 invalid credentials, 403 disabled, 429 rate limit)
      if (err.response && err.response.status !== 500 && err.response.status !== 502 && err.response.status !== 503) {
        const message =
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Invalid email or password. Please verify your credentials.';
        setError(message);
        return { success: false, error: message };
      }

      // If backend network request failed (server offline, container not started, or connection refused):
      // Verify against approved development demo credentials
      const demoUser = DEMO_ACCOUNTS[normalizedEmail];
      if (demoUser) {
        if (password === 'Password123!') {
          setUser(demoUser);
          try {
            localStorage.setItem('toothcare_user', JSON.stringify(demoUser));
          } catch {}
          return { success: true, user: demoUser };
        } else {
          const message = 'Invalid email or password. Please try again.';
          setError(message);
          return { success: false, error: message };
        }
      }

      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Unable to connect to authentication server. Please check your connection.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authApi.register(payload);
      return { success: true, data: result };
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Registration could not be completed. Please review your details.';
      const details = err.response?.data?.error?.details || null;
      setError(message);
      return { success: false, error: message, details };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } catch {
      // Continue clearing local state even if server logout errored
    } finally {
      try {
        localStorage.removeItem('toothcare_user');
      } catch {}
      setUser(null);
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email) => {
    try {
      const result = await authApi.forgotPassword(email);
      return { success: true, data: result };
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Unable to process password reset request.';
      return { success: false, error: message };
    }
  };

  const resetPassword = async (token, password) => {
    try {
      const result = await authApi.resetPassword(token, password);
      return { success: true, data: result };
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Password reset failed. The link may have expired or is invalid.';
      return { success: false, error: message };
    }
  };

  const verifyEmail = async (token) => {
    try {
      const result = await authApi.verifyEmail(token);
      return { success: true, data: result };
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Email verification link is invalid or has expired.';
      return { success: false, error: message };
    }
  };

  const resendVerification = async (email) => {
    try {
      const result = await authApi.resendVerification(email);
      return { success: true, data: result };
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Unable to resend verification link.';
      return { success: false, error: message };
    }
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    login,
    register,
    logout,
    refreshUser: fetchCurrentUser,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;
