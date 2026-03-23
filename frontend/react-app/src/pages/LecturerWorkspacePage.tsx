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
import RoadmapNode, { type RoadmapNodeData } from '../components/lecturer/RoadmapNode';
import SpecVisualEditor, { type VisualSpecState } from '../components/lecturer/SpecVisualEditor';

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
  evidenceUrl?: string | null;
  artifactUrl?: string | null;
  reflectionText?: string | null;
  rubricScores?: Record<string, number> | null;
  submittedAt?: string | null;
  gradedAt?: string | null;
}

interface GradeDraft {
  score: string;
  feedback: string;
  rubric_scores: string;
}

interface RubricRowDraft {
  criterion: string;
  value: string;
}

interface TaskRow {
  id: string;
  title: string;
  description: string;
  taskType: string;
  practicalBrief?: string | null;
  requiredTools?: string | null;
  expectedArtifact?: string | null;
  safetyNotes?: string | null;
  rubricJson?: Record<string, unknown> | null;
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
  practical_brief: string;
  required_tools: string;
  expected_artifact: string;
  safety_notes: string;
  rubric_json: string;
  due_at: string;
  max_attempts: string;
  allow_late_submission: boolean;
  late_penalty_percent: string;
  max_score: string;
  weight: string;
}

type LecturerTab = 'dashboard' | 'offerings' | 'roadmap' | 'students' | 'assessments' | 'uploads' | 'assistant';

const BASE_TABS: Array<{ id: LecturerTab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'offerings', label: 'Offerings' },
  { id: 'roadmap', label: 'Roadmap Builder' },
  { id: 'students', label: 'Students' },
  { id: 'assessments', label: 'Assessments' },
  { id: 'uploads', label: 'Uploads' },
  { id: 'assistant', label: 'AI Assistant' },
];

const defaultTaskDraft = (): TaskDraft => ({
  title: '',
  description: '',
  task_type: 'assignment',
  practical_brief: '',
  required_tools: '',
  expected_artifact: '',
  safety_notes: '',
  rubric_json: '',
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

const TASK_TYPE_OPTIONS = [
  'quiz',
  'assignment',
  'lab',
  'project',
  'case_study',
  'simulation',
  'field_task',
  'reflection',
  'presentation',
  'peer_review',
  'other',
];

const defaultGradeDraft = (): GradeDraft => ({
  score: '',
  feedback: '',
  rubric_scores: '',
});

const parseOptionalJsonObject = (value: string): Record<string, unknown> | null => {
  const raw = value.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Rubric JSON must be a JSON object.');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error('Rubric JSON is invalid. Provide a valid JSON object.');
  }
};

const parseOptionalRubricScores = (value: string): Record<string, number> | null => {
  const raw = value.trim();
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Rubric scores must be valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Rubric scores must be a JSON object.');
  }

  const out: Record<string, number> = {};
  for (const [key, valueEntry] of Object.entries(parsed as Record<string, unknown>)) {
    const numeric = Number(valueEntry);
    if (!Number.isFinite(numeric)) {
      throw new Error(`Rubric score for "${key}" must be numeric.`);
    }
    out[key] = numeric;
  }

  return out;
};

const rubricRowsFromJsonText = (value: string): RubricRowDraft[] => {
  const raw = value.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    return Object.entries(parsed as Record<string, unknown>).map(([criterion, numeric]) => ({
      criterion,
      value: numeric === null || numeric === undefined ? '' : String(numeric),
    }));
  } catch {
    return [];
  }
};

const rubricJsonTextFromRows = (rows: RubricRowDraft[]): string => {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = row.criterion.trim();
    const numeric = Number(row.value);
    if (!key || !Number.isFinite(numeric)) continue;
    out[key] = numeric;
  }
  if (Object.keys(out).length === 0) return '';
  return JSON.stringify(out, null, 2);
};

const setRubricRowField = (
  jsonText: string,
  rowIndex: number,
  field: keyof RubricRowDraft,
  value: string
): string => {
  const rows = rubricRowsFromJsonText(jsonText);
  while (rows.length <= rowIndex) {
    rows.push({ criterion: '', value: '' });
  }
  rows[rowIndex] = {
    ...rows[rowIndex],
    [field]: value,
  };
  return rubricJsonTextFromRows(rows);
};

const addRubricRow = (jsonText: string): string => {
  const rows = rubricRowsFromJsonText(jsonText);
  rows.push({ criterion: `criterion_${rows.length + 1}`, value: '0' });
  return rubricJsonTextFromRows(rows);
};

const removeRubricRow = (jsonText: string, rowIndex: number): string => {
  const rows = rubricRowsFromJsonText(jsonText).filter((_, index) => index !== rowIndex);
  return rubricJsonTextFromRows(rows);
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
  evidenceUrl: raw?.evidence_url || null,
  artifactUrl: raw?.artifact_url || null,
  reflectionText: raw?.reflection_text || null,
  rubricScores: raw?.rubric_scores_json && typeof raw?.rubric_scores_json === 'object' ? raw.rubric_scores_json : null,
  submittedAt: raw?.submitted_at || null,
  gradedAt: raw?.graded_at || null,
});

