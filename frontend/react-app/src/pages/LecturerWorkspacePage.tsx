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
import LecturerAssessmentsWorkspace from '../components/lecturer/LecturerAssessmentsWorkspace';
import InlineErrorBanner from '../components/tools/InlineErrorBanner';
import ModalConfirm from '../components/tools/ModalConfirm';
import ProgressBar from '../components/tools/ProgressBar';
import ScoreChip from '../components/tools/ScoreChip';
import StatusPill from '../components/tools/StatusPill';
import RoadmapNode, { type RoadmapNodeData } from '../components/lecturer/RoadmapNode';
import SpecVisualEditor, { type VisualSpecState } from '../components/lecturer/SpecVisualEditor';
import SpecReadonlyView from '../components/lecturer/SpecReadonlyView';

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
  enrollmentKeyGenerated: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  attemptsCount?: number;
  selectedAttemptNo?: number | null;
  selectedScore?: number | null;
  latestStatus?: string | null;
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
  status: string;
  progressPercent: number;
  avgScore?: number | null;
  itemsCompleted: number;
  totalItems: number;
  bestItemTitle?: string | null;
  bestItemScore?: number | null;
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
type IngestionMode = 'standard' | 'harag';

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

const createEmptyVisualSpec = (): VisualSpecState => ({
  header: {
    course_name: '',
    course_code: '',
    level: '',
    credit_units: '',
    prerequisites: '',
    description: '',
    rationale: '',
    aim: '',
    lectures: '',
    practicals: '',
  },
  learning_outcomes: [],
  assessment_plan: [],
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const titleCase = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const toDisplayName = (...values: Array<unknown>): string => {
  for (const value of values) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text || UUID_PATTERN.test(text)) continue;
    if (text.includes('@')) {
      const localPart = text.split('@')[0]?.trim();
      if (!localPart) continue;
      return titleCase(localPart.replace(/[._-]+/g, ' '));
    }
    if (/[._-]/.test(text) && !text.includes(' ')) {
      return titleCase(text.replace(/[._-]+/g, ' '));
    }
    return text;
  }
  return 'Student';
};

const formatDateLabel = (value?: string): string => {
  if (!value) return 'Recently synced';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recently synced';
  return parsed.toLocaleString();
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

const ROADMAP_CONTEXT_TABS: LecturerTab[] = ['roadmap', 'students', 'assessments', 'uploads', 'assistant'];

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

const buildVisualSpecState = (raw: unknown): VisualSpecState => {
  const parsed = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, any>
    : {};
  const header = parsed.course_header && typeof parsed.course_header === 'object'
    ? parsed.course_header as Record<string, any>
    : {};
  const contactHours = header.contact_hours && typeof header.contact_hours === 'object'
    ? header.contact_hours as Record<string, any>
    : {};

  return {
    header: {
      course_name: header.course_name || '',
      course_code: header.course_code || '',
      level: header.level || '',
      credit_units: header.credit_units != null ? String(header.credit_units) : '',
      prerequisites: Array.isArray(header.prerequisites)
        ? header.prerequisites.join(', ')
        : (header.prerequisites || ''),
      description: header.description || '',
      rationale: header.rationale || '',
      aim: header.aim || '',
      lectures: contactHours.lectures != null ? String(contactHours.lectures) : '',
      practicals: contactHours.practicals != null ? String(contactHours.practicals) : '',
    },
    learning_outcomes: Array.isArray(parsed.learning_outcomes) ? parsed.learning_outcomes : [],
    assessment_plan: Array.isArray(parsed.assessment_plan) ? parsed.assessment_plan : [],
  };
};

const buildSpecJsonText = (spec: VisualSpecState, existingJsonText: string): string => {
  let current: Record<string, unknown> = {};

  if (existingJsonText.trim()) {
    try {
      const parsed = JSON.parse(existingJsonText);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        current = parsed as Record<string, unknown>;
      }
    } catch {
      current = {};
    }
  }

  const existingHeader = current.course_header && typeof current.course_header === 'object'
    ? current.course_header as Record<string, unknown>
    : {};

  return JSON.stringify(
    {
      ...current,
      course_header: {
        ...existingHeader,
        course_name: spec.header.course_name,
        course_code: spec.header.course_code,
        level: spec.header.level,
        credit_units: spec.header.credit_units ? Number(spec.header.credit_units) : null,
        prerequisites: spec.header.prerequisites
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
        description: spec.header.description,
        rationale: spec.header.rationale,
        aim: spec.header.aim,
        contact_hours: {
          lectures: spec.header.lectures ? Number(spec.header.lectures) : null,
          practicals: spec.header.practicals ? Number(spec.header.practicals) : null,
          total:
            (spec.header.lectures ? Number(spec.header.lectures) : 0) +
              (spec.header.practicals ? Number(spec.header.practicals) : 0) || null,
        },
      },
      learning_outcomes: spec.learning_outcomes,
      assessment_plan: spec.assessment_plan,
    },
    null,
    2
  );
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
    enrollmentKeyGenerated: raw?.enrollment_key_generated === true,
    createdAt: raw?.created_at || undefined,
    updatedAt: raw?.updated_at || undefined,
  };
};

const normalizeEnrollment = (raw: any): EnrollmentRecord | null => {
  const id = raw?.id?.toString?.();
  const userId = raw?.user_id?.toString?.() || raw?.user?.id?.toString?.() || '';
  if (!id || !userId) return null;

  const email = raw?.user?.email || raw?.email || '';
  const fullName = toDisplayName(
    raw?.user?.profile?.full_name,
    raw?.user?.full_name,
    raw?.full_name,
    raw?.user?.username,
    raw?.username,
    email
  );

  return {
    id,
    userId,
    fullName,
    email,
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
  orderIndex: asNumber(raw?.order_index ?? raw?.display_order),
  isActive: raw?.is_active !== false,
  attemptsCount: undefined,
  selectedAttemptNo: null,
  selectedScore: null,
  latestStatus: null,
  results: parseRows<any>(raw?.results, ['items', 'results']).map(normalizeTaskResult),
});

const normalizeTaskSummary = (raw: any) => ({
  taskId: raw?.task_id?.toString?.() || '',
  selectedScore: asNumber(raw?.selected_score),
  selectedAttemptNo: asNumber(raw?.selected_attempt_no),
  attemptsCount: asNumber(raw?.attempts_count) ?? 0,
  latestStatus: raw?.latest_status || null,
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
  description: raw?.description || raw?.key_content || raw?.teaching_activity || '',
  weekNo: asNumber(raw?.week_no),
  estimatedHours: asNumber(raw?.estimated_hours),
  status: raw?.status || 'draft',
  orderIndex: asNumber(raw?.order_index ?? raw?.sequence_no),
  tasks: parseRows<any>(raw?.assessment_tasks ?? raw?.tasks, ['items', 'results', 'assessment_tasks'])
    .map(normalizeTask)
    .sort((left, right) => {
      const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.title.localeCompare(right.title);
    }),
  progress: raw?.progress ? normalizeProgress(raw.progress) : null,
});

