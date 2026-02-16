// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/AuthContext';

import SetupPage from './pages/SetupPage';
import LoginPage from './pages/LoginPage';
import CredentialsLoginPage from './pages/CredentialsLoginPage';
import SignupPage from './pages/SignupPage';
import ChatPage from './pages/ChatPage';
import CourseSelectionPage from './pages/CourseSelectionPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminDashboard from './pages/AdminDashboard';
import UploadPage from './pages/UploadPage';
import SetPasswordPage from './pages/SetPasswordPage';
import AccountSettingsPage from './pages/AccountSettingsPage';
import GeneralSettingsPage from './pages/GeneralSettingsPage';



// ==================== Home Router (Role-Based Navigation) ====================
function HomeRouter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  React.useEffect(() => {
    if (!user) {
      return;
    }
    if (user.role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    } else if (user.role === 'lecturer') {
      navigate('/upload', { replace: true });
    } else {
      navigate('/chat', { replace: true });
    }
  }, [user, navigate]);

  if (!user) {
    return <ChatPage publicMode />;
  }

  return <div className="flex items-center justify-center h-screen">Redirecting...</div>;
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
        <Route path="/chat" element={<ChatPage />} />
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
