// src/state/courseStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CourseStore {
  courseCode: string | null;
  courseName: string | null;
  campus: string | null;
  faculty: string | null;
  department: string | null;
  
  setCourse: (code: string, name: string) => void;
  setHierarchy: (campus: string, faculty: string, department: string) => void;
  clearCourse: () => void;
}

export const useCourseStore = create<CourseStore>()(
  persist(
    (set) => ({
      courseCode: null,
      courseName: null,
      campus: null,
      faculty: null,
      department: null,

      setCourse: (code, name) => set({ courseCode: code, courseName: name }),
      setHierarchy: (campus, faculty, department) => set({ campus, faculty, department }),
      clearCourse: () => set({
        courseCode: null,
        courseName: null,
        campus: null,
        faculty: null,
        department: null,
      }),
    }),
    {
      name: 'edusmart-course-context-v1',
    }
  )
);
