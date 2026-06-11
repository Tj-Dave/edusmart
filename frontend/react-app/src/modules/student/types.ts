export interface EnrollmentCourseContext {
  courseCode: string;
  courseName?: string;
  enrollmentId: string;
  offeringId?: string;
}

export interface Citation {
  id?: string;
  title: string;
  snippet?: string;
  source?: string;
  role?: string;
  url?: string;
}

export interface StudentMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  citations?: Citation[];
  hiddenCitationCount?: number;
  devTrace?: any;
}

export interface StudentChatSession {
  id: string;
  course_code: string;
  course_name: string;
  created_at: string;
  message_count: number;
}

export interface StudentChatHistory {
  session_id: string;
  title: string;
  created_at: string;
  message_preview?: string;
}

export interface StudentWorkspaceProps {
  publicMode?: boolean;
}

export interface EnrollmentRow {
  id?: string;
  status?: string;
  offering?: {
    id?: string;
    course_code?: string;
    course?: {
      course_name?: string;
    };
  };
}

export interface EnrolledCourseOption {
  code: string;
  name: string;
}
