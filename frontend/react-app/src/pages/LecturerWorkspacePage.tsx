import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  courseApi,
  enrollmentApi,
  ingestionApi,
  lecturerApi,
  offeringApi,
  progressApi,
  roadmapAdminApi,
} from '../services/api';
import { useAuth } from '../state/AuthContext';
import WorkspaceTabs from '../components/lecturer/WorkspaceTabs';
import MetricCard from '../components/lecturer/MetricCard';
import SectionCard from '../components/lecturer/SectionCard';
import LecturerAssistantPanel from '../components/lecturer/LecturerAssistantPanel';
import InlineErrorBanner from '../components/tools/InlineErrorBanner';
import ProgressBar from '../components/tools/ProgressBar';
import ScoreChip from '../components/tools/ScoreChip';
import StatusPill from '../components/tools/StatusPill';

interface CourseRecord {
  code: string;
  name: string;
}

interface OfferingRecord {
  id: string;
  courseCode: string;
  courseName: string;
  lecturerUserId?: string;
  term: string;
  year?: number;
  section?: string;
  cohort?: string;
  isActive: boolean;
  enrollmentKey?: string;
}

interface EnrollmentRecord {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  status: string;
}

interface RoadmapProgressRow {
  status: string;
  completionPercent: number;
  totalScore?: number | null;
  maxTotalScore?: number | null;
  avgScore?: number | null;
  bestScore?: number | null;
}

interface TaskResultRow {
  id?: string;
  attemptNo?: number;
  status?: string;
  score?: number | null;
  feedback?: string | null;
  submittedAt?: string | null;
  gradedAt?: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  description: string;
  taskType: string;
  dueAt?: string | null;
  maxAttempts: number;
  attemptScoringRule: string;
  allowLateSubmission: boolean;
  latePenaltyPercent?: number | null;
  maxScore?: number | null;
  weight?: number | null;
  orderIndex?: number | null;
  isActive: boolean;
  results: TaskResultRow[];
}

interface RoadmapItemRow {
  id: string;
  title: string;
  description: string;
  weekNo?: number | null;
  estimatedHours?: number | null;
  status: string;
  orderIndex?: number | null;
  tasks: TaskRow[];
  progress?: RoadmapProgressRow | null;
}

interface ParsedRoadmap {
  specId?: string | null;
  specStatus?: string | null;
  specJson?: Record<string, unknown> | null;
  items: RoadmapItemRow[];
}

interface StudentSummaryRow {
  enrollmentId: string;
  fullName: string;
  email: string;
  progressPercent: number;
  avgScore?: number | null;
  itemsCompleted: number;
  totalItems: number;
}

interface TaskDraft {
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

type LecturerTab = 'dashboard' | 'offerings' | 'roadmap' | 'students' | 'uploads' | 'assistant';

const TABS: Array<{ id: LecturerTab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'offerings', label: 'Offerings' },
  { id: 'roadmap', label: 'Roadmap Builder' },
  { id: 'students', label: 'Students' },
  { id: 'uploads', label: 'Uploads' },
  { id: 'assistant', label: 'AI Assistant' },
];

