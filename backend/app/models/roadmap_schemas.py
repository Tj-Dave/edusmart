from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CourseSpecExtractRequest(BaseModel):
    document_id: UUID
    mode: Literal["extract_only", "extract_and_draft_roadmap"] = "extract_only"


class CourseSpecUpdateRequest(BaseModel):
    spec_json: dict[str, Any] | None = None


class CourseSpecOut(BaseModel):
    id: UUID
    course_offering_id: UUID
    source_document_id: UUID | None
    status: str
    spec_json: dict[str, Any]
    created_by_user_id: UUID | None
    approved_by_user_id: UUID | None
    created_at: Any
    updated_at: Any
    approved_at: Any | None

    class Config:
        from_attributes = True


class CourseSpecExtractOut(BaseModel):
    spec: CourseSpecOut
    generated_roadmap_items: list["RoadmapItemOut"] | None = None


class RoadmapGenerateRequest(BaseModel):
    spec_id: UUID | None = None
    archive_existing_drafts: bool = True


class RoadmapActivateRequest(BaseModel):
    archive_existing_active: bool = True


class RoadmapItemCreateRequest(BaseModel):
    sequence_no: int = Field(..., ge=1)
    week_no: int | None = Field(default=None, ge=1)
    title: str = Field(..., min_length=1, max_length=500)
    key_content: str | None = None
    teaching_activity: str | None = None
    estimated_hours: float | None = Field(default=None, ge=0)
    status: Literal["draft", "approved_active", "archived"] = "draft"


class RoadmapItemUpdateRequest(BaseModel):
    sequence_no: int | None = Field(default=None, ge=1)
    week_no: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=500)
    key_content: str | None = None
    teaching_activity: str | None = None
    estimated_hours: float | None = Field(default=None, ge=0)
    status: Literal["draft", "approved_active", "archived"] | None = None


class RubricLevelInput(BaseModel):
    component_key: str = Field(..., min_length=1, max_length=120)
    label: str = Field(..., min_length=1, max_length=200)
    min_points: float = Field(..., ge=0)
    max_points: float = Field(..., ge=0)
    descriptor: str = Field(..., min_length=1)
    display_order: int = Field(default=0, ge=0)


class GradingComponentInput(BaseModel):
    key: str = Field(..., min_length=1, max_length=120)
    label: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    max_points: float = Field(..., gt=0)
    display_order: int = Field(default=0, ge=0)
    is_auto_gradable: bool = False
    manual_only: bool = False


class GradingSchemeInput(BaseModel):
    scheme_name: str | None = Field(default=None, max_length=200)
    auto_grading_enabled: bool = False
    auto_grading_instructions: str | None = None
    components: list[GradingComponentInput] = Field(default_factory=list, min_length=1)
    rubric_levels: list[RubricLevelInput] = Field(default_factory=list)


class GradingTemplateCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    grading_scheme: GradingSchemeInput


class GradingTemplateUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    is_active: bool | None = None
    grading_scheme: GradingSchemeInput | None = None


class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    task_type: str = "quiz"
    description: str | None = None
    practical_brief: str | None = None
    required_tools: str | None = None
    expected_artifact: str | None = None
    safety_notes: str | None = None
    rubric_json: dict[str, Any] | None = None
    max_score: float = Field(default=100, gt=0)
    weight: float | None = Field(default=None, ge=0)
    due_at: datetime | None = None
    is_required: bool = True
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True
    max_attempts: int = Field(default=1, ge=1)
    attempt_scoring_rule: Literal["best", "latest", "average", "first"] = "best"
    allow_late_submission: bool = False
    late_penalty_percent: float | None = Field(default=None, ge=0, le=100)
    grading_template_version_id: UUID | None = None
    grading_scheme: GradingSchemeInput | None = None


class TaskUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    task_type: str | None = None
    description: str | None = None
    practical_brief: str | None = None
    required_tools: str | None = None
    expected_artifact: str | None = None
    safety_notes: str | None = None
    rubric_json: dict[str, Any] | None = None
    max_score: float | None = Field(default=None, gt=0)
    weight: float | None = Field(default=None, ge=0)
    due_at: datetime | None = None
    is_required: bool | None = None
    display_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    max_attempts: int | None = Field(default=None, ge=1)
    attempt_scoring_rule: Literal["best", "latest", "average", "first"] | None = None
    allow_late_submission: bool | None = None
    late_penalty_percent: float | None = Field(default=None, ge=0, le=100)
    grading_template_version_id: UUID | None = None
    grading_scheme: GradingSchemeInput | None = None


class TaskReorderRequest(BaseModel):
    task_ids: list[UUID] = Field(default_factory=list, min_length=1)