const compareRoadmapItems = (left: RoadmapItemRow, right: RoadmapItemRow) => {
  const leftKey = left.weekNo ?? left.orderIndex ?? Number.MAX_SAFE_INTEGER;
  const rightKey = right.weekNo ?? right.orderIndex ?? Number.MAX_SAFE_INTEGER;
  if (leftKey !== rightKey) return leftKey - rightKey;
  return left.title.localeCompare(right.title);
};

const normalizeRoadmapEntry = (raw: any): RoadmapItemRow => {
  const itemSource = raw?.item ?? raw;
  const normalized = normalizeRoadmapItem(itemSource);
  const taskSummaries = parseRows<any>(raw?.task_summaries, ['items', 'results', 'task_summaries'])
    .map(normalizeTaskSummary)
    .filter((entry) => entry.taskId);

  if (taskSummaries.length === 0 && !raw?.progress) {
    return normalized;
  }

  const taskSummaryMap = new Map(taskSummaries.map((entry) => [entry.taskId, entry]));

  return {
    ...normalized,
    progress: raw?.progress ? normalizeProgress(raw.progress) : normalized.progress,
    tasks: normalized.tasks.map((task) => {
      const summary = taskSummaryMap.get(task.id);
      if (!summary) return task;
      return {
        ...task,
        attemptsCount: summary.attemptsCount,
        selectedAttemptNo: summary.selectedAttemptNo,
        selectedScore: summary.selectedScore,
        latestStatus: summary.latestStatus,
      };
    }),
  };
};

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
    .map(normalizeRoadmapEntry)
    .sort(compareRoadmapItems);

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

const getTaskAttemptCount = (task: TaskRow): number => task.attemptsCount ?? task.results.length;

const getTaskLatestStatus = (task: TaskRow): string | null => {
  if (task.latestStatus) return task.latestStatus;
  return task.results[task.results.length - 1]?.status || null;
};

const getTaskDisplayScore = (task: TaskRow): number | null => {
  if (task.selectedScore !== null && task.selectedScore !== undefined) return task.selectedScore;
  const latestResult = task.results[task.results.length - 1];
  return latestResult?.score ?? null;
};

