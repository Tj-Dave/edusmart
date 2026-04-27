import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/AuthContext';

import AccountSettingsPage from './pages/AccountSettingsPage';
import AdminCoursesPage from './pages/AdminCoursesPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminInstitutionPage from './pages/AdminInstitutionPage';
import AdminRagMonitoringPage from './pages/AdminRagMonitoringPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import ChatPage from './pages/ChatPage';
import CourseSelectionPage from './pages/CourseSelectionPage';
import CredentialsLoginPage from './pages/CredentialsLoginPage';
import GeneralSettingsPage from './pages/GeneralSettingsPage';
import LecturerWorkspacePage from './pages/LecturerWorkspacePage';
import LoginPage from './pages/LoginPage';
import SetPasswordPage from './pages/SetPasswordPage';
import SetupPage from './pages/SetupPage';
import SignupPage from './pages/SignupPage';
import UploadPage from './pages/UploadPage';

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

function HomeRouter() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isLoading || !user) return;
    if (user.role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
      return;
    }
    if (user.role === 'lecturer') {
      navigate('/lecturer', { replace: true });
      return;
    }
    navigate('/chat', { replace: true });
  }, [isLoading, navigate, user]);

  if (isLoading) return <AuthLoadingScreen />;
  if (!user) return <ChatPage publicMode />;
  return <div className="flex h-screen items-center justify-center text-sm text-gray-600">Redirecting...</div>;
}

function ChatRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthLoadingScreen />;
  if (!user) return <ChatPage publicMode />;
  if (user.role === 'lecturer') return <Navigate to="/lecturer" replace />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  return <ChatPage />;
}

function LecturerRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthLoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'lecturer') {
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/chat" replace />;
  }
  return <LecturerWorkspacePage />;
}

function AdminRoute({ children }: { children: React.ReactElement }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthLoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    if (user.role === 'lecturer') return <Navigate to="/lecturer" replace />;
    return <Navigate to="/chat" replace />;
  }
  return children;
}

function AppRouter() {
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
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <AdminUsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/courses"
          element={
            <AdminRoute>
              <AdminCoursesPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/institution"
          element={
            <AdminRoute>
              <AdminInstitutionPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/rag-monitoring"
          element={
            <AdminRoute>
              <AdminRagMonitoringPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <AdminRoute>
              <AdminSettingsPage />
            </AdminRoute>
          }
        />
        <Route path="/" element={<HomeRouter />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
