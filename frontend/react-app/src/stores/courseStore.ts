import { create } from "zustand";

export interface CourseSelection {
  campus: string | null;
  year: string | null;
  semester: string | null;
  courseCode: string | null;
  courseName: string | null;
}

interface CourseStore {
  selection: CourseSelection;
  campus: string | null;
  year: string | null;
  semester: string | null;
  courseCode: string | null;
  courseName: string | null;
  hydrated: boolean;
  setCampus: (campus: string) => void;
  setYear: (year: string) => void;
  setSemester: (semester: string) => void;
  setCourse: (courseCode: string, courseName: string) => void;
  resetSelection: () => void;
  resetCourse: () => void;
  isComplete: () => boolean;
  restoreFromLocalStorage: () => void;
}

export const useCourseStore = create<CourseStore>((set, get) => ({
  selection: {
    campus: null,
    year: null,
    semester: null,
    courseCode: null,
    courseName: null,
  },

  // Direct properties for convenience
  campus: null,
  year: null,
  semester: null,
  courseCode: null,
  courseName: null,
  hydrated: false,

  setCampus: (campus) => {
    set((state) => ({
      campus,
      year: null,
      semester: null,
      courseCode: null,
      courseName: null,
      selection: {
        ...state.selection,
        campus,
        year: null,
        semester: null,
        courseCode: null,
        courseName: null,
      },
    }));
  },

  setYear: (year) => {
    set((state) => ({
      year,
      semester: null,
      courseCode: null,
      courseName: null,
      selection: {
        ...state.selection,
        year,
        semester: null,
        courseCode: null,
        courseName: null,
      },
    }));
  },

  setSemester: (semester) => {
    set((state) => ({
      semester,
      courseCode: null,
      courseName: null,
      selection: {
        ...state.selection,
        semester,
        courseCode: null,
        courseName: null,
      },
    }));
  },

  setCourse: (courseCode, courseName) => {
    set((state) => ({
      courseCode,
      courseName,
      selection: {
        ...state.selection,
        courseCode,
        courseName,
      },
    }));
  },

  resetSelection: () => {
    set({
      campus: null,
      year: null,
      semester: null,
      courseCode: null,
      courseName: null,
      selection: {
        campus: null,
        year: null,
        semester: null,
        courseCode: null,
        courseName: null,
      },
    });
  },

  resetCourse: () => {
    set((state) => ({
      courseCode: null,
      courseName: null,
      selection: {
        ...state.selection,
        courseCode: null,
        courseName: null,
      },
    }));
  },

  isComplete: () => {
    const { selection } = get();
    return !!(
      selection.campus &&
      selection.year &&
      selection.semester &&
      selection.courseCode &&
      selection.courseName
    );
  },

  restoreFromLocalStorage: () => {
    const saved = localStorage.getItem("selected_course");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        set({
          campus: data.campus || null,
          year: data.year || null,
          semester: data.semester || null,
          courseCode: data.courseCode || null,
          courseName: data.courseName || null,
          selection: {
            campus: data.campus || null,
            year: data.year || null,
            semester: data.semester || null,
            courseCode: data.courseCode || null,
            courseName: data.courseName || null,
          },
          hydrated: true,
        });
      } catch (error) {
        console.error("Failed to restore course selection:", error);
        set({ hydrated: true });
      }
    } else {
      set({ hydrated: true });
    }
  },
}));
