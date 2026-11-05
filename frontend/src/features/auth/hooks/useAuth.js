import { useState, useEffect, useCallback } from 'react';
import authApi from '../api';

/**
 * React Hook for Authentication and Session State
 * Stores identity in memory only (never puts passwords or tokens into localStorage).
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCurrentUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authApi.getMe();
      setUser(data);
      return data;
    } catch (err) {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();

    const handleUnauthorized = () => {
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
    try {
      const userData = await authApi.login(credentials);
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Login failed. Please check your credentials.';
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
      const message = err.response?.data?.error?.message || 'Registration failed.';
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
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  return {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    login,
    register,
    logout,
    refreshUser: fetchCurrentUser,
  };
}

export default useAuth;

