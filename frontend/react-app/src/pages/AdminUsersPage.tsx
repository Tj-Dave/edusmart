// src/pages/AdminUsersPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';

interface User {
  email: string;
  full_name: string;
  role: 'student' | 'lecturer' | 'admin';
  approved: boolean;
  is_active: boolean;
  courses?: string;
}

export default function AdminUsersPage() {
  const { user: currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const token = localStorage.getItem('auth_token') || '';

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    phone: '',
    university_id: '',
    faculty: '',
    department: '',
    program: '',
    year_of_study: '',
    role: 'student' as 'student' | 'lecturer',
  });

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await adminApi.getUsers(token);
      setUsers(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);

    try {
      if (!currentUser?.id) {
        throw new Error('Admin user ID not found');
      }

      // Validate required fields based on role
      if (!formData.username || !formData.email || !formData.full_name || !formData.password || !formData.phone) {
        throw new Error('Username, Email, Full Name, Password, and Phone are required');
      }

      if (formData.role === 'student') {
        if (!formData.faculty || !formData.department) {
          throw new Error('Faculty and Department are required for students');
        }
      } else if (formData.role === 'lecturer') {
        if (!formData.department) {
          throw new Error('Department is required for lecturers');
        }
      }

      await adminApi.createUser(token, currentUser.id, {
        username: formData.username,
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
        password: formData.password,
        phone: formData.phone,
        university_id: formData.university_id || undefined,
        faculty: formData.role === 'student' ? formData.faculty : undefined,
        department: formData.department || undefined,
        program: formData.role === 'student' ? formData.program : undefined,
        year_of_study: formData.role === 'student' && formData.year_of_study ? parseInt(formData.year_of_study) : undefined,
      });

      // Reset form and refresh users
      setFormData({
        username: '',
        email: '',
        full_name: '',
        password: '',
        phone: '',
        university_id: '',
        faculty: '',
        department: '',
        program: '',
        year_of_study: '',
        role: 'student',
      });
      setShowCreateForm(false);
      await fetchUsers();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/credentials-login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-50">
      {/* Header with Navigation */}
      <div className="bg-white shadow-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">🎓 EduSmart Admin</h1>
            <p className="text-gray-600 text-sm">{currentUser?.email}</p>
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
        <div className="max-w-6xl mx-auto px-6 flex gap-8">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="px-4 py-4 border-b-2 font-medium transition border-transparent text-gray-600 hover:text-gray-800"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">User Management</h1>
              <p className="text-gray-600">Create and manage student and lecturer accounts</p>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              {showCreateForm ? 'Cancel' : '+ Create User'}
            </button>
          </div>
        </div>

        {/* Create User Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Create New User</h2>

            {createError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-6">
              {/* Account Information */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="font-semibold text-gray-800 mb-4">Account Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={createLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={createLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      minLength={8}
                      disabled={createLoading}
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as 'student' | 'lecturer' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={createLoading}
                    >
                      <option value="student">Student</option>
                      <option value="lecturer">Lecturer</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="font-semibold text-gray-800 mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={createLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={createLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      University ID
                    </label>
                    <input
                      type="text"
                      value={formData.university_id}
                      onChange={(e) => setFormData({ ...formData, university_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={createLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Academic Information */}
              <div className="pb-4">
                <h3 className="font-semibold text-gray-800 mb-4">Academic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={createLoading}
                    />
                  </div>

                  {formData.role === 'student' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Faculty <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.faculty}
                          onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required={formData.role === 'student'}
                          disabled={createLoading}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Program
                        </label>
                        <input
                          type="text"
                          value={formData.program}
                          onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={createLoading}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Year of Study
                        </label>
                        <select
                          value={formData.year_of_study}
                          onChange={(e) => setFormData({ ...formData, year_of_study: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={createLoading}
                        >
                          <option value="">Select year</option>
                          <option value="1">Year 1</option>
                          <option value="2">Year 2</option>
                          <option value="3">Year 3</option>
                          <option value="4">Year 4</option>
                          <option value="5">Year 5</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {createLoading ? 'Creating...' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800">Users</h2>
          </div>

          {error && (
            <div className="p-6 bg-red-100 border-b border-red-400 text-red-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="p-6 text-center text-gray-500">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.email} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-700">{u.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{u.full_name}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          u.role === 'admin'
                            ? 'bg-red-100 text-red-800'
                            : u.role === 'lecturer'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {u.approved ? (
                          <span className="text-green-600 font-medium">✓ Approved</span>
                        ) : (
                          <span className="text-yellow-600 font-medium">⏳ Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {u.is_active ? (
                          <span className="text-green-600 font-medium">✓ Active</span>
                        ) : (
                          <span className="text-gray-500 font-medium">✕ Inactive</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
