import { useEffect, useMemo, useState } from 'react';
import {
  courseApi,
  enrollmentApi,
  ingestionApi,
  offeringApi,
  progressApi,
  roadmapAdminApi,
} from '../../services/api';
import {
  AssessmentTask,
  EnrollmentRoadmapProgress,
  RoadmapItem,
  RoadmapResponse,
  TaskResult,
} from '../../types/progress';
import EditableField from './EditableField';
import EmptyStateCard from './EmptyStateCard';
import InlineErrorBanner from './InlineErrorBanner';
import ModalConfirm from './ModalConfirm';
import ProgressBar from './ProgressBar';
import ScoreChip from './ScoreChip';
import StatusPill from './StatusPill';

export interface EnrollmentCourseContext {
  courseCode: string;
  courseName?: string;
  enrollmentId: string;
  offeringId?: string;
}

interface CourseOption {
  code: string;
  name: string;
}

interface OfferingOption {
  id: string;
  courseCode: string;
  term?: string;
  year?: number;
  section?: string;
  isActive?: boolean;
}

interface TaskFormDraft {
  title: string;
  description: string;
  task_type: string;
  due_at: string;
  max_attempts: string;
  allow_late_submission: boolean;
  late_penalty_percent: string;
  max_score: string;
  weight: string;
}

interface TopToolsDrawerProps {
  open: boolean;
  onClose: () => void;
  token: string;
  role?: string;
  userId?: string;
  selectedCourseCode?: string | null;
  selectedCourseName?: string | null;
  activeEnrollmentContext?: EnrollmentCourseContext | null;
  enrollmentContextByCourse?: Record<string, EnrollmentCourseContext>;
  enrolledCourses?: CourseOption[];
}

type StudentTab = 'roadmap' | 'assessments' | 'progress';
type LecturerTab = 'offerings' | 'course_spec' | 'roadmap_builder' | 'students' | 'uploads';
type SurfaceMode = 'student' | 'lecturer';

interface SubmitDraft {
  taskId: string;
  attemptNo: number;
  taskTitle: string;
}

interface SpecState {
  specId: string | null;
  status: string | null;
  raw: Record<string, unknown> | null;
}

const defaultTaskDraft = (): TaskFormDraft => ({
  title: '',
  description: '',
  task_type: 'assignment',
  due_at: '',
  max_attempts: '1',
  allow_late_submission: false,
  late_penalty_percent: '',
  max_score: '100',
  weight: '1',
});

const asArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  return [];
};

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const toIsoDate = (value?: string | null) => {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleString();
};

const normalizeTaskResult = (raw: any): TaskResult => ({
  id: raw?.id?.toString?.() || raw?.result_id?.toString?.() || undefined,
  enrollment_id: raw?.enrollment_id?.toString?.(),
  roadmap_item_id: raw?.roadmap_item_id?.toString?.(),
  task_id: raw?.task_id?.toString?.(),
  attempt_no: asNumber(raw?.attempt_no) || undefined,
  status: raw?.status,
  score: asNumber(raw?.score),
  feedback: raw?.feedback ?? null,
  evidence_url: raw?.evidence_url ?? null,
  payload: raw?.payload,
  submitted_at: raw?.submitted_at ?? null,
  graded_at: raw?.graded_at ?? null,
  graded_by_user_id: raw?.graded_by_user_id?.toString?.() ?? null,
  is_late: typeof raw?.is_late === 'boolean' ? raw.is_late : null,
  created_at: raw?.created_at,
  updated_at: raw?.updated_at,
});

const normalizeTask = (raw: any): AssessmentTask => ({
  id: raw?.id?.toString?.() || raw?.task_id?.toString?.() || undefined,
  roadmap_item_id: raw?.roadmap_item_id?.toString?.() || raw?.item_id?.toString?.() || undefined,
  title: raw?.title || raw?.name || 'Untitled task',
  description: raw?.description ?? null,
  task_type: raw?.task_type || raw?.type || null,
  due_at: raw?.due_at ?? null,
  max_attempts: asNumber(raw?.max_attempts) ?? 1,
  attempt_scoring_rule: raw?.attempt_scoring_rule || 'latest',
  allow_late_submission: typeof raw?.allow_late_submission === 'boolean' ? raw.allow_late_submission : null,
  late_penalty_percent: asNumber(raw?.late_penalty_percent),
  max_score: asNumber(raw?.max_score),
  weight: asNumber(raw?.weight),
  order_index: asNumber(raw?.order_index),
  is_required: typeof raw?.is_required === 'boolean' ? raw.is_required : null,
  is_active: typeof raw?.is_active === 'boolean' ? raw.is_active : true,
  results: asArray<any>(raw?.results).map(normalizeTaskResult),
  latest_result: raw?.latest_result ? normalizeTaskResult(raw.latest_result) : null,
  result_summary: raw?.result_summary ? normalizeTaskResult(raw.result_summary) : null,
});

const normalizeProgress = (raw: any): EnrollmentRoadmapProgress => ({
  id: raw?.id?.toString?.() || undefined,
  enrollment_id: raw?.enrollment_id?.toString?.() || undefined,
  roadmap_item_id: raw?.roadmap_item_id?.toString?.() || raw?.item_id?.toString?.() || undefined,
  status: raw?.status,
  completion_percent: asNumber(raw?.completion_percent),
  total_score: asNumber(raw?.total_score),
  max_total_score: asNumber(raw?.max_total_score),
  avg_score: asNumber(raw?.avg_score),
  best_score: asNumber(raw?.best_score),
  submitted_at: raw?.submitted_at ?? null,
  completed_at: raw?.completed_at ?? null,
  updated_at: raw?.updated_at,
});

const normalizeRoadmapItem = (raw: any): RoadmapItem => ({
  id: raw?.id?.toString?.() || raw?.item_id?.toString?.() || undefined,
  course_offering_id: raw?.course_offering_id?.toString?.() || raw?.offering_id?.toString?.() || undefined,
  title: raw?.title || raw?.name || 'Untitled roadmap item',
  description: raw?.description ?? null,
  week_no: asNumber(raw?.week_no),
  estimated_hours: asNumber(raw?.estimated_hours),
  status: raw?.status,
  order_index: asNumber(raw?.order_index),
  assessment_task_count: asNumber(raw?.assessment_task_count),
  is_active: typeof raw?.is_active === 'boolean' ? raw.is_active : true,
  tasks: asArray<any>(raw?.tasks).map(normalizeTask),
  progress: raw?.progress ? normalizeProgress(raw.progress) : null,
});

const parseRoadmapResponse = (raw: any): RoadmapResponse => {
  const items = asArray<any>(raw?.items || raw?.roadmap_items).map(normalizeRoadmapItem);
  const progressRows = asArray<any>(raw?.progress || raw?.roadmap_progress).map(normalizeProgress);

  const progressByItem = new Map<string, EnrollmentRoadmapProgress>();
  for (const row of progressRows) {
    if (row.roadmap_item_id) progressByItem.set(row.roadmap_item_id, row);
  }

  const enrichedItems = items.map((item) => {
    if (item.id && !item.progress) {
      return {
        ...item,
        progress: progressByItem.get(item.id) || null,
      };
    }
    return item;
  });

  return {
    enrollment_id: raw?.enrollment_id?.toString?.() || undefined,
    offering_id: raw?.offering_id?.toString?.() || undefined,
    course_code: raw?.course_code,
    items: enrichedItems,
    roadmap_items: enrichedItems,
    progress: progressRows,
    roadmap_progress: progressRows,
    task_results: asArray<any>(raw?.task_results).map(normalizeTaskResult),
    summary: raw?.summary || null,
  };
};

const normalizeOffering = (raw: any): OfferingOption | null => {
  const id = raw?.id?.toString?.();
  const courseCode = raw?.course_code || raw?.course?.course_code;
  if (!id || !courseCode) return null;

  return {
    id,
    courseCode,
    term: raw?.term,
    year: asNumber(raw?.year) || undefined,
    section: raw?.section,
    isActive: typeof raw?.is_active === 'boolean' ? raw.is_active : true,
  };
};

