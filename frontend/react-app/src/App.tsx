// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/AuthContext';

import SetupPage from './pages/SetupPage';
import LoginPage from './pages/LoginPage';
import CredentialsLoginPage from './pages/CredentialsLoginPage';
import SignupPage from './pages/SignupPage';
import ChatPage from './pages/ChatPage';
import LecturerWorkspacePage from './pages/LecturerWorkspacePage';
import CourseSelectionPage from './pages/CourseSelectionPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminDashboard from './pages/AdminDashboard';
import UploadPage from './pages/UploadPage';
import SetPasswordPage from './pages/SetPasswordPage';
import AccountSettingsPage from './pages/AccountSettingsPage';
import GeneralSettingsPage from './pages/GeneralSettingsPage';


function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        <p className="text-sm text-gray-600">Restoring session...</p>
      </div>
    </div>
  );
}


// ==================== Home Router (Role-Based Navigation) ====================
function HomeRouter() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  
  React.useEffect(() => {
    if (isLoading || !user) {
      return;
    }
    if (user.role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    } else if (user.role === 'lecturer') {
      navigate('/lecturer', { replace: true });
    } else {
      navigate('/chat', { replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <ChatPage publicMode />;
  }

  return <div className="flex items-center justify-center h-screen">Redirecting...</div>;
}

function ChatRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <AuthLoadingScreen />;
  }
  if (!user) {
    return <ChatPage publicMode />;
  }
  if (user?.role === 'lecturer') {
    return <Navigate to="/lecturer" replace />;
  }
  return <ChatPage />;
}

function LecturerRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <AuthLoadingScreen />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== 'lecturer' && user.role !== 'admin') {
    return <Navigate to="/chat" replace />;
  }
  return <LecturerWorkspacePage />;
}

// ==================== Main Router ====================
function AppRouter() {
  // For UI-only development: skip all guards and just render the pages
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/credentials-login" element={<CredentialsLoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route path="/course-selection" element={<CourseSelectionPage />} />
        <Route path="/chat" element={<ChatRoute />} />
        <Route path="/lecturer" element={<LecturerRoute />} />
        <Route path="/account-settings" element={<AccountSettingsPage />} />
        <Route path="/general-settings" element={<GeneralSettingsPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/" element={<HomeRouter />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ==================== App Wrapper ====================
export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
