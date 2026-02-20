// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage      from './pages/landingPage';
import LoginPage        from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import LecturerDashboard from './pages/LecturerDashboard';
import HowItWorksPage   from './pages/HowItWorksPage';
import FeaturesPage     from './pages/FeaturesPage';
import BenefitsPage     from './pages/BenefitsPage';
import AboutPage        from './pages/AboutPage';

function Loader() {
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#f0f4fa',gap:14}}>
      <div style={{width:38,height:38,border:'3px solid rgba(26,107,255,0.15)',borderTopColor:'#1a6bff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{fontSize:'0.85rem',color:'#8a98a8',fontFamily:'Nunito,sans-serif'}}>Loading…</p>
    </div>
  );
}

function ProtectedRoute({ children, allowedRole }) {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRole && user?.role !== allowedRole)
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public landing & info pages */}
      <Route path="/"            element={<LandingPage />} />
      <Route path="/login"       element={<LoginPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/features"    element={<FeaturesPage />} />
      <Route path="/benefits"    element={<BenefitsPage />} />
      <Route path="/about"       element={<AboutPage />} />

      {/* Protected: Student */}
      <Route path="/student/dashboard"
        element={
          <ProtectedRoute allowedRole="student">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />

      {/* Protected: Lecturer */}
      <Route path="/lecturer/dashboard"
        element={
          <ProtectedRoute allowedRole="lecturer">
            <LecturerDashboard />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}