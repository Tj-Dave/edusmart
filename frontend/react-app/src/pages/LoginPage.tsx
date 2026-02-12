// src/pages/LoginPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { institutionApi } from '../services/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [emailError, setEmailError] = useState<string>('');
  const [emailPattern, setEmailPattern] = useState<string>('');
  
  const { login, isLoading, error } = useAuth();
  const navigate = useNavigate();

  // Load email pattern configuration for students
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await institutionApi.getConfiguration();
        setEmailPattern(config.student_email_pattern || '');
      } catch (err) {
        console.error('Failed to load institution config:', err);
      }
    };
    loadConfig();
  }, []);

  // Validate email against pattern
  const validateEmail = (email: string, pattern: string): boolean => {
    if (!pattern) return true;
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\./g, '\\.')
      .replace(/^/, '^')
      .replace(/$/, '$');
    try {
      const regex = new RegExp(regexPattern);
      return regex.test(email);
    } catch {
      return true;
    }
  };

  // Handle email input with validation
  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailPattern && !validateEmail(value, emailPattern)) {
      setEmailError(`Email must match pattern: ${emailPattern}`);
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email against pattern
    if (emailPattern && !validateEmail(email, emailPattern)) {
      setEmailError(`Email must match pattern: ${emailPattern}`);
      return;
    }
    
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      // Error is handled by useAuth context
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Connect to backend password reset API
    alert(`Password reset link sent to ${resetEmail}`);
    setForgotPasswordMode(false);
    setResetEmail('');
  };

  // Forgot password mode
  if (forgotPasswordMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Reset Password</h1>
          <p className="text-gray-600 mb-8">Enter your email to receive a reset link</p>

          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium mt-6"
            >
              Send Reset Link
            </button>
          </form>

          <button
            onClick={() => setForgotPasswordMode(false)}
            className="w-full py-2 text-blue-600 hover:text-blue-700 text-sm font-medium mt-4"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">EduSmart</h1>
        <p className="text-gray-600 mb-8">AI Learning Assistant Login</p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                emailError ? 'border-red-400' : 'border-gray-300'
              }`}
              required
            />
            {emailError ? (
              <p className="mt-1 text-xs text-red-600 font-medium">{emailError}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                {emailPattern ? `Must use: ${emailPattern}` : 'Must be your official student email'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-600 hover:text-gray-800"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"></path>
                    <path d="M15.171 11.586a4 4 0 111.414-1.414l1.514 1.515a1 1 0 11-1.414 1.414l-1.514-1.515z"></path>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-300 space-y-3">
          <button
            onClick={() => setForgotPasswordMode(true)}
            className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Forgot Password?
          </button>
          <p className="text-gray-600 text-sm">
            Don't have an account?{' '}
            <Link to="/signup" className="text-blue-600 hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
