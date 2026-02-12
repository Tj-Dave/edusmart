// src/state/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType } from '../types/auth';
import { authApi } from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Start as false for UI development
  const [error, setError] = useState<string | null>(null);

  // Initialize from localStorage
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Add timeout to prevent hanging if backend is down
      const timeout = setTimeout(() => {
        console.warn('Backend getMe request timed out - clearing token');
        localStorage.removeItem('auth_token');
        setIsLoading(false);
      }, 3000);

      authApi
        .getMe(token)
        .then((fetchedUser) => {
          clearTimeout(timeout);
          setUser(fetchedUser);
          setError(null);
          setIsLoading(false);
        })
        .catch((err) => {
          clearTimeout(timeout);
          console.error('Failed to fetch user (backend may be down):', err);
          localStorage.removeItem('auth_token');
          setError(null);
          setIsLoading(false);
        });
    } else {
      // No token - user not logged in, immediately ready
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.login(email, password);
      localStorage.setItem('auth_token', response.access_token);
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
