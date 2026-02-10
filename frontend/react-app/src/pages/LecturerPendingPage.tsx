import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export default function LecturerPendingPage() {
  const navigate = useNavigate();
  const { user, logout, status } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Only redirect AFTER auth has finished loading
  useEffect(() => {
    if (status !== 'checking' && (!user || user.role !== "lecturer" || user.approved)) {
      navigate("/chat");
    }
  }, [status, user, navigate]);

  // Show loading spinner while auth status is being determined
  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin -ml-1 mr-3 h-12 w-12 text-amber-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600 mt-4">Loading your session...</p>
        </div>
      </div>
    );
  }

  // Auto-polling every 30s per Proposal requirement (UC-10)
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch("/auth/me", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        });
        if (response.ok) {
          const updatedUser = await response.json();
          if (updatedUser.approved) {
            navigate("/upload");
          }
        }
      } catch (error) {
        console.error("Failed to poll approval status:", error);
      }
    }, 30000); // 30 second interval per spec

    return () => clearInterval(pollInterval);
  }, [navigate]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Manually refresh user data from API
      const response = await fetch("/auth/me", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      if (response.ok) {
        const updatedUser = await response.json();
        if (updatedUser.approved) {
          navigate("/upload");
        }
      }
    } catch (error) {
      console.error("Failed to refresh status:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Pending Approval</h1>
          <p className="text-gray-600">Hello, {user?.name}!</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              Your lecturer account is currently pending approval by the institution administrator.
            </p>
            <p className="text-gray-600 text-sm mb-4">
              Once approved, you'll be able to:
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 mr-3 text-xs font-bold">✓</span>
                Upload course materials
              </li>
              <li className="flex items-center">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 mr-3 text-xs font-bold">✓</span>
                Access the AI learning assistant
              </li>
              <li className="flex items-center">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 mr-3 text-xs font-bold">✓</span>
                Support your students with AI-powered learning
              </li>
            </ul>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <p className="text-xs text-gray-500 text-center mb-4">
              Expected approval time: 24-48 hours
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition"
          >
            {refreshing ? "Checking..." : "Check Approval Status"}
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold rounded-lg transition"
          >
            Logout
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Questions?</strong> Contact the IT Department at it@must.ac.ug for account status updates.
          </p>
        </div>
      </div>
    </div>
  );
}
