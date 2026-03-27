import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { assessmentApi } from '../../services/api';
import SectionCard from './SectionCard';
import InlineErrorBanner from '../tools/InlineErrorBanner';
import EmptyStateCard from '../tools/EmptyStateCard';
import ScoreChip from '../tools/ScoreChip';
import StatusPill from '../tools/StatusPill';

type WorkspaceTab = 'assessments' | 'grading';
type AssessmentMode = 'custom' | 'template';
type SubmissionFilter = 'all' | 'submitted' | 'ai_graded' | 'finalized';

interface OfferingSummary {
  id: string;
  courseCode: string;
  courseName: string;
  term: string;
  year?: number;
}

interface GradingComponent {
  id?: string;
  key: string;
  label: string;
  description?: string | null;
  max_points: number;
  display_order: number;
  is_auto_gradable: boolean;
  manual_only: boolean;
}

interface GradingScheme {
  id?: string;
  version_no?: number;
  scheme_name?: string | null;
  source_template_version_id?: string | null;
  auto_grading_enabled: boolean;
  auto_grading_instructions?: string | null;
  components: GradingComponent[];
}

interface AssessmentRecord {
  id: string;
  roadmap_item_id: string;
  title: string;
  task_type: string;
  description?: string | null;
  practical_brief?: string | null;
  required_tools?: string | null;
  expected_artifact?: string | null;
  safety_notes?: string | null;
  max_score: number;
  weight?: number | null;
  due_at?: string | null;
  is_required: boolean;
  is_active: boolean;
  max_attempts: number;
  allow_late_submission: boolean;
  late_penalty_percent?: number | null;
  current_grading_scheme?: GradingScheme | null;
}

interface AssessmentGroup {
  roadmap_item_id: string;
  roadmap_item_title: string;
  roadmap_item_week_no?: number | null;
  roadmap_item_status: string;
  assessments: AssessmentRecord[];
}

interface SubmissionListItem {
  id: string;
  enrollment_id: string;
  task_id: string;
  attempt_no: number;
  student_user_id: string;
  student_name: string;
  student_email?: string | null;
  student_identifier?: string | null;
  status: string;
  workflow_status: string;
  score?: number | null;
  submitted_at?: string | null;
  graded_at?: string | null;
  finalized_at?: string | null;
  feedback?: string | null;
  submission_text?: string | null;
  latest_ai_evaluation_status?: string | null;
}

interface AttemptComponentScore {
  id: string;
  component_id: string;
  component_key: string;
  component_label: string;
  max_points: number;
  score: number;
  feedback?: string | null;
  source: string;
}

interface AiComponentSuggestion {
  id: string;
  component_id: string;
  component_key: string;
  component_label: string;
  max_points: number;
  suggested_score: number;
  confidence?: number | null;
  rationale?: string | null;
}

interface SubmissionDetail {
  attempt: {
    id: string;
    enrollment_id: string;
    task_id: string;
    attempt_no: number;
    status: string;
    score?: number | null;
    feedback?: string | null;
    submission_text?: string | null;
    submitted_at?: string | null;
    graded_at?: string | null;
    finalized_at?: string | null;
  };
  grading_scheme?: GradingScheme | null;
  component_scores: AttemptComponentScore[];
  latest_ai_evaluation?: {
    id: string;
    status: string;
    overall_confidence?: number | null;
    suggested_total_score?: number | null;
    error_text?: string | null;
    component_suggestions: AiComponentSuggestion[];
  } | null;
  student: {
    user_id: string;
    username: string;
    full_name?: string | null;
    email?: string | null;
    university_id?: string | null;
  };
  assessment: AssessmentRecord;
  roadmap_item: {
    id: string;
    title: string;
    week_no?: number | null;
    status: string;
  };
  workflow_status: string;
}

interface TemplateVersionOption {
  id: string;
  templateId: string;
  templateName: string;
  label: string;
  schemeName: string;
  autoGradingEnabled: boolean;
  autoGradingInstructions: string;
  components: GradingComponent[];
}

interface ComponentDraft {
  label: string;
  description: string;
  maxPoints: string;
  isAutoGradable: boolean;
  manualOnly: boolean;
}

interface AssessmentDraft {
  title: string;
  description: string;
  taskType: string;
  practicalBrief: string;
  requiredTools: string;
  expectedArtifact: string;
  safetyNotes: string;
  dueAt: string;
  maxAttempts: string;
  allowLateSubmission: boolean;
  latePenaltyPercent: string;
  weight: string;
  isRequired: boolean;
  isActive: boolean;
  mode: AssessmentMode;
  templateVersionId: string;
  schemeName: string;
  autoGradingEnabled: boolean;
  autoGradingInstructions: string;
  components: ComponentDraft[];
}

interface GradeComponentDraft {
  componentKey: string;
  label: string;
  maxPoints: number;
  value: string;
  feedback: string;
  suggestedScore?: number | null;
  confidence?: number | null;
  rationale?: string | null;
}

interface SubmissionGradeDraft {
  feedback: string;
  useAiSuggestions: boolean;
  components: GradeComponentDraft[];
}

type AssessmentEditorAction =
  | { mode: 'edit'; assessmentId: string }
  | { mode: 'create'; roadmapItemId: string };

interface LecturerAssessmentsWorkspaceProps {
  token: string;
  selectedOfferingId: string;
  selectedOffering: OfferingSummary | null;
  onOpenRoadmapTab: () => void;
}

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

const createDefaultComponentDraft = (maxPoints: string = '100'): ComponentDraft => ({
  label: 'Overall',
  description: '',
  maxPoints,
  isAutoGradable: false,
  manualOnly: false,
});

const createEmptyAssessmentDraft = (): AssessmentDraft => ({
  title: '',
  description: '',
  taskType: 'assignment',
  practicalBrief: '',
  requiredTools: '',
  expectedArtifact: '',
  safetyNotes: '',
  dueAt: '',
  maxAttempts: '1',
  allowLateSubmission: false,
  latePenaltyPercent: '',
  weight: '',
  isRequired: true,
  isActive: true,
  mode: 'custom',
  templateVersionId: '',
  schemeName: '',
  autoGradingEnabled: false,
  autoGradingInstructions: '',
  components: [createDefaultComponentDraft()],
});

const toNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
};

const toLocalDateTimeValue = (value?: string | null): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const offset = parsed.getTimezoneOffset();
  const local = new Date(parsed.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
};

const formatPoints = (value?: number | null): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return Number(value).toFixed(1);
};

const summarizeScheme = (scheme?: GradingScheme | null): string => {
  if (!scheme || scheme.components.length === 0) return 'No grading scheme';
  const total = scheme.components.reduce((sum, component) => sum + Number(component.max_points || 0), 0);
  const autoCount = scheme.components.filter((component) => component.is_auto_gradable).length;
  const parts = [`${scheme.components.length} components`, `${formatPoints(total)} pts`];
  if (scheme.auto_grading_enabled) {
    parts.push(autoCount > 0 ? `${autoCount} AI-assisted` : 'AI enabled');
  }
  if (scheme.version_no) {
    parts.push(`v${scheme.version_no}`);
  }
  return parts.join(' • ');
};

const flattenTemplateVersions = (rawTemplates: any[]): TemplateVersionOption[] => {
  const out: TemplateVersionOption[] = [];
  for (const template of rawTemplates || []) {
    const versions = Array.isArray(template?.versions) ? template.versions : [];
    for (const version of versions) {
      const components = Array.isArray(version?.components)
        ? version.components.map((component: any, index: number) => ({
            id: component?.id?.toString?.(),
            key: String(component?.key || component?.component_key || `component_${index + 1}`),
            label: String(component?.label || `Component ${index + 1}`),
            description: component?.description || '',
            max_points: Number(component?.max_points || 0),
            display_order: Number(component?.display_order || index),
            is_auto_gradable: Boolean(component?.is_auto_gradable),
            manual_only: Boolean(component?.manual_only),
          }))
        : [];

      out.push({
        id: String(version?.id),
        templateId: String(template?.id),
        templateName: String(template?.name || 'Template'),
        label: `${template?.name || 'Template'} • v${version?.version_no || 1}`,
        schemeName: String(version?.scheme_name || template?.name || 'Template Scheme'),
        autoGradingEnabled: Boolean(version?.auto_grading_enabled),
        autoGradingInstructions: String(version?.auto_grading_instructions || ''),
        components,
      });
    }
  }
  return out.sort((left, right) => left.label.localeCompare(right.label));
};

