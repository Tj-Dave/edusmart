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


class TaskReorderRequest(BaseModel):
    task_ids: list[UUID] = Field(default_factory=list, min_length=1)


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
    created_at: Any
    updated_at: Any

    class Config:
        from_attributes = True


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
    max_score_snapshot: float
    weight_snapshot: float | None
    submitted_at: Any | None
    graded_at: Any | None
    graded_by_user_id: UUID | None
    feedback: str | None
    evidence_url: str | None
    artifact_url: str | None
    reflection_text: str | None
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
    payload: dict[str, Any] | None = None


class AttemptSubmitRequest(BaseModel):
    evidence_url: str | None = None
    artifact_url: str | None = None
    reflection_text: str | None = None
    payload: dict[str, Any] | None = None


class AttemptGradeRequest(BaseModel):
    score: float = Field(..., ge=0)
    feedback: str | None = None
    rubric_scores: dict[str, float] | None = None


class AttemptActionOut(BaseModel):
    attempt: EnrollmentTaskResultOut
    progress: EnrollmentRoadmapProgressOut | None = None


class GenericActionOut(BaseModel):
    ok: bool = True
    message: str
