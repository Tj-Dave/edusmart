export type ProgressStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'graded'
  | 'completed'
  | 'draft'
  | 'approved_active'
  | 'archived'
  | string;

export type AttemptScoringRule = 'best' | 'latest' | 'average' | 'first' | string;

export interface TaskResult {
  id?: string;
  enrollment_id?: string;
  roadmap_item_id?: string;
  task_id?: string;
  attempt_no?: number;
  status?: ProgressStatus;
  score?: number | null;
  feedback?: string | null;
  evidence_url?: string | null;
  payload?: unknown;
  submitted_at?: string | null;
  graded_at?: string | null;
  graded_by_user_id?: string | null;
  is_late?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export interface AssessmentTask {
  id?: string;
  roadmap_item_id?: string;
  title?: string;
  description?: string | null;
  task_type?: string | null;
  due_at?: string | null;
  max_attempts?: number | null;
  attempt_scoring_rule?: AttemptScoringRule;
  allow_late_submission?: boolean | null;
  late_penalty_percent?: number | null;
  max_score?: number | null;
  weight?: number | null;
  order_index?: number | null;
  is_required?: boolean | null;
  is_active?: boolean | null;
  results?: TaskResult[];
  latest_result?: TaskResult | null;
  result_summary?: TaskResult | null;
}

export interface EnrollmentRoadmapProgress {
  id?: string;
  enrollment_id?: string;
  roadmap_item_id?: string;
  status?: ProgressStatus;
  completion_percent?: number | null;
  total_score?: number | null;
  max_total_score?: number | null;
  avg_score?: number | null;
  best_score?: number | null;
  submitted_at?: string | null;
  completed_at?: string | null;
  updated_at?: string;
}

export interface RoadmapItem {
  id?: string;
  course_offering_id?: string;
  title?: string;
  description?: string | null;
  week_no?: number | null;
  estimated_hours?: number | null;
  status?: ProgressStatus;
  order_index?: number | null;
  assessment_task_count?: number | null;
  is_active?: boolean | null;
  tasks?: AssessmentTask[];
  progress?: EnrollmentRoadmapProgress | null;
}

export interface RoadmapResponse {
  enrollment_id?: string;
  offering_id?: string;
  course_code?: string;
  items?: RoadmapItem[];
  roadmap_items?: RoadmapItem[];
  progress?: EnrollmentRoadmapProgress[];
  roadmap_progress?: EnrollmentRoadmapProgress[];
  task_results?: TaskResult[];
  summary?: {
    overall_completion_percent?: number | null;
    items_completed?: number | null;
    total_items?: number | null;
    avg_score?: number | null;
    best_score?: number | null;
  } | null;
}

export interface LecturerRoadmapResponse {
  offering_id?: string;
  spec_id?: string;
  spec_status?: string;
  spec_json?: Record<string, unknown> | null;
  items?: RoadmapItem[];
  roadmap_items?: RoadmapItem[];
  metadata?: Record<string, unknown>;
}
