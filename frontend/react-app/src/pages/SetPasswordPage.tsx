// src/pages/SetPasswordPage.tsx - First Login Password Setup (For Admin-Created Accounts)
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/api';

export default function SetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token'); // Passed from login after detecting first_login

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = () => {
    if (!password || !passwordConfirm) {
      setError('Both password fields are required');
      return false;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePassword()) return;
    if (!token) {
      setError('Invalid token. Please login again.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await authApi.setPassword(token, password, passwordConfirm);

      // Redirect to appropriate page based on role
      // (This would normally be retrieved from user context)
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to set password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold text-gray-800">Set Your Password</h1>
          <p className="text-gray-600 mt-2">Create a permanent password for your account</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSetPassword} className="space-y-4">
          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              New Password <span className="text-red-600">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-600 mt-1">Must be at least 8 characters long</p>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              Confirm Password <span className="text-red-600">*</span>
            </label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={e => setPasswordConfirm(e.target.value)}
              placeholder="Re-enter your password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2 rounded-lg font-semibold text-white transition ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? '⏳ Setting Password...' : '✓ Set Password'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-sm mt-6">
          After setting your password, you'll have full access to your account.
        </p>
      </div>
    </div>
  );
}
