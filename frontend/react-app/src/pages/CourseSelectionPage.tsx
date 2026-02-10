import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import CourseSelector from "../components/CourseSelector";

export default function CourseSelectionPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleCourseSelected = () => {
    // Course selector has already saved to localStorage
    // Just navigate to chat
    navigate("/chat");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">EduSmart</h1>
          <p className="text-lg text-gray-600">Learning Assistant</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome, {user?.name}!</h2>
            <p className="text-gray-600">
              Select your course to begin your learning journey with AI-powered assistance.
            </p>
          </div>

          {/* Course Selector Component */}
          <CourseSelector onSelect={handleCourseSelected} />

          {/* Logout Button */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full py-3 px-4 border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> Select your campus, year, semester, and course unit to proceed.
          </p>
        </div>
      </div>
    </div>
  );
}
