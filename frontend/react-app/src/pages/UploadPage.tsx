// src/pages/UploadPage.tsx - Complete Lecturer Material Upload Interface
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../state/AuthContext';
import { useNavigate } from 'react-router-dom';
import { lecturerApi } from '../services/api';
import { useCourseStore } from '../state/courseStore';

interface LecturerProfile {
  email: string;
  full_name: string;
  department: string;
  courses: string;
  approved: boolean;
}

interface UploadedMaterial {
  id: string;
  file_name: string;
  course_code: string;
  semester: string;
  academic_year: string;
  file_type: string;
  file_size: number;
  status: string;
  uploaded_at: string;
}

interface UploadStats {
  total_uploads: number;
  completed_uploads: number;
  processing_uploads: number;
  total_size_bytes: number;
  by_course: Record<string, number>;
}

export default function UploadPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const token = localStorage.getItem('auth_token') || '';
  const dragZoneRef = useRef<HTMLDivElement>(null);
  const { setCourse } = useCourseStore();

  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'analytics'>('upload');
  const [profile, setProfile] = useState<LecturerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload form state
  const [courseCode, setCourseCode] = useState('');
  const [semester, setSemester] = useState('');
  const [academicYear, setAcademicYear] = useState('2025/2026');
  const [description, setDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // History state
  const [uploads, setUploads] = useState<UploadedMaterial[]>([]);
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);

  // Analytics state
  const [analytics, setAnalytics] = useState<any>(null);
  const [lastUploadedCourseCode, setLastUploadedCourseCode] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'lecturer') {
      setIsLoading(false);
      return;
    }
    fetchProfileAndData();
  }, [user?.role]);

  const goToChatWithCourse = (code: string, label?: string) => {
    if (code) {
      setCourse(code, label || code);
    }
    navigate('/lecturer');
  };

  const fetchProfileAndData = async () => {
    try {
      setIsLoading(true);
      const profileData = await lecturerApi.getProfile(token);
      setProfile(profileData);
      
      const uploadsData = await lecturerApi.getUploads(token);
      setUploads(uploadsData);
      
      const statsData = await lecturerApi.getStats(token);
      setUploadStats(statsData);
      
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const analyticsData = await lecturerApi.getAnalytics(token);
      setAnalytics(analyticsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragZoneRef.current) {
      dragZoneRef.current.classList.add('border-blue-500', 'bg-blue-50');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragZoneRef.current) {
      dragZoneRef.current.classList.remove('border-blue-500', 'bg-blue-50');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragZoneRef.current) {
      dragZoneRef.current.classList.remove('border-blue-500', 'bg-blue-50');
    }
    
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
  };

  const addFiles = (newFiles: File[]) => {
    const allowedTypes = ['pdf', 'ppt', 'pptx', 'doc', 'docx'];
    const maxSize = 20 * 1024 * 1024; // 20MB

    const validFiles = newFiles.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !allowedTypes.includes(ext)) {
        setError(`Invalid file type: ${file.name}`);
        return false;
      }
      if (file.size > maxSize) {
        setError(`File too large: ${file.name} (max 20MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length + selectedFiles.length > 10) {
      setError('Maximum 10 files per upload');
      return;
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!courseCode || !semester || selectedFiles.length === 0) {
      setError('Please select a course, semester, and at least one file');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      
      await lecturerApi.uploadMaterials(
        token,
        courseCode,
        semester,
        academicYear,
        selectedFiles,
        description || undefined
      );

      setUploadSuccess(true);
      setLastUploadedCourseCode(courseCode);
      setTimeout(() => {
        setUploadSuccess(false);
        setCourseCode('');
        setSemester('');
        setDescription('');
        setSelectedFiles([]);
        fetchProfileAndData();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-800">Loading...</div>
        </div>
      </div>
    );
  }

  if (user?.role !== 'lecturer') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-lg w-full p-8 text-center space-y-4">
          <div className="text-5xl">🔒</div>
          <h1 className="text-2xl font-semibold text-gray-900">Lecturer workspace only</h1>
          <p className="text-gray-600">
            Upload controls are reserved for lecturers so citations stay credible. You can still chat with
            the latest materials from the main assistant experience.
          </p>
          <button
            onClick={() => navigate('/chat')}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-500 transition"
          >
            Go to Chat
          </button>
        </div>
      </div>
    );
  }

  const assignedCourses = profile?.courses ? profile.courses.split(',') : [];
  const semesterOptions = ['Semester 1', 'Semester 2'];
  const yearOptions = ['2024/2025', '2025/2026'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Header */}
      <div className="bg-white shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">📚 Upload Materials</h1>
            <p className="text-gray-600 text-sm">{profile?.full_name || user?.email}</p>
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
            { id: 'upload', label: '⬆️ Upload' },
            { id: 'history', label: '📁 History' },
            { id: 'analytics', label: '📊 Analytics' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                if (tab.id === 'analytics' && !analytics) {
                  fetchAnalytics();
                }
              }}
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

        {uploadSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-4 rounded-2xl mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Materials uploaded successfully! Processing started...</p>
              <p className="text-sm text-green-700">Jump into chat to use them with Bloom prompts.</p>
            </div>
            <button
              type="button"
              onClick={() => lastUploadedCourseCode && goToChatWithCourse(lastUploadedCourseCode)}
              className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-500 transition"
              disabled={!lastUploadedCourseCode}
            >
              Chat with this course
            </button>
          </div>
        )}

        {/* UPLOAD TAB */}
        {activeTab === 'upload' && (
          <form onSubmit={handleUpload} className="space-y-6">
            {/* Course, Semester, Year Selection */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">📋 Select Course & Semester</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Course Code <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={courseCode}
                    onChange={e => setCourseCode(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select course...</option>
                    {assignedCourses.map(course => (
                      <option key={course} value={course.trim()}>
                        {course.trim()}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-600 mt-1">Assigned: {assignedCourses.join(', ')}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Semester <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={semester}
                    onChange={e => setSemester(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select semester...</option>
                    {semesterOptions.map(sem => (
                      <option key={sem} value={sem}>
                        {sem}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Academic Year
                  </label>
                  <select
                    value={academicYear}
                    onChange={e => setAcademicYear(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {yearOptions.map(year => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g., Complete lecture notes for CS201 Data Structures"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            {/* File Upload */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">📄 Upload Files</h2>
              
              {/* Drag & Drop Zone */}
              <div
                ref={dragZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer transition mb-4"
              >
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  accept=".pdf,.ppt,.pptx,.doc,.docx"
                  className="hidden"
                  id="fileInput"
                />
                <label htmlFor="fileInput" className="cursor-pointer">
                  <div className="text-5xl mb-3">📁</div>
                  <p className="text-lg font-semibold text-gray-700">Drag files here or click to browse</p>
                  <p className="text-sm text-gray-600 mt-1">Supported: PDF, PPT, PPTX, DOC, DOCX (Max 20MB each)</p>
                </label>
              </div>

              {/* File List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2 mb-4">
                  <h3 className="font-semibold text-gray-700">Selected Files ({selectedFiles.length}/10):</h3>
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-gray-800 font-medium">{file.name}</p>
                        <p className="text-xs text-gray-600">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={isUploading || selectedFiles.length === 0}
                className={`w-full px-6 py-3 rounded-lg font-semibold text-white transition ${
                  isUploading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : selectedFiles.length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isUploading ? '⏳ Uploading...' : '⬆️ Upload Materials'}
              </button>
            </div>
          </form>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            {uploadStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-gray-600 text-sm">Total Uploads</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{uploadStats.total_uploads}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-gray-600 text-sm">Completed</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{uploadStats.completed_uploads}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-gray-600 text-sm">Processing</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-1">{uploadStats.processing_uploads}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-gray-600 text-sm">Total Size</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">
                    {(uploadStats.total_size_bytes / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>
            )}

            {uploads.length > 0 ? (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">📁 Upload History</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-700">File Name</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Course</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Semester</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Size</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Uploaded</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploads.map(upload => (
                        <tr key={upload.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-800 font-medium">{upload.file_name}</td>
                          <td className="px-4 py-3 text-gray-700">{upload.course_code}</td>
                          <td className="px-4 py-3 text-gray-700">{upload.semester}</td>
                          <td className="px-4 py-3 text-gray-700">
                            {(upload.file_size / 1024 / 1024).toFixed(2)} MB
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              upload.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : upload.status === 'processing'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {upload.status === 'completed' ? '✅ Completed' :
                               upload.status === 'processing' ? '⏳ Processing' :
                               '❌ Failed'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {new Date(upload.uploaded_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => goToChatWithCourse(upload.course_code)}
                              className="px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-full hover:bg-blue-50"
                            >
                              Chat with this course
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <p className="text-gray-600">No uploads yet. Start uploading materials!</p>
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {analytics ? (
              <>
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-gray-600 text-sm">Total Uploads</p>
                    <p className="text-3xl font-bold text-blue-600 mt-1">{analytics.total_uploads}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-gray-600 text-sm">Total Queries</p>
                    <p className="text-3xl font-bold text-purple-600 mt-1">
                      {analytics.most_queried.reduce((sum: number, item: any) => sum + item.query_count, 0)}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-gray-600 text-sm">Top Questions Asked</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{analytics.top_questions.length}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-gray-600 text-sm">Citations (This Week)</p>
                    <p className="text-3xl font-bold text-orange-600 mt-1">{analytics.citations_this_week}</p>
                  </div>
                </div>

                {/* Most Queried Materials */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">🔍 Most Queried Materials</h2>
                  <div className="space-y-3">
                    {analytics.most_queried.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-800">{item.file_name}</span>
                        <span className="font-semibold text-blue-600">{item.query_count} queries</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Student Questions */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">❓ Top Student Questions</h2>
                  <div className="space-y-3">
                    {analytics.top_questions.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-800">{item.question}</span>
                        <span className="font-semibold text-purple-600">{item.count} times</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Citation Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h2 className="text-2xl font-bold text-blue-800 mb-2">📖 Citation Attribution</h2>
                  <p className="text-blue-700">
                    Your materials were cited in <span className="font-bold">{analytics.citations_this_week}</span> student 
                    AI responses this week. Every AI answer that references your uploads shows proper attribution.
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <p className="text-gray-600">Loading analytics...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
