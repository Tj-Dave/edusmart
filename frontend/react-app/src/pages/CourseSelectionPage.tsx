// src/pages/CourseSelectionPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCourseStore } from '../state/courseStore';
import { setupApi } from '../services/api';
import { InstitutionConfig } from '../types/institution';

export default function CourseSelectionPage() {
  const navigate = useNavigate();
  const { setCourse, setHierarchy } = useCourseStore();

  const [config, setConfig] = useState<InstitutionConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCampus, setSelectedCampus] = useState<string>('');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');

  // Fetch institution config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Try to fetch from backend, but use fallback data if it fails
        let configData: InstitutionConfig;
        
        try {
          const status = await setupApi.checkStatus();
          configData = {
            institution_name: status.institution_name || 'MUST',
            institution_code: status.institution_code || 'MUST',
            student_email_pattern: '@student.must.ac.ug',
            lecturer_email_pattern: '@must.ac.ug',
            campuses: ['Main Campus', 'Kampala Campus'],
            faculties: ['Science', 'Engineering', 'Arts'],
            departments: {
              Science: ['Computer Science', 'Mathematics', 'Physics'],
              Engineering: ['Civil', 'Mechanical', 'Electrical'],
              Arts: ['Literature', 'History', 'Philosophy'],
            },
            academic_years: ['2024/2025'],
            semesters: ['Semester 1'],
            course_catalog: [
              { code: 'CS101', name: 'Introduction to Programming', department: 'Computer Science' },
              { code: 'CS102', name: 'Data Structures', department: 'Computer Science' },
              { code: 'CS103', name: 'Algorithms', department: 'Computer Science' },
              { code: 'MATH101', name: 'Calculus I', department: 'Mathematics' },
              { code: 'MATH102', name: 'Linear Algebra', department: 'Mathematics' },
              { code: 'PHYS101', name: 'Physics I', department: 'Physics' },
              { code: 'CV101', name: 'Structural Analysis', department: 'Civil' },
              { code: 'ME101', name: 'Mechanics', department: 'Mechanical' },
              { code: 'LIT101', name: 'Classic Literature', department: 'Literature' },
            ],
          };
        } catch (backendErr) {
          // Backend unavailable, use fallback data
          console.warn('Backend unavailable, using fallback course data');
          configData = {
            institution_name: 'MUST',
            institution_code: 'MUST',
            student_email_pattern: '@student.must.ac.ug',
            lecturer_email_pattern: '@must.ac.ug',
            campuses: ['Main Campus', 'Kampala Campus'],
            faculties: ['Science', 'Engineering', 'Arts'],
            departments: {
              Science: ['Computer Science', 'Mathematics', 'Physics'],
              Engineering: ['Civil', 'Mechanical', 'Electrical'],
              Arts: ['Literature', 'History', 'Philosophy'],
            },
            academic_years: ['2024/2025'],
            semesters: ['Semester 1'],
            course_catalog: [
              { code: 'CS101', name: 'Introduction to Programming', department: 'Computer Science' },
              { code: 'CS102', name: 'Data Structures', department: 'Computer Science' },
              { code: 'CS103', name: 'Algorithms', department: 'Computer Science' },
              { code: 'MATH101', name: 'Calculus I', department: 'Mathematics' },
              { code: 'MATH102', name: 'Linear Algebra', department: 'Mathematics' },
              { code: 'PHYS101', name: 'Physics I', department: 'Physics' },
              { code: 'CV101', name: 'Structural Analysis', department: 'Civil' },
              { code: 'ME101', name: 'Mechanics', department: 'Mechanical' },
              { code: 'LIT101', name: 'Classic Literature', department: 'Literature' },
            ],
          };
        }
        
        setConfig(configData);
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load course information');
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCourse) {
      setError('Please select a course');
      return;
    }

    // Find selected course details
    const course = config?.course_catalog.find((c) => c.code === selectedCourse);
    if (course) {
      // Store course selection
      setCourse(course.code, course.name);
      setHierarchy(selectedCampus, selectedFaculty, selectedDepartment);

      // Redirect to chat
      navigate('/chat');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-700">Loading course information...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-700">Failed to load courses</p>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const availableDepartments = selectedFaculty
    ? config.departments[selectedFaculty] || []
    : [];

  const availableCourses = selectedDepartment
    ? config.course_catalog.filter((c) => c.department === selectedDepartment)
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Course Selection</h1>
          <p className="text-gray-600 mb-8">
            Select your course to access personalized AI tutoring
          </p>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Campus Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Campus
              </label>
              <select
                value={selectedCampus}
                onChange={(e) => {
                  setSelectedCampus(e.target.value);
                  setSelectedFaculty('');
                  setSelectedDepartment('');
                  setSelectedCourse('');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a campus</option>
                {config.campuses.map((campus) => (
                  <option key={campus} value={campus}>
                    {campus}
                  </option>
                ))}
              </select>
            </div>

            {/* Faculty Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Faculty
              </label>
              <select
                value={selectedFaculty}
                onChange={(e) => {
                  setSelectedFaculty(e.target.value);
                  setSelectedDepartment('');
                  setSelectedCourse('');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={!selectedCampus}
              >
                <option value="">Select a faculty</option>
                {config.faculties.map((faculty) => (
                  <option key={faculty} value={faculty}>
                    {faculty}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setSelectedCourse('');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={!selectedFaculty}
              >
                <option value="">Select a department</option>
                {availableDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Course Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Course
              </label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={!selectedDepartment}
              >
                <option value="">Select a course</option>
                {availableCourses.map((course) => (
                  <option key={course.code} value={course.code}>
                    {course.code} - {course.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-lg transition-colors"
              >
                Continue to AI Tutoring
              </button>
            </div>
          </form>

          {/* Course Summary */}
          {selectedCourse && (
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">Selected Course:</h3>
              <p className="text-gray-700">
                {availableCourses.find((c) => c.code === selectedCourse)?.code} -{' '}
                {availableCourses.find((c) => c.code === selectedCourse)?.name}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                All your AI interactions will be personalized to this course
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
