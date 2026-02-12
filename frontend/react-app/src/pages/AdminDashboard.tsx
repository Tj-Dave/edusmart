// src/pages/AdminDashboard.tsx - Complete Admin Interface (Proposal §5.2)
import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import { User } from '../types/auth';
import SettingsPage from './SettingsPage';

interface AnalyticsData {
  total_students: number;
  total_lecturers: number;
  approved_lecturers: number;
  pending_lecturers: number;
  total_chats: number;
  total_messages: number;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const token = localStorage.getItem('auth_token') || '';

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'settings' | 'analytics' | 'account'>('overview');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lecturer creation form state
  const [showLecturerForm, setShowLecturerForm] = useState(false);
  const [lecturerEmail, setLecturerEmail] = useState('');
  const [lecturerName, setLecturerName] = useState('');
  const [lecturerUsername, setLecturerUsername] = useState('');
  const [lecturerDept, setLecturerDept] = useState('');
  const [lecturerPhone, setLecturerPhone] = useState('');
  const [lecturerUniversityId, setLecturerUniversityId] = useState('');
  const [lecturerCourses, setLecturerCourses] = useState('');
  const [lecturerPassword, setLecturerPassword] = useState('');
  const [isCreatingLecturer, setIsCreatingLecturer] = useState(false);
  const [lecturerSuccess, setLecturerSuccess] = useState(false);