const buildComponentDraftsFromScheme = (scheme?: GradingScheme | null, fallbackMaxScore?: number): ComponentDraft[] => {
  if (scheme?.components?.length) {
    return [...scheme.components]
      .sort((left, right) => left.display_order - right.display_order)
      .map((component) => ({
        label: component.label,
        description: component.description || '',
        maxPoints: String(component.max_points),
        isAutoGradable: Boolean(component.is_auto_gradable),
        manualOnly: Boolean(component.manual_only),
      }));
  }

  return [createDefaultComponentDraft(String(fallbackMaxScore || 100))];
};

const buildAssessmentDraftFromRecord = (
  assessment: AssessmentRecord,
  templateVersions: TemplateVersionOption[],
): AssessmentDraft => {
  const scheme = assessment.current_grading_scheme;
  const linkedTemplateId = scheme?.source_template_version_id || '';
  const hasLinkedTemplate = Boolean(linkedTemplateId && templateVersions.some((version) => version.id === linkedTemplateId));

  return {
    title: assessment.title,
    description: assessment.description || '',
    taskType: assessment.task_type || 'assignment',
    practicalBrief: assessment.practical_brief || '',
    requiredTools: assessment.required_tools || '',
    expectedArtifact: assessment.expected_artifact || '',
    safetyNotes: assessment.safety_notes || '',
    dueAt: toLocalDateTimeValue(assessment.due_at),
    maxAttempts: String(assessment.max_attempts || 1),
    allowLateSubmission: Boolean(assessment.allow_late_submission),
    latePenaltyPercent: assessment.late_penalty_percent !== null && assessment.late_penalty_percent !== undefined
      ? String(assessment.late_penalty_percent)
      : '',
    weight: assessment.weight !== null && assessment.weight !== undefined ? String(assessment.weight) : '',
    isRequired: Boolean(assessment.is_required),
    isActive: Boolean(assessment.is_active),
    mode: hasLinkedTemplate ? 'template' : 'custom',
    templateVersionId: hasLinkedTemplate ? linkedTemplateId : '',
    schemeName: scheme?.scheme_name || assessment.title,
    autoGradingEnabled: Boolean(scheme?.auto_grading_enabled),
    autoGradingInstructions: scheme?.auto_grading_instructions || '',
    components: buildComponentDraftsFromScheme(scheme, assessment.max_score),
  };
};

const buildRubricJsonFromComponents = (components: ComponentDraft[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const component of components) {
    const label = component.label.trim();
    const maxPoints = toNumber(component.maxPoints);
    if (!label || maxPoints === null || maxPoints <= 0) continue;
    out[label] = maxPoints;
  }
  return out;
};

const sanitizeComponentKey = (label: string, index: number) => {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || `component_${index + 1}`;
};

const buildCustomSchemePayload = (draft: AssessmentDraft) => {
  return {
    scheme_name: draft.schemeName.trim() || draft.title.trim() || null,
    auto_grading_enabled: draft.autoGradingEnabled,
    auto_grading_instructions: draft.autoGradingInstructions.trim() || null,
    components: draft.components.map((component, index) => ({
      key: sanitizeComponentKey(component.label, index),
      label: component.label.trim() || `Component ${index + 1}`,
      description: component.description.trim() || null,
      max_points: Number(component.maxPoints),
      display_order: index,
      is_auto_gradable: component.isAutoGradable,
      manual_only: component.manualOnly,
    })),
    rubric_levels: [],
  };
};

const getDraftMaxScore = (draft: AssessmentDraft, templateVersions: TemplateVersionOption[]) => {
  if (draft.mode === 'template') {
    const template = templateVersions.find((version) => version.id === draft.templateVersionId);
    if (!template) return 0;
    return template.components.reduce((sum, component) => sum + Number(component.max_points || 0), 0);
  }
  return draft.components.reduce((sum, component) => sum + Number(toNumber(component.maxPoints) || 0), 0);
};

const buildAssessmentPayload = (draft: AssessmentDraft, templateVersions: TemplateVersionOption[]) => {
  const maxScore = getDraftMaxScore(draft, templateVersions);
  const payload: Record<string, unknown> = {
    title: draft.title.trim(),
    description: draft.description.trim() || undefined,
    task_type: draft.taskType || 'assignment',
    practical_brief: draft.practicalBrief.trim() || undefined,
    required_tools: draft.requiredTools.trim() || undefined,
    expected_artifact: draft.expectedArtifact.trim() || undefined,
    safety_notes: draft.safetyNotes.trim() || undefined,
    due_at: draft.dueAt || undefined,
    max_attempts: Math.max(1, Number(draft.maxAttempts || 1)),
    allow_late_submission: draft.allowLateSubmission,
    late_penalty_percent: toNumber(draft.latePenaltyPercent),
    is_required: draft.isRequired,
    is_active: draft.isActive,
    weight: toNumber(draft.weight),
    max_score: maxScore,
  };

  if (draft.mode === 'template') {
    payload.grading_template_version_id = draft.templateVersionId;
  } else {
    payload.grading_scheme = buildCustomSchemePayload(draft);
    payload.rubric_json = buildRubricJsonFromComponents(draft.components);
  }

  return payload;
};

const serializeAssessmentDraft = (draft: AssessmentDraft) => JSON.stringify(draft);

const isSameAssessmentEditorAction = (
  left: AssessmentEditorAction | null,
  right: AssessmentEditorAction | null,
) => {
  if (!left || !right) return false;
  if (left.mode !== right.mode) return false;
  if (left.mode === 'edit' && right.mode === 'edit') {
    return left.assessmentId === right.assessmentId;
  }
  if (left.mode === 'create' && right.mode === 'create') {
    return left.roadmapItemId === right.roadmapItemId;
  }
  return false;
};

const validateAssessmentDraft = (draft: AssessmentDraft, templateVersions: TemplateVersionOption[]) => {
  if (!draft.title.trim()) return 'Assessment title is required.';
  if (draft.mode === 'template' && !draft.templateVersionId) {
    return 'Select a grading template before saving.';
  }
  if (draft.mode === 'custom') {
    if (draft.components.length === 0) return 'Add at least one grading component.';
    for (const component of draft.components) {
      if (!component.label.trim()) return 'Every grading component needs a label.';
      const maxPoints = toNumber(component.maxPoints);
      if (maxPoints === null || maxPoints <= 0) return 'Each component max score must be a positive number.';
    }
  }
  if (getDraftMaxScore(draft, templateVersions) <= 0) {
    return 'The grading scheme must total more than 0 points.';
  }
  return null;
};

const buildSubmissionGradeDraft = (detail: SubmissionDetail): SubmissionGradeDraft => {
  const scheme = detail.grading_scheme || detail.assessment.current_grading_scheme;
  const scoreByKey = new Map(detail.component_scores.map((row) => [row.component_key, row]));
  const suggestionByKey = new Map(
    (detail.latest_ai_evaluation?.component_suggestions || []).map((row) => [row.component_key, row]),
  );

  return {
    feedback: detail.attempt.feedback || '',
    useAiSuggestions: false,
    components: (scheme?.components || []).map((component) => {
      const saved = scoreByKey.get(component.key);
      const suggested = suggestionByKey.get(component.key);
      return {
        componentKey: component.key,
        label: component.label,
        maxPoints: Number(component.max_points || 0),
        value: saved ? String(saved.score) : '',
        feedback: saved?.feedback || '',
        suggestedScore: suggested?.suggested_score,
        confidence: suggested?.confidence,
        rationale: suggested?.rationale,
      };
    }),
  };
};

