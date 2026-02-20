// src/pages/GeneralSettingsPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

interface GeneralSettings {
  notifications: boolean;
  emailNotifications: boolean;
  defaultView: 'chat' | 'course-selection';
  fontSize: 'small' | 'medium' | 'large';
  autoSave: boolean;
}

const DEFAULT_SETTINGS: GeneralSettings = {
  notifications: true,
  emailNotifications: true,
  defaultView: 'chat',
  fontSize: 'medium',
  autoSave: true,
};

const FONT_SIZE_MAP = {
  small: '14px',
  medium: '16px',
  large: '18px',
};

export default function GeneralSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const backPath = user?.role === 'lecturer' ? '/lecturer' : '/chat';
  const [settings, setSettings] = useState<GeneralSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasChanged, setHasChanged] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('generalSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to parse saved settings:', err);
        setSettings(DEFAULT_SETTINGS);
      }
    }
  }, []);

  // Apply font size when settings change
  useEffect(() => {
    const fontSize = FONT_SIZE_MAP[settings.fontSize];
    document.documentElement.style.fontSize = fontSize;
    localStorage.setItem('appFontSize', settings.fontSize);
  }, [settings.fontSize]);

  const handleInputChange = (field: keyof GeneralSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanged(true);
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      // Save to localStorage
      localStorage.setItem('generalSettings', JSON.stringify(settings));
      
      setMessage({ type: 'success', text: 'General settings saved successfully!' });
      setHasChanged(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      setSettings(DEFAULT_SETTINGS);
      localStorage.setItem('generalSettings', JSON.stringify(DEFAULT_SETTINGS));
      setMessage({ type: 'success', text: 'Settings reset to defaults' });
      setTimeout(() => setMessage(null), 3000);
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
          <h1 className="text-3xl font-bold text-gray-900">General Settings</h1>
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

        {/* Display Settings */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🎨 Display Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Font Size
              </label>
              <select
                value={settings.fontSize}
                onChange={(e) => handleInputChange('fontSize', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="small">Small</option>
                <option value="medium">Medium (Default)</option>
                <option value="large">Large</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Adjust text size for better readability</p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🔔 Notifications</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div>
                <p className="font-medium text-gray-900">In-App Notifications</p>
                <p className="text-sm text-gray-600">Receive notifications within EduSmart</p>
              </div>
              <button
                onClick={() => handleInputChange('notifications', !settings.notifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  settings.notifications ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings.notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-600">Receive notifications via email</p>
              </div>
              <button
                onClick={() => handleInputChange('emailNotifications', !settings.emailNotifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  settings.emailNotifications ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Behavior Settings */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">⚡ Behavior</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default View After Login
              </label>
              <select
                value={settings.defaultView}
                onChange={(e) => handleInputChange('defaultView', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="course-selection">Course Selection</option>
                <option value="chat">Chat (Last Course)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">What page should open when you login</p>
            </div>

            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div>
                <p className="font-medium text-gray-900">Auto-Save Drafts</p>
                <p className="text-sm text-gray-600">Automatically save chat drafts</p>
              </div>
              <button
                onClick={() => handleInputChange('autoSave', !settings.autoSave)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  settings.autoSave ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings.autoSave ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-medium ${hasChanged ? 'text-orange-600' : 'text-gray-500'}`}>
                {hasChanged ? '● Unsaved changes' : '✓ All changes saved'}
              </span>
            </div>
            
            <button
              onClick={handleSaveSettings}
              disabled={isSaving || !hasChanged}
              className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
            >
              {isSaving ? '💾 Saving...' : '✓ Save Settings'}
            </button>
            
            <button
              onClick={handleResetDefaults}
              className="w-full px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 font-medium transition"
            >
              ↺ Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
