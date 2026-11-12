import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authApi from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const updateUser = useCallback((updatedUser) => {
    if (!updatedUser) return;
    setUser((prev) => {
      const next = typeof updatedUser === 'function' ? updatedUser(prev) : { ...prev, ...updatedUser };
      try {
        localStorage.setItem('toothcare_user', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const fetchCurrentUser = useCallback(async (options = {}) => {
    const isSilent = Boolean(options?.silent);
    if (!isSilent && !localStorage.getItem('toothcare_user')) {
      setIsLoading(true);
    }
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
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Invalid email or password. Please verify your credentials.';
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

  const hasPermission = useCallback(
    (slug) => {
      if (!user || !slug) return false;
      if (Array.isArray(user.permissions)) {
        return user.permissions.includes(slug);
      }
      return String(user.role || '').toUpperCase() === 'ADMIN';
    },
    [user]
  );

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    hasPermission,
    login,
    register,
    logout,
    refreshUser: fetchCurrentUser,
    updateUser,
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