const pickAttemptNo = (response: any): number | null => {
  const candidates = [
    response?.attempt_no,
    response?.attempt?.attempt_no,
    response?.result?.attempt_no,
    response?.data?.attempt_no,
  ];

  for (const candidate of candidates) {
    const value = asNumber(candidate);
    if (value) return value;
  }
  return null;
};

const sortTasks = (tasks: AssessmentTask[]) => {
  return [...tasks].sort((a, b) => {
    const left = a.order_index ?? Number.MAX_SAFE_INTEGER;
    const right = b.order_index ?? Number.MAX_SAFE_INTEGER;
    if (left === right) return String(a.title || '').localeCompare(String(b.title || ''));
    return left - right;
  });
};

export default function TopToolsDrawer({
  open,
  onClose,
  token,
  role,
  userId,
  selectedCourseCode,
  selectedCourseName,
  activeEnrollmentContext,
  enrollmentContextByCourse,
  enrolledCourses,
}: TopToolsDrawerProps) {
  const canUseStudentTools = role === 'student' || role === 'admin';
  const canUseLecturerTools = role === 'lecturer' || role === 'admin';
  const [entered, setEntered] = useState(false);

  const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>(canUseLecturerTools ? 'lecturer' : 'student');

  const [studentTab, setStudentTab] = useState<StudentTab>('roadmap');
  const [lecturerTab, setLecturerTab] = useState<LecturerTab>('offerings');

  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [roadmapData, setRoadmapData] = useState<RoadmapResponse | null>(null);
  const [progressSummary, setProgressSummary] = useState<Record<string, unknown> | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [attemptFeedback, setAttemptFeedback] = useState<string | null>(null);
  const [latestAttemptByTask, setLatestAttemptByTask] = useState<Record<string, number>>({});
  const [creatingAttemptTaskId, setCreatingAttemptTaskId] = useState<string | null>(null);
  const [submitDraft, setSubmitDraft] = useState<SubmitDraft | null>(null);
  const [submitEvidenceUrl, setSubmitEvidenceUrl] = useState('');
  const [submitPayload, setSubmitPayload] = useState('');
  const [submittingAttempt, setSubmittingAttempt] = useState(false);

  const [offerings, setOfferings] = useState<OfferingOption[]>([]);
  const [offeringsLoading, setOfferingsLoading] = useState(false);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>('');
  const [catalogCourses, setCatalogCourses] = useState<CourseOption[]>([]);
  const [catalogCoursesLoading, setCatalogCoursesLoading] = useState(false);
  const [catalogCoursesError, setCatalogCoursesError] = useState<string | null>(null);
  const [createOfferingBusy, setCreateOfferingBusy] = useState(false);
  const [createOfferingError, setCreateOfferingError] = useState<string | null>(null);
  const [createOfferingSuccess, setCreateOfferingSuccess] = useState<string | null>(null);
  const [newOfferingCourseCode, setNewOfferingCourseCode] = useState('');
  const [newOfferingTerm, setNewOfferingTerm] = useState('');
  const [newOfferingYear, setNewOfferingYear] = useState(String(new Date().getFullYear()));
  const [newOfferingSection, setNewOfferingSection] = useState('');
  const [newOfferingCohort, setNewOfferingCohort] = useState('');

  const [specState, setSpecState] = useState<SpecState>({ specId: null, status: null, raw: null });
  const [specSourceFile, setSpecSourceFile] = useState<File | null>(null);
  const [specEditorText, setSpecEditorText] = useState('');
  const [specBusy, setSpecBusy] = useState(false);
  const [specMessage, setSpecMessage] = useState<string | null>(null);

  const [roadmapFilter, setRoadmapFilter] = useState<'all' | 'draft' | 'approved_active'>('all');
  const [roadmapBusy, setRoadmapBusy] = useState(false);
  const [roadmapMessage, setRoadmapMessage] = useState<string | null>(null);
  const [lecturerRoadmap, setLecturerRoadmap] = useState<RoadmapItem[]>([]);

  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemWeekNo, setNewItemWeekNo] = useState('');
  const [newItemEstimatedHours, setNewItemEstimatedHours] = useState('');

  const [taskDraftByItem, setTaskDraftByItem] = useState<Record<string, TaskFormDraft>>({});
  const [taskEditDrafts, setTaskEditDrafts] = useState<Record<string, TaskFormDraft>>({});

  const [archiveItemId, setArchiveItemId] = useState<string | null>(null);

  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [offeringEnrollments, setOfferingEnrollments] = useState<any[]>([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>('');
  const [selectedEnrollmentRoadmap, setSelectedEnrollmentRoadmap] = useState<RoadmapResponse | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const resolvedStudentEnrollment = useMemo(() => {
    if (!selectedCourseCode || selectedCourseCode === 'GENERAL') return null;
    if (activeEnrollmentContext?.enrollmentId) return activeEnrollmentContext;
    return enrollmentContextByCourse?.[selectedCourseCode] || null;
  }, [activeEnrollmentContext, enrollmentContextByCourse, selectedCourseCode]);
  const enrolledCourseCount = enrolledCourses?.length || 0;

  const studentRoadmapItems = useMemo(() => roadmapData?.items || roadmapData?.roadmap_items || [], [roadmapData]);

  const allStudentTasksByItem = useMemo(() => {
    return studentRoadmapItems.map((item) => ({
      item,
      tasks: sortTasks((item.tasks || []).filter((task) => task.is_active !== false)),
    }));
  }, [studentRoadmapItems]);

  const selectedOffering = useMemo(
    () => offerings.find((offering) => offering.id === selectedOfferingId) || null,
    [offerings, selectedOfferingId]
  );

  useEffect(() => {
    if (!open) return;
    setEntered(false);
    const frame = window.requestAnimationFrame(() => setEntered(true));
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (canUseLecturerTools) {
      setSurfaceMode('lecturer');
      return;
    }
    setSurfaceMode('student');
  }, [canUseLecturerTools, open]);

  const loadStudentData = async () => {
    if (!token || !resolvedStudentEnrollment?.enrollmentId) return;
    setStudentLoading(true);
    setStudentError(null);
    setAttemptFeedback(null);

    try {
      const roadmapRaw = await progressApi.getRoadmap(token, resolvedStudentEnrollment.enrollmentId);
      const parsedRoadmap = parseRoadmapResponse(roadmapRaw);
      setRoadmapData(parsedRoadmap);

      const attempts: Record<string, number> = {};
      for (const item of parsedRoadmap.items || []) {
        for (const task of item.tasks || []) {
          const resultCandidates = [
            ...(task.results || []),
            ...(task.latest_result ? [task.latest_result] : []),
            ...(task.result_summary ? [task.result_summary] : []),
          ];
          const maxAttempt = resultCandidates
            .map((result) => result.attempt_no || 0)
            .reduce((max, current) => (current > max ? current : max), 0);
          if (task.id && maxAttempt > 0) {
            attempts[task.id] = maxAttempt;
          }
        }
      }
      setLatestAttemptByTask((prev) => ({ ...prev, ...attempts }));

      try {
        const summary = await progressApi.getProgressSummary(token, resolvedStudentEnrollment.enrollmentId);
        setProgressSummary(summary || null);
      } catch {
        setProgressSummary(null);
      }
    } catch (error: any) {
      setStudentError(error?.message || 'Failed to load roadmap tools.');
      setRoadmapData(null);
      setProgressSummary(null);
    } finally {
      setStudentLoading(false);
    }
  };

  useEffect(() => {
    if (!open || surfaceMode !== 'student' || !canUseStudentTools) return;
    if (!resolvedStudentEnrollment?.enrollmentId) {
      setRoadmapData(null);
      return;
    }

    loadStudentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, surfaceMode, canUseStudentTools, resolvedStudentEnrollment?.enrollmentId, studentTab]);

  const loadOfferings = async () => {
    if (!token || !canUseLecturerTools) return;

    setOfferingsLoading(true);
    setOfferingsError(null);

    try {
      const response = await offeringApi.list(token, {
        lecturer_user_id: role === 'lecturer' ? userId : undefined,
        is_active: true,
        limit: 100,
      });

      const responseRows = asArray<any>(response).length > 0
        ? asArray<any>(response)
        : asArray<any>(response?.items || response?.results || response?.offerings);

      const mapped = responseRows
        .map(normalizeOffering)
        .filter((entry): entry is OfferingOption => Boolean(entry));

      setOfferings(mapped);
      if (!selectedOfferingId) {
        const preferredId =
          resolvedStudentEnrollment?.offeringId && mapped.find((offering) => offering.id === resolvedStudentEnrollment.offeringId)
            ? resolvedStudentEnrollment.offeringId
            : mapped[0]?.id;

        if (preferredId) {
          setSelectedOfferingId(preferredId);
        }
      }
    } catch (error: any) {
      setOfferings([]);
      setOfferingsError(error?.message || 'Failed to load offerings.');
    } finally {
      setOfferingsLoading(false);
    }
  };

  const loadCourseCatalog = async () => {
    if (!token || !canUseLecturerTools) return;

    setCatalogCoursesLoading(true);
    setCatalogCoursesError(null);

    try {
      const response = await courseApi.list(token, { is_active: true, limit: 300 });
      const responseRows = asArray<any>(response).length > 0
        ? asArray<any>(response)
        : asArray<any>(response?.items || response?.results || response?.courses);

      const mapped = responseRows
        .map((row: any) => ({
          code: row?.course_code || row?.code,
          name: row?.course_name || row?.name || row?.course_code || row?.code,
        }))
        .filter((row: CourseOption) => Boolean(row.code));

      setCatalogCourses(mapped);
      if (!newOfferingCourseCode && mapped[0]?.code) {
        setNewOfferingCourseCode(mapped[0].code);
      }
    } catch (error: any) {
      setCatalogCourses([]);
      setCatalogCoursesError(error?.message || 'Failed to load courses catalog.');
    } finally {
      setCatalogCoursesLoading(false);
    }
  };

  useEffect(() => {
    if (!open || surfaceMode !== 'lecturer' || !canUseLecturerTools) return;
    loadOfferings();
    loadCourseCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, surfaceMode, canUseLecturerTools]);

  const loadLecturerRoadmap = async () => {
    if (!token || !selectedOfferingId) return;

    setRoadmapBusy(true);
    setRoadmapMessage(null);

    try {
      const response = await roadmapAdminApi.listRoadmap(token, selectedOfferingId, roadmapFilter);
      const parsed = parseRoadmapResponse(response);
      const items = (parsed.items || []).map((item) => ({
        ...item,
        tasks: sortTasks(item.tasks || []),
      }));
      setLecturerRoadmap(items);

      const specId = response?.spec_id?.toString?.() || response?.spec?.id?.toString?.() || null;
      const status = response?.spec_status || response?.spec?.status || null;
      const specJson = response?.spec_json || response?.spec?.spec_json || null;

      if (specId || specJson) {
        setSpecState({ specId, status, raw: specJson });
        if (specJson) {
          setSpecEditorText(JSON.stringify(specJson, null, 2));
        }
      }
    } catch (error: any) {
      setRoadmapMessage(error?.message || 'Failed to load roadmap.');
      setLecturerRoadmap([]);
    } finally {
      setRoadmapBusy(false);
    }
  };

  useEffect(() => {
    if (!open || surfaceMode !== 'lecturer' || !selectedOfferingId) return;
    if (lecturerTab !== 'roadmap_builder' && lecturerTab !== 'course_spec') return;
    loadLecturerRoadmap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, surfaceMode, lecturerTab, selectedOfferingId, roadmapFilter]);

  const loadOfferingStudents = async () => {
    if (!token || !selectedOfferingId) return;
    setStudentsLoading(true);
    setStudentsError(null);

    try {
      const rows = await enrollmentApi.list(token, { offering_id: selectedOfferingId, limit: 200 });
      const data = asArray<any>(rows).length > 0
        ? asArray<any>(rows)
        : asArray<any>(rows?.items || rows?.results || rows?.enrollments);
      setOfferingEnrollments(data);
      if (!selectedEnrollmentId && data[0]?.id) {
        setSelectedEnrollmentId(String(data[0].id));
      }
    } catch (error: any) {
      setOfferingEnrollments([]);
      setStudentsError(error?.message || 'Failed to load students for this offering.');
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    if (!open || surfaceMode !== 'lecturer' || lecturerTab !== 'students') return;
    loadOfferingStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, surfaceMode, lecturerTab, selectedOfferingId]);

  const loadSelectedEnrollmentRoadmap = async (enrollmentId: string) => {
    if (!token || !enrollmentId) return;
    try {
      const result = await progressApi.getRoadmap(token, enrollmentId);
      setSelectedEnrollmentRoadmap(parseRoadmapResponse(result));
    } catch {
      setSelectedEnrollmentRoadmap(null);
    }
  };

  useEffect(() => {
    if (!open || surfaceMode !== 'lecturer' || lecturerTab !== 'students') return;
    if (!selectedEnrollmentId) return;
    loadSelectedEnrollmentRoadmap(selectedEnrollmentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, surfaceMode, lecturerTab, selectedEnrollmentId]);

  const createOffering = async () => {
    if (!token) return;
    if (!newOfferingCourseCode.trim() || !newOfferingTerm.trim()) {
      setCreateOfferingError('Course and term are required to create an offering.');
      return;
    }

    setCreateOfferingBusy(true);
    setCreateOfferingError(null);
    setCreateOfferingSuccess(null);

    try {
      const payload: Record<string, unknown> = {
        course_code: newOfferingCourseCode.trim(),
        term: newOfferingTerm.trim(),
        auto_generate_enrollment_key: true,
        is_active: true,
      };

      const year = asNumber(newOfferingYear);
      if (year) payload.year = year;
      if (newOfferingSection.trim()) payload.section = newOfferingSection.trim();
      if (newOfferingCohort.trim()) payload.cohort = newOfferingCohort.trim();

      const created = await offeringApi.create(token, payload as any);
      const createdId = created?.id?.toString?.() || created?.offering_id?.toString?.() || null;

      await loadOfferings();
      if (createdId) {
        setSelectedOfferingId(createdId);
      }

      setCreateOfferingSuccess(`Offering created for ${newOfferingCourseCode.trim()}.`);
      setNewOfferingSection('');
      setNewOfferingCohort('');
    } catch (error: any) {
      setCreateOfferingError(error?.message || 'Failed to create offering.');
    } finally {
      setCreateOfferingBusy(false);
    }
  };

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const startRoadmapItem = async (itemId: string) => {
    if (!token || !resolvedStudentEnrollment?.enrollmentId) return;
    try {
      setAttemptFeedback(null);
      await progressApi.startItem(token, resolvedStudentEnrollment.enrollmentId, itemId);
      await loadStudentData();
    } catch (error: any) {
      setAttemptFeedback(error?.message || 'Failed to start roadmap item.');
    }
  };

  const createAttempt = async (taskId: string) => {
    if (!token || !resolvedStudentEnrollment?.enrollmentId) return;

    setCreatingAttemptTaskId(taskId);
    setAttemptFeedback(null);
    try {
      const result = await progressApi.createAttempt(token, resolvedStudentEnrollment.enrollmentId, taskId);
      const attemptNo = pickAttemptNo(result);
      if (attemptNo) {
        setLatestAttemptByTask((prev) => ({ ...prev, [taskId]: attemptNo }));
        setAttemptFeedback(`Attempt ${attemptNo} created.`);
      } else {
        setAttemptFeedback('Attempt created.');
      }
      await loadStudentData();
    } catch (error: any) {
      setAttemptFeedback(error?.message || 'Could not create attempt.');
    } finally {
      setCreatingAttemptTaskId(null);
    }
  };

  const openSubmitModal = (task: AssessmentTask) => {
    if (!task.id) return;

    const attemptsFromResults = (task.results || []).map((result) => result.attempt_no || 0);
    const maxFromResults = attemptsFromResults.reduce((max, current) => (current > max ? current : max), 0);
    const attemptNo = latestAttemptByTask[task.id] || maxFromResults;

    if (!attemptNo) {
      setAttemptFeedback('Create an attempt first.');
      return;
    }

    setSubmitDraft({ taskId: task.id, attemptNo, taskTitle: task.title || 'Task' });
    setSubmitEvidenceUrl('');
    setSubmitPayload('');
  };

  const submitAttempt = async () => {
    if (!token || !resolvedStudentEnrollment?.enrollmentId || !submitDraft) return;

    setSubmittingAttempt(true);
    setAttemptFeedback(null);

    try {
      let parsedPayload: unknown;
      const trimmedPayload = submitPayload.trim();

      if (trimmedPayload) {
        try {
          parsedPayload = JSON.parse(trimmedPayload);
        } catch {
          parsedPayload = { notes: trimmedPayload };
        }
      }

      await progressApi.submitAttempt(
        token,
        resolvedStudentEnrollment.enrollmentId,
        submitDraft.taskId,
        submitDraft.attemptNo,
        {
          evidence_url: submitEvidenceUrl.trim() || undefined,
          payload: parsedPayload,
        }
      );

      setSubmitDraft(null);
      setAttemptFeedback(`Attempt ${submitDraft.attemptNo} submitted.`);
      await loadStudentData();
    } catch (error: any) {
      setAttemptFeedback(error?.message || 'Failed to submit attempt.');
    } finally {
      setSubmittingAttempt(false);
    }
  };

  const summary = useMemo(() => {
    const items = studentRoadmapItems;
    const progressRows = items
      .map((item) => item.progress)
      .filter((row): row is EnrollmentRoadmapProgress => Boolean(row));

    const overallCompletionPercent =
      asNumber(progressSummary?.overall_completion_percent) ??
      (progressRows.length > 0
        ? progressRows.reduce((sum, row) => sum + (row.completion_percent || 0), 0) / progressRows.length
        : 0);

    const totalItems = asNumber(progressSummary?.total_items) ?? items.length;
    const itemsCompleted =
      asNumber(progressSummary?.items_completed) ??
      progressRows.filter((row) => (row.status || '').toLowerCase() === 'completed').length;

    const avgScore =
      asNumber(progressSummary?.avg_score) ??
      (progressRows.filter((row) => row.avg_score !== null && row.avg_score !== undefined).length > 0
        ? progressRows
            .filter((row) => row.avg_score !== null && row.avg_score !== undefined)
            .reduce((sum, row) => sum + Number(row.avg_score || 0), 0) /
          progressRows.filter((row) => row.avg_score !== null && row.avg_score !== undefined).length
        : null);

    const bestScore =
      asNumber(progressSummary?.best_score) ??
      progressRows.reduce((max, row) => {
        const candidate = row.best_score ?? null;
        if (candidate === null || candidate === undefined) return max;
        return max === null || candidate > max ? candidate : max;
      }, null as number | null);

    return {
      overallCompletionPercent: overallCompletionPercent || 0,
      totalItems,
      itemsCompleted,
      avgScore,
      bestScore,
    };
  }, [progressSummary, studentRoadmapItems]);

  const createSpec = async () => {
    if (!token || !selectedOfferingId || !specSourceFile) return;

    setSpecBusy(true);
    setSpecMessage(null);

    try {
      const response = await roadmapAdminApi.extractSpec(token, selectedOfferingId, specSourceFile);
      const specId = response?.id?.toString?.() || response?.spec_id?.toString?.() || response?.spec?.id?.toString?.() || null;
      const status = response?.status || response?.spec_status || response?.spec?.status || null;
      const specJson = response?.spec_json || response?.spec?.spec_json || response?.spec || null;

      setSpecState({
        specId,
        status,
        raw: specJson,
      });

      setSpecEditorText(specJson ? JSON.stringify(specJson, null, 2) : '{}');
      setSpecSourceFile(null);
      setSpecMessage(`Spec extracted from ${specSourceFile.name}. Review and save before approval.`);
      await loadLecturerRoadmap();
    } catch (error: any) {
      setSpecMessage(error?.message || 'Spec extraction failed.');
    } finally {
      setSpecBusy(false);
    }
  };

  const saveSpecEdits = async () => {
    if (!token || !specState.specId) return;

    setSpecBusy(true);
    setSpecMessage(null);

    try {
      const parsed = specEditorText.trim() ? JSON.parse(specEditorText) : {};
      const response = await roadmapAdminApi.updateSpec(token, specState.specId, { spec_json: parsed });
      const nextSpecJson = response?.spec_json || response?.spec?.spec_json || parsed;
      const nextStatus = response?.status || response?.spec?.status || specState.status;

      setSpecState((prev) => ({
        ...prev,
        status: nextStatus,
        raw: nextSpecJson,
      }));
      setSpecEditorText(JSON.stringify(nextSpecJson, null, 2));
      setSpecMessage('Spec saved.');
    } catch (error: any) {
      setSpecMessage(error?.message || 'Failed to save spec JSON.');
    } finally {
      setSpecBusy(false);
    }
  };

  const approveSpec = async () => {
    if (!token || !specState.specId) return;

    setSpecBusy(true);
    setSpecMessage(null);
    try {
      await roadmapAdminApi.approveSpec(token, specState.specId);
      setSpecState((prev) => ({ ...prev, status: 'approved_active' }));
      setSpecMessage('Spec approved and activated.');
      await loadLecturerRoadmap();
    } catch (error: any) {
      setSpecMessage(error?.message || 'Failed to approve spec.');
    } finally {
      setSpecBusy(false);
    }
  };

  const generateRoadmap = async () => {
    if (!token || !selectedOfferingId) return;

    setRoadmapBusy(true);
    setRoadmapMessage(null);
    try {
      await roadmapAdminApi.generateRoadmap(token, selectedOfferingId);
      setRoadmapMessage('Roadmap generated.');
      await loadLecturerRoadmap();
    } catch (error: any) {
      setRoadmapMessage(error?.message || 'Failed to generate roadmap.');
    } finally {
      setRoadmapBusy(false);
    }
  };

  const activateRoadmap = async () => {
    if (!token || !selectedOfferingId) return;

    setRoadmapBusy(true);
    setRoadmapMessage(null);
    try {
      await roadmapAdminApi.activateRoadmap(token, selectedOfferingId);
      setRoadmapMessage('Roadmap activated.');
      await loadLecturerRoadmap();
    } catch (error: any) {
      setRoadmapMessage(error?.message || 'Failed to activate roadmap.');
    } finally {
      setRoadmapBusy(false);
    }
  };

  const createRoadmapItem = async () => {
    if (!token || !selectedOfferingId || !newItemTitle.trim()) return;

    setRoadmapBusy(true);
    setRoadmapMessage(null);
    try {
      await roadmapAdminApi.createRoadmapItem(token, selectedOfferingId, {
        title: newItemTitle.trim(),
        description: newItemDescription.trim() || undefined,
        week_no: asNumber(newItemWeekNo),
        estimated_hours: asNumber(newItemEstimatedHours),
      });

      setNewItemTitle('');
      setNewItemDescription('');
      setNewItemWeekNo('');
      setNewItemEstimatedHours('');
      setRoadmapMessage('Roadmap item created.');
      await loadLecturerRoadmap();
    } catch (error: any) {
      setRoadmapMessage(error?.message || 'Failed to create roadmap item.');
    } finally {
      setRoadmapBusy(false);
    }
  };

  const patchRoadmapItem = async (itemId: string, payload: Record<string, unknown>) => {
    if (!token) return;

    try {
      await roadmapAdminApi.updateRoadmapItem(token, itemId, payload);
      await loadLecturerRoadmap();
    } catch (error: any) {
      setRoadmapMessage(error?.message || 'Failed to update roadmap item.');
    }
  };

  const archiveRoadmapItem = async (itemId: string) => {
    if (!token) return;
    setRoadmapBusy(true);
    setRoadmapMessage(null);
    try {
      await roadmapAdminApi.archiveRoadmapItem(token, itemId);
      setRoadmapMessage('Roadmap item archived.');
      setArchiveItemId(null);
      await loadLecturerRoadmap();
    } catch (error: any) {
      setRoadmapMessage(error?.message || 'Failed to archive item.');
    } finally {
      setRoadmapBusy(false);
    }
  };

  const getTaskDraft = (itemId: string) => {
    return taskDraftByItem[itemId] || defaultTaskDraft();
  };

  const setTaskDraftField = <K extends keyof TaskFormDraft>(itemId: string, key: K, value: TaskFormDraft[K]) => {
    const current = getTaskDraft(itemId);
    setTaskDraftByItem((prev) => ({
      ...prev,
      [itemId]: {
        ...current,
        [key]: value,
      },
    }));
  };

  const createTask = async (itemId: string) => {
    if (!token) return;
    const draft = getTaskDraft(itemId);
    if (!draft.title.trim()) {
      setRoadmapMessage('Task title is required.');
      return;
    }

    try {
      await roadmapAdminApi.createTask(token, itemId, {
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        task_type: draft.task_type || undefined,
        due_at: draft.due_at || undefined,
        max_attempts: asNumber(draft.max_attempts) || 1,
        allow_late_submission: draft.allow_late_submission,
        late_penalty_percent: asNumber(draft.late_penalty_percent),
        max_score: asNumber(draft.max_score),
        weight: asNumber(draft.weight),
      });

      setTaskDraftByItem((prev) => ({
        ...prev,
        [itemId]: defaultTaskDraft(),
      }));

      await loadLecturerRoadmap();
    } catch (error: any) {
      setRoadmapMessage(error?.message || 'Failed to create task.');
    }
  };

  const getTaskEditDraft = (task: AssessmentTask) => {
    if (!task.id) {
      return defaultTaskDraft();
    }

    const existing = taskEditDrafts[task.id];
    if (existing) return existing;

    const seed: TaskFormDraft = {
      title: task.title || '',
      description: task.description || '',
      task_type: task.task_type || 'assignment',
      due_at: task.due_at ? String(task.due_at).slice(0, 16) : '',
      max_attempts: String(task.max_attempts ?? 1),
      allow_late_submission: Boolean(task.allow_late_submission),
      late_penalty_percent: task.late_penalty_percent !== null && task.late_penalty_percent !== undefined ? String(task.late_penalty_percent) : '',
      max_score: task.max_score !== null && task.max_score !== undefined ? String(task.max_score) : '100',
      weight: task.weight !== null && task.weight !== undefined ? String(task.weight) : '1',
    };

    return seed;
  };

  const setTaskEditField = <K extends keyof TaskFormDraft>(task: AssessmentTask, key: K, value: TaskFormDraft[K]) => {
    if (!task.id) return;
    const current = getTaskEditDraft(task);
    setTaskEditDrafts((prev) => ({
      ...prev,
      [task.id as string]: {
        ...current,
        [key]: value,
      },
    }));
  };

  const saveTaskEdits = async (task: AssessmentTask) => {
    if (!token || !task.id) return;
    const draft = getTaskEditDraft(task);

    try {
      await roadmapAdminApi.updateTask(token, task.id, {
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        task_type: draft.task_type || undefined,
        due_at: draft.due_at || undefined,
        max_attempts: asNumber(draft.max_attempts) || 1,
        allow_late_submission: draft.allow_late_submission,
        late_penalty_percent: asNumber(draft.late_penalty_percent),
        max_score: asNumber(draft.max_score),
        weight: asNumber(draft.weight),
      });
      await loadLecturerRoadmap();
    } catch (error: any) {
      setRoadmapMessage(error?.message || 'Failed to update task.');
    }
  };

  const deactivateTask = async (taskId?: string) => {
    if (!token || !taskId) return;

    try {
      await roadmapAdminApi.deactivateTask(token, taskId);
      await loadLecturerRoadmap();
    } catch (error: any) {
      setRoadmapMessage(error?.message || 'Failed to deactivate task.');
    }
  };

  const reorderTask = async (item: RoadmapItem, taskId: string, direction: -1 | 1) => {
    if (!token || !item.id) return;
    const ordered = sortTasks(item.tasks || []);
    const currentIndex = ordered.findIndex((task) => task.id === taskId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;

    const reordered = [...ordered];
    const [task] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, task);

    const taskIds = reordered.map((entry) => entry.id).filter((entry): entry is string => Boolean(entry));

    try {
      await roadmapAdminApi.reorderTasks(token, item.id, taskIds);
      await loadLecturerRoadmap();
    } catch (error: any) {
      setRoadmapMessage(error?.message || 'Failed to reorder tasks.');
    }
  };

  const uploadDocument = async () => {
    if (!token || !uploadFile) return;

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    try {
      const result = await ingestionApi.uploadDocument(token, uploadFile);
      const label = result?.document_id || result?.id || result?.filename || uploadFile.name;
      setUploadMessage(`Upload successful: ${label}`);
      setUploadFile(null);
    } catch (error: any) {
      setUploadError(error?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  const drawerTitle = canUseStudentTools && canUseLecturerTools
    ? surfaceMode === 'student'
      ? 'Learning Tools'
      : 'Lecturer Workspace'
    : canUseStudentTools
    ? 'Learning Tools'
    : 'Lecturer Workspace';

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/35" onClick={onClose} />
      <div
        className={`fixed left-1/2 top-3 z-[80] w-[min(1200px,calc(100%-1.5rem))] max-h-[78vh] -translate-x-1/2 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl transition-all duration-300 ${
          entered ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0'
        }`}
      >
        <div className="max-h-[78vh] overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-blue-600">EduSmart</p>
                <h2 className="text-xl font-semibold text-gray-900">{drawerTitle}</h2>
                <p className="text-xs text-gray-500">
                  {selectedCourseCode && selectedCourseCode !== 'GENERAL'
                    ? `${selectedCourseCode}${selectedCourseName ? ` • ${selectedCourseName}` : ''}`
                    : 'General context selected'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
                aria-label="Close tools"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {canUseStudentTools && canUseLecturerTools && (
              <div className="mt-4 inline-flex rounded-2xl border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setSurfaceMode('student')}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    surfaceMode === 'student' ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Student Tools
                </button>
                <button
                  type="button"
                  onClick={() => setSurfaceMode('lecturer')}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    surfaceMode === 'lecturer' ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Lecturer Workspace
                </button>
              </div>
            )}

            {surfaceMode === 'student' && canUseStudentTools && (
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { id: 'roadmap', label: 'Roadmap' },
                  { id: 'assessments', label: 'Assessments' },
                  { id: 'progress', label: 'Progress' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStudentTab(tab.id as StudentTab)}
                    className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                      studentTab === tab.id
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {surfaceMode === 'lecturer' && canUseLecturerTools && (
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { id: 'offerings', label: 'Offerings' },
                  { id: 'course_spec', label: 'Course Spec' },
                  { id: 'roadmap_builder', label: 'Roadmap Builder' },
                  { id: 'students', label: 'Students' },
                  { id: 'uploads', label: 'Uploads' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLecturerTab(tab.id as LecturerTab)}
                    className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                      lecturerTab === tab.id
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-5 sm:px-6">
            {surfaceMode === 'student' && canUseStudentTools && (
              <div className="space-y-4">
                {!selectedCourseCode || selectedCourseCode === 'GENERAL' ? (
                  <EmptyStateCard
                    title="Select a course"
                    description={`Pick an enrolled course from the sidebar dropdown to view roadmap and assessments. ${enrolledCourseCount} course${enrolledCourseCount === 1 ? '' : 's'} available.`}
                  />
                ) : !resolvedStudentEnrollment?.enrollmentId ? (
                  <EmptyStateCard
                    title="No active enrollment"
                    description="This course currently has no active enrollment context for your account."
                  />
                ) : (
                  <>
                    <InlineErrorBanner message={studentError} />
                    <InlineErrorBanner message={attemptFeedback} />

                    {studentLoading ? (
                      <div className="rounded-3xl border border-gray-200 bg-white px-6 py-10 text-center">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
                        <p className="mt-3 text-sm text-gray-500">Loading roadmap tools...</p>
                      </div>
                    ) : studentRoadmapItems.length === 0 ? (
                      <EmptyStateCard
                        title="No roadmap published yet"
                        description="Your lecturer has not activated a roadmap for this offering yet."
                      />
                    ) : (
                      <>
                        {studentTab === 'roadmap' && (
                          <div className="space-y-3">
                            {studentRoadmapItems.map((item) => {
                              const itemId = item.id || `item-${item.title}`;
                              const tasks = sortTasks((item.tasks || []).filter((task) => task.is_active !== false));
                              const isExpanded = expandedItems[itemId];

                              return (
                                <div key={itemId} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                                        <StatusPill status={item.progress?.status || item.status} />
                                      </div>
                                      <p className="mt-1 text-sm text-gray-500">
                                        Week {item.week_no ?? '-'} • {item.estimated_hours ?? '-'}h • {tasks.length} task{tasks.length === 1 ? '' : 's'}
                                      </p>
                                      {item.description && (
                                        <p className="mt-2 text-sm text-gray-600">{item.description}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => toggleItemExpanded(itemId)}
                                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                                      >
                                        {isExpanded ? 'Hide tasks' : 'Show tasks'}
                                      </button>
                                      {item.id && (
                                        <button
                                          type="button"
                                          onClick={() => startRoadmapItem(item.id as string)}
                                          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                                        >
                                          Start item
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-3">
                                    <ProgressBar value={item.progress?.completion_percent ?? 0} />
                                  </div>

                                  {isExpanded && (
                                    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                                      {tasks.length === 0 ? (
                                        <p className="text-sm text-gray-500">No assessments configured yet.</p>
                                      ) : (
                                        tasks.map((task) => (
                                          <div key={task.id || task.title} className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2">
                                            <div className="flex items-center justify-between gap-3">
                                              <p className="text-sm font-medium text-gray-800">{task.title}</p>
                                              <StatusPill status={task.latest_result?.status || task.result_summary?.status || 'not_started'} />
                                            </div>
                                            <p className="mt-1 text-xs text-gray-500">Due: {toIsoDate(task.due_at)}</p>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {studentTab === 'assessments' && (
                          <div className="space-y-4">
                            {allStudentTasksByItem.map(({ item, tasks }) => (
                              <div key={item.id || item.title} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                                <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                                {tasks.length === 0 ? (
                                  <p className="mt-2 text-sm text-gray-500">No tasks under this roadmap item.</p>
                                ) : (
                                  <div className="mt-3 space-y-3">
                                    {tasks.map((task) => {
                                      const resultList = task.results || [];
                                      const attemptsUsed = resultList.length;
                                      const maxAttempts = task.max_attempts || 1;
                                      const latestResult =
                                        [...resultList].sort((a, b) => (b.attempt_no || 0) - (a.attempt_no || 0))[0] || task.latest_result || task.result_summary;

                                      return (
                                        <div key={task.id || task.title} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                                          <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                              <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                                                <StatusPill status={latestResult?.status || 'not_started'} />
                                              </div>
                                              <p className="mt-1 text-xs text-gray-500">
                                                {task.task_type || 'task'} • Due: {toIsoDate(task.due_at)}
                                              </p>
                                              <p className="mt-1 text-xs text-gray-500">
                                                Attempts: {attemptsUsed}/{maxAttempts} • Rule: {task.attempt_scoring_rule || 'latest'}
                                              </p>
                                              <p className="mt-1 text-xs text-gray-500">
                                                Late: {task.allow_late_submission ? 'Allowed' : 'Not allowed'}
                                                {task.allow_late_submission && task.late_penalty_percent !== null && task.late_penalty_percent !== undefined
                                                  ? ` (${task.late_penalty_percent}% penalty)`
                                                  : ''}
                                              </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => task.id && createAttempt(task.id)}
                                                disabled={!task.id || attemptsUsed >= maxAttempts || creatingAttemptTaskId === task.id}
                                                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                              >
                                                {creatingAttemptTaskId === task.id ? 'Creating...' : 'New attempt'}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => openSubmitModal(task)}
                                                disabled={!task.id}
                                                className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                              >
                                                Submit attempt
                                              </button>
                                            </div>
                                          </div>

                                          {latestResult && (
                                            <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                                              <p>
                                                Latest attempt #{latestResult.attempt_no || '-'} • Score:{' '}
                                                {latestResult.score !== null && latestResult.score !== undefined
                                                  ? latestResult.score.toFixed(1)
                                                  : '--'}
                                              </p>
                                              {latestResult.feedback && <p className="mt-1">Feedback: {latestResult.feedback}</p>}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {studentTab === 'progress' && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Overall completion</p>
                                <p className="mt-2 text-2xl font-semibold text-gray-900">{summary.overallCompletionPercent.toFixed(0)}%</p>
                              </div>
                              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Items done</p>
                                <p className="mt-2 text-2xl font-semibold text-gray-900">
                                  {summary.itemsCompleted ?? 0}/{summary.totalItems ?? 0}
                                </p>
                              </div>
                              <ScoreChip label="Average score" value={summary.avgScore} />
                              <ScoreChip label="Best score" value={summary.bestScore} />
                            </div>

                            <div className="space-y-3">
                              {studentRoadmapItems.map((item) => (
                                <div key={item.id || item.title} className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                                      <p className="text-xs text-gray-500">Week {item.week_no ?? '-'} • {item.estimated_hours ?? '-'}h</p>
                                    </div>
                                    <StatusPill status={item.progress?.status || item.status} />
                                  </div>
                                  <div className="mt-3">
                                    <ProgressBar value={item.progress?.completion_percent || 0} />
                                  </div>
                                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    <ScoreChip label="Total" value={item.progress?.total_score} denominator={item.progress?.max_total_score} />
                                    <ScoreChip label="Average" value={item.progress?.avg_score} />
                                    <ScoreChip label="Best" value={item.progress?.best_score} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {surfaceMode === 'lecturer' && canUseLecturerTools && (
              <div className="space-y-4">
                <InlineErrorBanner message={offeringsError} />
                <InlineErrorBanner message={catalogCoursesError} />
                <InlineErrorBanner message={createOfferingError} />
                <InlineErrorBanner message={roadmapMessage} />
                {createOfferingSuccess && (
                  <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {createOfferingSuccess}
                  </div>
                )}

                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Active offering</label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={selectedOfferingId}
                      onChange={(event) => setSelectedOfferingId(event.target.value)}
                      className="min-w-[240px] rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select offering</option>
                      {offerings.map((offering) => (
                        <option key={offering.id} value={offering.id}>
                          {offering.courseCode} • {offering.term || '-'} {offering.year || ''} {offering.section ? `• ${offering.section}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={loadOfferings}
                      disabled={offeringsLoading}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {offeringsLoading ? 'Refreshing...' : 'Refresh offerings'}
                    </button>
                  </div>
                </div>

                {lecturerTab === 'offerings' && (
                  <div className="space-y-3">
                    <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">Create offering</h3>
                          <p className="text-sm text-gray-500">Pick an existing course and create a new offering.</p>
                        </div>
                        <button
                          type="button"
                          onClick={loadCourseCatalog}
                          disabled={catalogCoursesLoading}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {catalogCoursesLoading ? 'Loading courses...' : 'Refresh courses'}
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <select
                          value={newOfferingCourseCode}
                          onChange={(event) => setNewOfferingCourseCode(event.target.value)}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="">Select course</option>
                          {catalogCourses.map((course) => (
                            <option key={course.code} value={course.code}>
                              {course.code} • {course.name}
                            </option>
                          ))}
                        </select>

                        <input
                          value={newOfferingTerm}
                          onChange={(event) => setNewOfferingTerm(event.target.value)}
                          placeholder="Term (e.g., Fall)"
                          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />

                        <input
                          value={newOfferingYear}
                          onChange={(event) => setNewOfferingYear(event.target.value)}
                          placeholder="Year"
                          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />

                        <input
                          value={newOfferingSection}
                          onChange={(event) => setNewOfferingSection(event.target.value)}
                          placeholder="Section (optional)"
                          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />

                        <input
                          value={newOfferingCohort}
                          onChange={(event) => setNewOfferingCohort(event.target.value)}
                          placeholder="Cohort (optional)"
                          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />

                        <button
                          type="button"
                          onClick={createOffering}
                          disabled={createOfferingBusy || !newOfferingCourseCode.trim() || !newOfferingTerm.trim()}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                        >
                          {createOfferingBusy ? 'Creating...' : 'Create offering'}
                        </button>
                      </div>
                    </div>

                    {offeringsLoading ? (
                      <div className="rounded-3xl border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">
                        Loading offerings...
                      </div>
                    ) : offerings.length === 0 ? (
                      <EmptyStateCard
                        title="No offerings found"
                        description="When offerings are available for your account, they will appear here."
                      />
                    ) : (
                      offerings.map((offering) => (
                        <div
                          key={offering.id}
                          className={`rounded-2xl border p-4 ${
                            selectedOfferingId === offering.id
                              ? 'border-blue-200 bg-blue-50'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-base font-semibold text-gray-900">{offering.courseCode}</p>
                              <p className="text-sm text-gray-500">
                                {offering.term || 'Term'} {offering.year || ''} {offering.section ? `• Section ${offering.section}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusPill status={offering.isActive ? 'approved_active' : 'archived'} />
                              <button
                                type="button"
                                onClick={() => setSelectedOfferingId(offering.id)}
                                className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Select
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {lecturerTab === 'course_spec' && (
                  <div className="space-y-4">
                    {!selectedOfferingId ? (
                      <EmptyStateCard
                        title="Choose an offering first"
                        description="Select an offering above to extract and approve course specs."
                      />
                    ) : (
                      <>
                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">Extract Course Spec</h3>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <label className="inline-flex cursor-pointer items-center rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                              <input
                                type="file"
                                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                className="hidden"
                                onChange={(event) => {
                                  setSpecSourceFile(event.target.files?.[0] || null);
                                  setSpecMessage(null);
                                }}
                              />
                              {specSourceFile ? 'Change document' : 'Choose PDF/DOCX'}
                            </label>
                            <button
                              type="button"
                              onClick={createSpec}
                              disabled={!specSourceFile || specBusy}
                              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                              {specBusy ? 'Uploading and extracting...' : 'Extract spec'}
                            </button>
                          </div>
                          {specSourceFile && (
                            <p className="mt-2 text-xs text-gray-500">Selected file: {specSourceFile.name}</p>
                          )}
                          {specState.specId && (
                            <p className="mt-2 text-xs text-gray-500">
                              Spec ID: {specState.specId} {specState.status ? `• ${specState.status}` : ''}
                            </p>
                          )}
                          {specMessage && <p className="mt-2 text-sm text-gray-600">{specMessage}</p>}
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">Spec JSON</h3>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={saveSpecEdits}
                                disabled={!specState.specId || specBusy}
                                className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              >
                                Save edits
                              </button>
                              <button
                                type="button"
                                onClick={approveSpec}
                                disabled={!specState.specId || specBusy}
                                className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                              >
                                Approve spec
                              </button>
                            </div>
                          </div>
                          <textarea
                            value={specEditorText}
                            onChange={(event) => setSpecEditorText(event.target.value)}
                            rows={16}
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 font-mono text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
                            placeholder="Spec JSON appears here after extraction"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {lecturerTab === 'roadmap_builder' && (
                  <div className="space-y-4">
                    {!selectedOfferingId ? (
                      <EmptyStateCard
                        title="Choose an offering first"
                        description="Select an offering to generate and manage roadmap items."
                      />
                    ) : (
                      <>
                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">Roadmap controls</h3>
                            <div className="flex items-center gap-2">
                              <select
                                value={roadmapFilter}
                                onChange={(event) => setRoadmapFilter(event.target.value as 'all' | 'draft' | 'approved_active')}
                                className="rounded-xl border border-gray-200 px-2 py-1.5 text-sm text-gray-700"
                              >
                                <option value="all">All</option>
                                <option value="draft">Draft</option>
                                <option value="approved_active">Approved active</option>
                              </select>
                              <button
                                type="button"
                                onClick={generateRoadmap}
                                disabled={roadmapBusy}
                                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                              >
                                Generate
                              </button>
                              <button
                                type="button"
                                onClick={activateRoadmap}
                                disabled={roadmapBusy}
                                className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                              >
                                Activate
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">Add roadmap item</h3>
                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <input
                              value={newItemTitle}
                              onChange={(event) => setNewItemTitle(event.target.value)}
                              placeholder="Item title"
                              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            />
                            <input
                              value={newItemWeekNo}
                              onChange={(event) => setNewItemWeekNo(event.target.value)}
                              placeholder="Week number"
                              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            />
                            <input
                              value={newItemEstimatedHours}
                              onChange={(event) => setNewItemEstimatedHours(event.target.value)}
                              placeholder="Estimated hours"
                              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={createRoadmapItem}
                              disabled={!newItemTitle.trim() || roadmapBusy}
                              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                              Add item
                            </button>
                          </div>
                          <textarea
                            value={newItemDescription}
                            onChange={(event) => setNewItemDescription(event.target.value)}
                            rows={2}
                            placeholder="Description"
                            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>

                        {roadmapBusy ? (
                          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
                            Updating roadmap...
                          </div>
                        ) : lecturerRoadmap.length === 0 ? (
                          <EmptyStateCard
                            title="No roadmap items"
                            description="Generate a roadmap from an approved spec or create items manually."
                          />
                        ) : (
                          <div className="space-y-4">
                            {lecturerRoadmap.map((item) => {
                              const itemId = item.id || '';
                              const itemTasks = sortTasks(item.tasks || []);
                              const taskCreateDraft = getTaskDraft(itemId);

                              return (
                                <div key={itemId || item.title} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-[240px] flex-1 space-y-2">
                                      <EditableField
                                        value={item.title}
                                        onSave={(next) => {
                                          if (!itemId) return;
                                          return patchRoadmapItem(itemId, { title: next.trim() });
                                        }}
                                        placeholder="Roadmap item title"
                                      />
                                      <EditableField
                                        value={item.description || ''}
                                        onSave={(next) => {
                                          if (!itemId) return;
                                          return patchRoadmapItem(itemId, { description: next.trim() || null });
                                        }}
                                        placeholder="Description"
                                        multiline
                                      />
                                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        <EditableField
                                          value={item.week_no}
                                          onSave={(next) => {
                                            if (!itemId) return;
                                            return patchRoadmapItem(itemId, { week_no: asNumber(next) });
                                          }}
                                          placeholder="Week number"
                                        />
                                        <EditableField
                                          value={item.estimated_hours}
                                          onSave={(next) => {
                                            if (!itemId) return;
                                            return patchRoadmapItem(itemId, { estimated_hours: asNumber(next) });
                                          }}
                                          placeholder="Estimated hours"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <StatusPill status={item.status} />
                                      {itemId && (
                                        <button
                                          type="button"
                                          onClick={() => setArchiveItemId(itemId)}
                                          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                                        >
                                          Archive
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Assessment tasks</p>

                                    <div className="mt-3 space-y-3">
                                      {itemTasks.length === 0 ? (
                                        <p className="text-sm text-gray-500">No tasks yet.</p>
                                      ) : (
                                        itemTasks.map((task, index) => {
                                          const taskDraft = getTaskEditDraft(task);

                                          return (
                                            <div key={task.id || `${itemId}-${index}`} className="rounded-2xl border border-gray-200 bg-white p-3">
                                              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                                                <input
                                                  value={taskDraft.title}
                                                  onChange={(event) => setTaskEditField(task, 'title', event.target.value)}
                                                  placeholder="Task title"
                                                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                                />
                                                <input
                                                  value={taskDraft.task_type}
                                                  onChange={(event) => setTaskEditField(task, 'task_type', event.target.value)}
                                                  placeholder="Task type"
                                                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                                />
                                                <input
                                                  type="datetime-local"
                                                  value={taskDraft.due_at}
                                                  onChange={(event) => setTaskEditField(task, 'due_at', event.target.value)}
                                                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                                />
                                                <input
                                                  value={taskDraft.max_attempts}
                                                  onChange={(event) => setTaskEditField(task, 'max_attempts', event.target.value)}
                                                  placeholder="Max attempts"
                                                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                                />
                                                <input
                                                  value={taskDraft.max_score}
                                                  onChange={(event) => setTaskEditField(task, 'max_score', event.target.value)}
                                                  placeholder="Max score"
                                                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                                />
                                                <input
                                                  value={taskDraft.weight}
                                                  onChange={(event) => setTaskEditField(task, 'weight', event.target.value)}
                                                  placeholder="Weight"
                                                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                                />
                                                <input
                                                  value={taskDraft.late_penalty_percent}
                                                  onChange={(event) => setTaskEditField(task, 'late_penalty_percent', event.target.value)}
                                                  placeholder="Late penalty %"
                                                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                                />
                                                <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700">
                                                  <input
                                                    type="checkbox"
                                                    checked={taskDraft.allow_late_submission}
                                                    onChange={(event) => setTaskEditField(task, 'allow_late_submission', event.target.checked)}
                                                  />
                                                  Allow late submission
                                                </label>
                                              </div>

                                              <textarea
                                                value={taskDraft.description}
                                                onChange={(event) => setTaskEditField(task, 'description', event.target.value)}
                                                rows={2}
                                                placeholder="Task description"
                                                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                              />

                                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => saveTaskEdits(task)}
                                                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                >
                                                  Save task
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => deactivateTask(task.id)}
                                                  className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                >
                                                  Deactivate
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => reorderTask(item, task.id as string, -1)}
                                                  disabled={index === 0}
                                                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                                                >
                                                  Move up
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => reorderTask(item, task.id as string, 1)}
                                                  disabled={index === itemTasks.length - 1}
                                                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                                                >
                                                  Move down
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>

                                    {itemId && (
                                      <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white p-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Add task</p>
                                        <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                                          <input
                                            value={taskCreateDraft.title}
                                            onChange={(event) => setTaskDraftField(itemId, 'title', event.target.value)}
                                            placeholder="Task title"
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                          />
                                          <input
                                            value={taskCreateDraft.task_type}
                                            onChange={(event) => setTaskDraftField(itemId, 'task_type', event.target.value)}
                                            placeholder="Task type"
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                          />
                                          <input
                                            type="datetime-local"
                                            value={taskCreateDraft.due_at}
                                            onChange={(event) => setTaskDraftField(itemId, 'due_at', event.target.value)}
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                          />
                                          <input
                                            value={taskCreateDraft.max_attempts}
                                            onChange={(event) => setTaskDraftField(itemId, 'max_attempts', event.target.value)}
                                            placeholder="Max attempts"
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                          />
                                          <input
                                            value={taskCreateDraft.max_score}
                                            onChange={(event) => setTaskDraftField(itemId, 'max_score', event.target.value)}
                                            placeholder="Max score"
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                          />
                                          <input
                                            value={taskCreateDraft.weight}
                                            onChange={(event) => setTaskDraftField(itemId, 'weight', event.target.value)}
                                            placeholder="Weight"
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                          />
                                          <input
                                            value={taskCreateDraft.late_penalty_percent}
                                            onChange={(event) => setTaskDraftField(itemId, 'late_penalty_percent', event.target.value)}
                                            placeholder="Late penalty %"
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                          />
                                          <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700">
                                            <input
                                              type="checkbox"
                                              checked={taskCreateDraft.allow_late_submission}
                                              onChange={(event) => setTaskDraftField(itemId, 'allow_late_submission', event.target.checked)}
                                            />
                                            Allow late submission
                                          </label>
                                        </div>
                                        <textarea
                                          value={taskCreateDraft.description}
                                          onChange={(event) => setTaskDraftField(itemId, 'description', event.target.value)}
                                          rows={2}
                                          placeholder="Task description"
                                          className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => createTask(itemId)}
                                          className="mt-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                                        >
                                          Add task
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {lecturerTab === 'students' && (
                  <div className="space-y-4">
                    {!selectedOfferingId ? (
                      <EmptyStateCard
                        title="Choose an offering first"
                        description="Select an offering to review student progress."
                      />
                    ) : (
                      <>
                        <InlineErrorBanner message={studentsError} />

                        {studentsLoading ? (
                          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
                            Loading students...
                          </div>
                        ) : offeringEnrollments.length === 0 ? (
                          <EmptyStateCard
                            title="No enrollments"
                            description="No students are currently enrolled in this offering."
                          />
                        ) : (
                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                            <div className="space-y-2 lg:col-span-1">
                              {offeringEnrollments.map((row) => {
                                const enrollmentId = String(row?.id || '');
                                const displayName = row?.user?.full_name || row?.user?.username || row?.user_id || 'Student';
                                const displayEmail = row?.user?.email || '';

                                return (
                                  <button
                                    key={enrollmentId}
                                    type="button"
                                    onClick={() => setSelectedEnrollmentId(enrollmentId)}
                                    className={`w-full rounded-2xl border p-3 text-left transition ${
                                      selectedEnrollmentId === enrollmentId
                                        ? 'border-blue-200 bg-blue-50'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}
                                  >
                                    <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                                    <p className="text-xs text-gray-500">{displayEmail || enrollmentId}</p>
                                  </button>
                                );
                              })}
                            </div>

                            <div className="lg:col-span-2">
                              {!selectedEnrollmentRoadmap ? (
                                <EmptyStateCard
                                  title="Select a student"
                                  description="Student roadmap progress appears here."
                                />
                              ) : (
                                <div className="space-y-3">
                                  {(selectedEnrollmentRoadmap.items || []).map((item) => (
                                    <div key={item.id || item.title} className="rounded-2xl border border-gray-200 bg-white p-4">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                                        <StatusPill status={item.progress?.status || item.status} />
                                      </div>
                                      <div className="mt-3">
                                        <ProgressBar value={item.progress?.completion_percent || 0} />
                                      </div>
                                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                        <ScoreChip label="Total" value={item.progress?.total_score} denominator={item.progress?.max_total_score} />
                                        <ScoreChip label="Average" value={item.progress?.avg_score} />
                                        <ScoreChip label="Best" value={item.progress?.best_score} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {lecturerTab === 'uploads' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">Upload blueprint / source docs</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Upload course documents for your workspace. Course Spec extraction can also upload directly.
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <input
                            type="file"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;
                              setUploadFile(file);
                              setUploadError(null);
                              setUploadMessage(null);
                            }}
                          />
                          {uploadFile ? 'Change file' : 'Choose file'}
                        </label>
                        {uploadFile && <span className="text-sm text-gray-600">{uploadFile.name}</span>}
                        <button
                          type="button"
                          onClick={uploadDocument}
                          disabled={!uploadFile || uploading}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                        >
                          {uploading ? 'Uploading...' : 'Upload'}
                        </button>
                      </div>

                      {selectedOffering && (
                        <p className="mt-2 text-xs text-gray-500">
                          Active offering context: {selectedOffering.courseCode} ({selectedOffering.id})
                        </p>
                      )}

                      {uploadMessage && <p className="mt-3 text-sm text-green-700">{uploadMessage}</p>}
                      {uploadError && <p className="mt-3 text-sm text-red-700">{uploadError}</p>}
                    </div>

                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                      Tip: in Course Spec, choose a PDF or DOCX and extract directly without entering a document ID.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ModalConfirm
        open={Boolean(archiveItemId)}
        title="Archive roadmap item"
        description="This will archive the item from active use. You can continue to keep historical records."
        confirmLabel="Archive"
        danger
        onConfirm={() => {
          if (archiveItemId) archiveRoadmapItem(archiveItemId);
        }}
        onCancel={() => setArchiveItemId(null)}
        loading={roadmapBusy}
      />

      {submitDraft && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900">Submit attempt #{submitDraft.attemptNo}</h3>
            <p className="mt-1 text-sm text-gray-500">Task: {submitDraft.taskTitle}</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Evidence URL</label>
                <input
                  value={submitEvidenceUrl}
                  onChange={(event) => setSubmitEvidenceUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Payload / notes (JSON or text)</label>
                <textarea
                  value={submitPayload}
                  onChange={(event) => setSubmitPayload(event.target.value)}
                  rows={4}
                  placeholder='{"notes": "Completed in lab"}'
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSubmitDraft(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAttempt}
                disabled={submittingAttempt}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {submittingAttempt ? 'Submitting...' : 'Submit attempt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
