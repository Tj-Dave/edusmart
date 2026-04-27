// src/components/common/ProtectedRoute.tsx
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext';
import { useCourseStore } from '../../state/courseStore';
import { UserRole } from '../../types/auth';

// ==================== PublicRoute ====================
export function PublicRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// ==================== PrivateRoute ====================
export function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// ==================== CourseRequiredRoute (CRITICAL - Proposal §3.2) ====================
/**
 * Route guard that enforces mandatory course selection for students.
 * Students cannot access /chat without selecting a course first.
 * 
 * PROPOSAL §3.2: Students must have course context for all interactions.
 */
export function CourseRequiredRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const { courseCode } = useCourseStore();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Students MUST have course selected
  if (user.role === 'student' && !courseCode) {
    return <Navigate to="/course-selection" replace />;
  }

  // Lecturers/admins can skip course selection
  return <>{children}</>;
}

// ==================== RoleRoute ====================
export function RoleRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
