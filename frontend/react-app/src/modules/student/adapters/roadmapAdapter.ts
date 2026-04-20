import {
  AssessmentTask,
  EnrollmentRoadmapProgress,
  RoadmapItem,
  RoadmapResponse,
  TaskResult,
} from '../../../types/progress';

const asArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  return [];
};

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

export const normalizeTaskResult = (raw: any): TaskResult => ({
  id: raw?.id?.toString?.() || raw?.result_id?.toString?.() || undefined,
  enrollment_id: raw?.enrollment_id?.toString?.(),
  roadmap_item_id: raw?.roadmap_item_id?.toString?.(),
  task_id: raw?.task_id?.toString?.(),
  attempt_no: asNumber(raw?.attempt_no) || undefined,
  attempts_count: asNumber(raw?.attempts_count),
  status: raw?.status,
  score: asNumber(raw?.score),
  score_source: raw?.score_source ?? null,
  max_score_snapshot: asNumber(raw?.max_score_snapshot),
  weight_snapshot: asNumber(raw?.weight_snapshot),
  grading_scheme_version_id: raw?.grading_scheme_version_id?.toString?.() ?? null,
  latest_ai_evaluation_id: raw?.latest_ai_evaluation_id?.toString?.() ?? null,
  feedback: raw?.feedback ?? null,
  evidence_url: raw?.evidence_url ?? null,
  artifact_url: raw?.artifact_url ?? null,
  reflection_text: raw?.reflection_text ?? null,
  submission_text: raw?.submission_text ?? null,
  rubric_scores_json:
    raw?.rubric_scores_json && typeof raw.rubric_scores_json === 'object'
      ? raw.rubric_scores_json
      : null,
  payload: raw?.payload,
  submitted_at: raw?.submitted_at ?? null,
  graded_at: raw?.graded_at ?? null,
  finalized_at: raw?.finalized_at ?? null,
  graded_by_user_id: raw?.graded_by_user_id?.toString?.() ?? null,
  is_late: typeof raw?.is_late === 'boolean' ? raw.is_late : null,
  created_at: raw?.created_at,
  updated_at: raw?.updated_at,
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

const normalizeTask = (raw: any, summary?: any): AssessmentTask => {
  const taskId = raw?.id?.toString?.() || raw?.task_id?.toString?.() || undefined;
  const resultSummary = summary
    ? normalizeTaskResult({
        task_id: taskId,
        attempt_no: summary?.selected_attempt_no ?? summary?.attempts_count,
        attempts_count: summary?.attempts_count,
        status: summary?.latest_status,
        score: summary?.selected_score,
      })
    : raw?.result_summary
    ? normalizeTaskResult(raw.result_summary)
    : null;

  return {
    id: taskId,
    roadmap_item_id: raw?.roadmap_item_id?.toString?.() || raw?.item_id?.toString?.() || undefined,
    title: raw?.title || raw?.name || 'Untitled task',
    description: raw?.description ?? raw?.practical_brief ?? null,
    task_type: raw?.task_type || raw?.type || null,
    due_at: raw?.due_at ?? null,
    practical_brief: raw?.practical_brief ?? null,
    required_tools: raw?.required_tools ?? null,
    expected_artifact: raw?.expected_artifact ?? null,
    safety_notes: raw?.safety_notes ?? null,
    max_attempts: asNumber(raw?.max_attempts) ?? 1,
    attempt_scoring_rule: raw?.attempt_scoring_rule || 'latest',
    allow_late_submission: typeof raw?.allow_late_submission === 'boolean' ? raw.allow_late_submission : null,
    late_penalty_percent: asNumber(raw?.late_penalty_percent),
    max_score: asNumber(raw?.max_score),
    weight: asNumber(raw?.weight),
    order_index: asNumber(raw?.order_index ?? raw?.display_order),
    display_order: asNumber(raw?.display_order),
    is_required: typeof raw?.is_required === 'boolean' ? raw.is_required : null,
    is_active: typeof raw?.is_active === 'boolean' ? raw.is_active : true,
    current_grading_scheme_version_id: raw?.current_grading_scheme_version_id?.toString?.() ?? null,
    attempts_count: asNumber(summary?.attempts_count),
    latest_status: summary?.latest_status || null,
    selected_attempt_no: asNumber(summary?.selected_attempt_no),
    selected_score: asNumber(summary?.selected_score),
    results: asArray<any>(raw?.results).map(normalizeTaskResult),
    latest_result: raw?.latest_result ? normalizeTaskResult(raw.latest_result) : null,
    result_summary: resultSummary,
  };
};

const normalizeRoadmapItem = (raw: any): RoadmapItem => {
  const itemRaw = raw?.item || raw;
  const taskSummaryById = new Map<string, any>();

  for (const summary of asArray<any>(raw?.task_summaries)) {
    const key = summary?.task_id?.toString?.();
    if (key) taskSummaryById.set(key, summary);
  }

  const taskRows = asArray<any>(itemRaw?.assessment_tasks || itemRaw?.tasks);

  return {
    id: itemRaw?.id?.toString?.() || itemRaw?.item_id?.toString?.() || undefined,
    course_offering_id: itemRaw?.course_offering_id?.toString?.() || itemRaw?.offering_id?.toString?.() || undefined,
    spec_id: itemRaw?.spec_id?.toString?.() ?? null,
    title: itemRaw?.title || itemRaw?.name || 'Untitled roadmap item',
    description: itemRaw?.description ?? itemRaw?.key_content ?? itemRaw?.teaching_activity ?? null,
    key_content: itemRaw?.key_content ?? null,
    teaching_activity: itemRaw?.teaching_activity ?? null,
    week_no: asNumber(itemRaw?.week_no),
    estimated_hours: asNumber(itemRaw?.estimated_hours),
    status: itemRaw?.status,
    sequence_no: asNumber(itemRaw?.sequence_no),
    order_index: asNumber(itemRaw?.order_index ?? itemRaw?.sequence_no),
    assessment_task_count: asNumber(itemRaw?.assessment_task_count ?? taskRows.length),
    is_active: typeof itemRaw?.is_active === 'boolean' ? itemRaw.is_active : true,
    tasks: taskRows.map((task) => {
      const taskId = task?.id?.toString?.() || task?.task_id?.toString?.();
      return normalizeTask(task, taskId ? taskSummaryById.get(taskId) : undefined);
    }),
    progress: raw?.progress ? normalizeProgress(raw.progress) : itemRaw?.progress ? normalizeProgress(itemRaw.progress) : null,
  };
};

export const parseRoadmapResponse = (raw: any): RoadmapResponse => {
  const sourceItems = Array.isArray(raw) ? raw : asArray<any>(raw?.items || raw?.roadmap_items);
  const items = sourceItems.map(normalizeRoadmapItem);
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

export const sortAssessmentTasks = (tasks: AssessmentTask[]) => {
  return [...tasks].sort((left, right) => {
    const leftOrder = left.display_order ?? left.order_index ?? 0;
    const rightOrder = right.display_order ?? right.order_index ?? 0;
    return leftOrder - rightOrder;
  });
};
