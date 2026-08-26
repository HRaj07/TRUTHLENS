import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);
const STORAGE_KEY_USER  = 'truthlens_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_USER);
    if (stored) {
      try { setUser(JSON.parse(stored)); } 
      catch { localStorage.removeItem(STORAGE_KEY_USER); }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password, role) => {
    setLoading(true);
    setError(null);
    try {
      const userData = await authAPI.login({ email, password });
      const finalUser = { ...userData, role: role || userData.role };
      setUser(finalUser);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(finalUser));
      return finalUser;
    } catch (err) {
      const msg = err.message || 'Login failed. Please try again.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async ({ name, email, password, role, company }) => {
    setLoading(true);
    setError(null);
    try {
      if (!name?.trim()) throw new Error('Full name is required.');
      if (!email?.trim()) throw new Error('Email is required.');
      if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');
      
      const userData = await authAPI.signup({ name, email, password, role, company });
      setUser(userData);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userData));
      return userData;
    } catch (err) {
      const msg = err.message || 'Signup failed. Please try again.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY_USER);
  }, []);

  const updateProfile = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isInterviewer: user?.role === 'interviewer',
    isCandidate: user?.role === 'candidate',
    login,
    signup,
    logout,
    updateProfile,
    clearError: () => setError(null),
  }), [user, loading, error, login, signup, logout, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
