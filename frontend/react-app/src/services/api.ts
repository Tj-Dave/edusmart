// src/services/api.ts
import { User, TokenResponse } from '../types/auth';
import { SetupStatus } from '../types/institution';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';

// ==================== Setup Endpoints ====================
export const setupApi = {
  checkStatus: async (): Promise<SetupStatus> => {
    const response = await fetch(`${API_BASE_URL}/setup/status`);
    if (!response.ok) throw new Error('Failed to check setup status');
    return response.json();
  },

  configure: async (config: {
    institution_name: string;
    institution_code: string;
    student_email_pattern: string;
    lecturer_email_pattern: string;
    admin_email: string;
    admin_password: string;
    admin_full_name: string;
    campuses?: string[];
    faculties?: string[];
    departments?: Record<string, string[]>;
    academic_years?: string[];
    semesters?: string[];
    course_catalog?: Array<{ code: string; name: string; department: string }>;
  }) => {
    const response = await fetch(`${API_BASE_URL}/setup/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Setup failed');
    }
    return response.json();
  },
};

// ==================== Auth Endpoints ====================
export const authApi = {
  login: async (email: string, password: string): Promise<TokenResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }
    return response.json();
  },

  register: async (
    email: string,
    password: string,
    profileData?: {
      username?: string;
      full_name?: string;
      university_id?: string;
      faculty?: string;
      department?: string;
      program?: string;
      year_of_study?: number;
      phone?: string;
    }
  ) => {
    const body = {
      email,
      password,
      ...profileData,
    };
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }
    return response.json();
  },

  getMe: async (token: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      let detail = 'Failed to fetch user';
      try {
        const parsed = await response.json();
        detail = parsed?.detail || parsed?.message || detail;
      } catch {
        // fall through with default detail
      }
      const error = new Error(detail) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return response.json();
  },

  setPassword: async (token: string, password: string, passwordConfirm: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/set-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password, password_confirm: passwordConfirm }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Password update failed');
    }
    return response.json();
  },
};

// ==================== Admin Endpoints ====================
export const adminApi = {
  getUsers: async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  createUser: async (token: string, userId: string, userData: {
    email: string;
    full_name: string;
    role: 'student' | 'lecturer';
    password: string;
    username?: string;
    phone?: string;
    university_id?: string;
    department?: string;
    faculty?: string;
    program?: string;
    year_of_study?: number;
    courses?: string;
  }) => {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-User-Id': userId,
      },
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create user');
    }
    return response.json();
  },

  getAnalytics: async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/admin/analytics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch analytics');
    return response.json();
  },
};

// ==================== Chat Endpoints ====================
// services/api.ts (or wherever chatApi lives)

const safeParseError = async (response: Response) => {
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return json?.detail || json?.message || text || response.statusText;
  } catch {
    return text || response.statusText;
  }
};

export const chatApi = {
  // ✅ NEW: Atomic first-message endpoint
    queryAtomic: async (
      token: string,
      content: string,
      courseCode?: string | null,
      limit: number = 200
    ) => {
      const payload = {
        content,
        course_code: courseCode && courseCode.trim().length > 0 ? courseCode.trim() : null,
        limit,
      };

      const response = await fetch(`${API_BASE_URL}/chats/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || "Failed to run chat query");
      }

      return response.json();
    },

  listSessions: async (
    token: string,
    params?: { includeArchived?: boolean; course_id?: string; general_only?: boolean }
  ) => {
    const query = new URLSearchParams();
    if (params?.includeArchived) query.append("include_archived", "true");
    if (params?.course_id) query.append("course_id", params.course_id);
    if (params?.general_only) query.append("general_only", "true");

    const response = await fetch(`${API_BASE_URL}/chats?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to fetch chat sessions");
    return response.json();
  },



  // ✅ NEW: fetch a session + its messages
  getSessionDetail: async (token: string, sessionId: string, limit: number = 200) => {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await fetch(`${API_BASE_URL}/chats/${sessionId}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  sendMessage: async (token: string, sessionId: string, content: string) => {
    const params = new URLSearchParams({ content });
    const response = await fetch(`${API_BASE_URL}/chats/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${token}`,
      },
      body: params,
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  deleteSession: async (token: string, sessionId: string) => {
    const response = await fetch(`${API_BASE_URL}/chats/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  archiveSession: async (token: string, sessionId: string, isArchived: boolean) => {
    const response = await fetch(`${API_BASE_URL}/chats/${sessionId}/archive?is_archived=${isArchived}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },
};


// ==================== Ingestion Endpoints ====================
export const ingestionApi = {
  uploadDocument: async (token: string, file: File, courseId?: string) => {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const query = new URLSearchParams();
    if (courseId) query.append('course_id', courseId);

    const response = await fetch(`${API_BASE_URL}/ingest/upload?${query}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errorDetail = 'Reference upload failed';
      try {
        const error = await response.json();
        if (error?.detail) errorDetail = error.detail;
      } catch (error) {
        // Swallow JSON parse errors and fall back to default message
      }
      throw new Error(errorDetail);
    }

    return response.json();
  },
};
// ==================== Lecturer Endpoints ====================
export const lecturerApi = {
  getProfile: async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/lecturers/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch lecturer profile');
    return response.json();
  },

  uploadMaterials: async (
    token: string,
    courseCode: string,
    semester: string,
    academicYear: string,
    files: File[],
    description?: string
  ) => {
    const formData = new FormData();
    formData.append('course_code', courseCode);
    formData.append('semester', semester);
    formData.append('academic_year', academicYear);
    if (description) formData.append('description', description);
    files.forEach(file => formData.append('files', file));

    const response = await fetch(`${API_BASE_URL}/lecturers/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload failed');
    }
    return response.json();
  },

  getUploads: async (token: string, courseCode?: string) => {
    const params = new URLSearchParams();
    if (courseCode) params.append('course_code', courseCode);
    const response = await fetch(`${API_BASE_URL}/lecturers/uploads?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch uploads');
    return response.json();
  },

  getStats: async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/lecturers/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch upload stats');
    return response.json();
  },

  getAnalytics: async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/lecturers/analytics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch analytics');
    return response.json();
  },
};

// ==================== Institution Configuration Endpoints ====================
export const institutionApi = {
  getConfiguration: async (token?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/institution/config`, {
      headers,
    });
    if (!response.ok) throw new Error('Failed to fetch institution configuration');
    return response.json();
  },

  updateConfiguration: async (config: any, token?: string) => {
    const authToken = token || localStorage.getItem('auth_token') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const response = await fetch(`${API_BASE_URL}/institution/config`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update institution configuration');
    }
    return response.json();
  },
};

// ==================== Course Endpoints ====================
export const courseApi = {
  create: async (token: string, data: {
    course_code: string;
    course_name: string;
    description?: string;
    department?: string;
    faculty?: string;
    level?: string;
    credits?: number;
    is_active?: boolean;
  }) => {
    const response = await fetch(`${API_BASE_URL}/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create course');
    }
    return response.json();
  },

  list: async (token: string, params?: {
    q?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.q) query.append('q', params.q);
    if (params?.is_active !== undefined) query.append('is_active', String(params.is_active));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const response = await fetch(`${API_BASE_URL}/courses?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch courses');
    return response.json();
  },

  get: async (token: string, courseCode: string) => {
    const response = await fetch(`${API_BASE_URL}/courses/${courseCode}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch course');
    return response.json();
  },

  update: async (token: string, courseCode: string, data: {
    course_name?: string;
    description?: string;
    department?: string;
    faculty?: string;
    level?: string;
    credits?: number;
    is_active?: boolean;
  }) => {
    const response = await fetch(`${API_BASE_URL}/courses/${courseCode}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update course');
    }
    return response.json();
  },
};

// ==================== Course Offering Endpoints ====================
export const offeringApi = {
  create: async (token: string, data: {
    course_code: string;
    term: string;
    year?: number;
    cohort?: string;
    section?: string;
    lecturer_user_id?: string;
    is_active?: boolean;
    enrollment_key?: string;
    auto_generate_enrollment_key?: boolean;
  }) => {
    const response = await fetch(`${API_BASE_URL}/courses/offerings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create offering');
    }
    return response.json();
  },

  list: async (token: string, params?: {
    course_code?: string;
    year?: number;
    term?: string;
    cohort?: string;
    section?: string;
    lecturer_user_id?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.course_code) query.append('course_code', params.course_code);
    if (params?.year) query.append('year', String(params.year));
    if (params?.term) query.append('term', params.term);
    if (params?.cohort) query.append('cohort', params.cohort);
    if (params?.section) query.append('section', params.section);
    if (params?.lecturer_user_id) query.append('lecturer_user_id', params.lecturer_user_id);
    if (params?.is_active !== undefined) query.append('is_active', String(params.is_active));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const response = await fetch(`${API_BASE_URL}/courses/offerings?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  update: async (token: string, offeringId: string, data: {
    course_code?: string;
    term?: string;
    year?: number | null;
    cohort?: string | null;
    section?: string | null;
    is_active?: boolean;
    enrollment_key?: string | null;
    auto_generate_enrollment_key?: boolean;
  }) => {
    const response = await fetch(`${API_BASE_URL}/courses/offerings/${offeringId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  delete: async (token: string, offeringId: string) => {
    const response = await fetch(`${API_BASE_URL}/courses/offerings/${offeringId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  setActive: async (token: string, offeringId: string, isActive: boolean) => {
    const response = await fetch(`${API_BASE_URL}/courses/offerings/${offeringId}/active?is_active=${isActive}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update offering');
    }
    return response.json();
  },

  setEnrollmentKey: async (token: string, offeringId: string, data: {
    open_enrollment?: boolean;
    enrollment_key?: string;
    auto_generate?: boolean;
  }) => {
    const response = await fetch(`${API_BASE_URL}/courses/offerings/${offeringId}/enrollment-key`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update enrollment key');
    }
    return response.json();
  },
};

// ==================== Enrollment Endpoints ====================
export const enrollmentApi = {
  searchOfferings: async (token: string, params: {
    course_code: string;
    term?: string;
    year?: number;
    cohort?: string;
    section?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    query.append('course_code', params.course_code);
    if (params.term) query.append('term', params.term);
    if (params.year) query.append('year', String(params.year));
    if (params.cohort) query.append('cohort', params.cohort);
    if (params.section) query.append('section', params.section);
    if (params.limit) query.append('limit', String(params.limit));
    if (params.offset) query.append('offset', String(params.offset));
    const response = await fetch(`${API_BASE_URL}/enrollments/offerings?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to search offerings');
    }
    return response.json();
  },

  previewByKey: async (token: string, enrollmentKey: string) => {
    const query = new URLSearchParams({ enrollment_key: enrollmentKey });
    const response = await fetch(`${API_BASE_URL}/enrollments/preview-by-key?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Invalid enrollment key');
    }
    return response.json();
  },

  enrollByKey: async (token: string, data: {
    enrollment_key: string;
    user_id?: string;
    note?: string;
  }) => {
    const response = await fetch(`${API_BASE_URL}/enrollments/by-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to enroll by key');
    }
    return response.json();
  },

  enroll: async (token: string, data: {
    offering_id: string;
    user_id?: string;
    note?: string;
  }) => {
    const response = await fetch(`${API_BASE_URL}/enrollments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to enroll user');
    }
    return response.json();
  },

  list: async (token: string, params?: {
    offering_id?: string;
    user_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.offering_id) query.append('offering_id', params.offering_id);
    if (params?.user_id) query.append('user_id', params.user_id);
    if (params?.status) query.append('status', params.status);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const response = await fetch(`${API_BASE_URL}/enrollments?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch enrollments');
    return response.json();
  },

  setStatus: async (token: string, enrollmentId: string, data: {
    status: string;
    note?: string;
  }) => {
    const response = await fetch(`${API_BASE_URL}/enrollments/${enrollmentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update enrollment status');
    }
    return response.json();
  },

  getEvents: async (token: string, enrollmentId: string, params?: {
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const response = await fetch(`${API_BASE_URL}/enrollments/${enrollmentId}/events?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch enrollment events');
    return response.json();
  },
};

// ==================== Student Progress Endpoints ====================
export const progressApi = {
  getRoadmap: async (token: string, enrollmentId: string) => {
    const response = await fetch(`${API_BASE_URL}/enrollments/${enrollmentId}/roadmap`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  startItem: async (token: string, enrollmentId: string, itemId: string) => {
    const response = await fetch(`${API_BASE_URL}/enrollments/${enrollmentId}/roadmap/${itemId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  createAttempt: async (
    token: string,
    enrollmentId: string,
    taskId: string,
    payload?: { evidence_url?: string; artifact_url?: string; reflection_text?: string; payload?: unknown }
  ) => {
    const response = await fetch(`${API_BASE_URL}/enrollments/${enrollmentId}/tasks/${taskId}/attempts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload || {}),
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  submitAttempt: async (
    token: string,
    enrollmentId: string,
    taskId: string,
    attemptNo: number,
    payload: { evidence_url?: string; artifact_url?: string; reflection_text?: string; payload?: unknown }
  ) => {
    const response = await fetch(`${API_BASE_URL}/enrollments/${enrollmentId}/tasks/${taskId}/attempts/${attemptNo}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload || {}),
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  getProgressSummary: async (token: string, enrollmentId: string) => {
    const response = await fetch(`${API_BASE_URL}/enrollments/${enrollmentId}/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  gradeAttempt: async (
    token: string,
    enrollmentId: string,
    taskId: string,
    attemptNo: number,
    payload: { score: number; feedback?: string; rubric_scores?: Record<string, number> }
  ) => {
    const response = await fetch(`${API_BASE_URL}/enrollments/${enrollmentId}/tasks/${taskId}/attempts/${attemptNo}/grade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  getGamification: async (token: string, enrollmentId: string) => {
    const response = await fetch(`${API_BASE_URL}/enrollments/${enrollmentId}/gamification`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  getLeaderboard: async (token: string, enrollmentId: string, limit: number = 10) => {
    const query = new URLSearchParams({ limit: String(limit) });
    const response = await fetch(`${API_BASE_URL}/enrollments/${enrollmentId}/leaderboard?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },
};

// ==================== Assessment / Grading Endpoints ====================
export const assessmentApi = {
  listForOffering: async (token: string, offeringId: string) => {
    const response = await fetch(`${API_BASE_URL}/offerings/${offeringId}/assessments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  create: async (token: string, roadmapItemId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/roadmap-items/${roadmapItemId}/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  update: async (token: string, assessmentId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/assessments/${assessmentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  setActive: async (token: string, assessmentId: string, isActive: boolean) => {
    const response = await fetch(`${API_BASE_URL}/assessments/${assessmentId}/active`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ is_active: isActive }),
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  listSubmissions: async (token: string, assessmentId: string) => {
    const response = await fetch(`${API_BASE_URL}/assessments/${assessmentId}/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  getSubmission: async (token: string, submissionId: string) => {
    const response = await fetch(`${API_BASE_URL}/submissions/${submissionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  runAiGrade: async (token: string, submissionId: string) => {
    const response = await fetch(`${API_BASE_URL}/submissions/${submissionId}/ai-grade`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  finalizeSubmission: async (token: string, submissionId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/submissions/${submissionId}/finalize`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  listTemplates: async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/grading-templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },
};

// ==================== Lecturer Roadmap / Spec Endpoints ====================
export const roadmapAdminApi = {
  extractSpec: async (
    token: string,
    offeringId: string,
    file: File,
    mode: 'extract_only' | 'extract_and_draft_roadmap' = 'extract_only'
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);

    const response = await fetch(`${API_BASE_URL}/offerings/${offeringId}/specs/extract`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  updateSpec: async (token: string, specId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/specs/${specId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  approveSpec: async (token: string, specId: string) => {
    const response = await fetch(`${API_BASE_URL}/specs/${specId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  submitSpecReview: async (token: string, specId: string) => {
    const response = await fetch(`${API_BASE_URL}/specs/${specId}/submit-review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  getSpec: async (token: string, specId: string) => {
    const response = await fetch(`${API_BASE_URL}/specs/${specId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  getCurrentSpec: async (token: string, offeringId: string) => {
    const response = await fetch(`${API_BASE_URL}/offerings/${offeringId}/specs/current`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 404 = no spec yet for this offering, not a hard error
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  generateRoadmap: async (token: string, offeringId: string) => {
    const response = await fetch(`${API_BASE_URL}/offerings/${offeringId}/roadmap/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  activateRoadmap: async (token: string, offeringId: string) => {
    const response = await fetch(`${API_BASE_URL}/offerings/${offeringId}/roadmap/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  listRoadmap: async (token: string, offeringId: string, status: 'approved_active' | 'draft' | 'all' = 'all') => {
    const query = new URLSearchParams();
    if (status) query.append('status', status);
    const response = await fetch(`${API_BASE_URL}/offerings/${offeringId}/roadmap?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  createRoadmapItem: async (token: string, offeringId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/offerings/${offeringId}/roadmap-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  updateRoadmapItem: async (token: string, itemId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/roadmap-items/${itemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  archiveRoadmapItem: async (token: string, itemId: string) => {
    const response = await fetch(`${API_BASE_URL}/roadmap-items/${itemId}/archive`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  deleteRoadmapItem: async (token: string, itemId: string) => {
    const response = await fetch(`${API_BASE_URL}/roadmap-items/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  createTask: async (token: string, itemId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/roadmap-items/${itemId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  updateTask: async (token: string, taskId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  deactivateTask: async (token: string, taskId: string) => {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/deactivate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },

  reorderTasks: async (token: string, itemId: string, taskIds: string[]) => {
    const response = await fetch(`${API_BASE_URL}/roadmap-items/${itemId}/tasks/reorder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ task_ids: taskIds }),
    });
    if (!response.ok) throw new Error(await safeParseError(response));
    return response.json();
  },
};