class RubricLevelOut(BaseModel):
    id: UUID
    component_key: str
    label: str
    min_points: float
    max_points: float
    descriptor: str
    display_order: int

    class Config:
        from_attributes = True


class GradingComponentOut(BaseModel):
    id: UUID
    key: str
    label: str
    description: str | None
    max_points: float
    display_order: int
    is_auto_gradable: bool
    manual_only: bool
    rubric_levels: list[RubricLevelOut] = []

    class Config:
        from_attributes = True


class TaskGradingSchemeOut(BaseModel):
    id: UUID
    task_id: UUID
    version_no: int
    scheme_name: str | None
    source_template_version_id: UUID | None
    auto_grading_enabled: bool
    auto_grading_instructions: str | None
    created_by_user_id: UUID | None
    created_at: Any
    components: list[GradingComponentOut] = []

    class Config:
        from_attributes = True


class GradingTemplateVersionOut(BaseModel):
    id: UUID
    template_id: UUID
    version_no: int
    scheme_name: str | None
    auto_grading_enabled: bool
    auto_grading_instructions: str | None
    created_by_user_id: UUID | None
    created_at: Any
    components: list[GradingComponentOut] = []

    class Config:
        from_attributes = True


class GradingTemplateOut(BaseModel):
    id: UUID
    owner_user_id: UUID
    name: str
    description: str | None
    is_active: bool
    latest_version_no: int
    created_at: Any
    updated_at: Any
    versions: list[GradingTemplateVersionOut] = []

    class Config:
        from_attributes = True


class RoadmapTaskOut(BaseModel):
    id: UUID
    roadmap_item_id: UUID
    title: str
    task_type: str
    description: str | None
    practical_brief: str | None
    required_tools: str | None
    expected_artifact: str | None
    safety_notes: str | None
    rubric_json: dict[str, Any] | None
    max_score: float
    weight: float | None
    due_at: Any | None
    is_required: bool
    display_order: int
    is_active: bool
    max_attempts: int
    attempt_scoring_rule: str
    allow_late_submission: bool
    late_penalty_percent: float | None
    current_grading_scheme_version_id: UUID | None
    created_at: Any
    updated_at: Any

    class Config:
        from_attributes = True


class AssessmentTaskOut(RoadmapTaskOut):
    current_grading_scheme: TaskGradingSchemeOut | None = None

    class Config:
        from_attributes = True


class AssessmentRoadmapGroupOut(BaseModel):
    roadmap_item_id: UUID
    roadmap_item_title: str
    roadmap_item_week_no: int | None = None
    roadmap_item_status: str
    assessments: list[AssessmentTaskOut] = []


class RoadmapItemOut(BaseModel):
    id: UUID
    course_offering_id: UUID
    spec_id: UUID | None
    sequence_no: int
    week_no: int | None
    title: str
    key_content: str | None
    teaching_activity: str | None
    estimated_hours: float | None
    assessment_task_count: int
    status: str
    created_at: Any
    updated_at: Any
    assessment_tasks: list[RoadmapTaskOut] = []

    class Config:
        from_attributes = True


class EnrollmentRoadmapProgressOut(BaseModel):
    id: UUID
    enrollment_id: UUID
    roadmap_item_id: UUID
    status: str
    completion_percent: int
    avg_score: float | None
    best_score: float | None
    total_score: float | None
    max_total_score: float | None
    started_at: Any | None
    submitted_at: Any | None
    completed_at: Any | None
    notes: str | None
    created_at: Any
    updated_at: Any

    class Config:
        from_attributes = True


class EnrollmentTaskResultOut(BaseModel):
    id: UUID
    enrollment_id: UUID
    task_id: UUID
    status: str
    attempt_no: int
    score: float | None
    score_source: str | None
    max_score_snapshot: float
    weight_snapshot: float | None
    grading_scheme_version_id: UUID | None
    latest_ai_evaluation_id: UUID | None
    submitted_at: Any | None
    graded_at: Any | None
    finalized_at: Any | None
    graded_by_user_id: UUID | None
    feedback: str | None
    evidence_url: str | None
    artifact_url: str | None
    reflection_text: str | None
    submission_text: str | None
    rubric_scores_json: dict[str, Any] | None
    created_at: Any
    updated_at: Any

    class Config:
        from_attributes = True


class EnrollmentTaskSummaryOut(BaseModel):
    task_id: UUID
    selected_score: float
    selected_attempt_no: int | None
    attempts_count: int
    latest_status: str | None


class EnrollmentRoadmapItemOut(BaseModel):
    item: RoadmapItemOut
    progress: EnrollmentRoadmapProgressOut | None
    task_summaries: list[EnrollmentTaskSummaryOut] = []


