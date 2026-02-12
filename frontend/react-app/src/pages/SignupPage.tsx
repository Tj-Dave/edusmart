// src/pages/SignupPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { institutionApi } from '../services/api';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
    fullName: '',
    universityId: '',
    faculty: '',
    department: '',
    program: '',
    yearOfStudy: '',
    phone: '',
  });

  const [emailPattern, setEmailPattern] = useState<string>('');

  const [emailError, setEmailError] = useState<string>('');

  const { register, isLoading, error } = useAuth();
  const navigate = useNavigate();

  // Fetch institution config on page load
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await institutionApi.getConfiguration();
        setEmailPattern(config.student_email_pattern || '');
      } catch (err) {
        console.error('Failed to load institution config');
      }
    };
    loadConfig();
  }, []);

  // Validate email against pattern
  const validateEmail = (email: string, pattern: string): boolean => {
    if (!pattern) return true; // If no pattern set, allow any email
    
    // Convert simple pattern like "@must.ac.ug" to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\./g, '\\.')
      .replace(/^/, '^')
      .replace(/$/, '$');
    
    try {
      const regex = new RegExp(regexPattern);
      return regex.test(email);
    } catch {
      return true; // If regex fails, allow email
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Validate email in real-time
    if (name === 'email' && emailPattern) {
      if (!validateEmail(value, emailPattern)) {
        setEmailError(`Email must match pattern: ${emailPattern}`);
      } else {
        setEmailError('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.passwordConfirm) {
      alert('Passwords do not match');
      return;
    }

    // Validate email against pattern
    if (emailPattern && !validateEmail(formData.email, emailPattern)) {
      setEmailError(`Email must match pattern: ${emailPattern}`);
      return;
    }

    try {
      await register(formData.email, formData.password, {
        username: formData.username,
        full_name: formData.fullName,
        university_id: formData.universityId || undefined,
        faculty: formData.faculty || undefined,
        department: formData.department || undefined,
        program: formData.program || undefined,
        year_of_study: formData.yearOfStudy ? parseInt(formData.yearOfStudy) : undefined,
        phone: formData.phone || undefined,
      });
      navigate('/course-selection');
    } catch (err) {
      // Error is handled by useAuth context
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">EduSmart</h1>
        <p className="text-gray-600 mb-8">Student Registration</p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Account Information */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Account Information</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
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
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={8}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Minimum 8 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="passwordConfirm"
                  value={formData.passwordConfirm}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  University ID
                </label>
                <input
                  type="text"
                  name="universityId"
                  value={formData.universityId}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Academic Information */}
          <div className="pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Academic Information</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Faculty
                </label>
                <input
                  type="text"
                  name="faculty"
                  value={formData.faculty}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Science, Engineering"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Computer Science"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Program/Course
                </label>
                <input
                  type="text"
                  name="program"
                  value={formData.program}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., BSc Computer Science"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year of Study
                </label>
                <select
                  name="yearOfStudy"
                  value={formData.yearOfStudy}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select year</option>
                  <option value="1">Year 1</option>
                  <option value="2">Year 2</option>
                  <option value="3">Year 3</option>
                  <option value="4">Year 4</option>
                  <option value="5">Year 5</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? 'Registering...' : 'Create Account'}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-300">
          <p className="text-gray-600 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">
              Login
            </Link>
          </p>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-gray-600">
          <p className="font-semibold mb-2">Fields marked with * are required</p>
          <p>All other fields are optional and can be updated later in your profile.</p>
        </div>
      </div>
    </div>
  );
}
