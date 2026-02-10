import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInstitutionStore } from "../stores/institutionStore";
import { useCourseStore } from "../stores/courseStore";
import { fetchInstitutionConfig } from "../services/apiService";

interface CourseSelectorProps {
  onSelect?: () => void;
}

export default function CourseSelector({ onSelect }: CourseSelectorProps) {
  const navigate = useNavigate();
  const courseStore = useCourseStore();
  const institutionStore = useInstitutionStore();
  const [loading, setLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (hasInitialized) return; // Only run once
    
    if (!institutionStore.config) {
      setLoading(true);
      fetchInstitutionConfig()
        .then((config) => {
          institutionStore.setConfig(config);
          setLoading(false);
        })
        .catch((err) => {
          institutionStore.setError(err.message);
          setLoading(false);
        });
    }
    
    setHasInitialized(true);
  }, [institutionStore.config, hasInitialized]);

  const { selection } = courseStore;
  const config = institutionStore.config;

  // Show skeleton while loading AND no cached config
  if (loading && !config) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  // Safety check - if still no config, show error
  if (!config) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 font-semibold">Error loading course options</p>
        <p className="text-sm text-gray-600 mt-2">Please refresh the page and try again</p>
      </div>
    );
  }

  const handleStartLearning = () => {
    if (courseStore.isComplete()) {
      // ✅ MUST SYNC: Save to both localStorage AND courseStore
      const courseData = {
        campus: selection.campus!,
        year: selection.year!,
        semester: selection.semester!,
        courseCode: selection.courseCode!,
        courseName: selection.courseName!,
      };
      
      // 1. Save to localStorage (for PrivateRoute guard to find)
      localStorage.setItem("selected_course", JSON.stringify(courseData));
      
      // 2. Sync to courseStore (for ChatPage to read)
      courseStore.setCampus(selection.campus!);
      courseStore.setYear(selection.year!);
      courseStore.setSemester(selection.semester!);
      courseStore.setCourse(selection.courseCode!, selection.courseName!);

      // 3. Let parent handle navigation
      if (onSelect) {
        onSelect();
      }
    }
  };

  // Only show loading skeleton while actively fetching (loading=true AND config not yet available)
  if (loading && !config) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  const filteredYears = selection.campus
    ? institutionStore.getFilteredYears(selection.campus)
    : [];

  const filteredSemesters =
    selection.campus && selection.year
      ? institutionStore.getFilteredSemesters(selection.campus, selection.year)
      : [];

  const filteredCourses =
    selection.campus && selection.year && selection.semester
      ? institutionStore.getCoursesByFilters(
          selection.campus,
          selection.year,
          selection.semester
        )
      : [];

  return (
    <div className="space-y-4">
      {/* Campus Selector */}
      <div>
        <label htmlFor="campus-select" className="block text-sm font-medium text-gray-700 mb-1">
          Campus
        </label>
        <select
          id="campus-select"
          name="campus"
          value={selection.campus || ""}
          onChange={(e) => courseStore.setCampus(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select Campus</option>
          {config.campuses.map((campus) => (
            <option key={campus.id} value={campus.id}>
              {campus.name}
            </option>
          ))}
        </select>
      </div>

      {/* Year Selector */}
      <div>
        <label htmlFor="year-select" className="block text-sm font-medium text-gray-700 mb-1">
          Year of Study
        </label>
        <select
          id="year-select"
          name="year"
          value={selection.year || ""}
          onChange={(e) => courseStore.setYear(e.target.value)}
          disabled={!selection.campus}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        >
          <option value="">Select Year</option>
          {filteredYears.map((year) => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </select>
      </div>

      {/* Semester Selector */}
      <div>
        <label htmlFor="semester-select" className="block text-sm font-medium text-gray-700 mb-1">
          Semester
        </label>
        <select
          id="semester-select"
          name="semester"
          value={selection.semester || ""}
          onChange={(e) => courseStore.setSemester(e.target.value)}
          disabled={!selection.year}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        >
          <option value="">Select Semester</option>
          {filteredSemesters.map((semester) => (
            <option key={semester.id} value={semester.id}>
              {semester.name}
            </option>
          ))}
        </select>
      </div>

      {/* Course Selector */}
      <div>
        <label htmlFor="course-select" className="block text-sm font-medium text-gray-700 mb-1">
          Course
        </label>
        <select
          id="course-select"
          name="course"
          value={selection.courseCode || ""}
          onChange={(e) => {
            const course = filteredCourses.find((c) => c.code === e.target.value);
            if (course) {
              courseStore.setCourse(course.code, course.name);
            }
          }}
          disabled={!selection.semester}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        >
          <option value="">Select Course</option>
          {filteredCourses.map((course) => (
            <option key={course.id} value={course.code}>
              {course.code} - {course.name}
            </option>
          ))}
        </select>
      </div>

      {/* Start Learning Button */}
      <button
        onClick={handleStartLearning}
        disabled={!courseStore.isComplete()}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition duration-200"
      >
        Start Learning
      </button>
    </div>
  );
}
