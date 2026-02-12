// src/pages/SetupPage.tsx - Simplified: Admin Signup Only
import React, { useState } from 'react';
import { setupApi } from '../services/api';

export default function SetupPage() {
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ==================== Validation ====================
  const validateForm = () => {
    if (!adminEmail.trim()) return 'Admin email is required';
    if (!adminFullName.trim()) return 'Admin full name is required';
    if (!adminPassword) return 'Password is required';
    if (adminPassword.length < 8) return 'Password must be at least 8 characters';
    if (adminPassword !== adminPasswordConfirm) return 'Passwords do not match';
    if (!termsAccepted) return 'You must accept the terms';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForm();
    if (err) {
      setError(err);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await setupApi.configure({
        institution_name: 'To be configured',
        institution_code: 'TEMP',
        student_email_pattern: '@student.edu',
        lecturer_email_pattern: '@lecturer.edu',
        admin_email: adminEmail,
        admin_password: adminPassword,
        admin_full_name: adminFullName,
      });

      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/credentials-login';
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Setup failed');
      setSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== Success Screen ====================
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Setup Complete!</h1>
          <p className="text-gray-600 mb-6">
            Your admin account has been created.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-left">
            <h3 className="font-semibold text-gray-800 mb-3">📧 Admin Account</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Email:</span>
                <p className="font-mono text-gray-800 break-all">{adminEmail}</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              ℹ️ Redirecting to login page...
            </p>
          </div>

          <p className="text-gray-600 text-sm">Please wait</p>
        </div>
      </div>
    );
  }

  // ==================== Setup Form ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">EduSmart</h1>
        <p className="text-gray-600 mb-8">Setup - Create Admin Account</p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Admin Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={adminFullName}
              onChange={(e) => setAdminFullName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Admin Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password (min 8 characters)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
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

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={adminPasswordConfirm}
                onChange={(e) => setAdminPasswordConfirm(e.target.value)}
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

          {/* Terms Checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="terms"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="terms" className="ml-2 text-sm text-gray-700">
              I accept the terms and conditions
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium mt-6"
          >
            {isLoading ? 'Creating account...' : 'Complete Setup'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-300">
          <p className="text-gray-600 text-sm text-center">
            💡 Configure your institution after login.
          </p>
        </div>
      </div>
    </div>
  );
}