function AssessmentFormPanel({
  draft,
  templateVersions,
  busy,
  submitLabel,
  errorMessage,
  onSubmit,
  onCancel,
  onChange,
}: {
  draft: AssessmentDraft;
  templateVersions: TemplateVersionOption[];
  busy: boolean;
  submitLabel: string;
  errorMessage?: string | null;
  onSubmit: () => void;
  onCancel?: () => void;
  onChange: (next: AssessmentDraft) => void;
}) {
  const selectedTemplate = templateVersions.find((version) => version.id === draft.templateVersionId) || null;
  const renderedComponents = draft.mode === 'template'
    ? selectedTemplate?.components || []
    : draft.components.map((component, index) => ({
        key: `custom-${index}`,
        label: component.label,
        description: component.description,
        max_points: Number(component.maxPoints || 0),
        is_auto_gradable: component.isAutoGradable,
        manual_only: component.manualOnly,
      }));
  const maxScore = getDraftMaxScore(draft, templateVersions);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {errorMessage && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Title</span>
                  <input
                    value={draft.title}
                    onChange={(event) => onChange({ ...draft, title: event.target.value })}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                    placeholder="Assessment title"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Task Type</span>
                  <select
                    value={draft.taskType}
                    onChange={(event) => onChange({ ...draft, taskType: event.target.value })}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                  >
                    {TASK_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 lg:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Description</span>
                  <textarea
                    value={draft.description}
                    onChange={(event) => onChange({ ...draft, description: event.target.value })}
                    rows={4}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                    placeholder="What should students submit or demonstrate?"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Due At</span>
                  <input
                    type="datetime-local"
                    value={draft.dueAt}
                    onChange={(event) => onChange({ ...draft, dueAt: event.target.value })}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Max Attempts</span>
                  <input
                    type="number"
                    min={1}
                    value={draft.maxAttempts}
                    onChange={(event) => onChange({ ...draft, maxAttempts: event.target.value })}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Late Penalty %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.latePenaltyPercent}
                    onChange={(event) => onChange({ ...draft, latePenaltyPercent: event.target.value })}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                    placeholder="Optional"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Weight</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.weight}
                    onChange={(event) => onChange({ ...draft, weight: event.target.value })}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                    placeholder="Optional"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Expected Artifact</span>
                  <input
                    value={draft.expectedArtifact}
                    onChange={(event) => onChange({ ...draft, expectedArtifact: event.target.value })}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                    placeholder="Optional"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Required Tools</span>
                  <input
                    value={draft.requiredTools}
                    onChange={(event) => onChange({ ...draft, requiredTools: event.target.value })}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                    placeholder="Optional"
                  />
                </label>

                <label className="space-y-1 lg:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Practical Brief</span>
                  <textarea
                    value={draft.practicalBrief}
                    onChange={(event) => onChange({ ...draft, practicalBrief: event.target.value })}
                    rows={3}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                    placeholder="Optional"
                  />
                </label>

                <label className="space-y-1 lg:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Safety Notes</span>
                  <textarea
                    value={draft.safetyNotes}
                    onChange={(event) => onChange({ ...draft, safetyNotes: event.target.value })}
                    rows={3}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                    placeholder="Optional"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(event) => onChange({ ...draft, isActive: event.target.checked })}
                  />
                  Active for students
                </label>
                <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={draft.isRequired}
                    onChange={(event) => onChange({ ...draft, isRequired: event.target.checked })}
                  />
                  Required assessment
                </label>
                <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={draft.allowLateSubmission}
                    onChange={(event) => onChange({ ...draft, allowLateSubmission: event.target.checked })}
                  />
                  Allow late submission
                </label>
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-3 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-blue-600">Max Score</p>
                  <p className="mt-1 text-lg font-semibold text-blue-900">{formatPoints(maxScore)}</p>
                  <p className="mt-1 text-xs text-blue-700">
                    This stays aligned with the grading components or template selection.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Grading Scheme</p>
                  <p className="text-xs text-gray-500">Use a saved template or build a custom component-based scheme.</p>
                </div>
                <div className="inline-flex rounded-2xl border border-gray-200 bg-gray-50 p-1">
                  <button
                    type="button"
                    onClick={() => onChange({ ...draft, mode: 'custom' })}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      draft.mode === 'custom' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Custom
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...draft, mode: 'template' })}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      draft.mode === 'template' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Template
                  </button>
                </div>
              </div>

              {draft.mode === 'template' ? (
                <div className="mt-4 space-y-3">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Template Version</span>
                    <select
                      value={draft.templateVersionId}
                      onChange={(event) => onChange({ ...draft, templateVersionId: event.target.value })}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select a template</option>
                      {templateVersions.map((version) => (
                        <option key={version.id} value={version.id}>{version.label}</option>
                      ))}
                    </select>
                  </label>

                  {!selectedTemplate ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-500">
                      Pick a template to preview its grading components.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <ScoreChip label="Components" value={selectedTemplate.components.length} />
                        <ScoreChip label="Max Score" value={selectedTemplate.components.reduce((sum, component) => sum + Number(component.max_points || 0), 0)} />
                        <ScoreChip label="AI Ready" value={selectedTemplate.autoGradingEnabled ? 1 : 0} denominator={1} />
                      </div>
                      {selectedTemplate.autoGradingInstructions && (
                        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                          {selectedTemplate.autoGradingInstructions}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Scheme Name</span>
                      <input
                        value={draft.schemeName}
                        onChange={(event) => onChange({ ...draft, schemeName: event.target.value })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                        placeholder="Optional"
                      />
                    </label>
                    <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={draft.autoGradingEnabled}
                        onChange={(event) => onChange({ ...draft, autoGradingEnabled: event.target.checked })}
                      />
                      Enable AI suggestions for this scheme
                    </label>
                  </div>

                  {draft.autoGradingEnabled && (
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">AI Guidance</span>
                      <textarea
                        value={draft.autoGradingInstructions}
                        onChange={(event) => onChange({ ...draft, autoGradingInstructions: event.target.value })}
                        rows={3}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                        placeholder="Optional instructions for AI grading suggestions"
                      />
                    </label>
                  )}
                </div>
              )}

              <div className="mt-4 space-y-3">
                {renderedComponents.map((component, index) => (
                  <div key={`${component.key || component.label}-${index}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    {draft.mode === 'template' ? (
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{component.label}</p>
                          {component.description && <p className="mt-1 text-sm text-gray-500">{component.description}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700">
                            {formatPoints(component.max_points)} pts
                          </span>
                          {component.is_auto_gradable && <StatusPill status="ai_graded" />}
                          {component.manual_only && <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600">Manual only</span>}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_1fr_120px]">
                          <input
                            value={draft.components[index]?.label || ''}
                            onChange={(event) => {
                              const next = [...draft.components];
                              next[index] = { ...next[index], label: event.target.value };
                              onChange({ ...draft, components: next });
                            }}
                            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                            placeholder="Component label"
                          />
                          <input
                            value={draft.components[index]?.description || ''}
                            onChange={(event) => {
                              const next = [...draft.components];
                              next[index] = { ...next[index], description: event.target.value };
                              onChange({ ...draft, components: next });
                            }}
                            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                            placeholder="Criterion / notes"
                          />
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={draft.components[index]?.maxPoints || ''}
                            onChange={(event) => {
                              const next = [...draft.components];
                              next[index] = { ...next[index], maxPoints: event.target.value };
                              onChange({ ...draft, components: next });
                            }}
                            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                            placeholder="Points"
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={draft.components[index]?.isAutoGradable || false}
                              onChange={(event) => {
                                const next = [...draft.components];
                                next[index] = {
                                  ...next[index],
                                  isAutoGradable: event.target.checked,
                                  manualOnly: event.target.checked ? false : next[index].manualOnly,
                                };
                                onChange({ ...draft, components: next });
                              }}
                            />
                            AI gradable
                          </label>
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={draft.components[index]?.manualOnly || false}
                              onChange={(event) => {
                                const next = [...draft.components];
                                next[index] = {
                                  ...next[index],
                                  manualOnly: event.target.checked,
                                  isAutoGradable: event.target.checked ? false : next[index].isAutoGradable,
                                };
                                onChange({ ...draft, components: next });
                              }}
                            />
                            Manual only
                          </label>
                          {draft.components.length > 1 && (
                            <button
                              type="button"
                              onClick={() => onChange({ ...draft, components: draft.components.filter((_, componentIndex) => componentIndex !== index) })}
                              className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {draft.mode === 'custom' && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...draft, components: [...draft.components, createDefaultComponentDraft('0')] })}
                    className="rounded-2xl border border-dashed border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                  >
                    Add grading component
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? 'Saving...' : submitLabel}
        </button>
      </div>
    </div>
  );
}

function AssessmentEditorModal({
  open,
  title,
  description,
  saveLabel,
  saveBusy,
  onClose,
  onSave,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  saveLabel: string;
  saveBusy: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center overflow-hidden p-4">
      <button
        type="button"
        aria-label="Close assessment editor"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
      />
      <div className="relative flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Lecturer Workspace</p>
            <h3 className="mt-1 text-xl font-semibold text-gray-900">{title}</h3>
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saveBusy}
              className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saveBusy ? 'Saving...' : saveLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              aria-label="Close assessment editor"
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
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-5 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function AssessmentEditorCloseConfirm({
  open,
  updating,
  onConfirmSave,
  onDiscard,
  onCancel,
}: {
  open: boolean;
  updating: boolean;
  onConfirmSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close confirmation"
        onClick={onCancel}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900">Save assessment changes?</h3>
        <p className="mt-2 text-sm text-gray-600">
          You have unsaved updates in this editor. Save them before closing, or close without updating.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={updating}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={updating}
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            Close Without Updating
          </button>
          <button
            type="button"
            onClick={onConfirmSave}
            disabled={updating}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {updating ? 'Updating...' : 'Save / Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LecturerAssessmentsWorkspace({
  token,
  selectedOfferingId,
  selectedOffering,
  onOpenRoadmapTab,
}: LecturerAssessmentsWorkspaceProps) {
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('assessments');
  const [assessmentFilter, setAssessmentFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>('all');
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const [assessmentsByOffering, setAssessmentsByOffering] = useState<Record<string, AssessmentGroup[]>>({});
  const [templateVersions, setTemplateVersions] = useState<TemplateVersionOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [expandedAssessmentId, setExpandedAssessmentId] = useState<string | null>(null);
  const [expandedCreateItemId, setExpandedCreateItemId] = useState<string | null>(null);
  const [pendingEditorAction, setPendingEditorAction] = useState<AssessmentEditorAction | null>(null);
  const [showEditorCloseConfirm, setShowEditorCloseConfirm] = useState(false);
  const [assessmentDrafts, setAssessmentDrafts] = useState<Record<string, AssessmentDraft>>({});
  const [createDrafts, setCreateDrafts] = useState<Record<string, AssessmentDraft>>({});
  const [savingAssessmentId, setSavingAssessmentId] = useState<string | null>(null);
  const [creatingItemId, setCreatingItemId] = useState<string | null>(null);
  const [togglingAssessmentId, setTogglingAssessmentId] = useState<string | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [submissionsByAssessment, setSubmissionsByAssessment] = useState<Record<string, SubmissionListItem[]>>({});
  const [loadingSubmissionsByAssessment, setLoadingSubmissionsByAssessment] = useState<Record<string, boolean>>({});
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('');
  const [submissionDetails, setSubmissionDetails] = useState<Record<string, SubmissionDetail>>({});
  const [loadingSubmissionDetailId, setLoadingSubmissionDetailId] = useState<string | null>(null);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, SubmissionGradeDraft>>({});
  const [runningAiSubmissionId, setRunningAiSubmissionId] = useState<string | null>(null);
  const [finalizingSubmissionId, setFinalizingSubmissionId] = useState<string | null>(null);

  const assessmentGroups = useMemo(
    () => (selectedOfferingId ? assessmentsByOffering[selectedOfferingId] || [] : []),
    [assessmentsByOffering, selectedOfferingId],
  );

  const assessments = useMemo(
    () => assessmentGroups.flatMap((group) => group.assessments),
    [assessmentGroups],
  );

  const visibleAssessmentGroups = useMemo(() => {
    if (assessmentFilter === 'all') return assessmentGroups;
    return assessmentGroups
      .map((group) => ({
        ...group,
        assessments: group.assessments.filter((assessment) => (
          assessmentFilter === 'active' ? assessment.is_active : !assessment.is_active
        )),
      }))
      .filter((group) => group.assessments.length > 0);
  }, [assessmentFilter, assessmentGroups]);

  const selectedAssessment = useMemo(
    () => assessments.find((assessment) => assessment.id === selectedAssessmentId) || null,
    [assessments, selectedAssessmentId],
  );
  const assessmentGroupById = useMemo(
    () => new Map(assessmentGroups.map((group) => [group.roadmap_item_id, group])),
    [assessmentGroups],
  );
  const editingAssessment = useMemo(
    () => assessments.find((assessment) => assessment.id === expandedAssessmentId) || null,
    [assessments, expandedAssessmentId],
  );
  const creatingGroup = useMemo(
    () => assessmentGroups.find((group) => group.roadmap_item_id === expandedCreateItemId) || null,
    [assessmentGroups, expandedCreateItemId],
  );
  const activeEditorGroup = editingAssessment
    ? assessmentGroupById.get(editingAssessment.roadmap_item_id) || null
    : creatingGroup;
  const isAssessmentEditorOpen = Boolean(editingAssessment || creatingGroup);
  const currentEditorAction: AssessmentEditorAction | null = editingAssessment
    ? { mode: 'edit', assessmentId: editingAssessment.id }
    : creatingGroup
    ? { mode: 'create', roadmapItemId: creatingGroup.roadmap_item_id }
    : null;
  const baselineEditorDraft = useMemo(() => {
    if (editingAssessment) {
      return buildAssessmentDraftFromRecord(editingAssessment, templateVersions);
    }
    if (creatingGroup) {
      return createEmptyAssessmentDraft();
    }
    return null;
  }, [creatingGroup, editingAssessment, templateVersions]);
  const activeEditorDraft = useMemo(() => {
    if (editingAssessment) {
      return assessmentDrafts[editingAssessment.id] || buildAssessmentDraftFromRecord(editingAssessment, templateVersions);
    }
    if (creatingGroup) {
      return createDrafts[creatingGroup.roadmap_item_id] || createEmptyAssessmentDraft();
    }
    return null;
  }, [assessmentDrafts, createDrafts, creatingGroup, editingAssessment, templateVersions]);
  const hasUnsavedAssessmentEditorChanges = Boolean(
    activeEditorDraft && baselineEditorDraft && serializeAssessmentDraft(activeEditorDraft) !== serializeAssessmentDraft(baselineEditorDraft),
  );
  const activeEditorBusy = Boolean(
    (editingAssessment && savingAssessmentId === editingAssessment.id)
      || (creatingGroup && creatingItemId === creatingGroup.roadmap_item_id),
  );

  const submissionRows = selectedAssessmentId ? submissionsByAssessment[selectedAssessmentId] || [] : [];
  const filteredSubmissionRows = useMemo(
    () => submissionRows.filter((submission) => submissionFilter === 'all' || submission.workflow_status === submissionFilter),
    [submissionFilter, submissionRows],
  );
  const selectedSubmissionDetail = selectedSubmissionId ? submissionDetails[selectedSubmissionId] || null : null;
  const selectedSubmissionDraft = selectedSubmissionId ? gradeDrafts[selectedSubmissionId] || null : null;

  const activeAssessmentCount = assessments.filter((assessment) => assessment.is_active).length;
  const hasInitialAssessmentLoadError = Boolean(workspaceError && !loadingAssessments && assessmentGroups.length === 0);
  const pendingSubmissionCount = useMemo(
    () => Object.values(submissionsByAssessment)
      .flat()
      .filter((submission) => submission.workflow_status === 'submitted').length,
    [submissionsByAssessment],
  );

  const clearAssessmentEditorDraft = (action: AssessmentEditorAction | null = currentEditorAction) => {
    if (!action) return;
    if (action.mode === 'edit') {
      setAssessmentDrafts((prev) => {
        if (!(action.assessmentId in prev)) return prev;
        const next = { ...prev };
        delete next[action.assessmentId];
        return next;
      });
      return;
    }

    setCreateDrafts((prev) => {
      if (!(action.roadmapItemId in prev)) return prev;
      const next = { ...prev };
      delete next[action.roadmapItemId];
      return next;
    });
  };

  const applyAssessmentEditorAction = (action: AssessmentEditorAction) => {
    setWorkspaceError(null);
    setPendingEditorAction(null);
    setShowEditorCloseConfirm(false);
    if (action.mode === 'edit') {
      setExpandedAssessmentId(action.assessmentId);
      setExpandedCreateItemId(null);
      return;
    }
    setExpandedCreateItemId(action.roadmapItemId);
    setExpandedAssessmentId(null);
  };

  const closeAssessmentEditor = (nextAction: AssessmentEditorAction | null = null) => {
    clearAssessmentEditorDraft(currentEditorAction);
    setExpandedAssessmentId(null);
    setExpandedCreateItemId(null);
    setPendingEditorAction(null);
    setShowEditorCloseConfirm(false);
    setWorkspaceError(null);
    if (nextAction) {
      applyAssessmentEditorAction(nextAction);
    }
  };

  const requestCloseAssessmentEditor = () => {
    if (activeEditorBusy) return;
    if (!isAssessmentEditorOpen) return;
    if (hasUnsavedAssessmentEditorChanges) {
      setPendingEditorAction(null);
      setShowEditorCloseConfirm(true);
      return;
    }
    closeAssessmentEditor();
  };

  const requestAssessmentEditorAction = (action: AssessmentEditorAction) => {
    if (activeEditorBusy) return;
    if (!isAssessmentEditorOpen) {
      applyAssessmentEditorAction(action);
      return;
    }
    if (isSameAssessmentEditorAction(currentEditorAction, action)) {
      requestCloseAssessmentEditor();
      return;
    }
    if (hasUnsavedAssessmentEditorChanges) {
      setPendingEditorAction(action);
      setShowEditorCloseConfirm(true);
      return;
    }
    closeAssessmentEditor(action);
  };

  const refreshAssessments = async (force = false) => {
    if (!token || !selectedOfferingId) return;
    if (!force && assessmentsByOffering[selectedOfferingId]) return;

    setLoadingAssessments(true);
    setWorkspaceError(null);

    try {
      const response = await assessmentApi.listForOffering(token, selectedOfferingId);
      setAssessmentsByOffering((prev) => ({ ...prev, [selectedOfferingId]: response || [] }));
    } catch (error: any) {
      setWorkspaceError(error?.message || 'Failed to load assessments.');
    } finally {
      setLoadingAssessments(false);
    }
  };

  const refreshTemplates = async () => {
    if (!token) return;
    setLoadingTemplates(true);
    try {
      const response = await assessmentApi.listTemplates(token);
      setTemplateVersions(flattenTemplateVersions(Array.isArray(response) ? response : []));
    } catch {
      setTemplateVersions([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const refreshSubmissions = async (assessmentId: string, force = false) => {
    if (!token || !assessmentId) return;
    if (!force && submissionsByAssessment[assessmentId]) return;

    setLoadingSubmissionsByAssessment((prev) => ({ ...prev, [assessmentId]: true }));
    setWorkspaceError(null);
    try {
      const response = await assessmentApi.listSubmissions(token, assessmentId);
      setSubmissionsByAssessment((prev) => ({ ...prev, [assessmentId]: response || [] }));
    } catch (error: any) {
      setWorkspaceError(error?.message || 'Failed to load submissions.');
    } finally {
      setLoadingSubmissionsByAssessment((prev) => ({ ...prev, [assessmentId]: false }));
    }
  };

  const refreshSubmissionDetail = async (submissionId: string, force = false) => {
    if (!token || !submissionId) return;
    if (!force && submissionDetails[submissionId]) return;

    setLoadingSubmissionDetailId(submissionId);
    setWorkspaceError(null);
    try {
      const response = await assessmentApi.getSubmission(token, submissionId);
      setSubmissionDetails((prev) => ({ ...prev, [submissionId]: response }));
      setGradeDrafts((prev) => ({ ...prev, [submissionId]: buildSubmissionGradeDraft(response) }));
    } catch (error: any) {
      setWorkspaceError(error?.message || 'Failed to load submission detail.');
    } finally {
      setLoadingSubmissionDetailId((current) => (current === submissionId ? null : current));
    }
  };

  useEffect(() => {
    setExpandedAssessmentId(null);
    setExpandedCreateItemId(null);
    setPendingEditorAction(null);
    setShowEditorCloseConfirm(false);
    setWorkspaceError(null);
    setWorkspaceNotice(null);
    setSelectedAssessmentId('');
    setSelectedSubmissionId('');
  }, [selectedOfferingId]);

  useEffect(() => {
    if (!selectedOfferingId) return;
    refreshAssessments(false);
  }, [selectedOfferingId]);

  useEffect(() => {
    refreshTemplates();
  }, [token]);

  useEffect(() => {
    if (!selectedAssessmentId && assessments.length > 0) {
      const firstActive = assessments.find((assessment) => assessment.is_active) || assessments[0];
      setSelectedAssessmentId(firstActive.id);
    }
  }, [assessments, selectedAssessmentId]);

  useEffect(() => {
    if (workspaceTab !== 'grading' || !selectedAssessmentId) return;
    refreshSubmissions(selectedAssessmentId, false);
  }, [workspaceTab, selectedAssessmentId]);

  useEffect(() => {
    if (!selectedAssessmentId) return;
    const currentRows = submissionsByAssessment[selectedAssessmentId] || [];
    if (!selectedSubmissionId || !currentRows.some((row) => row.id === selectedSubmissionId)) {
      setSelectedSubmissionId(currentRows[0]?.id || '');
    }
  }, [selectedAssessmentId, selectedSubmissionId, submissionsByAssessment]);

  useEffect(() => {
    if (workspaceTab !== 'grading' || !selectedSubmissionId) return;
    refreshSubmissionDetail(selectedSubmissionId, false);
  }, [workspaceTab, selectedSubmissionId]);

  useEffect(() => {
    if (!isAssessmentEditorOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestCloseAssessmentEditor();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isAssessmentEditorOpen, requestCloseAssessmentEditor]);

  const getAssessmentDraft = (assessment: AssessmentRecord) => {
    return assessmentDrafts[assessment.id] || buildAssessmentDraftFromRecord(assessment, templateVersions);
  };

  const getCreateDraft = (roadmapItemId: string) => createDrafts[roadmapItemId] || createEmptyAssessmentDraft();

  const updateAssessmentDraft = (assessmentId: string, next: AssessmentDraft) => {
    setAssessmentDrafts((prev) => ({ ...prev, [assessmentId]: next }));
  };

  const updateCreateDraft = (roadmapItemId: string, next: AssessmentDraft) => {
    setCreateDrafts((prev) => ({ ...prev, [roadmapItemId]: next }));
  };

  const saveAssessment = async (
    assessment: AssessmentRecord,
    nextAction: AssessmentEditorAction | null = null,
    closeAfterSave = true,
  ): Promise<boolean> => {
    const draft = getAssessmentDraft(assessment);
    const validationError = validateAssessmentDraft(draft, templateVersions);
    if (validationError) {
      setWorkspaceError(validationError);
      setShowEditorCloseConfirm(false);
      return false;
    }

    setSavingAssessmentId(assessment.id);
    setWorkspaceError(null);
    setWorkspaceNotice(null);

    try {
      await assessmentApi.update(token, assessment.id, buildAssessmentPayload(draft, templateVersions));
      clearAssessmentEditorDraft({ mode: 'edit', assessmentId: assessment.id });
      setWorkspaceNotice(closeAfterSave ? 'Assessment updated.' : 'Assessment saved.');
      await refreshAssessments(true);
      setPendingEditorAction(null);
      setShowEditorCloseConfirm(false);
      setWorkspaceError(null);
      if (closeAfterSave) {
        setExpandedAssessmentId(null);
        setExpandedCreateItemId(null);
      } else {
        setExpandedAssessmentId(assessment.id);
        setExpandedCreateItemId(null);
      }
      if (closeAfterSave && nextAction) {
        applyAssessmentEditorAction(nextAction);
      }
      return true;
    } catch (error: any) {
      setWorkspaceError(error?.message || 'Failed to update assessment.');
      setShowEditorCloseConfirm(false);
      return false;
    } finally {
      setSavingAssessmentId(null);
    }
  };

  const createAssessment = async (
    roadmapItemId: string,
    nextAction: AssessmentEditorAction | null = null,
    closeAfterSave = true,
  ): Promise<boolean> => {
    const draft = getCreateDraft(roadmapItemId);
    const validationError = validateAssessmentDraft(draft, templateVersions);
    if (validationError) {
      setWorkspaceError(validationError);
      setShowEditorCloseConfirm(false);
      return false;
    }

    setCreatingItemId(roadmapItemId);
    setWorkspaceError(null);
    setWorkspaceNotice(null);
    try {
      const createdAssessment = await assessmentApi.create(token, roadmapItemId, buildAssessmentPayload(draft, templateVersions));
      clearAssessmentEditorDraft({ mode: 'create', roadmapItemId });
      setWorkspaceNotice(closeAfterSave ? 'Assessment created.' : 'Assessment created and saved.');
      await refreshAssessments(true);
      setPendingEditorAction(null);
      setShowEditorCloseConfirm(false);
      setWorkspaceError(null);
      if (closeAfterSave) {
        setExpandedAssessmentId(null);
        setExpandedCreateItemId(null);
      } else {
        setExpandedCreateItemId(null);
        setExpandedAssessmentId(createdAssessment?.id ? String(createdAssessment.id) : null);
      }
      if (closeAfterSave && nextAction) {
        applyAssessmentEditorAction(nextAction);
      }
      return true;
    } catch (error: any) {
      setWorkspaceError(error?.message || 'Failed to create assessment.');
      setShowEditorCloseConfirm(false);
      return false;
    } finally {
      setCreatingItemId(null);
    }
  };

  const toggleAssessmentActive = async (assessment: AssessmentRecord) => {
    setTogglingAssessmentId(assessment.id);
    setWorkspaceError(null);
    setWorkspaceNotice(null);
    try {
      await assessmentApi.setActive(token, assessment.id, !assessment.is_active);
      setWorkspaceNotice(assessment.is_active ? 'Assessment hidden from students.' : 'Assessment activated for students.');
      await refreshAssessments(true);
      if (selectedAssessmentId === assessment.id) {
        await refreshSubmissions(assessment.id, true);
      }
    } catch (error: any) {
      setWorkspaceError(error?.message || 'Failed to update assessment visibility.');
    } finally {
      setTogglingAssessmentId(null);
    }
  };

  const updateGradeDraft = (submissionId: string, next: SubmissionGradeDraft) => {
    setGradeDrafts((prev) => ({ ...prev, [submissionId]: next }));
  };

  const runAiGrade = async () => {
    if (!selectedSubmissionId || !selectedAssessmentId) return;

    setRunningAiSubmissionId(selectedSubmissionId);
    setWorkspaceError(null);
    setWorkspaceNotice(null);

    try {
      const detail = await assessmentApi.runAiGrade(token, selectedSubmissionId);
      setSubmissionDetails((prev) => ({ ...prev, [selectedSubmissionId]: detail }));
      setGradeDrafts((prev) => ({ ...prev, [selectedSubmissionId]: buildSubmissionGradeDraft(detail) }));
      setWorkspaceNotice('AI grading started. Suggestions will appear once processing completes.');
      await refreshSubmissions(selectedAssessmentId, true);
      window.setTimeout(() => {
        refreshSubmissionDetail(selectedSubmissionId, true);
        refreshSubmissions(selectedAssessmentId, true);
      }, 1800);
    } catch (error: any) {
      setWorkspaceError(error?.message || 'Failed to run AI grading.');
    } finally {
      setRunningAiSubmissionId(null);
    }
  };

  const finalizeSelectedSubmission = async () => {
    if (!selectedSubmissionId || !selectedSubmissionDetail || !selectedSubmissionDraft || !selectedAssessmentId) return;

    const manualComponents = selectedSubmissionDraft.components
      .filter((component) => component.value.trim() !== '')
      .map((component) => ({
        component_key: component.componentKey,
        score: Number(component.value),
        feedback: component.feedback.trim() || undefined,
      }));

    if (manualComponents.some((component) => !Number.isFinite(component.score) || component.score < 0)) {
      setWorkspaceError('Component scores must be valid positive numbers.');
      return;
    }

    if (manualComponents.length === 0 && !selectedSubmissionDraft.useAiSuggestions) {
      setWorkspaceError('Enter manual scores or enable AI suggestions before finalizing.');
      return;
    }

    setFinalizingSubmissionId(selectedSubmissionId);
    setWorkspaceError(null);
    setWorkspaceNotice(null);

    try {
      const detail = await assessmentApi.finalizeSubmission(token, selectedSubmissionId, {
        feedback: selectedSubmissionDraft.feedback.trim() || undefined,
        component_scores: manualComponents.length > 0 ? manualComponents : undefined,
        use_ai_suggestions: selectedSubmissionDraft.useAiSuggestions,
      });
      setSubmissionDetails((prev) => ({ ...prev, [selectedSubmissionId]: detail }));
      setGradeDrafts((prev) => ({ ...prev, [selectedSubmissionId]: buildSubmissionGradeDraft(detail) }));
      setWorkspaceNotice('Submission finalized and synced to progress results.');
      await refreshSubmissions(selectedAssessmentId, true);
    } catch (error: any) {
      setWorkspaceError(error?.message || 'Failed to finalize submission.');
    } finally {
      setFinalizingSubmissionId(null);
    }
  };

  const confirmAssessmentEditorClose = async () => {
    const nextAction = pendingEditorAction;
    setPendingEditorAction(null);
    if (editingAssessment) {
      await saveAssessment(editingAssessment, nextAction);
      return;
    }
    if (creatingGroup) {
      await createAssessment(creatingGroup.roadmap_item_id, nextAction);
      return;
    }
    setShowEditorCloseConfirm(false);
  };

  const discardAssessmentEditorClose = () => {
    closeAssessmentEditor(pendingEditorAction);
  };

  const saveAssessmentEditorInPlace = async () => {
    if (editingAssessment) {
      await saveAssessment(editingAssessment, null, false);
      return;
    }
    if (creatingGroup) {
      await createAssessment(creatingGroup.roadmap_item_id, null, false);
    }
  };

  if (!selectedOffering) {
    return (
      <EmptyStateCard
        title="Assessments Workspace"
        description="Select an offering to manage assessments and grading."
      />
    );
  }

  return (
    <div className="space-y-4">
      <InlineErrorBanner message={workspaceError} />
      {workspaceNotice && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {workspaceNotice}
        </div>
      )}

      <SectionCard
        title="Assessment & Grading"
        description={`${selectedOffering.courseCode} • ${selectedOffering.term}${selectedOffering.year ? ` ${selectedOffering.year}` : ''}`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setWorkspaceTab('assessments')}
              className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                workspaceTab === 'assessments'
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Assessments
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceTab('grading')}
              className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                workspaceTab === 'grading'
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Grading
            </button>
            <button
              type="button"
              onClick={() => refreshAssessments(true)}
              disabled={loadingAssessments}
              className="rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loadingAssessments ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        )}
      >
        {loadingAssessments && assessmentGroups.length === 0 ? (
          <p className="text-sm text-gray-500">Loading assessments...</p>
        ) : hasInitialAssessmentLoadError ? (
          <EmptyStateCard
            title="Could Not Load Assessments"
            description="The assessment workspace could not be loaded for this offering. Retry the request, and if the database was only partially migrated, apply the grading migration before using the grading features."
            action={(
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshAssessments(true)}
                  className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Retry Load
                </button>
                <button
                  type="button"
                  onClick={onOpenRoadmapTab}
                  className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Open Roadmap Builder
                </button>
              </div>
            )}
          />
        ) : assessmentGroups.length === 0 ? (
          <EmptyStateCard
            title="No Roadmap Items Yet"
            description="Build the course roadmap first, then attach assessments to each roadmap item here."
            action={(
              <button
                type="button"
                onClick={onOpenRoadmapTab}
                className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                Open Roadmap Builder
              </button>
            )}
          />
        ) : workspaceTab === 'assessments' ? (
          <div className="space-y-4 lg:flex lg:h-[calc(100vh-17rem)] lg:flex-col lg:overflow-hidden">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              <ScoreChip label="Roadmap Items" value={assessmentGroups.length} />
              <ScoreChip label="Assessments" value={assessments.length} />
              <ScoreChip label="Active Tasks" value={activeAssessmentCount} denominator={assessments.length || null} />
              <ScoreChip label="Templates" value={loadingTemplates ? null : templateVersions.length} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAssessmentFilter('all')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${assessmentFilter === 'all' ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setAssessmentFilter('active')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${assessmentFilter === 'active' ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setAssessmentFilter('inactive')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${assessmentFilter === 'inactive' ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                Inactive
              </button>
            </div>

            <div className="space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
              {visibleAssessmentGroups.map((group) => (
                <div key={group.roadmap_item_id} className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                        Week {group.roadmap_item_week_no ?? '--'}
                      </p>
                      <h3 className="text-lg font-semibold text-gray-900">{group.roadmap_item_title}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={group.roadmap_item_status} />
                      <button
                        type="button"
                        onClick={() => {
                          requestAssessmentEditorAction({ mode: 'create', roadmapItemId: group.roadmap_item_id });
                        }}
                        className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        {expandedCreateItemId === group.roadmap_item_id ? 'Close New Task' : 'New Assessment'}
                      </button>
                    </div>
                  </div>

                  {group.assessments.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-5 text-sm text-gray-500">
                      No assessments are linked to this roadmap item yet.
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                      {group.assessments.map((assessment) => {
                        const isExpanded = expandedAssessmentId === assessment.id;
                        const isBusy = savingAssessmentId === assessment.id || togglingAssessmentId === assessment.id;

                        return (
                          <div key={assessment.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-base font-semibold text-gray-900">{assessment.title}</h4>
                                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] text-gray-600">
                                    {assessment.task_type.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-gray-500">{summarizeScheme(assessment.current_grading_scheme)}</p>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                                  <span>Max score: {formatPoints(assessment.max_score)}</span>
                                  <span>Attempts: {assessment.max_attempts}</span>
                                  <span>Due: {assessment.due_at ? formatDateTime(assessment.due_at) : 'Open ended'}</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusPill status={assessment.is_active ? 'approved_active' : 'archived'} />
                                <button
                                  type="button"
                                  onClick={() => {
                                    requestAssessmentEditorAction({ mode: 'edit', assessmentId: assessment.id });
                                  }}
                                  className="rounded-2xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                  {isExpanded ? 'Editing...' : 'Edit'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleAssessmentActive(assessment)}
                                  disabled={isBusy}
                                  className="rounded-2xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                  {assessment.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            </div>

                            {assessment.description && (
                              <p className="mt-3 text-sm text-gray-600">{assessment.description}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="xl:h-[calc(100vh-17rem)] xl:overflow-hidden">
            <div className="grid grid-cols-1 gap-3 xl:h-full xl:grid-cols-[340px_minmax(0,1fr)]">
              <div className="grid gap-3 xl:min-h-0 xl:grid-rows-[minmax(220px,0.78fr)_minmax(0,1.22fr)]">
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 xl:flex xl:min-h-0 xl:flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Assessment Queue</p>
                      <p className="text-xs text-gray-500">Choose a task, then review its submissions.</p>
                    </div>
                    <ScoreChip label="Pending" value={pendingSubmissionCount} />
                  </div>

                  <div className="mt-4 max-h-[18rem] space-y-2 overflow-y-auto pr-1 xl:min-h-0 xl:max-h-none xl:flex-1">
                    {assessments.map((assessment) => (
                      <button
                        key={assessment.id}
                        type="button"
                        onClick={() => setSelectedAssessmentId(assessment.id)}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                          selectedAssessmentId === assessment.id
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-gray-900">{assessment.title}</p>
                            <p className="text-xs text-gray-500">{summarizeScheme(assessment.current_grading_scheme)}</p>
                          </div>
                          <StatusPill status={assessment.is_active ? 'approved_active' : 'archived'} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-4 xl:flex xl:min-h-0 xl:flex-col">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Submissions</p>
                      <p className="text-xs text-gray-500">
                        {selectedAssessment ? selectedAssessment.title : 'Select an assessment'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={submissionFilter}
                        onChange={(event) => setSubmissionFilter(event.target.value as SubmissionFilter)}
                        className="rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-700"
                      >
                        <option value="all">All</option>
                        <option value="submitted">Submitted</option>
                        <option value="ai_graded">AI graded</option>
                        <option value="finalized">Finalized</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => selectedAssessmentId && refreshSubmissions(selectedAssessmentId, true)}
                        disabled={!selectedAssessmentId || loadingSubmissionsByAssessment[selectedAssessmentId]}
                        className="rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[26rem] overflow-y-auto pr-1 xl:min-h-0 xl:max-h-none xl:flex-1">
                    {!selectedAssessment ? (
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                        Pick an assessment to see submissions.
                      </div>
                    ) : loadingSubmissionsByAssessment[selectedAssessmentId] && submissionRows.length === 0 ? (
                      <p className="text-sm text-gray-500">Loading submissions...</p>
                    ) : filteredSubmissionRows.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                        No submissions match the current filter.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredSubmissionRows.map((submission) => (
                          <button
                            key={submission.id}
                            type="button"
                            onClick={() => setSelectedSubmissionId(submission.id)}
                            className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                              selectedSubmissionId === submission.id
                                ? 'border-blue-200 bg-blue-50'
                                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-gray-900">{submission.student_name}</p>
                                <p className="truncate text-xs text-gray-500">
                                  {submission.student_identifier || submission.student_email || `Attempt ${submission.attempt_no}`}
                                </p>
                              </div>
                              <StatusPill status={submission.workflow_status} />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                              <span>Attempt #{submission.attempt_no}</span>
                              <span>Submitted: {formatDateTime(submission.submitted_at)}</span>
                              <span>Score: {formatPoints(submission.score)}</span>
                            </div>
                            {submission.submission_text && (
                              <p className="mt-2 line-clamp-3 text-xs text-gray-600">
                                {submission.submission_text}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-4 xl:min-h-0 xl:overflow-hidden">
                <div className="max-h-[70vh] overflow-y-auto pr-1 xl:h-full xl:max-h-none">
                  {!selectedSubmissionId ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                      Select a submission to review AI suggestions and finalize grading.
                    </div>
                  ) : loadingSubmissionDetailId === selectedSubmissionId && !selectedSubmissionDetail ? (
                    <p className="text-sm text-gray-500">Loading submission detail...</p>
                  ) : !selectedSubmissionDetail ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                      Submission detail is not available yet.
                    </div>
                  ) : (
                    (() => {
                      const draft = selectedSubmissionDraft || buildSubmissionGradeDraft(selectedSubmissionDetail);
                      const scheme = selectedSubmissionDetail.grading_scheme || selectedSubmissionDetail.assessment.current_grading_scheme;
                      const locked = selectedSubmissionDetail.workflow_status === 'finalized';
                      const aiSuggestionCount = selectedSubmissionDetail.latest_ai_evaluation?.component_suggestions?.length || 0;
                      const totalManual = draft.components.reduce((sum, component) => sum + Number(toNumber(component.value) || 0), 0);

                      return (
                        <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                          <div>
                            <p className="text-lg font-semibold text-gray-900">{selectedSubmissionDetail.student.full_name || selectedSubmissionDetail.student.username}</p>
                            <p className="text-sm text-gray-500">
                              {selectedSubmissionDetail.student.university_id || selectedSubmissionDetail.student.email || selectedSubmissionDetail.student.username}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {selectedSubmissionDetail.assessment.title} • Attempt #{selectedSubmissionDetail.attempt.attempt_no}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill status={selectedSubmissionDetail.workflow_status} />
                            <button
                              type="button"
                              onClick={() => refreshSubmissionDetail(selectedSubmissionId, true)}
                              className="rounded-2xl border border-white/70 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                            >
                              Refresh Detail
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                          <ScoreChip label="Current Score" value={selectedSubmissionDetail.attempt.score} denominator={selectedSubmissionDetail.assessment.max_score} />
                          <ScoreChip label="Manual Total" value={totalManual} denominator={selectedSubmissionDetail.assessment.max_score} />
                          <ScoreChip label="AI Suggestions" value={aiSuggestionCount} />
                          <ScoreChip label="Submitted" value={selectedSubmissionDetail.attempt.submitted_at ? 1 : 0} denominator={1} />
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">Submission Text</p>
                              <p className="text-xs text-gray-500">Submitted {formatDateTime(selectedSubmissionDetail.attempt.submitted_at)}</p>
                            </div>
                            {selectedSubmissionDetail.attempt.finalized_at && (
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                Finalized {formatDateTime(selectedSubmissionDetail.attempt.finalized_at)}
                              </p>
                            )}
                          </div>
                          <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700">
                            {selectedSubmissionDetail.attempt.submission_text?.trim() || 'No submission text provided.'}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">AI Suggestions</p>
                              <p className="text-xs text-gray-500">
                                {selectedSubmissionDetail.latest_ai_evaluation
                                  ? `Status: ${selectedSubmissionDetail.latest_ai_evaluation.status.replace(/_/g, ' ')}`
                                  : 'No AI grading run yet'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={runAiGrade}
                              disabled={Boolean(runningAiSubmissionId) || locked}
                              className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                            >
                              {runningAiSubmissionId === selectedSubmissionId ? 'Running AI...' : aiSuggestionCount > 0 ? 'Re-run AI Grading' : 'Run AI Grading'}
                            </button>
                          </div>

                          {selectedSubmissionDetail.latest_ai_evaluation?.error_text && (
                            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                              {selectedSubmissionDetail.latest_ai_evaluation.error_text}
                            </div>
                          )}

                          {selectedSubmissionDetail.latest_ai_evaluation?.component_suggestions?.length ? (
                            <div className="mt-3 space-y-2">
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                <ScoreChip label="Suggested Total" value={selectedSubmissionDetail.latest_ai_evaluation.suggested_total_score} denominator={selectedSubmissionDetail.assessment.max_score} />
                                <ScoreChip label="Confidence" value={selectedSubmissionDetail.latest_ai_evaluation.overall_confidence ? selectedSubmissionDetail.latest_ai_evaluation.overall_confidence * 100 : null} denominator={100} />
                                <ScoreChip label="Components" value={selectedSubmissionDetail.latest_ai_evaluation.component_suggestions.length} />
                              </div>
                              {selectedSubmissionDetail.latest_ai_evaluation.component_suggestions.map((suggestion) => (
                                <div key={suggestion.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-semibold text-gray-900">{suggestion.component_label}</p>
                                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                      {formatPoints(suggestion.suggested_score)} / {formatPoints(suggestion.max_points)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-gray-500">
                                    Confidence: {suggestion.confidence !== null && suggestion.confidence !== undefined ? `${Math.round(suggestion.confidence * 100)}%` : 'Not provided'}
                                  </p>
                                  {suggestion.rationale && (
                                    <p className="mt-2 text-sm text-gray-600">{suggestion.rationale}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-3 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-4 text-sm text-gray-500">
                              AI suggestions will appear here once a grading run completes.
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">Lecturer Grading Panel</p>
                              <p className="text-xs text-gray-500">
                                {scheme ? summarizeScheme(scheme) : 'No grading scheme available'}
                              </p>
                            </div>
                            <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={draft.useAiSuggestions}
                                disabled={locked || aiSuggestionCount === 0}
                                onChange={(event) => updateGradeDraft(selectedSubmissionId, { ...draft, useAiSuggestions: event.target.checked })}
                              />
                              Use AI suggestions for empty components
                            </label>
                          </div>

                          {locked && (
                            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                              This submission has been finalized and is locked in the lecturer workflow.
                            </div>
                          )}

                          <div className="mt-4 space-y-3">
                            {draft.components.map((component, index) => (
                              <div key={component.componentKey} className="rounded-2xl border border-gray-200 bg-white p-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="font-semibold text-gray-900">{component.label}</p>
                                    <p className="text-xs text-gray-500">Max {formatPoints(component.maxPoints)} points</p>
                                  </div>
                                  {component.suggestedScore !== null && component.suggestedScore !== undefined && (
                                    <button
                                      type="button"
                                      disabled={locked}
                                      onClick={() => {
                                        const next = { ...draft, components: [...draft.components] };
                                        next.components[index] = {
                                          ...next.components[index],
                                          value: String(component.suggestedScore),
                                        };
                                        updateGradeDraft(selectedSubmissionId, next);
                                      }}
                                      className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                    >
                                      Use AI {formatPoints(component.suggestedScore)}
                                    </button>
                                  )}
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    disabled={locked}
                                    value={component.value}
                                    onChange={(event) => {
                                      const next = { ...draft, components: [...draft.components] };
                                      next.components[index] = {
                                        ...next.components[index],
                                        value: event.target.value,
                                      };
                                      updateGradeDraft(selectedSubmissionId, next);
                                    }}
                                    className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                                    placeholder="Score"
                                  />
                                  <textarea
                                    rows={2}
                                    disabled={locked}
                                    value={component.feedback}
                                    onChange={(event) => {
                                      const next = { ...draft, components: [...draft.components] };
                                      next.components[index] = {
                                        ...next.components[index],
                                        feedback: event.target.value,
                                      };
                                      updateGradeDraft(selectedSubmissionId, next);
                                    }}
                                    className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                                    placeholder="Optional component feedback"
                                  />
                                </div>
                                {component.rationale && (
                                  <p className="mt-2 text-xs text-gray-500">{component.rationale}</p>
                                )}
                              </div>
                            ))}
                          </div>

                          <label className="mt-4 block space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Overall Feedback</span>
                            <textarea
                              rows={4}
                              disabled={locked}
                              value={draft.feedback}
                              onChange={(event) => updateGradeDraft(selectedSubmissionId, { ...draft, feedback: event.target.value })}
                              className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                              placeholder="Feedback for the student"
                            />
                          </label>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm text-gray-500">
                              Finalizing writes the final score, rubric totals, and synced result snapshot.
                            </div>
                            <button
                              type="button"
                              onClick={finalizeSelectedSubmission}
                              disabled={locked || finalizingSubmissionId === selectedSubmissionId}
                              className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                              {finalizingSubmissionId === selectedSubmissionId ? 'Finalizing...' : 'Finalize Grade'}
                            </button>
                          </div>
                        </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      <AssessmentEditorModal
        open={isAssessmentEditorOpen}
        title={editingAssessment ? 'Edit Assessment Task' : 'Create Assessment Task'}
        description={
          activeEditorGroup
            ? `${activeEditorGroup.roadmap_item_title} • Week ${activeEditorGroup.roadmap_item_week_no ?? '--'}`
            : undefined
        }
        saveLabel={editingAssessment ? 'Save' : 'Save'}
        saveBusy={activeEditorBusy}
        onClose={requestCloseAssessmentEditor}
        onSave={saveAssessmentEditorInPlace}
      >
        {editingAssessment ? (
          <AssessmentFormPanel
            draft={getAssessmentDraft(editingAssessment)}
            templateVersions={templateVersions}
            busy={savingAssessmentId === editingAssessment.id}
            submitLabel="Update & Close"
            errorMessage={workspaceError}
            onSubmit={() => saveAssessment(editingAssessment)}
            onCancel={requestCloseAssessmentEditor}
            onChange={(next) => updateAssessmentDraft(editingAssessment.id, next)}
          />
        ) : creatingGroup ? (
          <AssessmentFormPanel
            draft={getCreateDraft(creatingGroup.roadmap_item_id)}
            templateVersions={templateVersions}
            busy={creatingItemId === creatingGroup.roadmap_item_id}
            submitLabel="Create & Close"
            errorMessage={workspaceError}
            onSubmit={() => createAssessment(creatingGroup.roadmap_item_id)}
            onCancel={requestCloseAssessmentEditor}
            onChange={(next) => updateCreateDraft(creatingGroup.roadmap_item_id, next)}
          />
        ) : null}
      </AssessmentEditorModal>

      <AssessmentEditorCloseConfirm
        open={showEditorCloseConfirm}
        updating={activeEditorBusy}
        onConfirmSave={confirmAssessmentEditorClose}
        onDiscard={discardAssessmentEditorClose}
        onCancel={() => {
          setPendingEditorAction(null);
          setShowEditorCloseConfirm(false);
        }}
      />
    </div>
  );
}