const getBestRoadmapItem = (roadmap: ParsedRoadmap): { title: string; score: number | null } | null => {
  let best: { title: string; score: number | null } | null = null;

  for (const item of roadmap.items) {
    const candidates = [
      item.progress?.bestScore,
      item.progress?.avgScore,
      ...item.tasks.map((task) => task.selectedScore),
    ].filter((value): value is number => value !== null && value !== undefined);

    if (candidates.length === 0) continue;

    const score = Math.max(...candidates);
    if (!best || score > (best.score ?? Number.NEGATIVE_INFINITY)) {
      best = {
        title: item.title,
        score,
      };
    }
  }

  return best;
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
  const [offeringFormIsActive, setOfferingFormIsActive] = useState(true);
  const [autoGenerateEnrollmentKey, setAutoGenerateEnrollmentKey] = useState(true);
  const [customEnrollmentKey, setCustomEnrollmentKey] = useState('');
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null);
  const [pendingOfferingDeleteId, setPendingOfferingDeleteId] = useState<string | null>(null);
  const [offeringDeleteBusy, setOfferingDeleteBusy] = useState(false);

  const [roadmapFilter, setRoadmapFilter] = useState<'all' | 'draft' | 'approved_active'>('all');

  // ── Spec editor mode ──────────────────────────────────────────────────────
  type SpecEditorMode = 'visual' | 'json';
  const [specEditorMode, setSpecEditorMode] = useState<SpecEditorMode>('visual');
  const [visualSpec, setVisualSpec] = useState<VisualSpecState>(createEmptyVisualSpec);
  const [specJsonError, setSpecJsonError] = useState<string | null>(null);
  const [roadmapEditRequested, setRoadmapEditRequested] = useState(false);

  // ── Node canvas state ─────────────────────────────────────────────────────
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [pendingReorder, setPendingReorder] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [pendingNodeActionId, setPendingNodeActionId] = useState<string | null>(null);
  const [nodeActionBusy, setNodeActionBusy] = useState(false);
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
      setVisualSpec(buildVisualSpecState(parsed));
      setSpecJsonError(null);
    } catch {
      // Invalid JSON — don't wipe visual spec, just show the error on JSON tab
      setSpecJsonError('Invalid JSON — fix in JSON Editor before saving');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specEditor]);

  const [taskDraftByItem, setTaskDraftByItem] = useState<Record<string, TaskDraft>>({});
  const [taskEditDraftByTask, setTaskEditDraftByTask] = useState<Record<string, TaskDraft>>({});

  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentRows, setStudentRows] = useState<StudentSummaryRow[]>([]);
  const [selectedStudentEnrollmentId, setSelectedStudentEnrollmentId] = useState('');
  const [studentRoadmapByEnrollment, setStudentRoadmapByEnrollment] = useState<Record<string, ParsedRoadmap>>({});
  const [collapsedStudentItemKeys, setCollapsedStudentItemKeys] = useState<Record<string, boolean>>({});

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadHistoryLoading, setUploadHistoryLoading] = useState(false);
  const [uploadHistoryError, setUploadHistoryError] = useState<string | null>(null);
  const [uploadHistory, setUploadHistory] = useState<any[]>([]);
  const [uploadIngestionMode, setUploadIngestionMode] = useState<IngestionMode>('standard');
  const [recentUploads, setRecentUploads] = useState<Array<{ id: string; fileName: string; uploadedAt: string; offeringId?: string; ingestionMode?: IngestionMode }>>([]);

  const selectedOffering = useMemo(
    () => offerings.find((offering) => offering.id === selectedOfferingId) || null,
    [offerings, selectedOfferingId]
  );
  const editingOffering = editingOfferingId
    ? offerings.find((offering) => offering.id === editingOfferingId) || null
    : null;
  const pendingOfferingDelete = pendingOfferingDeleteId
    ? offerings.find((offering) => offering.id === pendingOfferingDeleteId) || null
    : null;
  const pendingNodeAction = pendingNodeActionId
    ? roadmapItems.find((item) => item.id === pendingNodeActionId) || null
    : null;
  const recentOfferings = offerings.slice(0, 4);
  const uploadContextReady = Boolean(selectedOffering?.courseCode);
  const recentUploadsForContext = recentUploads.filter(
    (upload) => !selectedOfferingId || !upload.offeringId || upload.offeringId === selectedOfferingId
  );

  const showCourseSelector = ROADMAP_CONTEXT_TABS.includes(activeTab);
  const isSpecApproved = specStatus === 'approved_active';
  const hasRoadmapNodes = roadmapItems.length > 0;
  const hasActiveRoadmap = roadmapItems.some((item) => item.status === 'approved_active');
  const isRoadmapEditMode = !hasActiveRoadmap || roadmapEditRequested;
  const isRoadmapViewMode = hasActiveRoadmap && !roadmapEditRequested;
  const roadmapPrimaryActionLabel = hasActiveRoadmap && !isRoadmapEditMode ? 'Edit Roadmap' : 'Add Node';
  const specViewMode: 'blank' | 'edit' | 'readonly' =
    !specId && !specEditor.trim()
      ? 'blank'
      : specStatus === 'approved_active'
        ? 'readonly'
        : 'edit';

  const resetSpecEditorState = () => {
    setSpecId(null);
    setSpecStatus(null);
    setSpecSourceFile(null);
    setSpecEditorMode('visual');
    setSpecEditor('');
    setSpecJsonError(null);
    setVisualSpec(createEmptyVisualSpec());
  };

  const syncVisualToJson = (nextSpec: VisualSpecState) => {
    setVisualSpec(nextSpec);
    setSpecEditor((current) => buildSpecJsonText(nextSpec, current));
    setSpecJsonError(null);
  };

  const updateSpecEditorMode = (mode: SpecEditorMode) => {
    if (mode === 'json' && specEditorMode === 'visual') {
      setSpecEditor(buildSpecJsonText(visualSpec, specEditor));
      setSpecJsonError(null);
    }

    if (mode === 'visual' && specEditorMode === 'json') {
      try {
        const parsed = specEditor.trim() ? JSON.parse(specEditor) : {};
        setVisualSpec(buildVisualSpecState(parsed));
        setSpecJsonError(null);
      } catch {
        setSpecJsonError('Invalid JSON — fix in JSON Editor before returning to Visual Editor');
        return;
      }
    }

    setSpecEditorMode(mode);
  };

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
          const latestStatus = (getTaskLatestStatus(task) || '').toLowerCase();
          if (latestStatus === 'submitted') {
            count += 1;
            continue;
          }
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

  useEffect(() => {
    setSelectedItemId(null);
    setDragId(null);
    setDropId(null);
    setPendingReorder(false);
    setRoadmapEditRequested(false);
    setPendingNodeActionId(null);
    setNodeActionBusy(false);
    setConfirmError(null);
    setRoadmapItems([]);
    setRoadmapError(null);
    setRoadmapNotice(null);
    setTaskDraftByItem({});
    setTaskEditDraftByTask({});
    resetSpecEditorState();
    setSelectedStudentEnrollmentId('');
    setStudentRows([]);
    setStudentRoadmapByEnrollment({});
    setCollapsedStudentItemKeys({});
    setUploadFile(null);
    setUploadError(null);
    setUploadMessage(null);
    setUploadHistory([]);
    setUploadHistoryError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOfferingId]);

  const isLecturerSurface = user?.role === 'lecturer';

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

  const resetOfferingForm = () => {
    setEditingOfferingId(null);
    setNewOfferingCourseCode(courses[0]?.code || '');
    setNewOfferingTerm('');
    setNewOfferingYear(String(new Date().getFullYear()));
    setNewOfferingSection('');
    setNewOfferingCohort('');
    setOfferingFormIsActive(true);
    setAutoGenerateEnrollmentKey(true);
    setCustomEnrollmentKey('');
  };

  const startOfferingEdit = (offering: OfferingRecord) => {
    setEditingOfferingId(offering.id);
    setSelectedOfferingId(offering.id);
    setNewOfferingCourseCode(offering.courseCode);
    setNewOfferingTerm(offering.term);
    setNewOfferingYear(offering.year != null ? String(offering.year) : '');
    setNewOfferingSection(offering.section || '');
    setNewOfferingCohort(offering.cohort || '');
    setOfferingFormIsActive(offering.isActive);
    setAutoGenerateEnrollmentKey(Boolean(offering.enrollmentKeyGenerated && offering.enrollmentKey));
    setCustomEnrollmentKey(offering.enrollmentKeyGenerated ? '' : offering.enrollmentKey || '');
    setCreateError(null);
    setCreateSuccess(null);
  };

  const saveOffering = async () => {
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
        is_active: offeringFormIsActive,
      };

      const yearValue = asNumber(newOfferingYear);
      payload.year = yearValue;
      payload.section = newOfferingSection.trim() || null;
      payload.cohort = newOfferingCohort.trim() || null;
      if (
        autoGenerateEnrollmentKey
        && editingOffering
        && editingOffering.enrollmentKeyGenerated
        && editingOffering.enrollmentKey
        && editingOffering.courseCode === newOfferingCourseCode.trim()
      ) {
        payload.enrollment_key = editingOffering.enrollmentKey;
      } else if (!autoGenerateEnrollmentKey && customEnrollmentKey.trim()) {
        payload.enrollment_key = customEnrollmentKey.trim();
      }

      if (editingOfferingId) {
        await offeringApi.update(token, editingOfferingId, payload as any);
        setCreateSuccess('Offering updated successfully.');
      } else {
        await offeringApi.create(token, payload as any);
        setCreateSuccess('Offering created successfully.');
      }
      setActiveTab('offerings');

      await refreshOfferings(false);
      resetOfferingForm();
    } catch (requestError: any) {
      setCreateError(requestError?.message || `Failed to ${editingOfferingId ? 'update' : 'create'} offering.`);
    } finally {
      setCreateBusy(false);
    }
  };

  const closeOfferingDeleteConfirm = () => {
    if (offeringDeleteBusy) return;
    setPendingOfferingDeleteId(null);
  };

  const confirmDeleteOffering = async () => {
    if (!token || !pendingOfferingDeleteId) return;

    setOfferingDeleteBusy(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      await offeringApi.delete(token, pendingOfferingDeleteId);
      if (selectedOfferingId === pendingOfferingDeleteId) {
        setSelectedOfferingId('');
      }
      if (editingOfferingId === pendingOfferingDeleteId) {
        resetOfferingForm();
      }
      setPendingOfferingDeleteId(null);
      setCreateSuccess('Offering deleted successfully.');
      await refreshOfferings(false);
    } catch (requestError: any) {
      setCreateError(requestError?.message || 'Failed to delete offering.');
    } finally {
      setOfferingDeleteBusy(false);
    }
  };

  const loadRoadmap = async (filterOverride?: 'all' | 'draft' | 'approved_active') => {
    if (!token || !selectedOfferingId) {
      setRoadmapItems([]);
      resetSpecEditorState();
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
        } else {
          resetSpecEditorState();
        }
      } else {
        if (parsed.specId || parsed.specJson) {
          setSpecId(parsed.specId || null);
          setSpecStatus(parsed.specStatus || null);
          setSpecEditor(parsed.specJson ? JSON.stringify(parsed.specJson, null, 2) : '');
        } else {
          resetSpecEditorState();
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

  const editApprovedSpec = async () => {
    if (!token || !specId) return;

    setRoadmapLoading(true);
    setRoadmapError(null);

    try {
      await roadmapAdminApi.submitSpecReview(token, specId);

      const activeItemIds = roadmapItems
        .filter((item) => item.status === 'approved_active')
        .map((item) => item.id);

      await Promise.all(
        activeItemIds.map((itemId) =>
          roadmapAdminApi.updateRoadmapItem(token, itemId, { status: 'draft' })
        )
      );

      setSpecEditorMode('visual');
      setRoadmapNotice('Spec unlocked for editing. Active roadmap items moved back to draft.');
      await loadRoadmap();
      await refreshOfferings(false);
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to reopen the approved spec for editing.');
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

  const confirmStructure = async (): Promise<boolean> => {
    if (!token) return false;

    setConfirmBusy(true);
    setConfirmError(null);

    try {
      await Promise.all(
        roadmapItems.map((item, idx) =>
          roadmapAdminApi.updateRoadmapItem(token, item.id, {
            title: item.title,
            description: item.description || null,
            week_no: item.weekNo,
            estimated_hours: item.estimatedHours,
            sequence_no: idx + 1,
          })
        )
      );
      setPendingReorder(false);
      return true;
    } catch (e: any) {
      setConfirmError(e?.message || 'Failed to confirm structure.');
      return false;
    } finally {
      setConfirmBusy(false);
    }
  };

  const activateRoadmap = async () => {
    if (!token || !selectedOfferingId) return;

    if (pendingReorder) {
      const confirmed = await confirmStructure();
      if (!confirmed) return;
    }

    setRoadmapLoading(true);
    try {
      const hasDraftRoadmap = roadmapItems.some((item) => item.status === 'draft');

      if (hasDraftRoadmap || !hasActiveRoadmap) {
        await roadmapAdminApi.activateRoadmap(token, selectedOfferingId);
        setRoadmapNotice('Roadmap activated.');
      } else {
        setRoadmapNotice('Roadmap changes finalized and editor locked.');
      }

      setRoadmapEditRequested(false);
      await loadRoadmap();
      await refreshOfferings(false);
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to activate roadmap.');
    } finally {
      setRoadmapLoading(false);
    }
  };

  const enableRoadmapEditMode = () => {
    setRoadmapEditRequested(true);
    setRoadmapNotice('Roadmap edit mode enabled.');
  };

  const createRoadmapNode = async () => {
    if (!token || !selectedOfferingId) return;

    const nextSequenceNo = roadmapItems.reduce((max, item) => {
      return Math.max(max, item.orderIndex ?? 0);
    }, 0) + 1;
    const nextWeekNo = roadmapItems.reduce((max, item) => {
      return Math.max(max, item.weekNo ?? 0);
    }, 0) + 1;

    setRoadmapLoading(true);
    setRoadmapError(null);

    try {
      const created = await roadmapAdminApi.createRoadmapItem(token, selectedOfferingId, {
        sequence_no: nextSequenceNo,
        week_no: nextWeekNo,
        title: `Week ${nextWeekNo}`,
        estimated_hours: null,
        status: hasActiveRoadmap ? 'approved_active' : 'draft',
      });

      const createdId = created?.id?.toString?.() || null;
      setRoadmapNotice('Roadmap node created.');
      await loadRoadmap();
      if (createdId) {
        setSelectedItemId(createdId);
      }
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to create roadmap node.');
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
      setRoadmapNotice('Roadmap node removed.');
      await loadRoadmap();
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to archive roadmap item.');
    } finally {
      setRoadmapLoading(false);
    }
  };

  const deleteRoadmapItem = async (itemId: string) => {
    if (!token) return;

    setRoadmapLoading(true);
    try {
      await roadmapAdminApi.deleteRoadmapItem(token, itemId);
      setRoadmapNotice('Roadmap node permanently deleted.');
      await loadRoadmap();
    } catch (requestError: any) {
      setRoadmapError(requestError?.message || 'Failed to delete roadmap item.');
    } finally {
      setRoadmapLoading(false);
    }
  };

  const openNodeDeleteConfirm = (itemId: string) => {
    setPendingNodeActionId(itemId);
  };

  const closeNodeDeleteConfirm = () => {
    if (nodeActionBusy) return;
    setPendingNodeActionId(null);
  };

  const confirmArchiveRoadmapNode = async () => {
    if (!pendingNodeActionId) return;

    setNodeActionBusy(true);
    try {
      await archiveRoadmapItem(pendingNodeActionId);
      setSelectedItemId((prev) => (prev === pendingNodeActionId ? null : prev));
      setPendingNodeActionId(null);
    } finally {
      setNodeActionBusy(false);
    }
  };

  const confirmDeleteRoadmapNode = async () => {
    if (!pendingNodeActionId) return;

    setNodeActionBusy(true);
    try {
      await deleteRoadmapItem(pendingNodeActionId);
      setSelectedItemId((prev) => (prev === pendingNodeActionId ? null : prev));
      setPendingNodeActionId(null);
    } finally {
      setNodeActionBusy(false);
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
            const bestItem = getBestRoadmapItem(parsed);
            return {
              enrollmentId: row.id,
              fullName: row.fullName,
              email: row.email,
              status: row.status,
              progressPercent: summary.progressPercent,
              avgScore: summary.avgScore,
              itemsCompleted: summary.itemsCompleted,
              totalItems: summary.totalItems,
              bestItemTitle: bestItem?.title || null,
              bestItemScore: bestItem?.score ?? null,
            } satisfies StudentSummaryRow;
          } catch {
            return {
              enrollmentId: row.id,
              fullName: row.fullName,
              email: row.email,
              status: row.status,
              progressPercent: 0,
              avgScore: null,
              itemsCompleted: 0,
              totalItems: 0,
              bestItemTitle: null,
              bestItemScore: null,
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

  const toggleStudentRoadmapCard = (enrollmentId: string, itemId: string) => {
    const key = `${enrollmentId}:${itemId}`;
    setCollapsedStudentItemKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    if (activeTab !== 'students') return;
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedOfferingId]);

  const loadUploadHistory = async () => {
    if (!token || !isLecturerSurface) return;
    if (!selectedOffering?.courseCode) {
      setUploadHistory([]);
      setUploadHistoryError(null);
      return;
    }

    setUploadHistoryLoading(true);
    setUploadHistoryError(null);

    try {
      const response = await lecturerApi.getUploads(token, selectedOffering.courseCode);
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
    if (!selectedOffering?.courseCode) {
      setUploadHistory([]);
      setUploadHistoryError(null);
      return;
    }
    loadUploadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedOfferingId]);

  const uploadDocument = async () => {
    if (!token || !uploadFile || !selectedOffering?.courseCode) {
      if (!selectedOffering?.courseCode) {
        setUploadError('Select a course to upload materials');
      }
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    try {
      const response = await ingestionApi.uploadDocument(token, uploadFile, selectedOffering.courseCode, {
        courseOfferingId: selectedOfferingId,
        ingestionMode: uploadIngestionMode,
      });
      const id = response?.document_id || response?.id || uploadFile.name;
      const modeLabel = response?.ingestion_mode === 'harag' ? 'HA-RAG' : 'Standard RAG';
      const vectorCount = response?.ingestion_mode === 'harag'
        ? response?.harag_stored_vectors ?? response?.stored_vectors
        : response?.standard_stored_vectors ?? response?.stored_vectors;
      const summary = typeof vectorCount === 'number' ? ` • ${vectorCount} indexed chunk${vectorCount === 1 ? '' : 's'}` : '';

      setUploadMessage(`Uploaded ${uploadFile.name} (${id}) using ${modeLabel}${summary}.`);
      setRecentUploads((prev) => [
        {
          id: String(id),
          fileName: uploadFile.name,
          uploadedAt: new Date().toISOString(),
          offeringId: selectedOfferingId || undefined,
          ingestionMode: response?.ingestion_mode || uploadIngestionMode,
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
        <InlineErrorBanner message={activeTab === 'offerings' || showCourseSelector ? offeringsError : null} />
        <InlineErrorBanner message={activeTab === 'offerings' ? coursesError : null} />

        <WorkspaceTabs
          tabs={tabsForRender}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as LecturerTab)}
          rightSlot={
            showCourseSelector ? (
              <div className="flex flex-col gap-1 xl:items-end">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                  Course Context
                </span>
                <select
                  value={selectedOfferingId}
                  onChange={(event) => setSelectedOfferingId(event.target.value)}
                  disabled={offeringsLoading || offerings.length === 0}
                  className="min-w-[min(100%,360px)] rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {offeringsLoading
                      ? 'Loading offerings...'
                      : offerings.length === 0
                        ? 'No offerings available'
                        : 'Select offering'}
                  </option>
                  {offerings.map((offering) => (
                    <option key={offering.id} value={offering.id}>
                      {offering.courseCode} • {offering.term} {offering.year || ''} {offering.section ? `• ${offering.section}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null
          }
        />

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
                  Upload Course Material
                </button>
              </div>
            </SectionCard>

            <SectionCard title="Recent Activity" description="A snapshot of the latest offerings in your workspace.">
              {recentOfferings.length === 0 ? (
                <p className="text-sm text-gray-500">No offerings available yet. Create your first offering to get started.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {recentOfferings.map((offering) => (
                    <div
                      key={`dashboard-${offering.id}`}
                      className={`rounded-2xl border px-4 py-3 transition ${
                        selectedOfferingId === offering.id
                          ? 'border-blue-200 bg-blue-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{offering.courseCode}</p>
                          <p className="text-xs text-gray-500">
                            {offering.term} {offering.year || ''} {offering.section ? `• Section ${offering.section}` : ''}
                          </p>
                        </div>
                        <StatusPill status={activeRoadmapByOffering[offering.id] ? 'approved_active' : 'draft'} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span>{enrollmentCountByOffering[offering.id] || 0} students</span>
                        <span>{offering.isActive ? 'Active offering' : 'Inactive offering'}</span>
                        <span>{formatDateLabel(offering.updatedAt || offering.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
              title={editingOffering ? 'Edit Offering' : 'Create Offering'}
              description={editingOffering ? 'Update offering metadata without leaving the workspace.' : 'Lecturers create offerings from existing course records. Students enroll afterwards.'}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  {editingOffering && (
                    <button
                      type="button"
                      onClick={resetOfferingForm}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={refreshCourseCatalog}
                    disabled={coursesLoading}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {coursesLoading ? 'Loading Courses...' : 'Refresh Courses'}
                  </button>
                </div>
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
                    checked={offeringFormIsActive}
                    onChange={(event) => setOfferingFormIsActive(event.target.checked)}
                  />
                  Offering is active
                </label>

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
                    placeholder="Custom enrollment key (leave blank for open enrollment)"
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                )}

                <button
                  type="button"
                  onClick={saveOffering}
                  disabled={createBusy || !newOfferingCourseCode.trim() || !newOfferingTerm.trim()}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {createBusy ? (editingOffering ? 'Saving...' : 'Creating...') : (editingOffering ? 'Save Changes' : 'Create Offering')}
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
                    <div
                      key={offering.id}
                      onClick={() => setSelectedOfferingId(offering.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedOfferingId(offering.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
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
                      <div className="mt-1 text-xs text-gray-500">
                        Updated: {formatDateLabel(offering.updatedAt || offering.createdAt)}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedOfferingId(offering.id);
                          }}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Use Course
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            startOfferingEdit(offering);
                          }}
                          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingOfferingDeleteId(offering.id);
                          }}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {activeTab === 'roadmap' && (() => {
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
          const activeAssessmentCount = selectedItem?.tasks.filter((task) => task.isActive).length ?? 0;
          const inactiveAssessmentCount = selectedItem ? selectedItem.tasks.length - activeAssessmentCount : 0;

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
                        <label className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm transition ${
                          isSpecApproved
                            ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                            : 'cursor-pointer text-slate-600 hover:bg-slate-50'
                        }`}>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input
                            type="file"
                            accept=".pdf,.docx"
                            disabled={isSpecApproved}
                            className="hidden"
                            onChange={(e) => { setSpecSourceFile(e.target.files?.[0] || null); setRoadmapError(null); }}
                          />
                          {specSourceFile ? specSourceFile.name : isSpecApproved ? 'Spec Upload Locked' : 'Choose PDF / DOCX'}
                        </label>

                        <button type="button" onClick={extractSpec} disabled={!specSourceFile || roadmapLoading || isSpecApproved}
                          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                          {roadmapLoading ? 'Extracting…' : 'Extract Spec'}
                        </button>

                        <button type="button" onClick={generateRoadmap} disabled={roadmapLoading || hasRoadmapNodes}
                          className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                          Generate Roadmap
                        </button>

                        <button type="button" onClick={activateRoadmap} disabled={roadmapLoading || confirmBusy || (hasActiveRoadmap && isRoadmapViewMode)}
                          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          Activate Roadmap
                        </button>
                      </div>
                    </div>

                    {/* ── SPEC VIEW / EDITOR ───────────────────────────────── */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">
                            {specViewMode === 'readonly' ? 'Approved Spec' : 'Spec Editor'}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {specViewMode === 'blank'
                              ? 'No spec exists for this offering yet.'
                              : specViewMode === 'readonly'
                                ? 'Approved specs are locked until you reopen them for lecturer review.'
                                : 'Switch between the visual editor and JSON editor as needed.'}
                          </p>
                        </div>

                        {specViewMode === 'edit' && (
                          <div className="flex items-center gap-2">
                            {(['visual', 'json'] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => updateSpecEditorMode(mode)}
                                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                  specEditorMode === mode
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                }`}
                              >
                                {mode === 'visual' ? 'Visual Editor' : 'JSON Editor'}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {specViewMode === 'readonly' && (
                            <button
                              type="button"
                              onClick={editApprovedSpec}
                              disabled={roadmapLoading}
                              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                            >
                              Edit
                            </button>
                          )}

                          {specViewMode === 'edit' && (
                            <>
                              <button
                                type="button"
                                onClick={saveSpecEdits}
                                disabled={!specId || roadmapLoading}
                                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                              >
                                Save Spec
                              </button>
                              <button
                                type="button"
                                onClick={approveSpec}
                                disabled={!specId || roadmapLoading || specStatus === 'approved_active'}
                                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition"
                              >
                                Approve Spec
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="p-4">
                        {specViewMode === 'blank' && (
                          <p className="text-sm text-slate-400 italic">
                            No spec loaded yet. Upload a document and click "Extract Spec" to get started.
                          </p>
                        )}

                        {specViewMode === 'readonly' && (
                          <SpecReadonlyView spec={visualSpec} jsonText={specEditor} />
                        )}

                        {specViewMode === 'edit' && specEditorMode === 'visual' && (
                          <SpecVisualEditor
                            spec={visualSpec}
                            onChange={(next) => syncVisualToJson(next)}
                          />
                        )}

                        {specViewMode === 'edit' && specEditorMode === 'json' && (
                          <>
                            {specJsonError && (
                              <p className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                                Warning: {specJsonError}
                              </p>
                            )}
                            <textarea
                              value={specEditor}
                              onChange={(e) => {
                                setSpecEditor(e.target.value);
                                try {
                                  JSON.parse(e.target.value);
                                  setSpecJsonError(null);
                                } catch {
                                  setSpecJsonError('Invalid JSON — fix before saving');
                                }
                              }}
                              rows={16}
                              placeholder="Spec JSON appears here after extraction..."
                              className={`w-full rounded-xl border bg-slate-50 px-3 py-3 font-mono text-xs text-slate-800 focus:outline-none focus:ring-1 transition ${
                                specJsonError ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 focus:border-blue-400 focus:ring-blue-400'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  setSpecEditor(JSON.stringify(JSON.parse(specEditor), null, 2));
                                  setSpecJsonError(null);
                                } catch {
                                  setSpecJsonError('Cannot format — invalid JSON');
                                }
                              }}
                              className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                            >
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
                            {nodes.length > 0
                              ? isRoadmapEditMode
                                ? `${nodes.length} weeks · Drag to reorder in edit mode`
                                : `${nodes.length} weeks · Active roadmap is currently read-only`
                              : 'Generate the roadmap to see nodes here'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={hasActiveRoadmap && !isRoadmapEditMode ? enableRoadmapEditMode : createRoadmapNode}
                            disabled={roadmapLoading || pendingReorder || confirmBusy}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          >
                            {roadmapPrimaryActionLabel}
                          </button>
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
                                      isEditable={isRoadmapEditMode}
                                      isSelected={selectedItemId === node.id}
                                      isDragging={dragId === node.id}
                                      isDropTarget={dropId === node.id && dragId !== node.id}
                                      onDelete={openNodeDeleteConfirm}
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
                            <p className="mt-2 text-center text-xs text-slate-400">
                              {isRoadmapEditMode
                                ? 'Click a node to edit · Drag to reorder'
                                : 'Click a node to view details'}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* ── SIDE PANEL: item editor ──────────────────────────────── */}
              {selectedItem && (
                <div className="w-96 flex-none">
                  <div className="sticky top-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <h3 className="text-sm font-bold text-slate-800">
                        {isRoadmapEditMode ? 'Edit' : 'View'} Week {selectedItem.weekNo ?? (roadmapItems.findIndex((i) => i.id === selectedItem.id) + 1)}
                      </h3>
                      <button type="button" onClick={() => setSelectedItemId(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>

                    <div className="max-h-[80vh] overflow-y-auto p-4 space-y-3">
                      {isRoadmapViewMode ? (
                        <>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Title</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">{selectedItem.title}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Description</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                              {selectedItem.description || 'No description provided.'}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Week No.</p>
                              <p className="mt-1 text-sm text-slate-700">{selectedItem.weekNo ?? '--'}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Est. Hours</p>
                              <p className="mt-1 text-sm text-slate-700">{selectedItem.estimatedHours ?? '--'}</p>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Assessments ({selectedItem.tasks.length})
                              </p>
                              {selectedItem.tasks.length > 0 && (
                                <span className="text-[10px] font-medium text-slate-400">
                                  {activeAssessmentCount} active · {inactiveAssessmentCount} inactive
                                </span>
                              )}
                            </div>
                            {selectedItem.tasks.length === 0 && (
                              <p className="text-xs text-slate-400 italic">No assessments linked to this roadmap item.</p>
                            )}
                            {selectedItem.tasks.map((task) => (
                              <div
                                key={task.id}
                                className={`mb-2 rounded-xl border p-3 ${task.isActive ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-slate-100/80'}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-slate-700">{task.title}</span>
                                  <div className="flex flex-wrap items-center justify-end gap-1">
                                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                      {task.taskType}
                                    </span>
                                    <span
                                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                        task.isActive
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : 'bg-slate-200 text-slate-600'
                                      }`}
                                    >
                                      {task.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                </div>
                                {task.description && (
                                  <p className="mt-2 text-xs text-slate-600">{task.description}</p>
                                )}
                                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                                  <span>Max score: {task.maxScore ?? '--'}</span>
                                  <span>Weight: {task.weight ?? '--'}</span>
                                  <span>Due: {task.dueAt ? new Date(task.dueAt).toLocaleString() : 'No due date'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
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

                          <div className="border-t border-slate-100 pt-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Assessments ({selectedItem.tasks.length})
                              </p>
                              {selectedItem.tasks.length > 0 && (
                                <span className="text-[10px] font-medium text-slate-400">
                                  {activeAssessmentCount} active · {inactiveAssessmentCount} inactive
                                </span>
                              )}
                            </div>
                            {selectedItem.tasks.length === 0 && (
                              <p className="text-xs text-slate-400 italic">No assessments linked to this roadmap item.</p>
                            )}
                            {selectedItem.tasks.map((task, taskIdx) => {
                              const draft = getTaskEditDraft(task);
                              return (
                                <div
                                  key={task.id}
                                  className={`mb-2 rounded-xl border p-3 ${task.isActive ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-slate-100/80'}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-slate-700">{task.title}</span>
                                    <div className="flex flex-wrap items-center justify-end gap-1">
                                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{task.taskType}</span>
                                      <span
                                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                          task.isActive
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-slate-200 text-slate-600'
                                        }`}
                                      >
                                        {task.isActive ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
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
                        </>
                      )}
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
                  <div className="grid grid-cols-1 gap-4 xl:h-[calc(100vh-17rem)] xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.35fr)]">
                    <div className="min-h-0 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                      <div className="max-h-[24rem] overflow-auto xl:h-full xl:max-h-none">
                        <table className="min-w-full bg-white text-sm">
                          <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">Name</th>
                              <th className="px-3 py-2 text-left font-semibold">Progress</th>
                              <th className="px-3 py-2 text-left font-semibold">Avg score</th>
                              <th className="px-3 py-2 text-left font-semibold">Best</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentRows.map((row) => (
                              <tr
                                key={row.enrollmentId}
                                onClick={() => setSelectedStudentEnrollmentId(row.enrollmentId)}
                                className={`cursor-pointer border-t align-top transition ${
                                  selectedStudentEnrollmentId === row.enrollmentId
                                    ? 'bg-blue-50'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <td className="px-3 py-2">
                                  <p className="font-semibold text-gray-900">{row.fullName}</p>
                                  <p className="text-xs text-gray-500">{row.email || `Status: ${row.status}`}</p>
                                </td>
                                <td className="px-3 py-2">{row.progressPercent.toFixed(0)}%</td>
                                <td className="px-3 py-2">
                                  {row.avgScore !== null && row.avgScore !== undefined ? row.avgScore.toFixed(1) : '--'}
                                </td>
                                <td className="px-3 py-2">
                                  {row.bestItemTitle ? (
                                    <>
                                      <p className="max-w-[12rem] truncate font-medium text-gray-800">{row.bestItemTitle}</p>
                                      <p className="text-xs text-gray-500">
                                        {row.bestItemScore !== null && row.bestItemScore !== undefined
                                          ? `${row.bestItemScore.toFixed(1)} pts`
                                          : 'Scored'}
                                      </p>
                                    </>
                                  ) : (
                                    <span className="text-gray-400">--</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="min-h-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50/80">
                      <div className="max-h-[32rem] overflow-y-auto p-3 xl:h-full xl:max-h-none">
                        {!selectedStudentRoadmap ? (
                          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-5 text-sm text-gray-500">
                            Select a student to inspect roadmap and assessment progress.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3">
                              <p className="font-semibold text-gray-900">{selectedStudentSummary?.fullName || 'Selected student'}</p>
                              <p className="text-xs text-gray-500">
                                {selectedStudentSummary?.email || `Status: ${selectedStudentSummary?.status || 'active'}`}
                              </p>
                              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <ScoreChip label="Progress" value={selectedStudentSummary?.progressPercent} denominator={100} />
                                <ScoreChip label="Average" value={selectedStudentSummary?.avgScore} />
                                <ScoreChip label="Completed" value={selectedStudentSummary?.itemsCompleted} denominator={selectedStudentSummary?.totalItems} />
                              </div>
                            </div>

                            {selectedStudentRoadmap.items.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-5 text-sm text-gray-500">
                                No active roadmap items are available for this student yet.
                              </div>
                            ) : (
                              selectedStudentRoadmap.items.map((item) => {
                                const collapseKey = `${selectedStudentEnrollmentId}:${item.id}`;
                                const isCollapsed = Boolean(collapsedStudentItemKeys[collapseKey]);

                                return (
                                  <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div>
                                        <p className="font-semibold text-gray-900">{item.title}</p>
                                        <p className="text-xs text-gray-500">
                                          Week {item.weekNo ?? '--'} · {item.tasks.length} assessments
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <StatusPill status={item.progress?.status || item.status} />
                                        <button
                                          type="button"
                                          aria-expanded={!isCollapsed}
                                          onClick={() => toggleStudentRoadmapCard(selectedStudentEnrollmentId, item.id)}
                                          className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                        >
                                          {isCollapsed ? 'Expand' : 'Collapse'}
                                          <svg
                                            className={`h-3.5 w-3.5 transition ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
                                            viewBox="0 0 20 20"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 7.5 10 12.5 15 7.5" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>

                                    {!isCollapsed && (
                                      <>
                                        <div className="mt-3">
                                          <ProgressBar value={item.progress?.completionPercent || 0} />
                                        </div>
                                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                          <ScoreChip label="Total" value={item.progress?.totalScore} denominator={item.progress?.maxTotalScore} />
                                          <ScoreChip label="Average" value={item.progress?.avgScore} />
                                          <ScoreChip label="Best" value={item.progress?.bestScore} />
                                        </div>

                                        <div className="mt-3 space-y-2">
                                          {item.tasks.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-xs text-gray-500">
                                              No assessments are linked to this roadmap item.
                                            </div>
                                          ) : (
                                            item.tasks.map((task) => {
                                              const attemptCount = getTaskAttemptCount(task);
                                              const latestStatus = getTaskLatestStatus(task);
                                              const displayScore = getTaskDisplayScore(task);

                                              return (
                                                <div
                                                  key={task.id}
                                                  className={`rounded-xl border px-3 py-2 text-xs ${task.isActive ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-slate-100/80'}`}
                                                >
                                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                                    <div>
                                                      <p className="font-semibold text-gray-800">{task.title}</p>
                                                      {task.description && (
                                                        <p className="mt-1 text-gray-500">{task.description}</p>
                                                      )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center justify-end gap-1">
                                                      <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-600">
                                                        {task.taskType}
                                                      </span>
                                                      <span
                                                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                          task.isActive
                                                            ? 'bg-emerald-50 text-emerald-700'
                                                            : 'bg-slate-200 text-slate-600'
                                                        }`}
                                                      >
                                                        {task.isActive ? 'Active' : 'Inactive'}
                                                      </span>
                                                      {latestStatus && <StatusPill status={latestStatus} />}
                                                    </div>
                                                  </div>

                                                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                                                    <span>Attempts: {attemptCount}/{task.maxAttempts}</span>
                                                    <span>Best: {displayScore !== null && displayScore !== undefined ? displayScore.toFixed(1) : '--'}</span>
                                                    <span>Selected attempt: {task.selectedAttemptNo ?? '--'}</span>
                                                    <span>Due: {task.dueAt ? new Date(task.dueAt).toLocaleString() : 'No due date'}</span>
                                                  </div>
                                                </div>
                                              );
                                            })
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => goToTab('assessments')}
                                          className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                        >
                                          Open Assessments Tab
                                        </button>
                                      </>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </SectionCard>
            )}
          </div>
        )}

        {activeTab === 'assessments' && (
          <LecturerAssessmentsWorkspace
            token={token}
            selectedOfferingId={selectedOfferingId}
            selectedOffering={selectedOffering}
            onOpenRoadmapTab={() => goToTab('roadmap')}
          />
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
              {!uploadContextReady && (
                <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Select a course to upload materials
                </div>
              )}
              <div className="mb-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Ingestion mode</div>
                <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1 text-sm font-semibold text-gray-600">
                  <button
                    type="button"
                    onClick={() => setUploadIngestionMode('standard')}
                    className={`rounded-xl px-4 py-2 transition ${uploadIngestionMode === 'standard' ? 'bg-gray-900 text-white shadow-sm' : 'hover:bg-gray-50'}`}
                    aria-pressed={uploadIngestionMode === 'standard'}
                  >
                    Standard RAG
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadIngestionMode('harag')}
                    className={`rounded-xl px-4 py-2 transition ${uploadIngestionMode === 'harag' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-50'}`}
                    aria-pressed={uploadIngestionMode === 'harag'}
                  >
                    HA-RAG
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <label className={`flex items-center justify-center rounded-2xl border border-dashed px-4 py-4 text-sm ${
                  uploadContextReady
                    ? 'cursor-pointer border-gray-300 bg-gray-50 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                    : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                }`}>
                  <input
                    type="file"
                    className="hidden"
                    disabled={!uploadContextReady}
                    onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                  />
                  {uploadFile ? uploadFile.name : uploadContextReady ? 'Choose document (PDF, DOCX, PPTX)' : 'Course selection required'}
                </label>
                <button
                  type="button"
                  onClick={uploadDocument}
                  disabled={!uploadContextReady || !uploadFile || uploading}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
              {selectedOffering && (
                <p className="mt-2 text-xs text-gray-500">
                  Active offering context: {selectedOffering.courseCode} • {selectedOffering.term} {selectedOffering.year || ''} • {uploadIngestionMode === 'harag' ? 'HA-RAG hierarchy' : 'Standard RAG chunks'}
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
                {!uploadContextReady && !uploadHistoryLoading && (
                  <p className="text-sm text-gray-500">Select a course to view uploaded materials for that context.</p>
                )}
                {uploadContextReady && recentUploadsForContext.map((upload) => (
                  <div key={`recent-${upload.id}-${upload.uploadedAt}`} className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                    <p className="font-semibold text-blue-800">{upload.fileName}</p>
                    <p className="text-xs text-blue-700">
                      Document ID: {upload.id} • {new Date(upload.uploadedAt).toLocaleString()}
                      {upload.ingestionMode ? ` • ${upload.ingestionMode === 'harag' ? 'HA-RAG' : 'Standard RAG'}` : ''}
                    </p>
                  </div>
                ))}

                {uploadContextReady && uploadHistory.map((upload, index) => (
                  <div key={`history-${upload?.id || index}`} className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    <p className="font-semibold text-gray-900">{upload?.file_name || upload?.name || 'Document'}</p>
                    <p className="text-xs text-gray-500">
                      {upload?.course_code || selectedOffering?.courseCode || 'N/A'}
                      {upload?.uploaded_at ? ` • ${new Date(upload.uploaded_at).toLocaleString()}` : ''}
                      {upload?.ingestion_mode ? ` • ${upload.ingestion_mode === 'harag' ? 'HA-RAG' : 'Standard RAG'}` : ''}
                    </p>
                  </div>
                ))}

                {!uploadHistoryLoading && uploadContextReady && recentUploadsForContext.length === 0 && uploadHistory.length === 0 && (
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

      <ModalConfirm
        open={Boolean(pendingNodeActionId)}
        title="Are you sure?"
        description={
          pendingNodeAction
            ? `Choose whether to archive or permanently delete "${pendingNodeAction.title}".`
            : 'Choose whether to archive or permanently delete this roadmap node.'
        }
        cancelLabel="Cancel"
        secondaryLabel="Archive"
        secondaryDanger
        confirmLabel="Delete"
        danger
        onCancel={closeNodeDeleteConfirm}
        onSecondary={confirmArchiveRoadmapNode}
        onConfirm={confirmDeleteRoadmapNode}
        loading={nodeActionBusy}
      />

      <ModalConfirm
        open={Boolean(pendingOfferingDeleteId)}
        title="Delete offering?"
        description={
          pendingOfferingDelete
            ? `Delete ${pendingOfferingDelete.courseCode} • ${pendingOfferingDelete.term} ${pendingOfferingDelete.year || ''}? This only works when the offering has no enrollments, specs, or roadmap data.`
            : 'Delete this offering? This only works when the offering has no dependent data.'
        }
        cancelLabel="Cancel"
        confirmLabel="Delete"
        danger
        onCancel={closeOfferingDeleteConfirm}
        onConfirm={confirmDeleteOffering}
        loading={offeringDeleteBusy}
      />
    </div>
  );
}
