import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCourseStore } from '../../../state/courseStore';
import { NO_COURSE_LABEL } from '../constants';
import { EnrolledCourseOption, EnrollmentCourseContext, EnrollmentRow } from '../types';
import { studentWorkspaceApi } from '../services/studentWorkspaceApi';

const ENROLLMENT_CACHE_KEY = 'edusmart_enrollment_context_v1';

const normalizeEnrollments = (rows: EnrollmentRow[]) => {
  const uniqueCourses = new Map<string, EnrolledCourseOption>();
  const contextMap: Record<string, EnrollmentCourseContext> = {};

  for (const row of rows) {
    if (row.status !== 'active') continue;

    const offering = row.offering;
    if (!offering?.course_code || !row.id) continue;

    const code = offering.course_code;
    const name = offering.course?.course_name || code;

    if (!uniqueCourses.has(code)) {
      uniqueCourses.set(code, { code, name });
    }

    if (!contextMap[code]) {
      contextMap[code] = {
        courseCode: code,
        courseName: name,
        enrollmentId: String(row.id),
        offeringId: offering.id ? String(offering.id) : undefined,
      };
    }
  }

  return {
    courses: Array.from(uniqueCourses.values()),
    contextMap,
  };
};

interface UseStudentEnrollmentArgs {
  isPublicPreview: boolean;
  token?: string | null;
  userId?: string | null;
}

export function useStudentEnrollment({ isPublicPreview, token, userId }: UseStudentEnrollmentArgs) {
  const { courseCode, courseName, setCourse } = useCourseStore();
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourseOption[]>([]);
  const [enrollmentContextByCourse, setEnrollmentContextByCourse] = useState<Record<string, EnrollmentCourseContext>>({});

  const activeEnrollmentContext = useMemo(() => {
    if (!courseCode || courseCode === 'GENERAL') return null;
    return enrollmentContextByCourse[courseCode] || null;
  }, [courseCode, enrollmentContextByCourse]);

  const refreshEnrolledCourseData = useCallback(async () => {
    if (isPublicPreview || !token || !userId) return;

    const response = await studentWorkspaceApi.listEnrollments(token, { user_id: userId });
    const rows = Array.isArray(response)
      ? (response as EnrollmentRow[])
      : (response?.items || response?.results || response?.enrollments || []) as EnrollmentRow[];
    const normalized = normalizeEnrollments(rows);
    setEnrolledCourses(normalized.courses);
    setEnrollmentContextByCourse(normalized.contextMap);

    if (!courseCode && normalized.courses.length > 0) {
      const firstCourse = normalized.courses[0];
      setCourse(firstCourse.code, firstCourse.name);
      return;
    }

    if (courseCode && courseCode !== 'GENERAL') {
      const currentCourse = normalized.courses.find((course) => course.code === courseCode);
      if (currentCourse && currentCourse.name !== courseName) {
        setCourse(currentCourse.code, currentCourse.name);
      }
    }
  }, [courseCode, courseName, isPublicPreview, setCourse, token, userId]);

  const selectCourse = useCallback((code: string, name: string) => {
    setCourse(code, name);
  }, [setCourse]);

  useEffect(() => {
    if (isPublicPreview) return;
    try {
      const raw = localStorage.getItem(ENROLLMENT_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setEnrollmentContextByCourse(parsed as Record<string, EnrollmentCourseContext>);
      }
    } catch (cacheError) {
      console.warn('Failed to hydrate enrollment context cache', cacheError);
    }
  }, [isPublicPreview]);

  useEffect(() => {
    if (isPublicPreview) return;
    if (Object.keys(enrollmentContextByCourse).length === 0) {
      localStorage.removeItem(ENROLLMENT_CACHE_KEY);
      return;
    }
    localStorage.setItem(ENROLLMENT_CACHE_KEY, JSON.stringify(enrollmentContextByCourse));
  }, [enrollmentContextByCourse, isPublicPreview]);

  useEffect(() => {
    if (isPublicPreview || !token || !userId) return;
    refreshEnrolledCourseData().catch((error) => {
      console.error('Failed to load enrolled courses:', error);
    });
  }, [isPublicPreview, refreshEnrolledCourseData, token, userId]);

  const activeCourseName = isPublicPreview
    ? NO_COURSE_LABEL
    : courseCode === 'GENERAL'
    ? NO_COURSE_LABEL
    : courseName || activeEnrollmentContext?.courseName || courseCode || NO_COURSE_LABEL;

  return {
    courseCode,
    courseName,
    activeCourseName,
    enrolledCourses,
    enrollmentContextByCourse,
    activeEnrollmentContext,
    refreshEnrolledCourseData,
    selectCourse,
  };
}
