// src/state/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType } from '../types/auth';
import { authApi } from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize from localStorage and revalidate token
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const cachedUserRaw = localStorage.getItem('auth_user');

    if (cachedUserRaw) {
      try {
        const parsedUser = JSON.parse(cachedUserRaw) as User;
        setUser(parsedUser);
      } catch {
        localStorage.removeItem('auth_user');
      }
    }

    if (!token) {
      setIsLoading(false);
      return;
    }

    authApi
      .getMe(token)
      .then((fetchedUser) => {
        setUser(fetchedUser);
        localStorage.setItem('auth_user', JSON.stringify(fetchedUser));
        setError(null);
      })
      .catch((err: any) => {
        const status = err?.status;
        const isAuthError = status === 401 || status === 403;

        if (isAuthError) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          setUser(null);
          setError('Session expired. Please login again.');
          return;
        }

        // Keep persisted session for non-auth failures (e.g. temporary backend/network issue)
        console.error('Session revalidation failed:', err);
        setError(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.login(email, password);
      localStorage.setItem('auth_token', response.access_token);
      localStorage.setItem('auth_user', JSON.stringify(response.user));
      setUser(response.user);
    } catch (err: any) {
      const message = err.message || 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    profileData?: {
      username?: string;
      full_name?: string;
      university_id?: string;
      faculty?: string;
      department?: string;
      program?: string;
      year_of_study?: number;
      phone?: string;
    }
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.register(email, password, profileData);
      // Auto-login after registration
      await login(email, password);
    } catch (err: any) {
      const message = err.message || 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const setPassword = async (password: string, passwordConfirm: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('No authentication token');
      await authApi.setPassword(token, password, passwordConfirm);
    } catch (err: any) {
      const message = err.message || 'Password update failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, register, logout, setPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