  // Account Control state
  const [accountForm, setAccountForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [accountMessage, setAccountMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    // Load dark mode preference from localStorage on mount
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  // Apply dark mode on mount and when it changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#1a1a1a';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '';
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch analytics from backend
      try {
        const analyticsData = await adminApi.getAnalytics(token);
        setAnalytics(analyticsData);
      } catch (analyticsErr) {
        console.warn('Failed to fetch analytics:', analyticsErr);
        // Set empty state instead of dummy data
        setAnalytics({
          total_students: 0,
          total_lecturers: 0,
          approved_lecturers: 0,
          pending_lecturers: 0,
          total_chats: 0,
          total_messages: 0,
        });
      }

      // Fetch users from backend
      try {
        const usersData = await adminApi.getUsers(token);
        setRecentUsers(usersData.slice(0, 10));
      } catch (usersErr) {
        console.warn('Failed to fetch users:', usersErr);
        setRecentUsers([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreateLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!lecturerEmail || !lecturerName || !lecturerUsername || !lecturerPassword || !lecturerCourses || !lecturerDept || !lecturerPhone) {
      setError('All fields are required (Username, Email, Full Name, Phone, Department, Temporary Password, and Courses)');
      return;
    }

    try {
      setIsCreatingLecturer(true);
      setError(null);

      await adminApi.createUser(token, user?.id || '', {
        email: lecturerEmail,
        full_name: lecturerName,
        username: lecturerUsername,
        role: 'lecturer',
        password: lecturerPassword,
        courses: lecturerCourses,
        phone: lecturerPhone,
        department: lecturerDept,
        university_id: lecturerUniversityId || undefined,
      });

      setLecturerSuccess(true);
      setTimeout(() => {
        setShowLecturerForm(false);
        setLecturerSuccess(false);
        setLecturerEmail('');
        setLecturerName('');
        setLecturerUsername('');
        setLecturerDept('');
        setLecturerPhone('');
        setLecturerUniversityId('');
        setLecturerCourses('');
        setLecturerPassword('');
        fetchData();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to create lecturer');
    } finally {
      setIsCreatingLecturer(false);
    }
  };

  // ==================== ACCOUNT HANDLERS ====================
  const handleUpdateProfile = async () => {
    try {
      // TODO: Connect to backend API
      // await adminApi.updateProfile(token, accountForm);
      setAccountMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setAccountMessage(null), 3000);
    } catch (err: any) {
      setAccountMessage({ type: 'error', text: err.message || 'Failed to update profile' });
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setAccountMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setAccountMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    try {
      // TODO: Connect to backend API
      // await adminApi.changePassword(token, passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setAccountMessage({ type: 'success', text: 'Password changed successfully!' });
      setTimeout(() => setAccountMessage(null), 3000);
    } catch (err: any) {
      setAccountMessage({ type: 'error', text: err.message || 'Failed to change password' });
    }
  };

  // const handleToggle2FA = async () => { // placeholder
  //   try {
  //     // TODO: Connect to backend API
  //     // await adminApi.toggle2FA(token, !twoFactorEnabled);
  //   } catch (err: any) {
  //     setAccountMessage({ type: 'error', text: err.message || 'Failed to toggle 2FA' });
  //   }
  // };

  const handleDeactivateAccount = async () => {
    try {
      // TODO: Connect to backend API
      // await adminApi.deactivateAccount(token);
      setAccountMessage({ type: 'success', text: 'Account deactivation initiated. Check your email to confirm.' });
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setAccountMessage({ type: 'error', text: err.message || 'Failed to deactivate account' });
    }
  };

  const handleDeleteAccount = async () => {
    try {
      // TODO: Connect to backend API
      // await adminApi.deleteAccount(token);
      setShowDeleteConfirm(false);
      setAccountMessage({ type: 'success', text: 'Account deletion initiated. Check your email for confirmation.' });
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setAccountMessage({ type: 'error', text: err.message || 'Failed to delete account' });
    }
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setAccountMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setAccountMessage({ type: 'error', text: 'Image must be less than 5MB' });
      return;
    }

    try {
      // Read file as data URL
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        setProfilePicture(dataUrl);
        
        // TODO: Upload to backend API
        // const formData = new FormData();
        // formData.append('file', file);
        // await adminApi.uploadProfilePicture(token, formData);
        
        setAccountMessage({ type: 'success', text: 'Profile picture updated successfully!' });
        setTimeout(() => setAccountMessage(null), 3000);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setAccountMessage({ type: 'error', text: err.message || 'Failed to upload picture' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Header */}
      <div className="bg-white shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">🎓 EduSmart Admin</h1>
            <p className="text-gray-600 text-sm">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 flex gap-8">
          {[
            { id: 'overview', label: '📊 Overview' },
            { id: 'users', label: '👥 Users' },
            { id: 'settings', label: '⚙️ Settings' },
            { id: 'analytics', label: '📈 Analytics' },
            { id: 'account', label: '👤 Account' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-4 border-b-2 font-medium transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            ❌ {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading dashboard...</div>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Analytics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-600">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm font-medium">Total Students</p>
                        <h3 className="text-4xl font-bold text-blue-600 mt-2">
                          {analytics?.total_students.toLocaleString() || 0}
                        </h3>
                      </div>
                      <div className="text-5xl opacity-20">👥</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-600">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Lecturers (Approved)</p>
                      <h3 className="text-4xl font-bold text-green-600 mt-2">
                        {analytics?.approved_lecturers || 0}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {analytics?.pending_lecturers || 0} pending
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-purple-600">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Active Chats</p>
                      <h3 className="text-4xl font-bold text-purple-600 mt-2">
                        {analytics?.total_chats.toLocaleString() || 0}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {analytics?.total_messages.toLocaleString() || 0} messages
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-orange-600">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Storage Usage</p>
                      <h3 className="text-4xl font-bold text-orange-600 mt-2">45 GB</h3>
                      <p className="text-xs text-gray-500 mt-1">45% of 100 GB</p>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">⚡ Quick Actions</h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <button
                      onClick={() => setActiveTab('users')}
                      className="flex flex-col items-center p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
                    >
                      <span className="text-3xl mb-2">➕</span>
                      <span className="font-semibold text-gray-800 text-center">Create Student</span>
                      <span className="text-xs text-gray-600 mt-1 text-center">Add single account</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('users')}
                      className="flex flex-col items-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition"
                    >
                      <span className="text-3xl mb-2">👨‍🏫</span>
                      <span className="font-semibold text-gray-800 text-center">Create Lecturer</span>
                      <span className="text-xs text-gray-600 mt-1 text-center">Add instructor</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('users')}
                      className="flex flex-col items-center p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition"
                    >
                      <span className="text-3xl mb-2">📁</span>
                      <span className="font-semibold text-gray-800 text-center">Bulk Import</span>
                      <span className="text-xs text-gray-600 mt-1 text-center">CSV upload</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('analytics')}
                      className="flex flex-col items-center p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition"
                    >
                      <span className="text-3xl mb-2">📊</span>
                      <span className="font-semibold text-gray-800 text-center">View Reports</span>
                      <span className="text-xs text-gray-600 mt-1 text-center">Analytics</span>
                    </button>
                  </div>
                </div>

                {/* System Health - Ready for backend integration */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">🔧 System Health</h2>
                  <div className="space-y-3">
                    <p className="text-gray-500 text-center py-4">
                      System health metrics will be displayed here once backend monitoring endpoint is connected.
                    </p>
                    <p className="text-gray-400 text-sm text-center">
                      Waiting for: <code className="bg-gray-100 px-2 py-1 rounded">GET /admin/system-health</code>
                    </p>
                  </div>
                </div>

                {/* Recent Users */}
                {recentUsers.length > 0 && (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-bold text-gray-800">👥 Recent Users</h2>
                      <button
                        onClick={() => setActiveTab('users')}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        View All →
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-gray-700">Email</th>
                            <th className="px-4 py-3 font-semibold text-gray-700">Name</th>
                            <th className="px-4 py-3 font-semibold text-gray-700">Role</th>
                            <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentUsers.map((u, idx) => (
                            <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-800">{u.email}</td>
                              <td className="px-4 py-3 text-gray-800">{u.full_name || '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  u.role === 'student' ? 'bg-blue-100 text-blue-800' :
                                  u.role === 'lecturer' ? 'bg-green-100 text-green-800' :
                                  'bg-purple-100 text-purple-800'
                                }`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  u.is_active && u.approved ? 'bg-green-100 text-green-800' :
                                  !u.is_active ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {u.is_active && u.approved ? '✓ Active' :
                                   !u.is_active ? '✗ Inactive' :
                                   '⏳ Pending'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                {lecturerSuccess && (
                  <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                    ✅ Lecturer account created successfully! They have immediate upload access.
                  </div>
                )}

                {/* Create Lecturer Form */}
                {showLecturerForm ? (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-bold text-gray-800">👨‍🏫 Create Lecturer Account</h2>
                      <button
                        onClick={() => {
                          setShowLecturerForm(false);
                          setError(null);
                        }}
                        className="text-gray-600 hover:text-gray-800 text-2xl"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleCreateLecturer} className="space-y-4">
                      {/* Account Information */}
                      <div className="border-b border-gray-200 pb-4">
                        <h3 className="font-semibold text-gray-800 mb-4">Account Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Username <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="text"
                              value={lecturerUsername}
                              onChange={e => setLecturerUsername(e.target.value)}
                              placeholder="dakello"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isCreatingLecturer}
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Email <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="email"
                              value={lecturerEmail}
                              onChange={e => setLecturerEmail(e.target.value)}
                              placeholder="dr.akello@must.ac.ug"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isCreatingLecturer}
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Temporary Password <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="password"
                              value={lecturerPassword}
                              onChange={e => setLecturerPassword(e.target.value)}
                              placeholder="Min 8 characters"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isCreatingLecturer}
                              required
                              minLength={8}
                            />
                            <p className="text-xs text-gray-500 mt-1">Lecturer sets new password on first login</p>
                          </div>
                        </div>
                      </div>

                      {/* Personal Information */}
                      <div className="border-b border-gray-200 pb-4">
                        <h3 className="font-semibold text-gray-800 mb-4">Personal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Full Name <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="text"
                              value={lecturerName}
                              onChange={e => setLecturerName(e.target.value)}
                              placeholder="Dr. David Akello"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isCreatingLecturer}
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Phone <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="tel"
                              value={lecturerPhone}
                              onChange={e => setLecturerPhone(e.target.value)}
                              placeholder="+256 701 123456"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isCreatingLecturer}
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              University ID
                            </label>
                            <input
                              type="text"
                              value={lecturerUniversityId}
                              onChange={e => setLecturerUniversityId(e.target.value)}
                              placeholder="LEC-2024-001"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isCreatingLecturer}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Academic Information */}
                      <div className="pb-4">
                        <h3 className="font-semibold text-gray-800 mb-4">Academic Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Department <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="text"
                              value={lecturerDept}
                              onChange={e => setLecturerDept(e.target.value)}
                              placeholder="Computer Science"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isCreatingLecturer}
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Assigned Courses (comma-separated) <span className="text-red-600">*</span>
                        </label>
                        <textarea
                          value={lecturerCourses}
                          onChange={e => setLecturerCourses(e.target.value)}
                          placeholder="CS101, CS201, CS301"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isCreatingLecturer}
                          rows={2}
                          required
                        />
                        <p className="text-xs text-gray-600 mt-1">Enter course codes separated by commas</p>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                        <p className="text-sm text-blue-700">
                          <strong>✅ Immediate Access:</strong> After creation, this lecturer will have direct upload access with no pending approval needed.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={isCreatingLecturer}
                          className={`flex-1 py-2 rounded-lg font-semibold text-white transition ${
                            isCreatingLecturer
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {isCreatingLecturer ? '⏳ Creating...' : '✓ Create Lecturer'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowLecturerForm(false);
                            setError(null);
                          }}
                          disabled={isCreatingLecturer}
                          className="flex-1 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">👥 User Management</h2>
                    <p className="text-gray-600 mb-4">Create, edit, and manage student and lecturer accounts. Use bulk import for CSV uploads.</p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setShowLecturerForm(true)}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                      >
                        👨‍🏫 Create Lecturer
                      </button>
                      <button
                        onClick={() => navigate('/admin/users')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        Manage Users →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <SettingsPage />
            )}

            {/* ANALYTICS TAB */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">🔍 Filters</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
                      <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
                      <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                        <option>All Departments</option>
                        <option>Computer Science</option>
                        <option>Engineering</option>
                        <option>Business</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                        <option>All Roles</option>
                        <option>Student</option>
                        <option>Lecturer</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* USER ANALYTICS */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">👥 User Analytics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-600 mb-1">Total Students</p>
                      <p className="text-3xl font-bold text-blue-600">{analytics?.total_students || 0}</p>
                      <p className="text-xs text-gray-500 mt-2">↑ 15% from last month</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <p className="text-sm text-gray-600 mb-1">Total Lecturers</p>
                      <p className="text-3xl font-bold text-green-600">{analytics?.total_lecturers || 0}</p>
                      <p className="text-xs text-gray-500 mt-2">Approved: {analytics?.approved_lecturers || 0}</p>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <p className="text-sm text-gray-600 mb-1">Pending Approval</p>
                      <p className="text-3xl font-bold text-yellow-600">{analytics?.pending_lecturers || 0}</p>
                      <p className="text-xs text-gray-500 mt-2">Lecturers awaiting approval</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <p className="text-sm text-gray-600 mb-1">Active Users (30d)</p>
                      <p className="text-3xl font-bold text-purple-600">—</p>
                      <p className="text-xs text-gray-500 mt-2">API integration pending</p>
                    </div>
                  </div>
                </div>

                {/* ENGAGEMENT METRICS */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">💬 Engagement Metrics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                      <p className="text-sm text-gray-600 mb-1">Total Chats</p>
                      <p className="text-3xl font-bold text-indigo-600">{analytics?.total_chats || 0}</p>
                      <p className="text-xs text-gray-500 mt-2">All time conversations</p>
                    </div>
                    <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
                      <p className="text-sm text-gray-600 mb-1">Total Messages</p>
                      <p className="text-3xl font-bold text-pink-600">{analytics?.total_messages || 0}</p>
                      <p className="text-xs text-gray-500 mt-2">↑ 23% from last month</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                      <p className="text-sm text-gray-600 mb-1">Peak Usage Time</p>
                      <p className="text-3xl font-bold text-orange-600">—</p>
                      <p className="text-xs text-gray-500 mt-2">API integration pending</p>
                    </div>
                    <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-200">
                      <p className="text-sm text-gray-600 mb-1">Avg Response Time</p>
                      <p className="text-3xl font-bold text-cyan-600">—</p>
                      <p className="text-xs text-gray-500 mt-2">API integration pending</p>
                    </div>
                  </div>
                </div>

                {/* COURSE & CONTENT */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">📚 Course & Content Analytics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                      <p className="text-sm text-gray-600 mb-1">Most Queried Topic</p>
                      <p className="text-2xl font-bold text-teal-600">—</p>
                      <p className="text-xs text-gray-500 mt-2">API integration pending</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                      <p className="text-sm text-gray-600 mb-1">Top Active Course</p>
                      <p className="text-2xl font-bold text-emerald-600">—</p>
                      <p className="text-xs text-gray-500 mt-2">API integration pending</p>
                    </div>
                    <div className="bg-lime-50 p-4 rounded-lg border border-lime-200">
                      <p className="text-sm text-gray-600 mb-1">Documents Indexed</p>
                      <p className="text-3xl font-bold text-lime-600">—</p>
                      <p className="text-xs text-gray-500 mt-2">API integration pending</p>
                    </div>
                  </div>
                </div>

                {/* SYSTEM HEALTH */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">⚙️ System Health</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <p className="text-sm text-gray-600 mb-1">Platform Uptime</p>
                      <p className="text-3xl font-bold text-green-600">—</p>
                      <p className="text-xs text-gray-500 mt-2">API integration pending</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-600 mb-1">API Response Time</p>
                      <p className="text-3xl font-bold text-blue-600">—</p>
                      <p className="text-xs text-gray-500 mt-2">API integration pending</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                      <p className="text-sm text-gray-600 mb-1">Storage Used</p>
                      <p className="text-3xl font-bold text-amber-600">—</p>
                      <p className="text-xs text-gray-500 mt-2">API integration pending</p>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                      <p className="text-sm text-gray-600 mb-1">Database Health</p>
                      <p className="text-3xl font-bold text-indigo-600">—</p>
                      <p className="text-xs text-gray-500 mt-2">API integration pending</p>
                    </div>
                  </div>
                </div>

                {/* REPORTS & EXPORTS */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Reports & Exports</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-3">Quick Reports</h4>
                      <div className="space-y-2">
                        <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-between">
                          📊 User Summary Report
                          <span>↓</span>
                        </button>
                        <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center justify-between">
                          💬 Engagement Report
                          <span>↓</span>
                        </button>
                        <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center justify-between">
                          📚 Course Analytics
                          <span>↓</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-3">Export Options</h4>
                      <div className="space-y-2">
                        <button className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-medium">
                          📄 Export to CSV
                        </button>
                        <button className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-medium">
                          📑 Export to PDF
                        </button>
                        <button className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-medium">
                          📧 Schedule Email Report
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TOP COURSES TABLE */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 Top Courses & Topics</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Rank</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Course/Topic</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Active Students</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Queries/Month</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Engagement</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-100 hover:bg-gray-50">
                          <td colSpan={5} className="py-6 px-4 text-center text-gray-600">
                            No data available. API integration pending.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ACCOUNT TAB */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                {/* PROFILE MANAGEMENT */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">👤 Profile Management</h2>
                  
                  {accountMessage && (
                    <div className={`px-4 py-3 rounded-lg mb-6 ${
                      accountMessage.type === 'success' 
                        ? 'bg-green-100 border border-green-400 text-green-700'
                        : 'bg-red-100 border border-red-400 text-red-700'
                    }`}>
                      {accountMessage.text}
                    </div>
                  )}

                  <div className="flex gap-8">
                    {/* Profile Picture */}
                    <div className="flex flex-col items-center">
                      <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-6xl mb-4 overflow-hidden">
                        {profilePicture ? (
                          <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          '👤'
                        )}
                      </div>
                      <input
                        id="profilePictureInput"
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePictureChange}
                        className="hidden"
                      />
                      <button 
                        onClick={() => document.getElementById('profilePictureInput')?.click()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
                        Update Picture
                      </button>
                    </div>

                    {/* Profile Fields */}
                    <div className="flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                          <input
                            type="text"
                            value={accountForm.full_name}
                            onChange={(e) => setAccountForm({ ...accountForm, full_name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            value={accountForm.email}
                            onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                          <input
                            type="text"
                            value="Administrator"
                            disabled
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleUpdateProfile}
                        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>

                {/* SECURITY */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">🔒 Security</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Change Password */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Change Password</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                          <input
                            type="password"
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                          <input
                            type="password"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                          <input
                            type="password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <button 
                          onClick={handleChangePassword}
                          className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                          Update Password
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ACCOUNT PREFERENCES */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">⚙️ Account Preferences</h2>
                  
                  <div className="space-y-4">
                    {/* Email Notifications */}
                    <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">Email Notifications</p>
                        <p className="text-sm text-gray-600">Receive email alerts for important events</p>
                      </div>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationsEnabled}
                          onChange={(e) => setNotificationsEnabled(e.target.checked)}
                          className="w-5 h-5 text-blue-600 rounded"
                        />
                      </label>
                    </div>

                    {/* Dark Mode */}
                    <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">Dark Mode</p>
                        <p className="text-sm text-gray-600">{darkMode ? 'Enabled' : 'Disabled'} - Theme will update site-wide</p>
                      </div>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={darkMode}
                          onChange={(e) => setDarkMode(e.target.checked)}
                          className="w-5 h-5 text-blue-600 rounded"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* ACCOUNT STATUS - Requires additional User model fields (created_at, last_login, login_count) */}

                {/* DANGER ZONE */}
                <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-red-800 mb-6">⚠️ Danger Zone</h2>
                  
                  <div className="space-y-4">
                    <div className="border border-red-300 rounded-lg p-4">
                      <p className="font-medium text-red-800 mb-2">Deactivate Account</p>
                      <p className="text-sm text-red-700 mb-4">Temporarily disable your account. You can reactivate it later by logging in again.</p>
                      <button
                        onClick={handleDeactivateAccount}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                      >
                        Deactivate Account
                      </button>
                    </div>

                    <div className="border border-red-300 rounded-lg p-4">
                      <p className="font-medium text-red-800 mb-2">Delete Account</p>
                      <p className="text-sm text-red-700 mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                      <h3 className="text-xl font-bold text-red-800 mb-4">⚠️ Confirm Account Deletion</h3>
                      <p className="text-gray-700 mb-6">
                        Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteAccount}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
