// src/pages/AccountSettingsPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

interface AccountSettings {
  username: string;
  description: string;
  theme: 'light' | 'dark' | 'system';
}

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const backPath = user?.role === 'lecturer' ? '/lecturer' : '/chat';
  const [settings, setSettings] = useState<AccountSettings>({
    username: user?.username || '',
    description: '',
    theme: 'system',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);
  
  // Password reset state
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('accountSettings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const handleInputChange = (field: keyof AccountSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanged(true);
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      // Save to localStorage for now (will connect to backend later)
      localStorage.setItem('accountSettings', JSON.stringify(settings));
      
      // Apply theme
      if (settings.theme !== 'system') {
        document.documentElement.classList.toggle('dark', settings.theme === 'dark');
      }
      
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setHasChanged(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAllChats = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      // Auto-reset after 5 seconds if not confirmed
      setTimeout(() => setShowDeleteConfirm(false), 5000);
      return;
    }

    try {
      // TODO: Connect to backend API to delete all chats
      // await chatApi.deleteAllChats(token);
      setMessage({ type: 'success', text: 'All chats deleted successfully' });
      setShowDeleteConfirm(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to delete chats' });
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  };

  // Password strength checker
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[!@#$%^&*]/.test(password)) strength++;
    return strength;
  };

  const getPasswordStrengthLabel = (password: string) => {
    const strength = getPasswordStrength(password);
    if (!password) return '';
    if (strength <= 1) return 'Weak';
    if (strength <= 2) return 'Fair';
    if (strength <= 3) return 'Good';
    if (strength <= 4) return 'Strong';
    return 'Very Strong';
  };

  const getPasswordStrengthColor = (password: string) => {
    const strength = getPasswordStrength(password);
    if (!password) return 'bg-gray-300';
    if (strength <= 1) return 'bg-red-500';
    if (strength <= 2) return 'bg-orange-500';
    if (strength <= 3) return 'bg-yellow-500';
    if (strength <= 4) return 'bg-lime-500';
    return 'bg-green-500';
  };

  const handleResetPassword = async () => {
    // Validation
    if (!passwordForm.currentPassword) {
      setMessage({ type: 'error', text: 'Current password is required' });
      return;
    }
    if (!passwordForm.newPassword) {
      setMessage({ type: 'error', text: 'New password is required' });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setMessage({ type: 'error', text: 'New password cannot be the same as current password' });
      return;
    }

    try {
      setIsResettingPassword(true);
      // TODO: Connect to backend API for password reset
      // const response = await authApi.resetPassword({
      //   currentPassword: passwordForm.currentPassword,
      //   newPassword: passwordForm.newPassword,
      // });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordReset(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to change password' });
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Back Button */}
      <button
        onClick={() => navigate(backPath)}
        className="fixed top-4 left-4 p-2 hover:bg-gray-200 rounded-lg transition z-10"
        title="Back"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Main Content */}
      <div className="flex-1 max-w-3xl mx-auto px-6 py-8 pt-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-600 mt-1">Customize your EduSmart experience</p>
        </div>

        {/* Messages */}
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-100 text-green-700 border border-green-300' 
              : 'bg-red-100 text-red-700 border border-red-300'
          }`}>
            {message.text}
          </div>
        )}

        {/* User Info Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">👤 Profile</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={settings.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">{settings.username.length}/50</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio/Description
              </label>
              <textarea
                value={settings.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Tell us about yourself (helps AI understand your needs)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">{settings.description.length}/500</p>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">⚙️ Preferences</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Theme
              </label>
              <select
                value={settings.theme}
                onChange={(e) => handleInputChange('theme', e.target.value as 'light' | 'dark' | 'system')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="system">System (Auto)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Choose how EduSmart appears</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <div className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 capitalize">
                {user?.role || 'Student'}
              </div>
              <p className="text-xs text-gray-500 mt-1">Role cannot be changed here</p>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveSettings}
            disabled={isSaving || !hasChanged}
            className="mt-6 w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
          >
            {isSaving ? '💾 Saving...' : '✓ Save Settings'}
          </button>
          {hasChanged && (
            <p className="text-sm text-orange-600 font-medium mt-2 text-center">● Unsaved changes</p>
          )}
        </div>

        {/* Password Reset Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">🔐 Security</h2>
            <button
              onClick={() => setShowPasswordReset(!showPasswordReset)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {showPasswordReset ? 'Cancel' : 'Change Password'}
            </button>
          </div>

          {showPasswordReset && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="Enter your current password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter your new password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                
                {/* Password Strength Indicator */}
                {passwordForm.newPassword && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getPasswordStrengthColor(passwordForm.newPassword)} transition-all`}
                          style={{ width: `${(getPasswordStrength(passwordForm.newPassword) / 5) * 100}%` }}
                        />
                      </div>
                      <span className={`text-sm font-medium ${
                        getPasswordStrength(passwordForm.newPassword) <= 1 ? 'text-red-600' :
                        getPasswordStrength(passwordForm.newPassword) <= 2 ? 'text-orange-600' :
                        getPasswordStrength(passwordForm.newPassword) <= 3 ? 'text-yellow-600' :
                        getPasswordStrength(passwordForm.newPassword) <= 4 ? 'text-lime-600' :
                        'text-green-600'
                      }`}>
                        {getPasswordStrengthLabel(passwordForm.newPassword)}
                      </span>
                    </div>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li className={passwordForm.newPassword.length >= 8 ? 'text-green-600' : ''}>
                        ✓ At least 8 characters
                      </li>
                      <li className={/[a-z]/.test(passwordForm.newPassword) && /[A-Z]/.test(passwordForm.newPassword) ? 'text-green-600' : ''}>
                        ✓ Mix of uppercase and lowercase
                      </li>
                      <li className={/\d/.test(passwordForm.newPassword) ? 'text-green-600' : ''}>
                        ✓ At least one number
                      </li>
                      <li className={/[!@#$%^&*]/.test(passwordForm.newPassword) ? 'text-green-600' : ''}>
                        ✓ Special character (!@#$%^&*)
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm your new password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                  <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                )}
                {passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword && (
                  <p className="text-xs text-green-600 mt-1">✓ Passwords match</p>
                )}
              </div>

              <button
                onClick={handleResetPassword}
                disabled={isResettingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition"
              >
                {isResettingPassword ? '⏳ Changing...' : '✓ Change Password'}
              </button>

              <button
                onClick={() => {
                  setShowPasswordReset(false);
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                }}
                className="w-full px-6 py-2 mt-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 font-medium transition"
              >
                Cancel
              </button>
            </div>
          )}

          {!showPasswordReset && (
            <p className="text-sm text-gray-600">
              Keep your account secure by using a strong password. Last changed: Never
            </p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-l-4 border-red-500">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">⚠️ Danger Zone</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-1">Delete All Chats</h3>
              <p className="text-sm text-gray-600 mb-3">
                Permanently delete all your chat history. This cannot be undone.
              </p>
              <button
                onClick={handleDeleteAllChats}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  showDeleteConfirm
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                {showDeleteConfirm ? '🗑️ Confirm Delete All Chats' : '🗑️ Delete All Chats'}
              </button>
              {showDeleteConfirm && (
                <p className="text-xs text-red-600 mt-2">⚠️ Click again to confirm</p>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-1">Logout</h3>
              <p className="text-sm text-gray-600 mb-3">
                Sign out of your account
              </p>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">ℹ️ About EduSmart</h2>
          
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              <span className="font-medium">Version:</span> 1.0.0
            </p>
            <p>
              <span className="font-medium">Purpose:</span> AI-powered learning assistant for curriculum-aware education
            </p>
            <p>
              <span className="font-medium">Technology:</span> RAG + Local LLM with Bloom's Taxonomy integration
            </p>
            <p>
              <span className="font-medium">Built with:</span> React, FastAPI, ChromaDB, E5 Embeddings
            </p>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                © 2024 EduSmart. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
