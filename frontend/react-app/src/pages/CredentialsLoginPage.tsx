// src/pages/CredentialsLoginPage.tsx - Admin & Lecturer Login
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { adminApi, institutionApi } from '../services/api';

interface CreateUserFormData {
  username: string;
  email: string;
  full_name: string;
  password: string;
  phone: string;
  university_id: string;
  department: string;
  role: 'student' | 'lecturer';
  faculty?: string;
  program?: string;
  year_of_study?: string;
}

export default function CredentialsLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showCreateUserMode, setShowCreateUserMode] = useState(false);

  const { login, user, isLoading, error } = useAuth();
  const navigate = useNavigate();
  const token = localStorage.getItem('auth_token') || '';

  // Create User form state
  const [createFormData, setCreateFormData] = useState<CreateUserFormData>({
    username: '',
    email: '',
    full_name: '',
    password: '',
    phone: '',
    university_id: '',
    department: '',
    role: 'student',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string>('');
  const [emailPattern, setEmailPattern] = useState<string>('');

  // Load email pattern configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await institutionApi.getConfiguration();
        if (createFormData.role === 'student') {
          setEmailPattern(config.student_email_pattern || '');
        } else {
          setEmailPattern(config.lecturer_email_pattern || '');
        }
      } catch (err) {
        console.error('Failed to load institution config:', err);
      }
    };
    loadConfig();
  }, [createFormData.role]);

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
  const handleCreateFormChange = (field: keyof CreateUserFormData, value: string) => {
    setCreateFormData({ ...createFormData, [field]: value });
    if (field === 'email') {
      if (emailPattern && !validateEmail(value, emailPattern)) {
        setEmailError(`Email must match pattern: ${emailPattern}`);
      } else {
        setEmailError('');
      }
    }
  };

  // Update role and refresh email pattern
  const handleRoleChange = (role: 'student' | 'lecturer') => {
    setCreateFormData({ ...createFormData, role, faculty: undefined, program: undefined, year_of_study: undefined });
    setEmailError('');
  };

  // ==================== Login Handler ====================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      // Error is handled by useAuth context
    }
  };

  // ==================== Password Reset Handler ====================
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Connect to backend password reset API
    alert(`Password reset link sent to ${resetEmail}`);
    setForgotPasswordMode(false);
    setResetEmail('');
  };

  // ==================== Create User Handler ====================
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);

    try {
      // Validate required fields
      if (!createFormData.username || !createFormData.email || !createFormData.full_name || 
          !createFormData.password || !createFormData.phone || !createFormData.department) {
        throw new Error('Username, Email, Full Name, Password, Phone, and Department are required');
      }

      // Validate email against pattern
      if (emailPattern && !validateEmail(createFormData.email, emailPattern)) {
        throw new Error(`Email must match pattern: ${emailPattern}`);
      }

      if (createFormData.role === 'student' && !createFormData.faculty) {
        throw new Error('Faculty is required for students');
      }

      if (!user?.id) {
        throw new Error('Admin user ID not found. Please log in again.');
      }

      // Call API to create user
      await adminApi.createUser(token, user.id, {
        username: createFormData.username,
        email: createFormData.email,
        full_name: createFormData.full_name,
        role: createFormData.role,
        password: createFormData.password,
        phone: createFormData.phone,
        university_id: createFormData.university_id || undefined,
        department: createFormData.department,
        faculty: createFormData.role === 'student' ? createFormData.faculty : undefined,
        program: createFormData.role === 'student' ? createFormData.program : undefined,
        year_of_study: createFormData.role === 'student' && createFormData.year_of_study 
          ? parseInt(createFormData.year_of_study) 
          : undefined,
      });

      setCreateSuccess(true);
      setTimeout(() => {
        setShowCreateUserMode(false);
        setCreateSuccess(false);
        setCreateFormData({
          username: '',
          email: '',
          full_name: '',
          password: '',
          phone: '',
          university_id: '',
          department: '',
          role: 'student',
        });
      }, 2000);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  // ==================== Create User Mode ====================
  if (showCreateUserMode && user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Create New User</h1>
              <p className="text-gray-600 text-sm mt-1">Add student or lecturer account</p>
            </div>
            <button
              onClick={() => setShowCreateUserMode(false)}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>

          {createSuccess && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
              ✅ User created successfully!
            </div>
          )}

          {createError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {createError}
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-6">
            {/* Account Information Section */}
            <div className="border-b border-gray-200 pb-4">
              <h3 className="font-semibold text-gray-800 mb-4">Account Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={createFormData.username}
                    onChange={(e) => setCreateFormData({ ...createFormData, username: e.target.value })}
                    placeholder="johndoe"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={createLoading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={createFormData.email}
                    onChange={(e) => handleCreateFormChange('email', e.target.value)}
                    placeholder="john@must.ac.ug"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      emailError ? 'border-red-400' : 'border-gray-300'
                    }`}
                    disabled={createLoading}
                    required
                  />
                  {emailError ? (
                    <p className="mt-1 text-xs text-red-600 font-medium">{emailError}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">
                      {emailPattern ? `Must use: ${emailPattern}` : 'Must be official institution email'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={createFormData.password}
                    onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                    placeholder="Min 8 characters"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={createLoading}
                    minLength={8}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createFormData.role}
                    onChange={(e) => handleRoleChange(e.target.value as 'student' | 'lecturer')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={createLoading}
                  >
                    <option value="student">Student</option>
                    <option value="lecturer">Lecturer</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Personal Information Section */}
            <div className="border-b border-gray-200 pb-4">
              <h3 className="font-semibold text-gray-800 mb-4">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={createFormData.full_name}
                    onChange={(e) => setCreateFormData({ ...createFormData, full_name: e.target.value })}
                    placeholder="John Doe"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={createLoading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={createFormData.phone}
                    onChange={(e) => setCreateFormData({ ...createFormData, phone: e.target.value })}
                    placeholder="+256 701 234567"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={createLoading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    University ID
                  </label>
                  <input
                    type="text"
                    value={createFormData.university_id}
                    onChange={(e) => setCreateFormData({ ...createFormData, university_id: e.target.value })}
                    placeholder="STU-2024-001"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={createLoading}
                  />
                </div>
              </div>
            </div>

            {/* Academic Information Section */}
            <div className="pb-4">
              <h3 className="font-semibold text-gray-800 mb-4">Academic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={createFormData.department}
                    onChange={(e) => setCreateFormData({ ...createFormData, department: e.target.value })}
                    placeholder="Computer Science"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={createLoading}
                    required
                  />
                </div>

                {createFormData.role === 'student' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Faculty <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={createFormData.faculty || ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, faculty: e.target.value })}
                        placeholder="Faculty of Computing"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={createLoading}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Program
                      </label>
                      <input
                        type="text"
                        value={createFormData.program || ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, program: e.target.value })}
                        placeholder="Bachelor of Science"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={createLoading}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Year of Study
                      </label>
                      <select
                        value={createFormData.year_of_study || ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, year_of_study: e.target.value })}
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

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={createLoading}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
              >
                {createLoading ? '⏳ Creating...' : '✓ Create User'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateUserMode(false)}
                disabled={createLoading}
                className="flex-1 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 font-medium transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ==================== Forgot Password Mode ====================
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

  // ==================== Login Form ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">EduSmart</h1>
        <p className="text-gray-600 mb-8">Admin & Lecturer Login</p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
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
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium mt-6"
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
          
          {user && (
            <button
              onClick={() => setShowCreateUserMode(true)}
              className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
            >
              + Create New User
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