class EnrollmentRoadmapViewOut(BaseModel):
    enrollment_id: UUID
    offering_id: UUID
    items: list[EnrollmentRoadmapItemOut] = []


class EnrollmentProgressSummaryOut(BaseModel):
    enrollment_id: UUID
    offering_id: UUID
    total_items: int
    items_completed: int
    overall_completion_percent: float
    avg_score: float | None = None
    best_score: float | None = None
    total_score: float = 0
    max_total_score: float = 0


class AttemptCreateRequest(BaseModel):
    evidence_url: str | None = None
    artifact_url: str | None = None
    reflection_text: str | None = None
    submission_text: str | None = None
    payload: dict[str, Any] | None = None


class AttemptSubmitRequest(BaseModel):
    evidence_url: str | None = None
    artifact_url: str | None = None
    reflection_text: str | None = None
    submission_text: str | None = None
    payload: dict[str, Any] | None = None


class AttemptComponentScoreInput(BaseModel):
    component_key: str = Field(..., min_length=1, max_length=120)
    score: float = Field(..., ge=0)
    feedback: str | None = None


class AttemptGradeRequest(BaseModel):
    score: float | None = Field(default=None, ge=0)
    feedback: str | None = None
    rubric_scores: dict[str, float] | None = None
    component_scores: list[AttemptComponentScoreInput] | None = None
    use_ai_suggestions: bool = False


class AttemptComponentScoreOut(BaseModel):
    id: UUID
    component_id: UUID
    component_key: str
    component_label: str
    max_points: float
    score: float
    feedback: str | None
    source: str
    created_by_user_id: UUID | None
    created_at: Any
    updated_at: Any

    class Config:
        from_attributes = True


class AttemptAiComponentSuggestionOut(BaseModel):
    id: UUID
    component_id: UUID
    component_key: str
    component_label: str
    max_points: float
    suggested_score: float
    confidence: float | None
    rationale: str | None
    created_at: Any

    class Config:
        from_attributes = True


class AttemptAiEvaluationOut(BaseModel):
    id: UUID
    status: str
    trigger_source: str | None
    provider: str | None
    model_name: str | None
    overall_confidence: float | None
    suggested_total_score: float | None
    error_text: str | None
    started_at: Any | None
    completed_at: Any | None
    created_at: Any
    updated_at: Any
    component_suggestions: list[AttemptAiComponentSuggestionOut] = []

    class Config:
        from_attributes = True


class AssessmentSubmissionListItemOut(BaseModel):
    id: UUID
    enrollment_id: UUID
    task_id: UUID
    attempt_no: int
    student_user_id: UUID
    student_name: str
    student_email: str | None = None
    student_identifier: str | None = None
    status: str
    workflow_status: str
    score: float | None = None
    submitted_at: Any | None = None
    graded_at: Any | None = None
    finalized_at: Any | None = None
    feedback: str | None = None
    submission_text: str | None = None
    latest_ai_evaluation_status: str | None = None


class AttemptGradingDetailOut(BaseModel):
    attempt: EnrollmentTaskResultOut
    grading_scheme: TaskGradingSchemeOut | None
    component_scores: list[AttemptComponentScoreOut] = []
    latest_ai_evaluation: AttemptAiEvaluationOut | None = None


class SubmissionStudentOut(BaseModel):
    user_id: UUID
    username: str
    full_name: str | None = None
    email: str | None = None
    university_id: str | None = None


class SubmissionRoadmapItemOut(BaseModel):
    id: UUID
    title: str
    week_no: int | None = None
    status: str


class SubmissionDetailOut(BaseModel):
    attempt: EnrollmentTaskResultOut
    grading_scheme: TaskGradingSchemeOut | None
    component_scores: list[AttemptComponentScoreOut] = []
    latest_ai_evaluation: AttemptAiEvaluationOut | None = None
    student: SubmissionStudentOut
    assessment: AssessmentTaskOut
    roadmap_item: SubmissionRoadmapItemOut
    workflow_status: str


class AttemptActionOut(BaseModel):
    attempt: EnrollmentTaskResultOut
    progress: EnrollmentRoadmapProgressOut | None = None


class GenericActionOut(BaseModel):
    ok: bool = True
    message: str


class AssessmentActiveUpdateRequest(BaseModel):
    is_active: bool


class SubmissionFinalizeRequest(BaseModel):
    score: float | None = Field(default=None, ge=0)
    feedback: str | None = None
    rubric_scores: dict[str, float] | None = None
    component_scores: list[AttemptComponentScoreInput] | None = None
    use_ai_suggestions: bool = False
