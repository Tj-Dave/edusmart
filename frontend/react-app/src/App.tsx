import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import ChatPage from "./pages/ChatPage";
import UploadPage from "./pages/UploadPage";
import AdminDashboard from "./pages/AdminDashboard";
import SetPasswordPage from "./pages/SetPasswordPage";
import LecturerPendingPage from "./pages/LecturerPendingPage";
import CourseSelectionPage from "./pages/CourseSelectionPage";
import { SetupWizardPage } from "./pages/SetupWizardPage";
import MainLayout from "./layout/MainLayout";
import { useAuth } from "./state/AuthContext";
import { useSetup } from "./contexts/SetupContext";

function PrivateRoute({ allowedRoles, requireCourse }: { allowedRoles?: string[]; requireCourse?: boolean }) {
  const { status, user } = useAuth();

  // ✅ All auth checks passed by App.tsx - just check role/course permissions
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/course-selection" replace />;
  }

  // ✅ For students accessing chat, verify course is selected
  if (requireCourse && user?.role === "student") {
    const selectedCourse = localStorage.getItem("selected_course");
    if (!selectedCourse) {
      return <Navigate to="/course-selection" replace />;
    }
  }

  // ✅ All checks passed - render the route
  return <Outlet />;
}

export default function App() {
  const { status } = useAuth();
  const { needsSetup, isLoading: setupLoading } = useSetup();

  // ⏳ Both auth and setup checks are still loading - show loader
  if (status === 'checking' || setupLoading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(to bottom right, rgb(243, 244, 246), rgb(229, 231, 235))'
      }}>
        <div style={{ textAlign: 'center' }}>
          <svg 
            style={{ 
              animation: 'spin 1s linear infinite', 
              width: '48px', 
              height: '48px',
              margin: '0 auto 16px',
              color: '#2563eb'
            }} 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p style={{ color: '#4b5563', marginTop: '16px' }}>Loading your session...</p>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // ✅ Navigation hierarchy (single decision tree):
  // 1. Setup needed? → Show setup wizard
  // 2. Not authenticated? → Show login
  // 3. Authenticated? → Show appropriate dashboard
  return (
    <Routes>
      {/* SETUP FLOW: If setup is needed, ALWAYS show setup first (bypass auth) */}
      {needsSetup ? (
        <>
          <Route path="/setup" element={<SetupWizardPage />} />
          <Route path="*" element={<Navigate to="/setup" replace />} />
        </>
      ) : status === 'unauthenticated' ? (
        // AUTH FLOW: Not logged in - show public routes only
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      ) : (
        // PROTECTED FLOW: Logged in - show user-appropriate routes
        <>
          {/* Password setup on first login */}
          <Route element={<PrivateRoute />}>
            <Route path="/set-password" element={<SetPasswordPage />} />
          </Route>

          {/* Lecturer pending approval */}
          <Route element={<PrivateRoute />}>
            <Route path="/lecturer-pending" element={<LecturerPendingPage />} />
          </Route>

          {/* Course selection (all authenticated users) */}
          <Route element={<PrivateRoute />}>
            <Route path="/course-selection" element={<CourseSelectionPage />} />
          </Route>

          {/* Main chat (students only, requires course) */}
          <Route element={<PrivateRoute requireCourse={true} />}>
            <Route path="/chat" element={<MainLayout />}>
              <Route index element={<ChatPage />} />
            </Route>
          </Route>

          {/* Upload (lecturers only) */}
          <Route element={<PrivateRoute allowedRoles={["lecturer"]} />}>
            <Route path="/upload" element={<UploadPage />} />
          </Route>

          {/* Admin dashboard (admins only) */}
          <Route element={<PrivateRoute allowedRoles={["admin"]} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          {/* Default redirect based on role */}
          <Route path="/" element={<RoleBasedRedirect />} />
          <Route path="*" element={<RoleBasedRedirect />} />
        </>
      )}
    </Routes>
  );
}

// Helper component for role-based default redirect
function RoleBasedRedirect() {
  const { user } = useAuth();
  
  // Redirect based on user role
  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }
  if (user?.role === "lecturer") {
    return <Navigate to={user.approved ? "/upload" : "/lecturer-pending"} replace />;
  }
  // Default for students
  return <Navigate to="/course-selection" replace />;
}
