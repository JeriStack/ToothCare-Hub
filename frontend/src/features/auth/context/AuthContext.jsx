import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authApi from '../api';

const AuthContext = createContext(null);
const USER_STORAGE_KEY = 'toothcare_user';

function readStoredAuthUser() {
  if (typeof window === 'undefined') {
    return null;
  }

  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const raw = storage?.getItem(USER_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Ignore corrupt or unavailable storage
    }
  }
  return null;
}

function hasPersistentAuthUser() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return Boolean(window.localStorage.getItem(USER_STORAGE_KEY));
  } catch {
    return false;
  }
}

function writeStoredAuthUser(userData, persistent = hasPersistentAuthUser()) {
  if (typeof window === 'undefined' || !userData) {
    return;
  }

  const serialized = JSON.stringify(userData);
  try {
    if (persistent) {
      window.localStorage.setItem(USER_STORAGE_KEY, serialized);
      window.sessionStorage?.removeItem(USER_STORAGE_KEY);
    } else {
      window.sessionStorage?.setItem(USER_STORAGE_KEY, serialized);
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // Safe fallback when storage is unavailable
  }
}

function clearStoredAuthUser() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } catch {}
  try {
    window.sessionStorage?.removeItem(USER_STORAGE_KEY);
  } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const updateUser = useCallback((updatedUser) => {
    if (!updatedUser) return;
    setUser((prev) => {
      const next = typeof updatedUser === 'function' ? updatedUser(prev) : { ...prev, ...updatedUser };
      writeStoredAuthUser(next, hasPersistentAuthUser());
      return next;
    });
  }, []);

  const fetchCurrentUser = useCallback(async (options = {}) => {
    const isSilent = Boolean(options?.silent);
    if (!isSilent && !readStoredAuthUser()) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const requestOptions =
        isSilent || (typeof window !== 'undefined' && window.location.pathname === '/')
          ? { background: true }
          : undefined;
      const data = await authApi.getMe(requestOptions);
      if (data) {
        setUser(data);
        writeStoredAuthUser(
          data,
          typeof data.remember_me === 'boolean' ? data.remember_me : hasPersistentAuthUser()
        );
        return data;
      }
    } catch {
      // Offline fallback: check stored user profile
      const saved = readStoredAuthUser();
      if (saved) {
        setUser(saved);
        return saved;
      }
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();

    const handleUnauthorized = () => {
      clearStoredAuthUser();
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
    const rememberMe = Boolean(credentials?.remember_me);

    try {
      const userData = await authApi.login({
        email: normalizedEmail,
        password,
        remember_me: rememberMe,
      });
      setUser(userData);
      writeStoredAuthUser(userData, rememberMe);
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
      clearStoredAuthUser();
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

export function useOptionalAuth() {
  return useContext(AuthContext);
}

export default useAuth;
