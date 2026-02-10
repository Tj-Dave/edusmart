import { create } from "zustand";

export interface InstitutionConfig {
  campuses: { id: string; name: string }[];
  years: { id: string; name: string }[];
  semesters: { id: string; name: string }[];
  courses: {
    id: string;
    code: string;
    name: string;
    campusId: string;
    yearId: string;
    semesterId: string;
  }[];
}

interface InstitutionStore {
  config: InstitutionConfig | null;
  loading: boolean;
  error: string | null;
  setConfig: (config: InstitutionConfig) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getCoursesByFilters: (campusId: string, yearId: string, semesterId: string) => any[];
  getFilteredYears: (campusId: string) => any[];
  getFilteredSemesters: (campusId: string, yearId: string) => any[];
}

export const useInstitutionStore = create<InstitutionStore>((set, get) => ({
  config: (() => {
    // Restore from localStorage on initialization
    const saved = localStorage.getItem("institution_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  })(),
  loading: false,
  error: null,

  setConfig: (config) => {
    // Persist to localStorage
    localStorage.setItem("institution_config", JSON.stringify(config));
    set({ config, error: null });
  },

  setLoading: (loading) => {
    set({ loading });
  },

  setError: (error) => {
    set({ error });
  },

  getCoursesByFilters: (campusId, yearId, semesterId) => {
    const { config } = get();
    if (!config) return [];
    
    return config.courses.filter(
      (course) =>
        course.campusId === campusId &&
        course.yearId === yearId &&
        course.semesterId === semesterId
    );
  },

  getFilteredYears: (campusId) => {
    const { config } = get();
    if (!config) return [];
    
    // Return unique years for this campus
    const courseYearIds = new Set(
      config.courses
        .filter((course) => course.campusId === campusId)
        .map((course) => course.yearId)
    );

    return config.years.filter((year) => courseYearIds.has(year.id));
  },

  getFilteredSemesters: (campusId, yearId) => {
    const { config } = get();
    if (!config) return [];

    // Return unique semesters for this campus/year combination
    const courseSemesterIds = new Set(
      config.courses
        .filter(
          (course) => course.campusId === campusId && course.yearId === yearId
        )
        .map((course) => course.semesterId)
    );

    return config.semesters.filter((semester) =>
      courseSemesterIds.has(semester.id)
    );
  },
}));