const defaultTaskDraft = (): TaskDraft => ({
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

const parseRows = <T,>(raw: unknown, keys: string[]): T[] => {
  const direct = asArray<T>(raw);
  if (direct.length > 0) return direct;

  if (!raw || typeof raw !== 'object') return [];
  const source = raw as Record<string, unknown>;
  for (const key of keys) {
    const nested = asArray<T>(source[key]);
    if (nested.length > 0) return nested;
  }
  return [];
};

const normalizeCourse = (raw: any): CourseRecord | null => {
  const code = raw?.course_code || raw?.code;
  if (!code) return null;

  return {
    code: String(code),
    name: raw?.course_name || raw?.name || String(code),
  };
};

const normalizeOffering = (raw: any): OfferingRecord | null => {
  const id = raw?.id?.toString?.() || raw?.offering_id?.toString?.();
  const courseCode = raw?.course_code || raw?.course?.course_code;
  if (!id || !courseCode) return null;

  return {
    id,
    courseCode: String(courseCode),
    courseName: raw?.course?.course_name || raw?.course_name || String(courseCode),
    lecturerUserId: raw?.lecturer_user_id?.toString?.() || undefined,
    term: raw?.term || '-',
    year: asNumber(raw?.year) || undefined,
    section: raw?.section || undefined,
    cohort: raw?.cohort || undefined,
    isActive: typeof raw?.is_active === 'boolean' ? raw.is_active : true,
    enrollmentKey: raw?.enrollment_key || undefined,
  };
};

const normalizeEnrollment = (raw: any): EnrollmentRecord | null => {
  const id = raw?.id?.toString?.();
  const userId = raw?.user_id?.toString?.() || raw?.user?.id?.toString?.() || '';
  if (!id || !userId) return null;

  return {
    id,
    userId,
    fullName: raw?.user?.full_name || raw?.user?.username || userId,
    email: raw?.user?.email || '',
    status: raw?.status || 'active',
  };
};

const normalizeTaskResult = (raw: any): TaskResultRow => ({
  id: raw?.id?.toString?.() || undefined,
  attemptNo: asNumber(raw?.attempt_no) || undefined,
  status: raw?.status || undefined,
  score: asNumber(raw?.score),
  feedback: raw?.feedback || null,
  submittedAt: raw?.submitted_at || null,
  gradedAt: raw?.graded_at || null,
});

const normalizeTask = (raw: any): TaskRow => ({
  id: raw?.id?.toString?.() || raw?.task_id?.toString?.() || `${Date.now()}-${Math.random()}`,
  title: raw?.title || raw?.name || 'Untitled task',
  description: raw?.description || '',
  taskType: raw?.task_type || raw?.type || 'assignment',
  dueAt: raw?.due_at || null,
  maxAttempts: asNumber(raw?.max_attempts) || 1,
  attemptScoringRule: raw?.attempt_scoring_rule || 'latest',
  allowLateSubmission: Boolean(raw?.allow_late_submission),
  latePenaltyPercent: asNumber(raw?.late_penalty_percent),
  maxScore: asNumber(raw?.max_score),
  weight: asNumber(raw?.weight),
  orderIndex: asNumber(raw?.order_index),
  isActive: raw?.is_active !== false,
  results: parseRows<any>(raw?.results, ['items', 'results']).map(normalizeTaskResult),
});

const normalizeProgress = (raw: any): RoadmapProgressRow => ({
  status: raw?.status || 'not_started',
  completionPercent: asNumber(raw?.completion_percent) || 0,
  totalScore: asNumber(raw?.total_score),
  maxTotalScore: asNumber(raw?.max_total_score),
  avgScore: asNumber(raw?.avg_score),
  bestScore: asNumber(raw?.best_score),
});

const normalizeRoadmapItem = (raw: any): RoadmapItemRow => ({
  id: raw?.id?.toString?.() || raw?.item_id?.toString?.() || `${Date.now()}-${Math.random()}`,
  title: raw?.title || raw?.name || 'Untitled roadmap item',
  description: raw?.description || '',
  weekNo: asNumber(raw?.week_no),
  estimatedHours: asNumber(raw?.estimated_hours),
  status: raw?.status || 'draft',
  orderIndex: asNumber(raw?.order_index),
  tasks: parseRows<any>(raw?.tasks, ['items', 'results']).map(normalizeTask),
  progress: raw?.progress ? normalizeProgress(raw.progress) : null,
});

const parseRoadmap = (raw: unknown): ParsedRoadmap => {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const items = parseRows<any>(source?.items || source?.roadmap_items, ['items', 'roadmap_items'])
    .map(normalizeRoadmapItem)
    .sort((left, right) => {
      const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder === rightOrder) return left.title.localeCompare(right.title);
      return leftOrder - rightOrder;
    });

  const progressRows = parseRows<any>(source?.progress || source?.roadmap_progress, ['progress', 'roadmap_progress'])
    .map((row) => ({
      roadmapItemId: row?.roadmap_item_id?.toString?.() || row?.item_id?.toString?.(),
      progress: normalizeProgress(row),
    }));

  const progressMap = new Map<string, RoadmapProgressRow>();
  for (const row of progressRows) {
    if (row.roadmapItemId) {
      progressMap.set(row.roadmapItemId, row.progress);
    }
  }

  const enriched = items.map((item) => {
    if (!item.progress && progressMap.has(item.id)) {
      return { ...item, progress: progressMap.get(item.id) || null };
    }
    return item;
  });

  return {
    specId: source?.spec_id?.toString?.() || (source?.spec as any)?.id?.toString?.() || null,
    specStatus: (source?.spec_status as string) || (source?.spec as any)?.status || null,
    specJson: (source?.spec_json as Record<string, unknown>) || (source?.spec as any)?.spec_json || null,
    items: enriched,
  };
};

const summarizeStudent = (roadmap: ParsedRoadmap): Pick<StudentSummaryRow, 'progressPercent' | 'avgScore' | 'itemsCompleted' | 'totalItems'> => {
  const totalItems = roadmap.items.length;
  if (totalItems === 0) {
    return {
      progressPercent: 0,
      avgScore: null,
      itemsCompleted: 0,
      totalItems,
    };
  }

  const progressRows = roadmap.items
    .map((item) => item.progress)
    .filter((row): row is RoadmapProgressRow => Boolean(row));

  const progressPercent = progressRows.length > 0
    ? progressRows.reduce((sum, row) => sum + row.completionPercent, 0) / progressRows.length
    : 0;

  const scoreRows = progressRows.filter((row) => row.avgScore !== null && row.avgScore !== undefined);
  const avgScore = scoreRows.length > 0
    ? scoreRows.reduce((sum, row) => sum + Number(row.avgScore || 0), 0) / scoreRows.length
    : null;

  const itemsCompleted = progressRows.filter((row) => row.status === 'completed').length;

  return {
    progressPercent,
    avgScore,
    itemsCompleted,
    totalItems,
  };
};

export default function LecturerWorkspacePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const token = localStorage.getItem('auth_token') || '';

  const [activeTab, setActiveTab] = useState<LecturerTab>('dashboard');

  const [offerings, setOfferings] = useState<OfferingRecord[]>([]);
  const [offeringsLoading, setOfferingsLoading] = useState(false);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [selectedOfferingId, setSelectedOfferingId] = useState('');

  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [enrollmentsByOffering, setEnrollmentsByOffering] = useState<Record<string, EnrollmentRecord[]>>({});
  const [enrollmentCountByOffering, setEnrollmentCountByOffering] = useState<Record<string, number>>({});
  const [activeRoadmapByOffering, setActiveRoadmapByOffering] = useState<Record<string, boolean>>({});

  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeRoadmapsCount, setActiveRoadmapsCount] = useState(0);
  const [averageProgress, setAverageProgress] = useState(0);

  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [newOfferingCourseCode, setNewOfferingCourseCode] = useState('');
  const [newOfferingTerm, setNewOfferingTerm] = useState('');
  const [newOfferingYear, setNewOfferingYear] = useState(String(new Date().getFullYear()));
  const [newOfferingSection, setNewOfferingSection] = useState('');
  const [newOfferingCohort, setNewOfferingCohort] = useState('');
  const [autoGenerateEnrollmentKey, setAutoGenerateEnrollmentKey] = useState(true);
  const [customEnrollmentKey, setCustomEnrollmentKey] = useState('');

  const [roadmapFilter, setRoadmapFilter] = useState<'all' | 'draft' | 'approved_active'>('all');
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);
  const [roadmapNotice, setRoadmapNotice] = useState<string | null>(null);
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItemRow[]>([]);
  const [specId, setSpecId] = useState<string | null>(null);
  const [specStatus, setSpecStatus] = useState<string | null>(null);
  const [specSourceFile, setSpecSourceFile] = useState<File | null>(null);
  const [specEditor, setSpecEditor] = useState('');

  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemWeekNo, setNewItemWeekNo] = useState('');
  const [newItemEstimatedHours, setNewItemEstimatedHours] = useState('');

  const [taskDraftByItem, setTaskDraftByItem] = useState<Record<string, TaskDraft>>({});
  const [taskEditDraftByTask, setTaskEditDraftByTask] = useState<Record<string, TaskDraft>>({});

  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentRows, setStudentRows] = useState<StudentSummaryRow[]>([]);
  const [selectedStudentEnrollmentId, setSelectedStudentEnrollmentId] = useState('');
  const [studentRoadmapByEnrollment, setStudentRoadmapByEnrollment] = useState<Record<string, ParsedRoadmap>>({});

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadHistoryLoading, setUploadHistoryLoading] = useState(false);
  const [uploadHistoryError, setUploadHistoryError] = useState<string | null>(null);
  const [uploadHistory, setUploadHistory] = useState<any[]>([]);
  const [recentUploads, setRecentUploads] = useState<Array<{ id: string; fileName: string; uploadedAt: string; offeringId?: string }>>([]);

  const selectedOffering = useMemo(
    () => offerings.find((offering) => offering.id === selectedOfferingId) || null,
    [offerings, selectedOfferingId]
  );

  const selectedStudentRoadmap = selectedStudentEnrollmentId
    ? studentRoadmapByEnrollment[selectedStudentEnrollmentId] || null
    : null;

  const isLecturerSurface = user?.role === 'lecturer' || user?.role === 'admin';

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    if (!isLecturerSurface) {
      navigate('/chat', { replace: true });
    }
  }, [isLecturerSurface, navigate, user]);

  const refreshCourseCatalog = async () => {
    if (!token) return;

    setCoursesLoading(true);
    setCoursesError(null);

    try {
      const response = await courseApi.list(token, { is_active: true, limit: 300 });
      const rows = parseRows<any>(response, ['items', 'results', 'courses']);
      const mapped = rows
        .map(normalizeCourse)
        .filter((entry): entry is CourseRecord => Boolean(entry));

      setCourses(mapped);
      if (!newOfferingCourseCode && mapped[0]?.code) {
        setNewOfferingCourseCode(mapped[0].code);
      }
    } catch (requestError: any) {
      setCourses([]);
      setCoursesError(requestError?.message || 'Failed to load courses.');
    } finally {
      setCoursesLoading(false);
    }
  };

  const getEnrollmentProgressPercent = async (enrollmentId: string): Promise<number | null> => {
    if (!token) return null;

    try {
      const summary = await progressApi.getProgressSummary(token, enrollmentId);
      const value = asNumber((summary as any)?.overall_completion_percent ?? (summary as any)?.completion_percent);
      if (value !== null) return value;
    } catch {
      // fall through
    }

    try {
      const roadmapRaw = await progressApi.getRoadmap(token, enrollmentId);
      const parsedRoadmap = parseRoadmap(roadmapRaw);
      const summary = summarizeStudent(parsedRoadmap);
      return summary.progressPercent;
    } catch {
      return null;
    }
  };

  const refreshDashboardStats = async (
    offeringList: OfferingRecord[],
    enrollmentMap: Record<string, EnrollmentRecord[]>
  ) => {
    if (!token || offeringList.length === 0) {
      setActiveRoadmapsCount(0);
      setAverageProgress(0);
      return;
    }

    setDashboardLoading(true);

    try {
      const activeRoadmapEntries = await Promise.all(
        offeringList.map(async (offering) => {
          try {
            const response = await roadmapAdminApi.listRoadmap(token, offering.id, 'approved_active');
            const parsed = parseRoadmap(response);
            return [offering.id, parsed.items.length > 0] as const;
          } catch {
            return [offering.id, false] as const;
          }
        })
      );

      const activeRoadmapState: Record<string, boolean> = {};
      for (const [offeringId, hasActiveRoadmap] of activeRoadmapEntries) {
        activeRoadmapState[offeringId] = hasActiveRoadmap;
      }
      setActiveRoadmapByOffering(activeRoadmapState);
      setActiveRoadmapsCount(Object.values(activeRoadmapState).filter(Boolean).length);

      const enrollmentIds = Object.values(enrollmentMap)
        .flat()
        .map((row) => row.id)
        .slice(0, 50);

      if (enrollmentIds.length === 0) {
        setAverageProgress(0);
        return;
      }

      const progressValues = await Promise.all(
        enrollmentIds.map(async (enrollmentId) => getEnrollmentProgressPercent(enrollmentId))
      );

      const numeric = progressValues.filter((value): value is number => value !== null);
      setAverageProgress(numeric.length > 0 ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : 0);
    } finally {
      setDashboardLoading(false);
    }
  };

  const refreshOfferings = async (showErrors: boolean = false) => {
    if (!token || !isLecturerSurface) return;

    setOfferingsLoading(true);
    if (showErrors) {
      setOfferingsError(null);
    }

    try {
      const toMapped = (response: unknown): OfferingRecord[] => {
        const rows = parseRows<any>(response, ['items', 'results', 'offerings']);
        const mapped = rows
          .map(normalizeOffering)
          .filter((entry): entry is OfferingRecord => Boolean(entry));
        if (user?.role === 'lecturer' && user.id) {
          const hasOwnerInfo = mapped.some((offering) => Boolean(offering.lecturerUserId));
          if (!hasOwnerInfo) {
            return mapped;
          }
          return mapped.filter((offering) => offering.lecturerUserId === user.id);
        }
        return mapped;
      };

      let mapped: OfferingRecord[] = [];
      let listError: any = null;

      try {
        const response = await offeringApi.list(token, {
          lecturer_user_id: user?.role === 'lecturer' ? user.id : undefined,
          limit: 200,
        });
        mapped = toMapped(response);
      } catch (primaryError: any) {
        listError = primaryError;
        const fallbackResponse = await offeringApi.list(token, { limit: 200 });
        mapped = toMapped(fallbackResponse);
      }

      setOfferings(mapped);

      if (!selectedOfferingId || !mapped.find((offering) => offering.id === selectedOfferingId)) {
        setSelectedOfferingId(mapped[0]?.id || '');
      }

      const enrollmentEntries = await Promise.all(
        mapped.map(async (offering) => {
          try {
            const enrollmentResponse = await enrollmentApi.list(token, { offering_id: offering.id, limit: 500 });
            const enrollmentRows = parseRows<any>(enrollmentResponse, ['items', 'results', 'enrollments'])
              .map(normalizeEnrollment)
              .filter((entry): entry is EnrollmentRecord => Boolean(entry));
            return [offering.id, enrollmentRows] as const;
          } catch {
            return [offering.id, [] as EnrollmentRecord[]] as const;
          }
        })
      );

      const nextEnrollmentMap: Record<string, EnrollmentRecord[]> = {};
      const nextCountMap: Record<string, number> = {};
      let total = 0;

      for (const [offeringId, enrollmentRows] of enrollmentEntries) {
        nextEnrollmentMap[offeringId] = enrollmentRows;
        nextCountMap[offeringId] = enrollmentRows.length;
        total += enrollmentRows.length;
      }

      setEnrollmentsByOffering(nextEnrollmentMap);
      setEnrollmentCountByOffering(nextCountMap);
      setTotalStudents(total);

      await refreshDashboardStats(mapped, nextEnrollmentMap);
      if (listError && showErrors) {
        setOfferingsError(null);
      }
    } catch (requestError: any) {
      setOfferings([]);
      if (showErrors) {
        setOfferingsError(requestError?.message || 'Failed to load offerings.');
      } else {
        setOfferingsError(null);
      }
    } finally {
      setOfferingsLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !isLecturerSurface) return;
    refreshOfferings(false);
    refreshCourseCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isLecturerSurface]);

  const createOffering = async () => {
    if (!token || !newOfferingCourseCode.trim() || !newOfferingTerm.trim()) {
      setCreateError('Course and term are required.');
      return;
    }

    setCreateBusy(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const payload: Record<string, unknown> = {
        course_code: newOfferingCourseCode.trim(),
        term: newOfferingTerm.trim(),
        auto_generate_enrollment_key: autoGenerateEnrollmentKey,
        is_active: true,
      };

      const yearValue = asNumber(newOfferingYear);
      if (yearValue !== null) payload.year = yearValue;
      if (newOfferingSection.trim()) payload.section = newOfferingSection.trim();
      if (newOfferingCohort.trim()) payload.cohort = newOfferingCohort.trim();
      if (!autoGenerateEnrollmentKey && customEnrollmentKey.trim()) payload.enrollment_key = customEnrollmentKey.trim();

      await offeringApi.create(token, payload as any);
      setCreateSuccess('Offering created successfully.');
      setActiveTab('offerings');

      await refreshOfferings(false);
      setNewOfferingSection('');
      setNewOfferingCohort('');
      setCustomEnrollmentKey('');
    } catch (requestError: any) {
      setCreateError(requestError?.message || 'Failed to create offering.');
    } finally {
      setCreateBusy(false);
    }
  };

  const loadRoadmap = async () => {
    if (!token || !selectedOfferingId) {
      setRoadmapItems([]);
      return;
    }

    setRoadmapLoading(true);
    setRoadmapError(null);

    try {
      const response = await roadmapAdminApi.listRoadmap(token, selectedOfferingId, roadmapFilter);
      const parsed = parseRoadmap(response);
      setRoadmapItems(parsed.items);
      setSpecId(parsed.specId || null);
      setSpecStatus(parsed.specStatus || null);
      if (parsed.specJson) {
        setSpecEditor(JSON.stringify(parsed.specJson, null, 2));
      }
    } catch (requestError: any) {
      setRoadmapItems([]);
      setRoadmapError(requestError?.message || 'Failed to load roadmap data.');
    } finally {
      setRoadmapLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'roadmap') return;
    loadRoadmap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedOfferingId, roadmapFilter]);

  const extractSpec = async () => {
    if (!token || !selectedOfferingId || !specSourceFile) return;

    setRoadmapLoading(true);
    setRoadmapError(null);
    setRoadmapNotice(null);

    try {
      const response = await roadmapAdminApi.extractSpec(token, selectedOfferingId, specSourceFile);
      const nextSpecId = response?.id?.toString?.() || response?.spec_id?.toString?.() || response?.spec?.id?.toString?.() || null;
      const nextStatus = response?.status || response?.spec_status || response?.spec?.status || null;
      const nextSpecJson = response?.spec_json || response?.spec?.spec_json || response?.spec || null;

      setSpecId(nextSpecId);
      setSpecStatus(nextStatus);
      if (nextSpecJson) {
        setSpecEditor(JSON.stringify(nextSpecJson, null, 2));
      }

      setRoadmapNotice(`Spec extracted from ${specSourceFile.name}. Review and save or approve.`);
      setSpecSourceFile(null);
      await loadRoadmap();
      await refreshOfferings(false);
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to extract course spec.');
    } finally {
      setRoadmapLoading(false);
    }
  };

  const saveSpecEdits = async () => {
    if (!token || !specId) return;

    setRoadmapLoading(true);
    try {
      const parsedSpec = specEditor.trim() ? JSON.parse(specEditor) : {};
      const response = await roadmapAdminApi.updateSpec(token, specId, { spec_json: parsedSpec });
      const nextStatus = response?.status || response?.spec?.status || specStatus;
      const nextSpecJson = response?.spec_json || response?.spec?.spec_json || parsedSpec;
      setSpecStatus(nextStatus);
      setSpecEditor(JSON.stringify(nextSpecJson, null, 2));
      setRoadmapNotice('Spec saved.');
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to save spec edits.');
    } finally {
      setRoadmapLoading(false);
    }
  };

  const approveSpec = async () => {
    if (!token || !specId) return;

    setRoadmapLoading(true);
    try {
      await roadmapAdminApi.approveSpec(token, specId);
      setSpecStatus('approved_active');
      setRoadmapNotice('Spec approved.');
      await loadRoadmap();
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to approve spec.');
    } finally {
      setRoadmapLoading(false);
    }
  };

  const generateRoadmap = async () => {
    if (!token || !selectedOfferingId) return;

    setRoadmapLoading(true);
    try {
      await roadmapAdminApi.generateRoadmap(token, selectedOfferingId);
      setRoadmapNotice('Roadmap generated from current spec.');
      await loadRoadmap();
      await refreshOfferings(false);
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to generate roadmap.');
    } finally {
      setRoadmapLoading(false);
    }
  };

  const activateRoadmap = async () => {
    if (!token || !selectedOfferingId) return;

    setRoadmapLoading(true);
    try {
      await roadmapAdminApi.activateRoadmap(token, selectedOfferingId);
      setRoadmapNotice('Roadmap activated.');
      await loadRoadmap();
      await refreshOfferings(false);
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to activate roadmap.');
    } finally {
      setRoadmapLoading(false);
    }
  };

  const createRoadmapItem = async () => {
    if (!token || !selectedOfferingId || !newItemTitle.trim()) return;

    setRoadmapLoading(true);
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

      setRoadmapNotice('Roadmap item created.');
      await loadRoadmap();
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to create roadmap item.');
    } finally {
      setRoadmapLoading(false);
    }
  };

  const updateRoadmapItem = async (itemId: string, payload: Record<string, unknown>) => {
    if (!token) return;

    try {
      await roadmapAdminApi.updateRoadmapItem(token, itemId, payload);
      await loadRoadmap();
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to update roadmap item.');
    }
  };

  const archiveRoadmapItem = async (itemId: string) => {
    if (!token) return;

    setRoadmapLoading(true);
    try {
      await roadmapAdminApi.archiveRoadmapItem(token, itemId);
      setRoadmapNotice('Roadmap item archived.');
      await loadRoadmap();
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to archive roadmap item.');
    } finally {
      setRoadmapLoading(false);
    }
  };

  const getTaskCreateDraft = (itemId: string): TaskDraft => {
    return taskDraftByItem[itemId] || defaultTaskDraft();
  };

  const setTaskCreateDraftField = <K extends keyof TaskDraft>(itemId: string, field: K, value: TaskDraft[K]) => {
    const current = getTaskCreateDraft(itemId);
    setTaskDraftByItem((prev) => ({
      ...prev,
      [itemId]: {
        ...current,
        [field]: value,
      },
    }));
  };

  const createTask = async (itemId: string) => {
    if (!token) return;

    const draft = getTaskCreateDraft(itemId);
    if (!draft.title.trim()) {
      setRoadmapError('Task title is required.');
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
      await loadRoadmap();
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to create task.');
    }
  };

  const getTaskEditDraft = (task: TaskRow): TaskDraft => {
    const existing = taskEditDraftByTask[task.id];
    if (existing) return existing;

    return {
      title: task.title,
      description: task.description,
      task_type: task.taskType,
      due_at: task.dueAt ? String(task.dueAt).slice(0, 16) : '',
      max_attempts: String(task.maxAttempts),
      allow_late_submission: task.allowLateSubmission,
      late_penalty_percent: task.latePenaltyPercent !== null && task.latePenaltyPercent !== undefined ? String(task.latePenaltyPercent) : '',
      max_score: task.maxScore !== null && task.maxScore !== undefined ? String(task.maxScore) : '100',
      weight: task.weight !== null && task.weight !== undefined ? String(task.weight) : '1',
    };
  };

  const setTaskEditDraftField = <K extends keyof TaskDraft>(task: TaskRow, field: K, value: TaskDraft[K]) => {
    const current = getTaskEditDraft(task);
    setTaskEditDraftByTask((prev) => ({
      ...prev,
      [task.id]: {
        ...current,
        [field]: value,
      },
    }));
  };

  const saveTask = async (task: TaskRow) => {
    if (!token) return;

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
      await loadRoadmap();
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to save task changes.');
    }
  };

  const deactivateTask = async (taskId: string) => {
    if (!token) return;

    try {
      await roadmapAdminApi.deactivateTask(token, taskId);
      await loadRoadmap();
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to deactivate task.');
    }
  };

  const moveTask = async (item: RoadmapItemRow, taskId: string, direction: -1 | 1) => {
    if (!token) return;

    const ordered = [...item.tasks].sort((left, right) => {
      const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder === rightOrder) return left.title.localeCompare(right.title);
      return leftOrder - rightOrder;
    });

    const currentIndex = ordered.findIndex((task) => task.id === taskId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;

    const reordered = [...ordered];
    const [movingTask] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, movingTask);

    const taskIds = reordered.map((task) => task.id);

    try {
      await roadmapAdminApi.reorderTasks(token, item.id, taskIds);
      await loadRoadmap();
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to reorder tasks.');
    }
  };

  const loadStudents = async () => {
    if (!token || !selectedOfferingId) {
      setStudentRows([]);
      return;
    }

    setStudentsLoading(true);
    setStudentsError(null);

    try {
      const baseRows = enrollmentsByOffering[selectedOfferingId] || [];
      const enrollments = baseRows.length > 0
        ? baseRows
        : parseRows<any>(await enrollmentApi.list(token, { offering_id: selectedOfferingId, limit: 500 }), ['items', 'results', 'enrollments'])
            .map(normalizeEnrollment)
            .filter((entry): entry is EnrollmentRecord => Boolean(entry));

      const roadmapMap: Record<string, ParsedRoadmap> = {};

      const summaries = await Promise.all(
        enrollments.map(async (row) => {
          try {
            const roadmapRaw = await progressApi.getRoadmap(token, row.id);
            const parsed = parseRoadmap(roadmapRaw);
            roadmapMap[row.id] = parsed;

            const summary = summarizeStudent(parsed);
            return {
              enrollmentId: row.id,
              fullName: row.fullName,
              email: row.email,
              progressPercent: summary.progressPercent,
              avgScore: summary.avgScore,
              itemsCompleted: summary.itemsCompleted,
              totalItems: summary.totalItems,
            } satisfies StudentSummaryRow;
          } catch {
            return {
              enrollmentId: row.id,
              fullName: row.fullName,
              email: row.email,
              progressPercent: 0,
              avgScore: null,
              itemsCompleted: 0,
              totalItems: 0,
            } satisfies StudentSummaryRow;
          }
        })
      );

      setStudentRoadmapByEnrollment(roadmapMap);
      setStudentRows(summaries);
      if (!selectedStudentEnrollmentId || !summaries.find((row) => row.enrollmentId === selectedStudentEnrollmentId)) {
        setSelectedStudentEnrollmentId(summaries[0]?.enrollmentId || '');
      }
    } catch (requestError: any) {
      setStudentsError(requestError?.message || 'Failed to load students for offering.');
      setStudentRows([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'students') return;
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedOfferingId]);

  const loadUploadHistory = async () => {
    if (!token || !isLecturerSurface) return;

    setUploadHistoryLoading(true);
    setUploadHistoryError(null);

    try {
      const response = await lecturerApi.getUploads(token, selectedOffering?.courseCode || undefined);
      const rows = parseRows<any>(response, ['items', 'results', 'uploads']);
      setUploadHistory(rows);
    } catch (requestError: any) {
      setUploadHistoryError(requestError?.message || 'Failed to load uploads.');
      setUploadHistory([]);
    } finally {
      setUploadHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'uploads') return;
    loadUploadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedOfferingId]);

  const uploadDocument = async () => {
    if (!token || !uploadFile) return;

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    try {
      const response = await ingestionApi.uploadDocument(token, uploadFile);
      const id = response?.document_id || response?.id || uploadFile.name;

      setUploadMessage(`Uploaded ${uploadFile.name} (${id}).`);
      setRecentUploads((prev) => [
        {
          id: String(id),
          fileName: uploadFile.name,
          uploadedAt: new Date().toISOString(),
          offeringId: selectedOfferingId || undefined,
        },
        ...prev,
      ]);

      setUploadFile(null);
      await loadUploadHistory();
    } catch (requestError: any) {
      setUploadError(requestError?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const goToTab = (tab: LecturerTab) => {
    setActiveTab(tab);
  };

  if (!user) {
    return null;
  }

  if (!isLecturerSurface) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-blue-600">EduSmart Lecturer Workspace</p>
            <h1 className="text-2xl font-semibold text-gray-900">Teaching Control Center</h1>
            <p className="text-sm text-gray-500">Create offerings, design roadmaps, track learners, and use AI support.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/account-settings')}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Account
            </button>
            <button
              type="button"
              onClick={() => navigate('/general-settings')}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Settings
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <InlineErrorBanner message={activeTab === 'offerings' ? offeringsError : null} />
        <InlineErrorBanner message={activeTab === 'offerings' ? coursesError : null} />

        <WorkspaceTabs tabs={TABS} activeTab={activeTab} onChange={(tab) => setActiveTab(tab as LecturerTab)} />

        <SectionCard
          title="Offering Context"
          description="Workspace operations apply to your selected offering."
          actions={
            <button
              type="button"
              onClick={() => refreshOfferings(true)}
              disabled={offeringsLoading}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {offeringsLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(240px,420px)_1fr]">
            <select
              value={selectedOfferingId}
              onChange={(event) => setSelectedOfferingId(event.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select offering</option>
              {offerings.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {offering.courseCode} • {offering.term} {offering.year || ''} {offering.section ? `• ${offering.section}` : ''}
                </option>
              ))}
            </select>

            {selectedOffering ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
                <span className="font-semibold text-gray-900">{selectedOffering.courseCode}</span>
                <span className="text-gray-500"> • {selectedOffering.courseName}</span>
                <span className="text-gray-500"> • {selectedOffering.term} {selectedOffering.year || ''}</span>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500">
                {offerings.length === 0
                  ? 'No course offerings available. Create one in the Offerings tab.'
                  : 'Select an offering to unlock roadmap, student, upload, and AI context.'}
              </div>
            )}
          </div>
        </SectionCard>

        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Offerings"
                value={String(offerings.length)}
                hint="Owned by lecturer"
              />
              <MetricCard
                label="Active Roadmaps"
                value={String(activeRoadmapsCount)}
                hint="Approved and activated"
              />
              <MetricCard
                label="Enrolled Students"
                value={String(totalStudents)}
                hint="Across all offerings"
              />
              <MetricCard
                label="Average Progress"
                value={`${averageProgress.toFixed(0)}%`}
                hint={dashboardLoading ? 'Calculating...' : 'Across sampled enrollments'}
              />
            </div>

            <SectionCard title="Quick Actions" description="Jump straight into the core lecturer workflows.">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => goToTab('offerings')}
                  className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Create Offering
                </button>
                <button
                  type="button"
                  onClick={() => goToTab('roadmap')}
                  className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Generate Roadmap
                </button>
                <button
                  type="button"
                  onClick={() => goToTab('uploads')}
                  className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Upload Course Spec
                </button>
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === 'offerings' && (
          <div className="space-y-4">
            <InlineErrorBanner message={createError} />
            {createSuccess && (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {createSuccess}
              </div>
            )}

            <SectionCard
              title="Create Offering"
              description="Lecturers create offerings from existing course records. Students enroll afterwards."
              actions={
                <button
                  type="button"
                  onClick={refreshCourseCatalog}
                  disabled={coursesLoading}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {coursesLoading ? 'Loading Courses...' : 'Refresh Courses'}
                </button>
              }
            >
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                <select
                  value={newOfferingCourseCode}
                  onChange={(event) => setNewOfferingCourseCode(event.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select course</option>
                  {courses.map((course) => (
                    <option key={course.code} value={course.code}>
                      {course.code} • {course.name}
                    </option>
                  ))}
                </select>

                <input
                  value={newOfferingTerm}
                  onChange={(event) => setNewOfferingTerm(event.target.value)}
                  placeholder="Term (e.g., Semester 1, Fall)"
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

                <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={autoGenerateEnrollmentKey}
                    onChange={(event) => setAutoGenerateEnrollmentKey(event.target.checked)}
                  />
                  Auto-generate enrollment key
                </label>

                {!autoGenerateEnrollmentKey && (
                  <input
                    value={customEnrollmentKey}
                    onChange={(event) => setCustomEnrollmentKey(event.target.value)}
                    placeholder="Custom enrollment key"
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                )}

                <button
                  type="button"
                  onClick={createOffering}
                  disabled={createBusy || !newOfferingCourseCode.trim() || !newOfferingTerm.trim()}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {createBusy ? 'Creating...' : 'Create Offering'}
                </button>
              </div>
            </SectionCard>

            <SectionCard title="Your Offerings" description="Offerings you created and currently manage.">
              {offeringsLoading ? (
                <p className="text-sm text-gray-500">Loading offerings...</p>
              ) : offerings.length === 0 ? (
                <p className="text-sm text-gray-500">No course offerings available.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {offerings.map((offering) => (
                    <button
                      key={offering.id}
                      type="button"
                      onClick={() => setSelectedOfferingId(offering.id)}
                      className={`rounded-3xl border p-4 text-left transition ${
                        selectedOfferingId === offering.id
                          ? 'border-blue-200 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold text-gray-900">{offering.courseCode}</p>
                          <p className="text-sm text-gray-500">
                            {offering.term} {offering.year || ''} {offering.section ? `• Section ${offering.section}` : ''}
                          </p>
                          <p className="text-xs text-gray-500">{offering.courseName}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={offering.isActive ? 'approved_active' : 'draft'} />
                          <StatusPill status={activeRoadmapByOffering[offering.id] ? 'approved_active' : 'draft'} />
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-600">
                        Enrolled students: {enrollmentCountByOffering[offering.id] || 0}
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        Roadmap: {activeRoadmapByOffering[offering.id] ? 'Active' : 'Draft / none'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>

            {selectedOffering && (
              <SectionCard title="Offering Detail" description="Open this offering in other workspace modules.">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => goToTab('roadmap')}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Open Roadmap Builder
                  </button>
                  <button
                    type="button"
                    onClick={() => goToTab('students')}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    View Students
                  </button>
                  <button
                    type="button"
                    onClick={() => goToTab('uploads')}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Upload Documents
                  </button>
                  <button
                    type="button"
                    onClick={() => goToTab('assistant')}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Ask AI Assistant
                  </button>
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {activeTab === 'roadmap' && (
          <div className="space-y-4">
            <InlineErrorBanner message={roadmapError} />
            {roadmapNotice && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {roadmapNotice}
              </div>
            )}

            {!selectedOffering ? (
              <SectionCard title="Roadmap Builder" description="Select an offering to begin roadmap design.">
                <p className="text-sm text-gray-500">No offering selected.</p>
              </SectionCard>
            ) : (
              <>
                <SectionCard
                  title="Roadmap Controls"
                  description="Extract a spec, generate draft roadmap, and activate for students."
                  actions={
                    <select
                      value={roadmapFilter}
                      onChange={(event) => setRoadmapFilter(event.target.value as 'all' | 'draft' | 'approved_active')}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700"
                    >
                      <option value="all">All items</option>
                      <option value="draft">Draft items</option>
                      <option value="approved_active">Active items</option>
                    </select>
                  }
                >
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <input
                        type="file"
                        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={(event) => {
                          setSpecSourceFile(event.target.files?.[0] || null);
                          setRoadmapError(null);
                        }}
                      />
                      {specSourceFile ? 'Change document' : 'Choose PDF/DOCX'}
                    </label>
                    <button
                      type="button"
                      onClick={extractSpec}
                      disabled={!specSourceFile || roadmapLoading}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {roadmapLoading ? 'Uploading and extracting...' : 'Extract Spec from Document'}
                    </button>
                    <button
                      type="button"
                      onClick={generateRoadmap}
                      disabled={roadmapLoading}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                      Generate Roadmap
                    </button>
                    <button
                      type="button"
                      onClick={activateRoadmap}
                      disabled={roadmapLoading}
                      className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      Activate Roadmap
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {specSourceFile ? `Selected file: ${specSourceFile.name}` : 'Upload a blueprint document to extract a spec.'}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    <span>Spec ID: {specId || 'None'}</span>
                    <span>•</span>
                    <span>Status: {specStatus || 'Not set'}</span>
                  </div>
                </SectionCard>

                <SectionCard title="Spec JSON Editor" description="Review and edit extracted curriculum spec before approval.">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveSpecEdits}
                      disabled={!specId || roadmapLoading}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Save Spec
                    </button>
                    <button
                      type="button"
                      onClick={approveSpec}
                      disabled={!specId || roadmapLoading}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                      Approve Spec
                    </button>
                  </div>
                  <textarea
                    value={specEditor}
                    onChange={(event) => setSpecEditor(event.target.value)}
                    rows={12}
                    placeholder="Spec JSON appears here"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 font-mono text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
                  />
                </SectionCard>

                <SectionCard title="Add Roadmap Item" description="Define learning milestones for this offering.">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
                    <input
                      value={newItemTitle}
                      onChange={(event) => setNewItemTitle(event.target.value)}
                      placeholder="Title"
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    />
                    <input
                      value={newItemWeekNo}
                      onChange={(event) => setNewItemWeekNo(event.target.value)}
                      placeholder="Week number"
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    />
                    <input
                      value={newItemEstimatedHours}
                      onChange={(event) => setNewItemEstimatedHours(event.target.value)}
                      placeholder="Estimated hours"
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={createRoadmapItem}
                      disabled={!newItemTitle.trim() || roadmapLoading}
                      className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      Add Item
                    </button>
                  </div>
                  <textarea
                    value={newItemDescription}
                    onChange={(event) => setNewItemDescription(event.target.value)}
                    rows={2}
                    placeholder="Description"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </SectionCard>

                <SectionCard title="Roadmap Items" description="Edit items and manage assessment task policies.">
                  {roadmapLoading ? (
                    <p className="text-sm text-gray-500">Loading roadmap...</p>
                  ) : roadmapItems.length === 0 ? (
                    <p className="text-sm text-gray-500">No roadmap items found.</p>
                  ) : (
                    <div className="space-y-4">
                      {roadmapItems.map((item) => {
                        const taskCreateDraft = getTaskCreateDraft(item.id);
                        return (
                          <div key={item.id} className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-[260px] flex-1 space-y-2">
                                <input
                                  value={item.title}
                                  onChange={(event) => {
                                    const next = event.target.value;
                                    setRoadmapItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, title: next } : entry)));
                                  }}
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                />
                                <textarea
                                  value={item.description}
                                  onChange={(event) => {
                                    const next = event.target.value;
                                    setRoadmapItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, description: next } : entry)));
                                  }}
                                  rows={2}
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                />
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <input
                                    value={item.weekNo ?? ''}
                                    onChange={(event) => {
                                      const next = asNumber(event.target.value);
                                      setRoadmapItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, weekNo: next } : entry)));
                                    }}
                                    placeholder="Week"
                                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={item.estimatedHours ?? ''}
                                    onChange={(event) => {
                                      const next = asNumber(event.target.value);
                                      setRoadmapItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, estimatedHours: next } : entry)));
                                    }}
                                    placeholder="Hours"
                                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <StatusPill status={item.status} />
                                <button
                                  type="button"
                                  onClick={() => updateRoadmapItem(item.id, {
                                    title: item.title,
                                    description: item.description || null,
                                    week_no: item.weekNo,
                                    estimated_hours: item.estimatedHours,
                                  })}
                                  className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => archiveRoadmapItem(item.id)}
                                  className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                                >
                                  Archive
                                </button>
                              </div>
                            </div>

                            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Assessment Tasks</p>

                              <div className="mt-3 space-y-3">
                                {item.tasks.length === 0 ? (
                                  <p className="text-sm text-gray-500">No tasks yet.</p>
                                ) : (
                                  item.tasks.map((task, index) => {
                                    const draft = getTaskEditDraft(task);

                                    return (
                                      <div key={task.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                                          <input
                                            value={draft.title}
                                            onChange={(event) => setTaskEditDraftField(task, 'title', event.target.value)}
                                            placeholder="Task title"
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                          />
                                          <input
                                            value={draft.task_type}
                                            onChange={(event) => setTaskEditDraftField(task, 'task_type', event.target.value)}
                                            placeholder="Task type"
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                          />
                                          <input
                                            type="datetime-local"
                                            value={draft.due_at}
                                            onChange={(event) => setTaskEditDraftField(task, 'due_at', event.target.value)}
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                          />
                                          <input
                                            value={draft.max_attempts}
                                            onChange={(event) => setTaskEditDraftField(task, 'max_attempts', event.target.value)}
                                            placeholder="Max attempts"
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                          />
                                          <input
                                            value={draft.late_penalty_percent}
                                            onChange={(event) => setTaskEditDraftField(task, 'late_penalty_percent', event.target.value)}
                                            placeholder="Late penalty %"
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                          />
                                          <input
                                            value={draft.max_score}
                                            onChange={(event) => setTaskEditDraftField(task, 'max_score', event.target.value)}
                                            placeholder="Max score"
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                          />
                                          <input
                                            value={draft.weight}
                                            onChange={(event) => setTaskEditDraftField(task, 'weight', event.target.value)}
                                            placeholder="Weight"
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                          />
                                          <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                                            <input
                                              type="checkbox"
                                              checked={draft.allow_late_submission}
                                              onChange={(event) => setTaskEditDraftField(task, 'allow_late_submission', event.target.checked)}
                                            />
                                            Allow late
                                          </label>
                                        </div>

                                        <textarea
                                          value={draft.description}
                                          onChange={(event) => setTaskEditDraftField(task, 'description', event.target.value)}
                                          rows={2}
                                          placeholder="Task description"
                                          className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                        />

                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => saveTask(task)}
                                            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
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
                                            onClick={() => moveTask(item, task.id, -1)}
                                            disabled={index === 0}
                                            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-700 disabled:opacity-40"
                                          >
                                            Move up
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => moveTask(item, task.id, 1)}
                                            disabled={index === item.tasks.length - 1}
                                            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-700 disabled:opacity-40"
                                          >
                                            Move down
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                              <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Add Task</p>
                                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                                  <input
                                    value={taskCreateDraft.title}
                                    onChange={(event) => setTaskCreateDraftField(item.id, 'title', event.target.value)}
                                    placeholder="Title"
                                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={taskCreateDraft.task_type}
                                    onChange={(event) => setTaskCreateDraftField(item.id, 'task_type', event.target.value)}
                                    placeholder="Type"
                                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                  />
                                  <input
                                    type="datetime-local"
                                    value={taskCreateDraft.due_at}
                                    onChange={(event) => setTaskCreateDraftField(item.id, 'due_at', event.target.value)}
                                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={taskCreateDraft.max_attempts}
                                    onChange={(event) => setTaskCreateDraftField(item.id, 'max_attempts', event.target.value)}
                                    placeholder="Max attempts"
                                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={taskCreateDraft.late_penalty_percent}
                                    onChange={(event) => setTaskCreateDraftField(item.id, 'late_penalty_percent', event.target.value)}
                                    placeholder="Late penalty %"
                                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={taskCreateDraft.max_score}
                                    onChange={(event) => setTaskCreateDraftField(item.id, 'max_score', event.target.value)}
                                    placeholder="Max score"
                                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={taskCreateDraft.weight}
                                    onChange={(event) => setTaskCreateDraftField(item.id, 'weight', event.target.value)}
                                    placeholder="Weight"
                                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                  />
                                  <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                                    <input
                                      type="checkbox"
                                      checked={taskCreateDraft.allow_late_submission}
                                      onChange={(event) => setTaskCreateDraftField(item.id, 'allow_late_submission', event.target.checked)}
                                    />
                                    Allow late
                                  </label>
                                </div>
                                <textarea
                                  value={taskCreateDraft.description}
                                  onChange={(event) => setTaskCreateDraftField(item.id, 'description', event.target.value)}
                                  rows={2}
                                  placeholder="Task description"
                                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => createTask(item.id)}
                                  className="mt-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                                >
                                  Add task
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              </>
            )}
          </div>
        )}

        {activeTab === 'students' && (
          <div className="space-y-4">
            <InlineErrorBanner message={studentsError} />

            {!selectedOffering ? (
              <SectionCard title="Students" description="Select an offering to view student progress.">
                <p className="text-sm text-gray-500">No offering selected.</p>
              </SectionCard>
            ) : (
              <SectionCard
                title="Student Tracking"
                description="Review enrolled learners and their progress in this offering."
                actions={
                  <button
                    type="button"
                    onClick={loadStudents}
                    disabled={studentsLoading}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {studentsLoading ? 'Refreshing...' : 'Refresh'}
                  </button>
                }
              >
                {studentsLoading ? (
                  <p className="text-sm text-gray-500">Loading students...</p>
                ) : studentRows.length === 0 ? (
                  <p className="text-sm text-gray-500">No students found for this offering.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
                    <div className="overflow-x-auto rounded-2xl border border-gray-200">
                      <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Name</th>
                            <th className="px-3 py-2 text-left font-semibold">Progress</th>
                            <th className="px-3 py-2 text-left font-semibold">Avg score</th>
                            <th className="px-3 py-2 text-left font-semibold">Items</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentRows.map((row) => (
                            <tr
                              key={row.enrollmentId}
                              onClick={() => setSelectedStudentEnrollmentId(row.enrollmentId)}
                              className={`cursor-pointer border-t transition ${
                                selectedStudentEnrollmentId === row.enrollmentId
                                  ? 'bg-blue-50'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              <td className="px-3 py-2">
                                <p className="font-semibold text-gray-900">{row.fullName}</p>
                                <p className="text-xs text-gray-500">{row.email || row.enrollmentId}</p>
                              </td>
                              <td className="px-3 py-2">{row.progressPercent.toFixed(0)}%</td>
                              <td className="px-3 py-2">{row.avgScore !== null && row.avgScore !== undefined ? row.avgScore.toFixed(1) : '--'}</td>
                              <td className="px-3 py-2">{row.itemsCompleted}/{row.totalItems}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3">
                      {!selectedStudentRoadmap ? (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                          Select a student to inspect roadmap and attempt history.
                        </div>
                      ) : (
                        selectedStudentRoadmap.items.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold text-gray-900">{item.title}</p>
                              <StatusPill status={item.progress?.status || item.status} />
                            </div>
                            <div className="mt-2">
                              <ProgressBar value={item.progress?.completionPercent || 0} />
                            </div>
                            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <ScoreChip label="Total" value={item.progress?.totalScore} denominator={item.progress?.maxTotalScore} />
                              <ScoreChip label="Average" value={item.progress?.avgScore} />
                              <ScoreChip label="Best" value={item.progress?.bestScore} />
                            </div>

                            <div className="mt-2 space-y-2">
                              {item.tasks.map((task) => (
                                <div key={task.id} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs">
                                  <p className="font-semibold text-gray-800">{task.title}</p>
                                  <p className="text-gray-500">Attempts: {task.results.length}/{task.maxAttempts}</p>
                                  {task.results.length > 0 && (
                                    <p className="text-gray-500">
                                      Latest: #{task.results[task.results.length - 1]?.attemptNo || '-'} • Score{' '}
                                      {task.results[task.results.length - 1]?.score ?? '--'}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </SectionCard>
            )}
          </div>
        )}

        {activeTab === 'uploads' && (
          <div className="space-y-4">
            <InlineErrorBanner message={uploadError} />
            <InlineErrorBanner message={uploadHistoryError} />
            {uploadMessage && (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {uploadMessage}
              </div>
            )}

            <SectionCard title="Upload Documents" description="Upload course specs and source documents for roadmap generation and teaching context.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-600 hover:border-blue-300 hover:bg-blue-50">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                  />
                  {uploadFile ? uploadFile.name : 'Choose document (PDF, DOCX, PPTX)'}
                </label>
                <button
                  type="button"
                  onClick={uploadDocument}
                  disabled={!uploadFile || uploading}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
              {selectedOffering && (
                <p className="mt-2 text-xs text-gray-500">
                  Active offering context: {selectedOffering.courseCode} • {selectedOffering.term} {selectedOffering.year || ''}
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Uploaded Documents"
              description="Latest documents uploaded to lecturer workspace."
              actions={
                <button
                  type="button"
                  onClick={loadUploadHistory}
                  disabled={uploadHistoryLoading}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {uploadHistoryLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              }
            >
              <div className="space-y-2">
                {recentUploads.map((upload) => (
                  <div key={`recent-${upload.id}-${upload.uploadedAt}`} className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                    <p className="font-semibold text-blue-800">{upload.fileName}</p>
                    <p className="text-xs text-blue-700">Document ID: {upload.id} • {new Date(upload.uploadedAt).toLocaleString()}</p>
                  </div>
                ))}

                {uploadHistory.map((upload, index) => (
                  <div key={`history-${upload?.id || index}`} className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    <p className="font-semibold text-gray-900">{upload?.file_name || upload?.name || 'Document'}</p>
                    <p className="text-xs text-gray-500">
                      {upload?.course_code || selectedOffering?.courseCode || 'N/A'}
                      {upload?.uploaded_at ? ` • ${new Date(upload.uploaded_at).toLocaleString()}` : ''}
                    </p>
                  </div>
                ))}

                {!uploadHistoryLoading && recentUploads.length === 0 && uploadHistory.length === 0 && (
                  <p className="text-sm text-gray-500">No uploads yet.</p>
                )}
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === 'assistant' && (
          <LecturerAssistantPanel
            token={token}
            selectedCourseCode={selectedOffering?.courseCode || null}
            selectedOfferingLabel={selectedOffering ? `${selectedOffering.courseCode} • ${selectedOffering.term} ${selectedOffering.year || ''}` : null}
          />
        )}
      </main>
    </div>
  );
}