const normalizeTask = (raw: any): TaskRow => ({
  id: raw?.id?.toString?.() || raw?.task_id?.toString?.() || `${Date.now()}-${Math.random()}`,
  title: raw?.title || raw?.name || 'Untitled task',
  description: raw?.description || '',
  taskType: raw?.task_type || raw?.type || 'assignment',
  practicalBrief: raw?.practical_brief || null,
  requiredTools: raw?.required_tools || null,
  expectedArtifact: raw?.expected_artifact || null,
  safetyNotes: raw?.safety_notes || null,
  rubricJson: raw?.rubric_json && typeof raw?.rubric_json === 'object' ? raw.rubric_json : null,
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
  // The backend GET /offerings/{id}/roadmap returns a flat array — handle both shapes:
  // shape A: flat array   [{ id, title, ... }, ...]          ← backend default
  // shape B: wrapped obj  { items: [...], spec_id: ..., ... } ← extended response
  const rawArray: any[] = Array.isArray(raw) ? raw : [];
  const source = (raw && !Array.isArray(raw) && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  // Gather items from whichever shape is present
  const rawItems: any[] = rawArray.length > 0
    ? rawArray
    : parseRows<any>(source?.items || source?.roadmap_items, ['items', 'roadmap_items']);

  const items = rawItems
    .map(normalizeRoadmapItem)
    .sort((left, right) => {
      // Sort by week_no first (curriculum sequence), then order_index, then title
      const leftKey = left.weekNo ?? left.orderIndex ?? Number.MAX_SAFE_INTEGER;
      const rightKey = right.weekNo ?? right.orderIndex ?? Number.MAX_SAFE_INTEGER;
      if (leftKey !== rightKey) return leftKey - rightKey;
      return left.title.localeCompare(right.title);
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

  // ── Spec editor mode ──────────────────────────────────────────────────────
  type SpecEditorMode = 'visual' | 'json';
  const [specEditorMode, setSpecEditorMode] = useState<SpecEditorMode>('visual');
  const [visualSpec, setVisualSpec] = useState<VisualSpecState>({
    header: { course_name: '', course_code: '', level: '', credit_units: '', prerequisites: '', description: '', rationale: '', aim: '', lectures: '', practicals: '' },
    learning_outcomes: [],
    assessment_plan: [],
  });
  const [specJsonError, setSpecJsonError] = useState<string | null>(null);

  // ── Node canvas state ─────────────────────────────────────────────────────
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [pendingReorder, setPendingReorder] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);
  const [roadmapNotice, setRoadmapNotice] = useState<string | null>(null);
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItemRow[]>([]);
  const [specId, setSpecId] = useState<string | null>(null);
  const [specStatus, setSpecStatus] = useState<string | null>(null);
  const [specSourceFile, setSpecSourceFile] = useState<File | null>(null);
  const [specEditor, setSpecEditor] = useState('');

  // Sync visualSpec whenever specEditor changes (e.g. after spec extraction or initial load)
  useEffect(() => {
    if (!specEditor.trim()) return;
    try {
      const parsed = JSON.parse(specEditor);
      const h = parsed?.course_header || {};
      setVisualSpec({
        header: {
          course_name: h.course_name || '',
          course_code: h.course_code || '',
          level: h.level || '',
          credit_units: h.credit_units != null ? String(h.credit_units) : '',
          prerequisites: Array.isArray(h.prerequisites)
            ? h.prerequisites.join(', ')
            : (h.prerequisites || ''),
          description: h.description || '',
          rationale: h.rationale || '',
          aim: h.aim || '',
          lectures: h.contact_hours?.lectures != null ? String(h.contact_hours.lectures) : '',
          practicals: h.contact_hours?.practicals != null ? String(h.contact_hours.practicals) : '',
        },
        learning_outcomes: Array.isArray(parsed?.learning_outcomes) ? parsed.learning_outcomes : [],
        assessment_plan: Array.isArray(parsed?.assessment_plan) ? parsed.assessment_plan : [],
      });
      setSpecJsonError(null);
    } catch {
      // Invalid JSON — don't wipe visual spec, just show the error on JSON tab
      setSpecJsonError('Invalid JSON — fix in JSON Editor before saving');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specEditor]);

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
  const [assessmentStatusFilter, setAssessmentStatusFilter] = useState<'all' | 'submitted' | 'graded' | 'in_progress' | 'not_started'>('submitted');
  const [gradingByAttempt, setGradingByAttempt] = useState<Record<string, boolean>>({});
  const [gradeDraftByAttempt, setGradeDraftByAttempt] = useState<Record<string, GradeDraft>>({});

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

  const selectedStudentSummary = selectedStudentEnrollmentId
    ? studentRows.find((row) => row.enrollmentId === selectedStudentEnrollmentId) || null
    : null;

  const pendingAssessmentCount = useMemo(() => {
    let count = 0;
    for (const roadmap of Object.values(studentRoadmapByEnrollment)) {
      for (const item of roadmap.items || []) {
        for (const task of item.tasks || []) {
          for (const attempt of task.results || []) {
            if ((attempt.status || '').toLowerCase() === 'submitted') {
              count += 1;
            }
          }
        }
      }
    }
    return count;
  }, [studentRoadmapByEnrollment]);

  const tabsForRender = useMemo(
    () =>
      BASE_TABS.map((tab) => {
        if (tab.id !== 'assessments') return tab;
        return {
          ...tab,
          label: pendingAssessmentCount > 0 ? `Assessments (${pendingAssessmentCount})` : 'Assessments',
        };
      }),
    [pendingAssessmentCount]
  );

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

  const loadRoadmap = async (filterOverride?: 'all' | 'draft' | 'approved_active') => {
    if (!token || !selectedOfferingId) {
      setRoadmapItems([]);
      return;
    }

    setRoadmapLoading(true);
    setRoadmapError(null);

    try {
      // Always fetch ALL items for the canvas (filter is only for display toggle, not data fetch)
      const [response, currentSpec] = await Promise.all([
        roadmapAdminApi.listRoadmap(token, selectedOfferingId, filterOverride ?? 'all'),
        roadmapAdminApi.getCurrentSpec(token, selectedOfferingId).catch(() => null),
      ]);

      const parsed = parseRoadmap(response);
      setRoadmapItems(parsed.items);

      // Populate spec info — always update when spec changes (keyed by specId, not editor content)
      if (currentSpec) {
        const newSpecId = currentSpec.id?.toString() || null;
        setSpecId(newSpecId);
        setSpecStatus(currentSpec.status || null);
        if (currentSpec.spec_json) {
          setSpecEditor(JSON.stringify(currentSpec.spec_json, null, 2));
        }
      } else {
        setSpecId(parsed.specId || null);
        setSpecStatus(parsed.specStatus || null);
        if (parsed.specJson) {
          setSpecEditor(JSON.stringify(parsed.specJson, null, 2));
        }
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
    if (!token || !specId || !selectedOfferingId) return;

    setRoadmapLoading(true);
    setRoadmapError(null);
    try {
      await roadmapAdminApi.approveSpec(token, specId);
      setSpecStatus('approved_active');
      setRoadmapNotice('Spec approved. Generating roadmap…');

      // Auto-generate roadmap immediately after approval
      await roadmapAdminApi.generateRoadmap(token, selectedOfferingId);
      setRoadmapNotice('Spec approved ✓  Roadmap generated ✓');

      await loadRoadmap();
      await refreshOfferings(false);
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to approve spec or generate roadmap.');
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

    let rubricJson: Record<string, unknown> | null = null;
    try {
      rubricJson = parseOptionalJsonObject(draft.rubric_json);
    } catch (error: any) {
      setRoadmapError(error?.message || 'Rubric JSON is invalid.');
      return;
    }

    try {
      await roadmapAdminApi.createTask(token, itemId, {
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        task_type: draft.task_type || undefined,
        practical_brief: draft.practical_brief.trim() || undefined,
        required_tools: draft.required_tools.trim() || undefined,
        expected_artifact: draft.expected_artifact.trim() || undefined,
        safety_notes: draft.safety_notes.trim() || undefined,
        rubric_json: rubricJson || undefined,
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
      practical_brief: task.practicalBrief || '',
      required_tools: task.requiredTools || '',
      expected_artifact: task.expectedArtifact || '',
      safety_notes: task.safetyNotes || '',
      rubric_json: task.rubricJson ? JSON.stringify(task.rubricJson, null, 2) : '',
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

    let rubricJson: Record<string, unknown> | null = null;
    try {
      rubricJson = parseOptionalJsonObject(draft.rubric_json);
    } catch (error: any) {
      setRoadmapError(error?.message || 'Rubric JSON is invalid.');
      return;
    }

    try {
      await roadmapAdminApi.updateTask(token, task.id, {
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        task_type: draft.task_type || undefined,
        practical_brief: draft.practical_brief.trim() || undefined,
        required_tools: draft.required_tools.trim() || undefined,
        expected_artifact: draft.expected_artifact.trim() || undefined,
        safety_notes: draft.safety_notes.trim() || undefined,
        rubric_json: rubricJson || undefined,
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
    if (activeTab !== 'students' && activeTab !== 'assessments') return;
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedOfferingId]);

  const attemptKey = (enrollmentId: string, taskId: string, attemptNo?: number) =>
    `${enrollmentId}:${taskId}:${attemptNo ?? 0}`;

  const getGradeDraft = (enrollmentId: string, taskId: string, attempt: TaskResultRow): GradeDraft => {
    const key = attemptKey(enrollmentId, taskId, attempt.attemptNo);
    const existing = gradeDraftByAttempt[key];
    if (existing) return existing;

    return {
      score: attempt.score !== null && attempt.score !== undefined ? String(attempt.score) : '',
      feedback: attempt.feedback || '',
      rubric_scores: attempt.rubricScores ? JSON.stringify(attempt.rubricScores, null, 2) : '',
    };
  };

  const setGradeDraftField = <K extends keyof GradeDraft>(
    enrollmentId: string,
    taskId: string,
    attemptNo: number | undefined,
    field: K,
    value: GradeDraft[K]
  ) => {
    const key = attemptKey(enrollmentId, taskId, attemptNo);
    const current = gradeDraftByAttempt[key] || defaultGradeDraft();
    setGradeDraftByAttempt((prev) => ({
      ...prev,
      [key]: {
        ...current,
        [field]: value,
      },
    }));
  };

  const gradeAttempt = async (
    enrollmentId: string,
    taskId: string,
    attempt: TaskResultRow
  ) => {
    if (!token || attempt.attemptNo === undefined || attempt.attemptNo === null) return;

    const key = attemptKey(enrollmentId, taskId, attempt.attemptNo);
    const draft = getGradeDraft(enrollmentId, taskId, attempt);
    const score = asNumber(draft.score);
    if (score === null) {
      setStudentsError('Score is required and must be numeric.');
      return;
    }

    let rubricScores: Record<string, number> | null = null;
    try {
      rubricScores = parseOptionalRubricScores(draft.rubric_scores);
    } catch (error: any) {
      setStudentsError(error?.message || 'Rubric scores are invalid.');
      return;
    }

    setGradingByAttempt((prev) => ({ ...prev, [key]: true }));
    setStudentsError(null);

    try {
      await progressApi.gradeAttempt(token, enrollmentId, taskId, attempt.attemptNo, {
        score,
        feedback: draft.feedback.trim() || undefined,
        rubric_scores: rubricScores || undefined,
      });
      await loadStudents();
    } catch (requestError: any) {
      setStudentsError(requestError?.message || 'Failed to grade attempt.');
    } finally {
      setGradingByAttempt((prev) => ({ ...prev, [key]: false }));
    }
  };

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

        <WorkspaceTabs tabs={tabsForRender} activeTab={activeTab} onChange={(tab) => setActiveTab(tab as LecturerTab)} />

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

        {activeTab === 'roadmap' && (() => {
          // ── helpers (inline, no new state needed) ────────────────────────────
          const buildVisualSpec = (jsonStr: string): VisualSpecState => {
            try {
              const parsed = JSON.parse(jsonStr);
              const h = parsed?.course_header || {};
              return {
                header: {
                  course_name: h.course_name || '',
                  course_code: h.course_code || '',
                  level: h.level || '',
                  credit_units: h.credit_units != null ? String(h.credit_units) : '',
                  prerequisites: Array.isArray(h.prerequisites) ? h.prerequisites.join(', ') : (h.prerequisites || ''),
                  description: h.description || '',
                  rationale: h.rationale || '',
                  aim: h.aim || '',
                  lectures: h.contact_hours?.lectures != null ? String(h.contact_hours.lectures) : '',
                  practicals: h.contact_hours?.practicals != null ? String(h.contact_hours.practicals) : '',
                },
                learning_outcomes: Array.isArray(parsed?.learning_outcomes) ? parsed.learning_outcomes : [],
                assessment_plan: Array.isArray(parsed?.assessment_plan) ? parsed.assessment_plan : [],
              };
            } catch {
              return visualSpec;
            }
          };

          const syncVisualToJson = (vs: VisualSpecState) => {
            try {
              const current = specEditor ? JSON.parse(specEditor) : {};
              const next = {
                ...current,
                course_header: {
                  ...(current.course_header || {}),
                  course_name: vs.header.course_name,
                  course_code: vs.header.course_code,
                  level: vs.header.level,
                  credit_units: vs.header.credit_units ? Number(vs.header.credit_units) : null,
                  prerequisites: vs.header.prerequisites.split(',').map((s: string) => s.trim()).filter(Boolean),
                  description: vs.header.description,
                  rationale: vs.header.rationale,
                  aim: vs.header.aim,
                  contact_hours: {
                    lectures: vs.header.lectures ? Number(vs.header.lectures) : null,
                    practicals: vs.header.practicals ? Number(vs.header.practicals) : null,
                    total: (vs.header.lectures ? Number(vs.header.lectures) : 0) + (vs.header.practicals ? Number(vs.header.practicals) : 0) || null,
                  },
                },
                learning_outcomes: vs.learning_outcomes,
                assessment_plan: vs.assessment_plan,
              };
              setSpecEditor(JSON.stringify(next, null, 2));
              setSpecJsonError(null);
            } catch {
              // keep existing JSON
            }
          };

          const handleReorder = (fromId: string, toId: string) => {
            if (fromId === toId) return;
            setRoadmapItems((prev) => {
              const arr = [...prev];
              const fromIdx = arr.findIndex((i) => i.id === fromId);
              const toIdx = arr.findIndex((i) => i.id === toId);
              if (fromIdx < 0 || toIdx < 0) return prev;
              const [moved] = arr.splice(fromIdx, 1);
              arr.splice(toIdx, 0, moved);
              return arr.map((item, idx) => ({ ...item, orderIndex: idx + 1, weekNo: item.weekNo != null ? idx + 1 : null }));
            });
            setPendingReorder(true);
            setDragId(null);
            setDropId(null);
          };

          const confirmStructure = async () => {
            setConfirmBusy(true);
            setConfirmError(null);
            try {
              await Promise.allSettled(
                roadmapItems.map((item, idx) =>
                  updateRoadmapItem(item.id, {
                    title: item.title,
                    description: item.description || null,
                    week_no: item.weekNo,
                    estimated_hours: item.estimatedHours,
                    sequence_no: idx + 1,
                  })
                )
              );
              setPendingReorder(false);
            } catch (e: any) {
              setConfirmError(e?.message || 'Failed to confirm structure.');
            } finally {
              setConfirmBusy(false);
            }
          };

          // Build node data from roadmapItems — apply filter client-side (API always fetches all)
          const filteredItems = roadmapFilter === 'all'
            ? roadmapItems
            : roadmapItems.filter((item) => item.status === roadmapFilter);

          const nodes: RoadmapNodeData[] = filteredItems.map((item, idx) => ({
            id: item.id,
            sequenceNo: (item.orderIndex ?? idx + 1),
            weekNo: item.weekNo ?? null,          // coerce undefined → null
            title: item.title,
            status: item.status,
            taskCount: item.tasks.length,
            estimatedHours: item.estimatedHours ?? null,
          }));

          const selectedItem = roadmapItems.find((i) => i.id === selectedItemId) || null;

          return (
            <div className="flex gap-4">
              {/* ── MAIN COLUMN ────────────────────────────────────────────── */}
              <div className="min-w-0 flex-1 space-y-4">
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
                    {/* ── PIPELINE CONTROLS ──────────────────────────────── */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h2 className="text-base font-bold text-slate-800">Roadmap Builder</h2>
                          <p className="text-xs text-slate-500">{selectedOffering.courseName} · {selectedOffering.term} {selectedOffering.year}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {specStatus && (
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              specStatus === 'approved_active' ? 'bg-emerald-100 text-emerald-700' :
                              specStatus === 'lecturer_review' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              Spec: {specStatus?.replace(/_/g, ' ')}
                            </span>
                          )}
                          <select
                            value={roadmapFilter}
                            onChange={(e) => setRoadmapFilter(e.target.value as 'all' | 'draft' | 'approved_active')}
                            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700"
                          >
                            <option value="all">All items</option>
                            <option value="draft">Draft only</option>
                            <option value="approved_active">Active only</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => { setSpecSourceFile(e.target.files?.[0] || null); setRoadmapError(null); }} />
                          {specSourceFile ? specSourceFile.name : 'Choose PDF / DOCX'}
                        </label>

                        <button type="button" onClick={extractSpec} disabled={!specSourceFile || roadmapLoading}
                          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                          {roadmapLoading ? 'Extracting…' : 'Extract Spec'}
                        </button>

                        <button type="button" onClick={generateRoadmap} disabled={roadmapLoading}
                          className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                          Generate Roadmap
                        </button>

                        <button type="button" onClick={activateRoadmap} disabled={roadmapLoading}
                          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          Activate Roadmap
                        </button>
                      </div>
                    </div>

                    {/* ── SPEC EDITOR (tabbed) ────────────────────────────── */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                      {/* Tab header */}
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 pt-3">
                        <div className="flex gap-0">
                          {(['visual', 'json'] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                if (mode === 'json' && specEditorMode === 'visual') {
                                  syncVisualToJson(visualSpec);
                                }
                                if (mode === 'visual' && specEditorMode === 'json') {
                                  const parsed = buildVisualSpec(specEditor);
                                  setVisualSpec(parsed);
                                  try { JSON.parse(specEditor); setSpecJsonError(null); } catch { setSpecJsonError('Invalid JSON'); }
                                }
                                setSpecEditorMode(mode);
                              }}
                              className={`rounded-t-xl px-4 py-2 text-sm font-semibold transition border-b-2 ${
                                specEditorMode === mode
                                  ? 'border-blue-500 text-blue-700 bg-blue-50'
                                  : 'border-transparent text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              {mode === 'visual' ? '✏️ Visual Editor' : '{ } JSON Editor'}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 pb-2">
                          <button type="button" onClick={saveSpecEdits} disabled={!specId || roadmapLoading}
                            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition">
                            💾 Save Spec
                          </button>
                          <button type="button" onClick={approveSpec} disabled={!specId || roadmapLoading || specStatus === 'approved_active'}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition">
                            ✅ Approve Spec
                          </button>
                        </div>
                      </div>

                      {/* Tab body */}
                      <div className="p-4">
                        {!specId && !specEditor && (
                          <p className="text-sm text-slate-400 italic">No spec loaded yet. Upload a document and click "Extract Spec" to get started.</p>
                        )}

                        {specEditorMode === 'visual' && (specId || specEditor) && (
                          <SpecVisualEditor
                            spec={visualSpec}
                            onChange={(next) => {
                              setVisualSpec(next);
                              syncVisualToJson(next);
                            }}
                          />
                        )}

                        {specEditorMode === 'json' && (
                          <>
                            {specJsonError && (
                              <p className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                                ⚠ {specJsonError}
                              </p>
                            )}
                            <textarea
                              value={specEditor}
                              onChange={(e) => {
                                setSpecEditor(e.target.value);
                                try { JSON.parse(e.target.value); setSpecJsonError(null); } catch { setSpecJsonError('Invalid JSON — fix before saving'); }
                              }}
                              rows={16}
                              placeholder="Spec JSON appears here after extraction…"
                              className={`w-full rounded-xl border bg-slate-50 px-3 py-3 font-mono text-xs text-slate-800 focus:outline-none focus:ring-1 transition ${
                                specJsonError ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 focus:border-blue-400 focus:ring-blue-400'
                              }`}
                            />
                            <button type="button"
                              onClick={() => { try { setSpecEditor(JSON.stringify(JSON.parse(specEditor), null, 2)); setSpecJsonError(null); } catch { setSpecJsonError('Cannot format — invalid JSON'); } }}
                              className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                              Format JSON
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* ── NODE CANVAS ─────────────────────────────────────── */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">Curriculum Roadmap</h3>
                          <p className="text-xs text-slate-500">
                            {nodes.length > 0 ? `${nodes.length} weeks · Drag to reorder` : 'Generate the roadmap to see nodes here'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {pendingReorder && (
                            <>
                              {confirmError && <span className="text-xs text-red-500">{confirmError}</span>}
                              <button type="button" onClick={confirmStructure} disabled={confirmBusy}
                                className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition animate-pulse">
                                {confirmBusy ? 'Saving…' : '✓ Confirm Structure'}
                              </button>
                              <button type="button" onClick={() => { loadRoadmap(); setPendingReorder(false); }}
                                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition">
                                Discard
                              </button>
                            </>
                          )}
                          {/* Add week button */}
                          <button type="button"
                            onClick={() => {
                              const nextWeek = nodes.length + 1;
                              setNewItemTitle(`Week ${nextWeek}`);
                              setNewItemWeekNo(String(nextWeek));
                              // scroll to add-item form
                              document.getElementById('add-roadmap-item-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition">
                            + Add Week
                          </button>
                        </div>
                      </div>

                      <div className="p-4">
                        {roadmapLoading ? (
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                            Loading roadmap…
                          </div>
                        ) : nodes.length === 0 ? (
                          <div className="flex flex-col items-center gap-3 py-10 text-center">
                            <div className="text-4xl">🗺️</div>
                            <p className="text-sm font-semibold text-slate-600">No roadmap items yet</p>
                            <p className="text-xs text-slate-400">Approve your spec and click "Generate Roadmap" to create the curriculum structure.</p>
                          </div>
                        ) : (
                          <>
                            {/* Horizontal scrollable node row with connectors */}
                            <div className="overflow-x-auto pb-2">
                              <div className="flex items-start gap-0 min-w-max">
                                {nodes.map((node, idx) => (
                                  <div key={node.id} className="flex items-center">
                                    <RoadmapNode
                                      node={node}
                                      isSelected={selectedItemId === node.id}
                                      isDragging={dragId === node.id}
                                      isDropTarget={dropId === node.id && dragId !== node.id}
                                      onSelect={(id) => setSelectedItemId((prev) => (prev === id ? null : id))}
                                      onDragStart={(e, id) => { e.dataTransfer.effectAllowed = 'move'; setDragId(id); }}
                                      onDragOver={(e, id) => { e.preventDefault(); setDropId(id); }}
                                      onDragLeave={() => setDropId(null)}
                                      onDrop={(e, targetId) => { e.preventDefault(); if (dragId) handleReorder(dragId, targetId); }}
                                    />
                                    {idx < nodes.length - 1 && (
                                      <div className="flex h-full w-6 flex-none items-center justify-center">
                                        <svg className="h-4 w-6 text-slate-300" viewBox="0 0 24 16" fill="none">
                                          <path d="M0 8 H18 M14 3 L22 8 L14 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <p className="mt-2 text-center text-xs text-slate-400">Click a node to edit · Drag to reorder</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* ── ADD ITEM FORM ───────────────────────────────────── */}
                    <div id="add-roadmap-item-form" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <h3 className="mb-3 text-sm font-bold text-slate-800">Add Week / Roadmap Item</h3>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
                        <input value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} placeholder="Title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                        <input value={newItemWeekNo} onChange={(e) => setNewItemWeekNo(e.target.value)} placeholder="Week number" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                        <input value={newItemEstimatedHours} onChange={(e) => setNewItemEstimatedHours(e.target.value)} placeholder="Estimated hours" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                        <button type="button" onClick={createRoadmapItem} disabled={!newItemTitle.trim() || roadmapLoading}
                          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition">
                          Add Item
                        </button>
                      </div>
                      <textarea value={newItemDescription} onChange={(e) => setNewItemDescription(e.target.value)} rows={2} placeholder="Description (optional)" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    </div>
                  </>
                )}
              </div>

              {/* ── SIDE PANEL: item editor ──────────────────────────────── */}
              {selectedItem && (
                <div className="w-96 flex-none">
                  <div className="sticky top-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <h3 className="text-sm font-bold text-slate-800">Edit Week {selectedItem.weekNo ?? (roadmapItems.findIndex((i) => i.id === selectedItem.id) + 1)}</h3>
                      <button type="button" onClick={() => setSelectedItemId(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>

                    <div className="max-h-[80vh] overflow-y-auto p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Title</label>
                        <input
                          value={selectedItem.title}
                          onChange={(e) => {
                            const next = e.target.value;
                            setRoadmapItems((prev) => prev.map((entry) => entry.id === selectedItem.id ? { ...entry, title: next } : entry));
                          }}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Description</label>
                        <textarea
                          value={selectedItem.description}
                          onChange={(e) => {
                            const next = e.target.value;
                            setRoadmapItems((prev) => prev.map((entry) => entry.id === selectedItem.id ? { ...entry, description: next } : entry));
                          }}
                          rows={3}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Week No.</label>
                          <input type="number" value={selectedItem.weekNo ?? ''}
                            onChange={(e) => { const next = asNumber(e.target.value); setRoadmapItems((prev) => prev.map((entry) => entry.id === selectedItem.id ? { ...entry, weekNo: next } : entry)); }}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Est. Hours</label>
                          <input type="number" value={selectedItem.estimatedHours ?? ''}
                            onChange={(e) => { const next = asNumber(e.target.value); setRoadmapItems((prev) => prev.map((entry) => entry.id === selectedItem.id ? { ...entry, estimatedHours: next } : entry)); }}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button type="button"
                          onClick={() => updateRoadmapItem(selectedItem.id, { title: selectedItem.title, description: selectedItem.description || null, week_no: selectedItem.weekNo, estimated_hours: selectedItem.estimatedHours })}
                          className="flex-1 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-500 transition">
                          Save Changes
                        </button>
                        <button type="button"
                          onClick={() => { archiveRoadmapItem(selectedItem.id); setSelectedItemId(null); }}
                          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition">
                          Archive
                        </button>
                      </div>

                      {/* Tasks section */}
                      <div className="border-t border-slate-100 pt-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Assessment Tasks ({selectedItem.tasks.length})</p>
                        {selectedItem.tasks.length === 0 && <p className="text-xs text-slate-400 italic">No tasks yet.</p>}
                        {selectedItem.tasks.map((task, taskIdx) => {
                          const draft = getTaskEditDraft(task);
                          return (
                            <div key={task.id} className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-700">{task.title}</span>
                                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{task.taskType}</span>
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-1">
                                <input value={draft.title} onChange={(e) => setTaskEditDraftField(task, 'title', e.target.value)} placeholder="Title" className="rounded-lg border border-slate-200 px-2 py-1 text-xs" />
                                <select value={draft.task_type} onChange={(e) => setTaskEditDraftField(task, 'task_type', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
                                  {TASK_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <input value={draft.max_score} onChange={(e) => setTaskEditDraftField(task, 'max_score', e.target.value)} placeholder="Max score" className="rounded-lg border border-slate-200 px-2 py-1 text-xs" />
                                <input value={draft.weight} onChange={(e) => setTaskEditDraftField(task, 'weight', e.target.value)} placeholder="Weight" className="rounded-lg border border-slate-200 px-2 py-1 text-xs" />
                              </div>
                              <textarea value={draft.description} onChange={(e) => setTaskEditDraftField(task, 'description', e.target.value)} rows={2} placeholder="Description" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" />
                              <div className="mt-1.5 flex gap-1">
                                <button type="button" onClick={() => saveTask(task)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100">Save</button>
                                <button type="button" onClick={() => deactivateTask(task.id)} className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50">Remove</button>
                                <button type="button" onClick={() => moveTask(selectedItem, task.id, -1)} disabled={taskIdx === 0} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-500 disabled:opacity-40">↑</button>
                                <button type="button" onClick={() => moveTask(selectedItem, task.id, 1)} disabled={taskIdx === selectedItem.tasks.length - 1} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-500 disabled:opacity-40">↓</button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Add task mini form */}
                        {(() => {
                          const taskCreateDraft = getTaskCreateDraft(selectedItem.id);
                          return (
                            <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2">
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Add Task</p>
                              <div className="grid grid-cols-2 gap-1">
                                <input value={taskCreateDraft.title} onChange={(e) => setTaskCreateDraftField(selectedItem.id, 'title', e.target.value)} placeholder="Title" className="col-span-2 rounded-lg border border-slate-200 px-2 py-1 text-xs" />
                                <select value={taskCreateDraft.task_type} onChange={(e) => setTaskCreateDraftField(selectedItem.id, 'task_type', e.target.value)} className="col-span-2 rounded-lg border border-slate-200 px-2 py-1 text-xs">
                                  {TASK_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <input value={taskCreateDraft.max_score} onChange={(e) => setTaskCreateDraftField(selectedItem.id, 'max_score', e.target.value)} placeholder="Max score" className="rounded-lg border border-slate-200 px-2 py-1 text-xs" />
                                <input value={taskCreateDraft.weight} onChange={(e) => setTaskCreateDraftField(selectedItem.id, 'weight', e.target.value)} placeholder="Weight" className="rounded-lg border border-slate-200 px-2 py-1 text-xs" />
                              </div>
                              <textarea value={taskCreateDraft.description} onChange={(e) => setTaskCreateDraftField(selectedItem.id, 'description', e.target.value)} rows={2} placeholder="Description" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" />
                              <button type="button" onClick={() => createTask(selectedItem.id)} className="mt-1.5 w-full rounded-xl bg-blue-600 py-1.5 text-[10px] font-bold text-white hover:bg-blue-500">
                                Add Task
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-semibold text-gray-800">{task.title}</p>
                                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">
                                      {task.taskType}
                                    </span>
                                  </div>
                                  <p className="text-gray-500">Attempts: {task.results.length}/{task.maxAttempts}</p>
                                  {task.results.length > 0 ? (
                                    <p className="text-gray-500">
                                      Latest: #{task.results[task.results.length - 1]?.attemptNo || '-'} • Score {task.results[task.results.length - 1]?.score ?? '--'}
                                    </p>
                                  ) : (
                                    <p className="text-gray-500">No attempts submitted yet.</p>
                                  )}
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => goToTab('assessments')}
                              className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Open Assessments Tab
                            </button>
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

        {activeTab === 'assessments' && (
          <div className="space-y-4">
            <InlineErrorBanner message={studentsError} />

            {!selectedOffering ? (
              <SectionCard title="Assessments" description="Select an offering to grade student attempts.">
                <p className="text-sm text-gray-500">No offering selected.</p>
              </SectionCard>
            ) : (
              <SectionCard
                title="Assessment & Grading"
                description="Lecturer grading workspace for practical and theory tasks."
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={assessmentStatusFilter}
                      onChange={(event) => setAssessmentStatusFilter(event.target.value as 'all' | 'submitted' | 'graded' | 'in_progress' | 'not_started')}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700"
                    >
                      <option value="submitted">Submitted</option>
                      <option value="all">All statuses</option>
                      <option value="graded">Graded</option>
                      <option value="in_progress">In progress</option>
                      <option value="not_started">Not started</option>
                    </select>
                    <button
                      type="button"
                      onClick={loadStudents}
                      disabled={studentsLoading}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {studentsLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>
                }
              >
                {studentsLoading ? (
                  <p className="text-sm text-gray-500">Loading assessment data...</p>
                ) : studentRows.length === 0 ? (
                  <p className="text-sm text-gray-500">No students found for this offering.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1.3fr]">
                    <div className="overflow-x-auto rounded-2xl border border-gray-200">
                      <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Student</th>
                            <th className="px-3 py-2 text-left font-semibold">Progress</th>
                            <th className="px-3 py-2 text-left font-semibold">Avg score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentRows.map((row) => (
                            <tr
                              key={`assessment-${row.enrollmentId}`}
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
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3">
                      {!selectedStudentRoadmap ? (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                          Select a student to view submitted attempts.
                        </div>
                      ) : (
                        <>
                          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                            <p className="font-semibold text-gray-900">{selectedStudentSummary?.fullName || 'Selected student'}</p>
                            <p className="text-xs text-gray-500">Enrollment: {selectedStudentEnrollmentId}</p>
                          </div>

                          {selectedStudentRoadmap.items.map((item) => (
                            <div key={`assess-item-${item.id}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-semibold text-gray-900">{item.title}</p>
                                <StatusPill status={item.progress?.status || item.status} />
                              </div>

                              <div className="mt-2 space-y-2">
                                {item.tasks.map((task) => {
                                  const attempts = task.results.filter((attempt) => {
                                    if (assessmentStatusFilter === 'all') return true;
                                    return (attempt.status || '').toLowerCase() === assessmentStatusFilter;
                                  });

                                  if (attempts.length === 0) return null;

                                  return (
                                    <div key={`assess-task-${task.id}`} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="font-semibold text-gray-800">{task.title}</p>
                                        <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">
                                          {task.taskType}
                                        </span>
                                      </div>

                                      <div className="mt-2 space-y-2">
                                        {attempts.map((attempt) => {
                                          const key = attemptKey(selectedStudentEnrollmentId, task.id, attempt.attemptNo);
                                          const draft = getGradeDraft(selectedStudentEnrollmentId, task.id, attempt);
                                          const isBusy = Boolean(gradingByAttempt[key]);

                                          return (
                                            <div key={attempt.id || key} className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                                              <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="font-medium text-gray-700">Attempt #{attempt.attemptNo || '-'}</p>
                                                <StatusPill status={attempt.status || 'not_started'} />
                                              </div>
                                              <p className="mt-1 text-gray-500">
                                                Submitted: {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'Not submitted'}
                                              </p>
                                              <p className="text-gray-500">Current score: {attempt.score ?? '--'}</p>
                                              {attempt.evidenceUrl && (
                                                <a className="text-blue-600 underline" href={attempt.evidenceUrl} target="_blank" rel="noreferrer">
                                                  Evidence
                                                </a>
                                              )}
                                              {attempt.artifactUrl && (
                                                <a className="ml-2 text-blue-600 underline" href={attempt.artifactUrl} target="_blank" rel="noreferrer">
                                                  Artifact
                                                </a>
                                              )}
                                              {attempt.reflectionText && (
                                                <p className="mt-1 whitespace-pre-wrap text-gray-600">Reflection: {attempt.reflectionText}</p>
                                              )}

                                              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                                                <input
                                                  value={draft.score}
                                                  onChange={(event) => setGradeDraftField(selectedStudentEnrollmentId, task.id, attempt.attemptNo, 'score', event.target.value)}
                                                  placeholder="Score"
                                                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
                                                />
                                                <textarea
                                                  value={draft.feedback}
                                                  onChange={(event) => setGradeDraftField(selectedStudentEnrollmentId, task.id, attempt.attemptNo, 'feedback', event.target.value)}
                                                  rows={2}
                                                  placeholder="Feedback"
                                                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs md:col-span-2"
                                                />
                                              </div>

                                              <textarea
                                                value={draft.rubric_scores}
                                                onChange={(event) => setGradeDraftField(selectedStudentEnrollmentId, task.id, attempt.attemptNo, 'rubric_scores', event.target.value)}
                                                rows={2}
                                                placeholder='Rubric scores JSON, e.g. {"correctness": 34, "process": 27}'
                                                className="mt-2 w-full rounded-lg border border-gray-200 px-2 py-1 text-xs font-mono"
                                              />

                                              {(() => {
                                                const rubricRows = rubricRowsFromJsonText(draft.rubric_scores);
                                                return (
                                                  <div className="mt-2 rounded-lg border border-gray-200 bg-white p-2">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Rubric Scores Builder</p>
                                                    <div className="mt-2 space-y-2">
                                                      {rubricRows.map((row, rubricIndex) => (
                                                        <div
                                                          key={`grade-rubric-${selectedStudentEnrollmentId}-${task.id}-${attempt.attemptNo}-${rubricIndex}`}
                                                          className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_auto]"
                                                        >
                                                          <input
                                                            value={row.criterion}
                                                            onChange={(event) =>
                                                              setGradeDraftField(
                                                                selectedStudentEnrollmentId,
                                                                task.id,
                                                                attempt.attemptNo,
                                                                'rubric_scores',
                                                                setRubricRowField(draft.rubric_scores, rubricIndex, 'criterion', event.target.value)
                                                              )
                                                            }
                                                            placeholder="Criterion"
                                                            className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
                                                          />
                                                          <input
                                                            value={row.value}
                                                            onChange={(event) =>
                                                              setGradeDraftField(
                                                                selectedStudentEnrollmentId,
                                                                task.id,
                                                                attempt.attemptNo,
                                                                'rubric_scores',
                                                                setRubricRowField(draft.rubric_scores, rubricIndex, 'value', event.target.value)
                                                              )
                                                            }
                                                            placeholder="Score"
                                                            className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
                                                          />
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              setGradeDraftField(
                                                                selectedStudentEnrollmentId,
                                                                task.id,
                                                                attempt.attemptNo,
                                                                'rubric_scores',
                                                                removeRubricRow(draft.rubric_scores, rubricIndex)
                                                              )
                                                            }
                                                            className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                                                          >
                                                            Remove
                                                          </button>
                                                        </div>
                                                      ))}
                                                    </div>
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        setGradeDraftField(
                                                          selectedStudentEnrollmentId,
                                                          task.id,
                                                          attempt.attemptNo,
                                                          'rubric_scores',
                                                          addRubricRow(draft.rubric_scores)
                                                        )
                                                      }
                                                      className="mt-2 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                                                    >
                                                      Add criterion
                                                    </button>
                                                  </div>
                                                );
                                              })()}

                                              <button
                                                type="button"
                                                onClick={() => gradeAttempt(selectedStudentEnrollmentId, task.id, attempt)}
                                                disabled={isBusy}
                                                className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                                              >
                                                {isBusy ? 'Grading...' : 'Grade Attempt'}
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </>
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
