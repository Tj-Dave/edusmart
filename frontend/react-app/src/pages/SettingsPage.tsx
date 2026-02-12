// src/pages/SettingsPage.tsx - Institution Configuration Management
import { useState, useEffect } from 'react';
import { institutionApi } from '../services/api';

interface InstitutionConfig {
  institution_name: string;
  institution_code: string;
  student_email_pattern: string;
  lecturer_email_pattern: string;
  allow_student_signup: boolean;
  campuses: string[];
  faculties: string[];
  departments: string[];
}

export default function SettingsPage() {
  const [config, setConfig] = useState<InstitutionConfig>({
    institution_name: '',
    institution_code: '',
    student_email_pattern: '',
    lecturer_email_pattern: '',
    allow_student_signup: false,
    campuses: [],
    faculties: [],
    departments: [],
  });

  const [newCampus, setNewCampus] = useState('');
  const [newFaculty, setNewFaculty] = useState('');
  const [newDepartment, setNewDepartment] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ==================== Load Configuration ====================
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await institutionApi.getConfiguration();
        setConfig(data);
      } catch (err: any) {
        setError('Failed to load settings');
      }
    };
    loadConfig();
  }, []);

  // ==================== Handlers ====================
  const handleInputChange = (field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addCampus = () => {
    if (newCampus.trim() && !config.campuses.includes(newCampus)) {
      setConfig((prev) => ({
        ...prev,
        campuses: [...prev.campuses, newCampus],
      }));
      setNewCampus('');
    }
  };

  const removeCampus = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      campuses: prev.campuses.filter((_, i) => i !== index),
    }));
  };

  const addFaculty = () => {
    if (newFaculty.trim() && !config.faculties.includes(newFaculty)) {
      setConfig((prev) => ({
        ...prev,
        faculties: [...prev.faculties, newFaculty],
      }));
      setNewFaculty('');
    }
  };

  const removeFaculty = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      faculties: prev.faculties.filter((_, i) => i !== index),
    }));
  };

  const addDepartment = () => {
    if (newDepartment.trim() && !config.departments.includes(newDepartment)) {
      setConfig((prev) => ({
        ...prev,
        departments: [...prev.departments, newDepartment],
      }));
      setNewDepartment('');
    }
  };

  const removeDepartment = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      departments: prev.departments.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await institutionApi.updateConfiguration(config);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== Render ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Institution Settings</h1>
        <p className="text-gray-600 mt-1">Manage your institution configuration</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          Settings saved successfully!
        </div>
      )}

      {/* Institution Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">📋 Institution Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Institution Name
            </label>
            <input
              type="text"
              value={config.institution_name}
              onChange={(e) => handleInputChange('institution_name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Institution Code
            </label>
            <input
              type="text"
              value={config.institution_code}
              onChange={(e) => handleInputChange('institution_code', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Email Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">✉️ Email Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Student Email Pattern (e.g., @student.edu)
            </label>
            <input
              type="text"
              value={config.student_email_pattern}
              onChange={(e) => handleInputChange('student_email_pattern', e.target.value)}
              placeholder="@student.edu"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lecturer Email Pattern (e.g., @lecturer.edu)
            </label>
            <input
              type="text"
              value={config.lecturer_email_pattern}
              onChange={(e) => handleInputChange('lecturer_email_pattern', e.target.value)}
              placeholder="@lecturer.edu"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Campuses */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">🏛️ Campuses</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newCampus}
            onChange={(e) => setNewCampus(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCampus()}
            placeholder="Add campus name"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addCampus}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {config.campuses.map((campus, idx) => (
            <div
              key={idx}
              className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full flex items-center gap-2"
            >
              {campus}
              <button
                onClick={() => removeCampus(idx)}
                className="text-blue-600 hover:text-blue-800"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Faculties */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">🎓 Faculties</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newFaculty}
            onChange={(e) => setNewFaculty(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addFaculty()}
            placeholder="Add faculty name"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addFaculty}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {config.faculties.map((faculty, idx) => (
            <div
              key={idx}
              className="bg-green-100 text-green-800 px-3 py-1 rounded-full flex items-center gap-2"
            >
              {faculty}
              <button
                onClick={() => removeFaculty(idx)}
                className="text-green-600 hover:text-green-800"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Departments */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">🏢 Departments</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newDepartment}
            onChange={(e) => setNewDepartment(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addDepartment()}
            placeholder="Add department name"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addDepartment}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {config.departments.map((dept, idx) => (
            <div
              key={idx}
              className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full flex items-center gap-2"
            >
              {dept}
              <button
                onClick={() => removeDepartment(idx)}
                className="text-purple-600 hover:text-purple-800"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Other Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">⚙️ Other Settings</h2>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="allowStudentSignup"
            checked={config.allow_student_signup}
            onChange={(e) => handleInputChange('allow_student_signup', e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <label htmlFor="allowStudentSignup" className="ml-2 text-gray-700">
            Allow student self-signup (instead of admin creating accounts)
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
