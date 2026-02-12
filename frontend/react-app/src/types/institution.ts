// src/types/institution.ts
export interface InstitutionConfig {
  institution_name: string;
  institution_code: string;
  student_email_pattern: string;
  lecturer_email_pattern: string;
  campuses: string[];
  faculties: string[];
  departments: Record<string, string[]>;
  academic_years: string[];
  semesters: string[];
  course_catalog: CourseCatalogItem[];
}

export interface CourseCatalogItem {
  code: string;
  name: string;
  department: string;
}

export interface SetupStatus {
  configured: boolean;
  institution_name?: string;
  institution_code?: string;
}
