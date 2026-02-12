// src/types/auth.ts
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'student' | 'lecturer' | 'admin';
  full_name?: string;
  department?: string;
  faculty?: string;
  program?: string;
  approved: boolean;
  is_active: boolean;
  courses?: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, profileData?: {
    username?: string;
    full_name?: string;
    university_id?: string;
    faculty?: string;
    department?: string;
    program?: string;
    year_of_study?: number;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  setPassword: (password: string, passwordConfirm: string) => Promise<void>;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}
