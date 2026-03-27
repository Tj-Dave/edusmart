from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from app.db.models import (
    AiEvaluationStatus,
    AttemptAiComponentSuggestion,
    AttemptAiEvaluation,
    AttemptComponentScore,
    Enrollment,
    EnrollmentTaskResult,
    EnrollmentTaskStatus,
    OfferingRoadmapItem,
    RoadmapAssessmentTask,
    TaskGradingComponent,
    TaskGradingSchemeVersion,
    User,
)
from app.services.access_control import (
    require_lecturer_or_admin_for_enrollment,
    require_lecturer_or_admin_for_offering,
    require_student_owner_or_admin_for_enrollment,
)
from app.services.domain_errors import (
    ServiceConflictError,
    ServiceNotFoundError,
    ServiceValidationError,
)
from app.services.event_service import emit_enrollment_event, emit_event_for_offering_enrollments
from app.services.gamification_service import award_xp_safe
from app.services.grading_template_service import get_template_version_for_actor
from app.services.grading_scheme_service import (
    build_attempt_grading_detail,
    can_auto_grade_attempt,
    create_pending_ai_evaluation,
    create_task_grading_scheme_version,
    create_task_scheme_from_template_version,
    derive_attempt_score_source,
    ensure_task_grading_scheme,
    get_latest_completed_ai_evaluation,
    load_attempt_with_grading_or_404,
    persist_component_scores,
    resolve_component_scores_for_finalization,
    serialize_scheme_version,
)
from app.services.progress_service import ensure_progress_rows_for_enrollment, recompute_item_progress
from app.services.roadmap_service import refresh_assessment_task_count


PRACTICAL_TASK_TYPES = {"lab", "project", "case_study", "simulation", "field_task"}
GRADING_SCHEME_TABLES = (
    "task_grading_scheme_versions",
    "task_grading_components",
    "task_component_rubric_levels",
)
ATTEMPT_GRADING_TABLES = (
    "attempt_component_scores",
    "attempt_ai_evaluations",
    "attempt_ai_component_suggestions",
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_float(v: Any) -> float | None:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def _relation_exists(db: Session, relation_name: str) -> bool:
    cache = db.info.setdefault("_relation_exists_cache", {})
    if relation_name in cache:
        return bool(cache[relation_name])

    exists = bool(
        db.execute(
            text("SELECT to_regclass(:relation_name) IS NOT NULL"),
            {"relation_name": f"public.{relation_name}"},
        ).scalar()
    )
    cache[relation_name] = exists
    return exists


def _grading_scheme_tables_available(db: Session) -> bool:
    return all(_relation_exists(db, relation_name) for relation_name in GRADING_SCHEME_TABLES)


def _attempt_grading_tables_available(db: Session) -> bool:
    return all(_relation_exists(db, relation_name) for relation_name in ATTEMPT_GRADING_TABLES)


def _grading_migration_hint() -> str:
    return "Run python3 backend/scripts/apply_grading_migration.py to create the grading tables."


def _legacy_rubric_json_from_grading_scheme_payload(
    grading_scheme: dict[str, Any] | None,
    *,
    max_score: float,
) -> dict[str, float]:
    raw_components = list((grading_scheme or {}).get("components") or [])
    if not raw_components:
        return {"Overall": float(max_score)}

    rubric_json: dict[str, float] = {}
    for index, component in enumerate(raw_components, start=1):
        label = str(component.get("label") or component.get("key") or f"Component {index}").strip()
        if not label:
            label = f"Component {index}"
        points = float(component.get("max_points") or 0)
        rubric_json[label] = points

    return rubric_json or {"Overall": float(max_score)}


def apply_late_penalty(raw_score: float, late_penalty_percent: float | None) -> float:
    if late_penalty_percent is None:
        return raw_score
    pct = max(0.0, min(float(late_penalty_percent), 100.0))
    return raw_score * (1.0 - (pct / 100.0))


def compute_next_attempt_no(existing_attempts: int, max_attempts: int) -> int:
    nxt = int(existing_attempts) + 1
    if nxt > int(max_attempts):
        raise ServiceConflictError("Maximum attempt limit reached for this task")
    return nxt


def evaluate_submission_deadline(
    *,
    due_at: datetime | None,
    submitted_at: datetime,
    allow_late_submission: bool,
) -> bool:
    is_late = bool(due_at and submitted_at > due_at)
    if is_late and not allow_late_submission:
        raise ServiceValidationError("Late submission is not allowed for this task")
    return is_late


def _task_and_item_or_404(db: Session, task_id: UUID) -> tuple[RoadmapAssessmentTask, OfferingRoadmapItem]:
    task = db.query(RoadmapAssessmentTask).filter(RoadmapAssessmentTask.id == task_id).one_or_none()
    if not task:
        raise ServiceNotFoundError("Assessment task not found")
    item = db.query(OfferingRoadmapItem).filter(OfferingRoadmapItem.id == task.roadmap_item_id).one_or_none()
    if not item:
        raise ServiceNotFoundError("Roadmap item not found")
    return task, item


def _validate_rubric_json(rubric_json: Any, *, max_score: float | None = None) -> dict[str, float] | None:
    if rubric_json is None:
        return None
    if not isinstance(rubric_json, dict):
        raise ServiceValidationError("rubric_json must be an object with criterion weights")

    out: dict[str, float] = {}
    total = 0.0
    for key, value in rubric_json.items():
        criterion = str(key).strip()
        if not criterion:
            raise ServiceValidationError("rubric_json contains an empty criterion key")
        try:
            numeric = float(value)
        except Exception as err:
            raise ServiceValidationError(f"rubric_json value for '{criterion}' must be numeric") from err
        if numeric < 0:
            raise ServiceValidationError(f"rubric_json value for '{criterion}' must be >= 0")
        out[criterion] = numeric
        total += numeric

    if max_score is not None and total > float(max_score):
        raise ServiceValidationError("Sum of rubric_json weights cannot exceed max_score")

    return out


def _validate_rubric_scores(
    rubric_scores: dict[str, float] | None,
    *,
    rubric_json: Any,
    max_score: float,
) -> dict[str, float] | None:
    if rubric_scores is None:
        return None
    if not isinstance(rubric_scores, dict):
        raise ServiceValidationError("rubric_scores must be an object")

    normalized = _validate_rubric_json(rubric_scores, max_score=max_score)
    if normalized is None:
        return None

    if isinstance(rubric_json, dict) and rubric_json:
        rubric_weights = _validate_rubric_json(rubric_json, max_score=max_score) or {}
        invalid = [k for k in normalized.keys() if k not in rubric_weights]
        if invalid:
            raise ServiceValidationError(f"rubric_scores contain unknown criteria: {', '.join(invalid)}")
        for key, score_value in normalized.items():
            max_criterion = float(rubric_weights[key])
            if score_value > max_criterion:
                raise ServiceValidationError(
                    f"rubric_scores value for '{key}' cannot exceed rubric_json weight ({max_criterion})"
                )

    return normalized


def _legacy_scheme_payload_from_rubric_json(
    rubric_json: dict[str, float] | None,
    *,
    max_score: float,
    scheme_name: str | None,
) -> dict[str, Any]:
    if rubric_json:
        components = [
            {
                "key": str(label).strip(),
                "label": str(label).strip(),
                "description": None,
                "max_points": float(points),
                "display_order": index,
                "is_auto_gradable": False,
                "manual_only": False,
            }
            for index, (label, points) in enumerate(rubric_json.items())
        ]
    else:
        components = [
            {
                "key": "overall",
                "label": "Overall",
                "description": None,
                "max_points": float(max_score),
                "display_order": 0,
                "is_auto_gradable": False,
                "manual_only": False,
            }
        ]

    return {
        "scheme_name": scheme_name,
        "auto_grading_enabled": False,
        "auto_grading_instructions": None,
        "components": components,
        "rubric_levels": [],
    }


def create_task(
    db: Session,
    *,
    roadmap_item_id: UUID,
    actor: User,
    payload: dict[str, Any],
) -> RoadmapAssessmentTask:
    item = db.query(OfferingRoadmapItem).filter(OfferingRoadmapItem.id == roadmap_item_id).one_or_none()
    if not item:
        raise ServiceNotFoundError("Roadmap item not found")
    require_lecturer_or_admin_for_offering(db, offering_id=item.course_offering_id, actor=actor)
    grading_schema_ready = _grading_scheme_tables_available(db)

    max_score = float(payload.get("max_score") or 100)
    rubric_source = payload.get("rubric_json")
    if rubric_source is None and payload.get("grading_scheme") is not None and not grading_schema_ready:
        rubric_source = _legacy_rubric_json_from_grading_scheme_payload(
            payload.get("grading_scheme"),
            max_score=max_score,
        )
    rubric_json = _validate_rubric_json(rubric_source, max_score=max_score)

    task = RoadmapAssessmentTask(
        roadmap_item_id=item.id,
        title=payload["title"],
        task_type=payload.get("task_type") or "quiz",
        description=payload.get("description"),
        practical_brief=payload.get("practical_brief"),
        required_tools=payload.get("required_tools"),
        expected_artifact=payload.get("expected_artifact"),
        safety_notes=payload.get("safety_notes"),
        rubric_json=rubric_json,
        max_score=max_score,
        weight=payload.get("weight"),
        due_at=payload.get("due_at"),
        is_required=bool(payload.get("is_required", True)),
        display_order=int(payload.get("display_order", 0)),
        is_active=bool(payload.get("is_active", True)),
        max_attempts=max(1, int(payload.get("max_attempts", 1))),
        attempt_scoring_rule=payload.get("attempt_scoring_rule") or "best",
        allow_late_submission=bool(payload.get("allow_late_submission", False)),
        late_penalty_percent=payload.get("late_penalty_percent"),
    )
    db.add(task)
    db.flush()

    if payload.get("grading_template_version_id") is not None and not grading_schema_ready:
        raise ServiceValidationError(
            "Grading templates are unavailable because the grading migration has not been applied. "
            + _grading_migration_hint()
        )

    if payload.get("grading_template_version_id") is not None:
        template_version = get_template_version_for_actor(
            db,
            template_version_id=payload["grading_template_version_id"],
            actor=actor,
        )
        create_task_scheme_from_template_version(
            db,
            task=task,
            template_version=template_version,
            actor_user_id=str(actor.id),
        )
    elif payload.get("grading_scheme") is not None and grading_schema_ready:
        create_task_grading_scheme_version(
            db,
            task=task,
            grading_scheme=payload["grading_scheme"],
            actor_user_id=str(actor.id),
        )
    elif grading_schema_ready:
        create_task_grading_scheme_version(
            db,
            task=task,
            grading_scheme=_legacy_scheme_payload_from_rubric_json(
                rubric_json,
                max_score=max_score,
                scheme_name=task.title,
            ),
            actor_user_id=str(actor.id),
        )

    refresh_assessment_task_count(db, roadmap_item_id=item.id)

    emit_event_for_offering_enrollments(
        db,
        offering_id=str(item.course_offering_id),
        event_type="task_created",
        actor_user_id=str(actor.id),
        note={"task_id": str(task.id), "roadmap_item_id": str(item.id)},
    )
    db.commit()
    db.refresh(task)
    return task


def update_task(
    db: Session,
    *,
    task_id: UUID,
    actor: User,
    payload: dict[str, Any],
) -> RoadmapAssessmentTask:
    task, item = _task_and_item_or_404(db, task_id)
    require_lecturer_or_admin_for_offering(db, offering_id=item.course_offering_id, actor=actor)
    grading_schema_ready = _grading_scheme_tables_available(db)

    prior_max_score = float(task.max_score)

    for field in [
        "title",
        "task_type",
        "description",
        "practical_brief",
        "required_tools",
        "expected_artifact",
        "safety_notes",
        "rubric_json",
        "max_score",
        "weight",
        "due_at",
        "is_required",
        "display_order",
        "is_active",
        "max_attempts",
        "attempt_scoring_rule",
        "allow_late_submission",
        "late_penalty_percent",
    ]:
        if field in payload and payload[field] is not None:
            setattr(task, field, payload[field])

    task.rubric_json = _validate_rubric_json(task.rubric_json, max_score=float(task.max_score))

    if int(task.max_attempts) < 1:
        raise ServiceValidationError("max_attempts must be >= 1")

    if payload.get("grading_template_version_id") is not None and not grading_schema_ready:
        raise ServiceValidationError(
            "Grading templates are unavailable because the grading migration has not been applied. "
            + _grading_migration_hint()
        )

    if payload.get("grading_template_version_id") is not None:
        template_version = get_template_version_for_actor(
            db,
            template_version_id=payload["grading_template_version_id"],
            actor=actor,
        )
        create_task_scheme_from_template_version(
            db,
            task=task,
            template_version=template_version,
            actor_user_id=str(actor.id),
        )
    elif payload.get("grading_scheme") is not None and grading_schema_ready:
        create_task_grading_scheme_version(
            db,
            task=task,
            grading_scheme=payload["grading_scheme"],
            actor_user_id=str(actor.id),
        )
    elif payload.get("grading_scheme") is not None:
        task.rubric_json = _validate_rubric_json(
            _legacy_rubric_json_from_grading_scheme_payload(
                payload.get("grading_scheme"),
                max_score=float(task.max_score),
            ),
            max_score=float(task.max_score),
        )
    elif "rubric_json" in payload and grading_schema_ready:
        create_task_grading_scheme_version(
            db,
            task=task,
            grading_scheme=_legacy_scheme_payload_from_rubric_json(
                task.rubric_json,
                max_score=float(task.max_score),
                scheme_name=task.title,
            ),
            actor_user_id=str(actor.id),
        )
    elif "max_score" in payload and float(task.max_score) != prior_max_score and grading_schema_ready:
        current_scheme = ensure_task_grading_scheme(db, task=task, actor_user_id=str(actor.id))
        raise ServiceValidationError(
            "Updating max_score requires grading_scheme or grading_template_version_id "
            f"for tasks that already have scheme version {current_scheme.version_no}"
        )
    elif "max_score" in payload and float(task.max_score) != prior_max_score:
        raise ServiceValidationError(
            "Updating max_score requires the grading migration because the task grading tables are not available yet. "
            + _grading_migration_hint()
        )
    elif grading_schema_ready:
        ensure_task_grading_scheme(db, task=task, actor_user_id=str(actor.id))

    refresh_assessment_task_count(db, roadmap_item_id=item.id)
    emit_event_for_offering_enrollments(
        db,
        offering_id=str(item.course_offering_id),
        event_type="task_updated",
        actor_user_id=str(actor.id),
        note={"task_id": str(task.id), "roadmap_item_id": str(item.id)},
    )
    db.commit()
    db.refresh(task)
    return task


def deactivate_task(
    db: Session,
    *,
    task_id: UUID,
    actor: User,
) -> None:
    task, item = _task_and_item_or_404(db, task_id)
    require_lecturer_or_admin_for_offering(db, offering_id=item.course_offering_id, actor=actor)

    has_results = (
        db.query(EnrollmentTaskResult.id)
        .filter(EnrollmentTaskResult.task_id == task.id)
        .first()
        is not None
    )

    if has_results:
        task.is_active = False
    else:
        db.delete(task)

    refresh_assessment_task_count(db, roadmap_item_id=item.id)
    emit_event_for_offering_enrollments(
        db,
        offering_id=str(item.course_offering_id),
        event_type="task_deactivated",
        actor_user_id=str(actor.id),
        note={"task_id": str(task_id), "roadmap_item_id": str(item.id), "soft": has_results},
    )
    db.commit()


def reorder_tasks(
    db: Session,
    *,
    roadmap_item_id: UUID,
    actor: User,
    task_ids: list[UUID],
) -> list[RoadmapAssessmentTask]:
    if not task_ids:
        raise ServiceValidationError("task_ids is required")
    item = db.query(OfferingRoadmapItem).filter(OfferingRoadmapItem.id == roadmap_item_id).one_or_none()
    if not item:
        raise ServiceNotFoundError("Roadmap item not found")
    require_lecturer_or_admin_for_offering(db, offering_id=item.course_offering_id, actor=actor)

    tasks = (
        db.query(RoadmapAssessmentTask)
        .filter(RoadmapAssessmentTask.roadmap_item_id == roadmap_item_id)
        .all()
    )
    by_id = {t.id: t for t in tasks}

    missing = [tid for tid in task_ids if tid not in by_id]
    if missing:
        raise ServiceValidationError("task_ids contain tasks outside this roadmap item")

    for order, tid in enumerate(task_ids):
        by_id[tid].display_order = order

    db.commit()
    return sorted(tasks, key=lambda x: x.display_order)


def create_attempt(
    db: Session,
    *,
    enrollment_id: UUID,
    task_id: UUID,
    actor: User,
    evidence_url: str | None = None,
    artifact_url: str | None = None,
    reflection_text: str | None = None,
    submission_text: str | None = None,
    payload: dict[str, Any] | None = None,
) -> tuple[EnrollmentTaskResult, Any]:
    enrollment = require_student_owner_or_admin_for_enrollment(db, enrollment_id=enrollment_id, actor=actor)
    task, item = _task_and_item_or_404(db, task_id)
    scheme_version = ensure_task_grading_scheme(db, task=task, actor_user_id=str(actor.id))

    if str(item.course_offering_id) != str(enrollment.offering_id):
        raise ServiceValidationError("Task does not belong to this enrollment's offering")
    if not task.is_active:
        raise ServiceValidationError("Task is inactive")

    existing = (
        db.query(EnrollmentTaskResult)
        .filter(
            EnrollmentTaskResult.enrollment_id == enrollment_id,
            EnrollmentTaskResult.task_id == task_id,
        )
        .order_by(EnrollmentTaskResult.attempt_no.asc())
        .all()
    )
    next_attempt_no = compute_next_attempt_no(len(existing), int(task.max_attempts))

    attempt = EnrollmentTaskResult(
        enrollment_id=enrollment_id,
        task_id=task_id,
        status=EnrollmentTaskStatus.in_progress,
        attempt_no=next_attempt_no,
        max_score_snapshot=float(task.max_score),
        weight_snapshot=task.weight,
        grading_scheme_version_id=scheme_version.id,
        evidence_url=evidence_url,
        artifact_url=artifact_url,
        reflection_text=reflection_text,
        submission_text=submission_text,
    )
    if payload:
        attempt.feedback = f"payload={payload}"

    db.add(attempt)
    db.flush()

    emit_enrollment_event(
        db,
        enrollment_id=str(enrollment_id),
        event_type="attempt_created",
        actor_user_id=str(actor.id),
        note={"task_id": str(task_id), "attempt_no": next_attempt_no},
    )

    award_xp_safe(
        db,
        user_id=enrollment.user_id,
        enrollment_id=enrollment_id,
        event_type="attempt_created",
        xp_delta=5,
        reason="Created assessment attempt",
        metadata_json={"task_id": str(task_id), "attempt_no": next_attempt_no},
    )

    ensure_progress_rows_for_enrollment(db, enrollment_id=enrollment_id)
    progress, _ = recompute_item_progress(
        db,
        enrollment_id=enrollment_id,
        roadmap_item_id=item.id,
        actor_user_id=str(actor.id),
        emit_events=True,
    )

    db.commit()
    db.refresh(attempt)
    db.refresh(progress)
    return attempt, progress


def submit_attempt(
    db: Session,
    *,
    enrollment_id: UUID,
    task_id: UUID,
    attempt_no: int,
    actor: User,
    evidence_url: str | None = None,
    artifact_url: str | None = None,
    reflection_text: str | None = None,
    submission_text: str | None = None,
    payload: dict[str, Any] | None = None,
) -> tuple[EnrollmentTaskResult, Any]:
    enrollment = require_student_owner_or_admin_for_enrollment(db, enrollment_id=enrollment_id, actor=actor)
    task, item = _task_and_item_or_404(db, task_id)
    scheme_version = ensure_task_grading_scheme(db, task=task)
    if str(item.course_offering_id) != str(enrollment.offering_id):
        raise ServiceValidationError("Task does not belong to this enrollment's offering")

    attempt = (
        db.query(EnrollmentTaskResult)
        .filter(
            EnrollmentTaskResult.enrollment_id == enrollment_id,
            EnrollmentTaskResult.task_id == task_id,
            EnrollmentTaskResult.attempt_no == attempt_no,
        )
        .one_or_none()
    )
    if not attempt:
        raise ServiceNotFoundError("Attempt not found")

    status_value = attempt.status.value if hasattr(attempt.status, "value") else str(attempt.status)
    if status_value in {EnrollmentTaskStatus.graded.value, EnrollmentTaskStatus.completed.value}:
        raise ServiceConflictError("This attempt is already graded")

    if attempt.submitted_at is not None:
        # idempotent submit
        progress, _ = recompute_item_progress(
            db,
            enrollment_id=enrollment_id,
            roadmap_item_id=item.id,
            actor_user_id=str(actor.id),
            emit_events=False,
        )
        db.commit()
        db.refresh(attempt)
        db.refresh(progress)
        return attempt, progress

    now = _now()
    is_late = evaluate_submission_deadline(
        due_at=task.due_at,
        submitted_at=now,
        allow_late_submission=bool(task.allow_late_submission),
    )

    task_type_value = task.task_type.value if hasattr(task.task_type, "value") else str(task.task_type)
    effective_artifact = artifact_url if artifact_url is not None else attempt.artifact_url
    if task_type_value in PRACTICAL_TASK_TYPES and not (effective_artifact and str(effective_artifact).strip()):
        raise ServiceValidationError("artifact_url is required when submitting a practical task")

    attempt.status = EnrollmentTaskStatus.submitted
    attempt.submitted_at = now
    if attempt.grading_scheme_version_id is None:
        attempt.grading_scheme_version_id = scheme_version.id
    if evidence_url is not None:
        attempt.evidence_url = evidence_url
    if artifact_url is not None:
        attempt.artifact_url = artifact_url
    if reflection_text is not None:
        attempt.reflection_text = reflection_text
    if submission_text is not None:
        attempt.submission_text = submission_text
    if payload is not None:
        payload_text = f"payload={payload}"
        attempt.feedback = f"{attempt.feedback}\n{payload_text}".strip() if attempt.feedback else payload_text

    if can_auto_grade_attempt(attempt, scheme_version):
        create_pending_ai_evaluation(db, attempt=attempt, trigger_source="auto_submit")

    emit_enrollment_event(
        db,
        enrollment_id=str(enrollment_id),
        event_type="attempt_submitted",
        actor_user_id=str(actor.id),
        note={"task_id": str(task_id), "attempt_no": attempt_no, "is_late": is_late},
    )

    award_xp_safe(
        db,
        user_id=enrollment.user_id,
        enrollment_id=enrollment_id,
        event_type="attempt_submitted",
        xp_delta=15,
        reason="Submitted assessment attempt",
        metadata_json={"task_id": str(task_id), "attempt_no": attempt_no, "is_late": is_late},
    )

    if task_type_value in PRACTICAL_TASK_TYPES and effective_artifact:
        award_xp_safe(
            db,
            user_id=enrollment.user_id,
            enrollment_id=enrollment_id,
            event_type="practical_submit",
            xp_delta=10,
            reason="Submitted practical artifact",
            metadata_json={"task_id": str(task_id), "attempt_no": attempt_no},
        )

    if reflection_text and len(reflection_text.strip()) >= 40:
        award_xp_safe(
            db,
            user_id=enrollment.user_id,
            enrollment_id=enrollment_id,
            event_type="reflection_bonus",
            xp_delta=10,
            reason="Submitted reflective notes",
            metadata_json={"task_id": str(task_id), "attempt_no": attempt_no},
        )

    progress, _ = recompute_item_progress(
        db,
        enrollment_id=enrollment_id,
        roadmap_item_id=item.id,
        actor_user_id=str(actor.id),
        emit_events=True,
    )
    db.commit()
    db.refresh(attempt)
    db.refresh(progress)
    return attempt, progress


def grade_attempt(
    db: Session,
    *,
    enrollment_id: UUID,
    task_id: UUID,
    attempt_no: int,
    actor: User,
    score: float | None = None,
    feedback: str | None = None,
    rubric_scores: dict[str, float] | None = None,
    component_scores: list[dict[str, Any]] | None = None,
    use_ai_suggestions: bool = False,
) -> tuple[EnrollmentTaskResult, Any]:
    enrollment = require_lecturer_or_admin_for_enrollment(db, enrollment_id=enrollment_id, actor=actor)
    task, item = _task_and_item_or_404(db, task_id)
    if str(item.course_offering_id) != str(enrollment.offering_id):
        raise ServiceValidationError("Task does not belong to this enrollment's offering")

    attempt = load_attempt_with_grading_or_404(
        db,
        enrollment_id=enrollment_id,
        task_id=task_id,
        attempt_no=attempt_no,
    )

    current_status = attempt.status.value if hasattr(attempt.status, "value") else str(attempt.status)
    if current_status in {EnrollmentTaskStatus.not_started.value, EnrollmentTaskStatus.in_progress.value}:
        raise ServiceValidationError("Attempt must be submitted before grading")

    scheme_version = attempt.grading_scheme_version or ensure_task_grading_scheme(db, task=task, actor_user_id=str(actor.id))
    if attempt.grading_scheme_version_id is None:
        attempt.grading_scheme_version_id = scheme_version.id

    normalized_rubric_scores = _validate_rubric_scores(
        rubric_scores,
        rubric_json=task.rubric_json,
        max_score=float(attempt.max_score_snapshot),
    )

    resolved_component_scores, raw = resolve_component_scores_for_finalization(
        attempt=attempt,
        scheme_version=scheme_version,
        component_scores=component_scores,
        rubric_scores=normalized_rubric_scores,
        direct_score=score,
        use_ai_suggestions=use_ai_suggestions,
    )

    is_late = False
    if attempt.submitted_at:
        is_late = evaluate_submission_deadline(
            due_at=task.due_at,
            submitted_at=attempt.submitted_at,
            allow_late_submission=bool(task.allow_late_submission),
        )

    max_snapshot = float(attempt.max_score_snapshot)
    effective = apply_late_penalty(raw, _to_float(task.late_penalty_percent) if is_late else None)
    effective = max(0.0, min(effective, max_snapshot))

    persist_component_scores(
        db,
        attempt=attempt,
        actor_user_id=actor.id,
        resolved_scores=resolved_component_scores,
    )

    attempt.score = round(effective, 4)
    attempt.score_source = derive_attempt_score_source(resolved_component_scores)
    attempt.status = EnrollmentTaskStatus.graded
    attempt.graded_at = _now()
    attempt.finalized_at = attempt.graded_at
    attempt.graded_by_user_id = actor.id
    if feedback:
        attempt.feedback = feedback
    attempt.rubric_scores_json = {
        row["component"].label: round(float(row["score"]), 4)
        for row in resolved_component_scores
    }
    if is_late and task.late_penalty_percent is not None:
        penalty_note = f"Late penalty applied: {task.late_penalty_percent}% (raw={raw}, effective={effective:.4f})"
        attempt.feedback = f"{attempt.feedback}\n{penalty_note}".strip() if attempt.feedback else penalty_note

    emit_enrollment_event(
        db,
        enrollment_id=str(enrollment_id),
        event_type="attempt_graded",
        actor_user_id=str(actor.id),
        note={
            "task_id": str(task_id),
            "attempt_no": attempt_no,
            "raw_score": raw,
            "effective_score": effective,
            "is_late": is_late,
        },
    )

    award_xp_safe(
        db,
        user_id=enrollment.user_id,
        enrollment_id=enrollment_id,
        event_type="attempt_graded",
        xp_delta=5,
        reason="Attempt graded by lecturer",
        metadata_json={"task_id": str(task_id), "attempt_no": attempt_no, "effective_score": effective},
    )

    if effective >= 80:
        award_xp_safe(
            db,
            user_id=enrollment.user_id,
            enrollment_id=enrollment_id,
            event_type="high_score_bonus",
            xp_delta=10,
            reason="High-scoring graded attempt",
            metadata_json={"task_id": str(task_id), "attempt_no": attempt_no, "effective_score": effective},
        )

    progress, _ = recompute_item_progress(
        db,
        enrollment_id=enrollment_id,
        roadmap_item_id=item.id,
        actor_user_id=str(actor.id),
        emit_events=True,
    )

    db.commit()
    db.refresh(attempt)
    db.refresh(progress)
    return attempt, progress


def get_task_grading_config(
    db: Session,
    *,
    task_id: UUID,
    actor: User,
) -> dict[str, Any]:
    task, item = _task_and_item_or_404(db, task_id)
    require_lecturer_or_admin_for_offering(db, offering_id=item.course_offering_id, actor=actor)
    if not _grading_scheme_tables_available(db):
        raise ServiceValidationError(
            "Task grading details are unavailable because the grading migration has not been applied. "
            + _grading_migration_hint()
        )
    scheme_version = ensure_task_grading_scheme(db, task=task, actor_user_id=str(actor.id))
    db.commit()
    return serialize_scheme_version(scheme_version)


def get_attempt_grading_detail(
    db: Session,
    *,
    enrollment_id: UUID,
    task_id: UUID,
    attempt_no: int,
    actor: User,
) -> dict[str, Any]:
    require_lecturer_or_admin_for_enrollment(db, enrollment_id=enrollment_id, actor=actor)
    attempt = load_attempt_with_grading_or_404(
        db,
        enrollment_id=enrollment_id,
        task_id=task_id,
        attempt_no=attempt_no,
    )
    return build_attempt_grading_detail(attempt)


def retry_attempt_ai_evaluation(
    db: Session,
    *,
    enrollment_id: UUID,
    task_id: UUID,
    attempt_no: int,
    actor: User,
) -> dict[str, Any]:
    require_lecturer_or_admin_for_enrollment(db, enrollment_id=enrollment_id, actor=actor)
    attempt = load_attempt_with_grading_or_404(
        db,
        enrollment_id=enrollment_id,
        task_id=task_id,
        attempt_no=attempt_no,
    )
    scheme_version = attempt.grading_scheme_version
    if scheme_version is None or not can_auto_grade_attempt(attempt, scheme_version):
        raise ServiceValidationError("Attempt is not eligible for AI grading suggestions")
    create_pending_ai_evaluation(db, attempt=attempt, trigger_source="manual_retry")
    db.commit()
    db.refresh(attempt)
    return build_attempt_grading_detail(attempt)


def _enum_value(value: Any) -> str:
    return value.value if hasattr(value, "value") else str(value)


def _display_student_name(user: User | None) -> str:
    if user is None:
        return "Student"
    profile = getattr(user, "profile", None)
    for candidate in [
        getattr(profile, "full_name", None),
        getattr(user, "username", None),
        getattr(user, "email", None),
    ]:
        text = str(candidate or "").strip()
        if text:
            return text
    return "Student"


def _derive_submission_workflow_status(
    attempt: EnrollmentTaskResult,
    *,
    attempt_grading_ready: bool = True,
) -> str:
    current_status = _enum_value(attempt.status)
    if attempt.finalized_at is not None or current_status in {
        EnrollmentTaskStatus.graded.value,
        EnrollmentTaskStatus.completed.value,
    }:
        return "finalized"

    latest_ai = (
        attempt.latest_ai_evaluation or get_latest_completed_ai_evaluation(attempt)
        if attempt_grading_ready
        else None
    )
    if latest_ai is not None and _enum_value(latest_ai.status) == AiEvaluationStatus.completed.value:
        return "ai_graded"

    return "submitted"


def serialize_assessment_task_for_output(
    db: Session,
    *,
    task: RoadmapAssessmentTask,
    actor_user_id: str | None = None,
    grading_schema_ready: bool | None = None,
) -> dict[str, Any]:
    if grading_schema_ready is None:
        grading_schema_ready = _grading_scheme_tables_available(db)
    scheme_version = None
    if grading_schema_ready:
        scheme_version = (
            ensure_task_grading_scheme(db, task=task, actor_user_id=actor_user_id)
            if task.current_grading_scheme_version_id is None
            else task.current_grading_scheme_version
        )

    return {
        "id": task.id,
        "roadmap_item_id": task.roadmap_item_id,
        "title": task.title,
        "task_type": _enum_value(task.task_type),
        "description": task.description,
        "practical_brief": task.practical_brief,
        "required_tools": task.required_tools,
        "expected_artifact": task.expected_artifact,
        "safety_notes": task.safety_notes,
        "rubric_json": task.rubric_json,
        "max_score": _to_float(task.max_score) or 0.0,
        "weight": _to_float(task.weight),
        "due_at": task.due_at,
        "is_required": bool(task.is_required),
        "display_order": int(task.display_order or 0),
        "is_active": bool(task.is_active),
        "max_attempts": int(task.max_attempts or 1),
        "attempt_scoring_rule": _enum_value(task.attempt_scoring_rule),
        "allow_late_submission": bool(task.allow_late_submission),
        "late_penalty_percent": _to_float(task.late_penalty_percent),
        "current_grading_scheme_version_id": task.current_grading_scheme_version_id,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "current_grading_scheme": serialize_scheme_version(scheme_version),
    }


def list_assessments_for_offering(
    db: Session,
    *,
    offering_id: UUID,
    actor: User,
) -> list[dict[str, Any]]:
    require_lecturer_or_admin_for_offering(db, offering_id=offering_id, actor=actor)
    grading_schema_ready = _grading_scheme_tables_available(db)
    query = (
        db.query(OfferingRoadmapItem)
        .filter(OfferingRoadmapItem.course_offering_id == offering_id)
        .order_by(OfferingRoadmapItem.sequence_no.asc())
    )
    if grading_schema_ready:
        query = query.options(
            joinedload(OfferingRoadmapItem.assessment_tasks)
            .joinedload(RoadmapAssessmentTask.current_grading_scheme_version)
            .joinedload(TaskGradingSchemeVersion.components)
            .joinedload(TaskGradingComponent.rubric_levels)
        )
    else:
        query = query.options(joinedload(OfferingRoadmapItem.assessment_tasks))

    items = query.all()

    generated_missing_scheme = False
    groups: list[dict[str, Any]] = []
    for item in items:
        assessments: list[dict[str, Any]] = []
        for task in sorted(
            list(item.assessment_tasks),
            key=lambda row: (row.display_order, row.title.lower()),
        ):
            if task.current_grading_scheme_version_id is None:
                generated_missing_scheme = True
            assessments.append(
                serialize_assessment_task_for_output(
                    db,
                    task=task,
                    actor_user_id=str(actor.id),
                    grading_schema_ready=grading_schema_ready,
                )
            )

        groups.append(
            {
                "roadmap_item_id": item.id,
                "roadmap_item_title": item.title,
                "roadmap_item_week_no": item.week_no,
                "roadmap_item_status": _enum_value(item.status),
                "assessments": assessments,
            }
        )

    if generated_missing_scheme and grading_schema_ready:
        db.commit()

    return groups


def _serialize_submission_list_item(
    attempt: EnrollmentTaskResult,
    *,
    attempt_grading_ready: bool,
) -> dict[str, Any]:
    user = attempt.enrollment.user if attempt.enrollment else None
    profile = getattr(user, "profile", None)
    latest_ai = (
        attempt.latest_ai_evaluation or get_latest_completed_ai_evaluation(attempt)
        if attempt_grading_ready
        else None
    )

    return {
        "id": attempt.id,
        "enrollment_id": attempt.enrollment_id,
        "task_id": attempt.task_id,
        "attempt_no": int(attempt.attempt_no or 1),
        "student_user_id": user.id if user is not None else attempt.enrollment.user_id,
        "student_name": _display_student_name(user),
        "student_email": getattr(user, "email", None) if user is not None else None,
        "student_identifier": (
            getattr(profile, "university_id", None)
            or getattr(user, "username", None)
            or getattr(user, "email", None)
        ) if user is not None else None,
        "status": _enum_value(attempt.status),
        "workflow_status": _derive_submission_workflow_status(
            attempt,
            attempt_grading_ready=attempt_grading_ready,
        ),
        "score": _to_float(attempt.score),
        "submitted_at": attempt.submitted_at,
        "graded_at": attempt.graded_at,
        "finalized_at": attempt.finalized_at,
        "feedback": attempt.feedback,
        "submission_text": attempt.submission_text,
        "latest_ai_evaluation_status": _enum_value(latest_ai.status) if latest_ai is not None else None,
    }


def list_submissions_for_assessment(
    db: Session,
    *,
    assessment_id: UUID,
    actor: User,
) -> list[dict[str, Any]]:
    task, item = _task_and_item_or_404(db, assessment_id)
    require_lecturer_or_admin_for_offering(db, offering_id=item.course_offering_id, actor=actor)
    attempt_grading_ready = _attempt_grading_tables_available(db)

    query = (
        db.query(EnrollmentTaskResult)
        .options(
            joinedload(EnrollmentTaskResult.enrollment)
            .joinedload(Enrollment.user)
            .joinedload(User.profile),
        )
        .filter(
            EnrollmentTaskResult.task_id == task.id,
            EnrollmentTaskResult.submitted_at.isnot(None),
        )
        .order_by(EnrollmentTaskResult.submitted_at.desc(), EnrollmentTaskResult.created_at.desc())
    )
    if attempt_grading_ready:
        query = query.options(
            joinedload(EnrollmentTaskResult.latest_ai_evaluation),
            joinedload(EnrollmentTaskResult.ai_evaluations),
        )

    attempts = query.all()

    return [
        _serialize_submission_list_item(
            attempt,
            attempt_grading_ready=attempt_grading_ready,
        )
        for attempt in attempts
    ]


def _load_submission_attempt_or_404(
    db: Session,
    *,
    submission_id: UUID,
    grading_schema_ready: bool | None = None,
    attempt_grading_ready: bool | None = None,
) -> EnrollmentTaskResult:
    if grading_schema_ready is None:
        grading_schema_ready = _grading_scheme_tables_available(db)
    if attempt_grading_ready is None:
        attempt_grading_ready = _attempt_grading_tables_available(db)

    query = (
        db.query(EnrollmentTaskResult)
        .options(
            joinedload(EnrollmentTaskResult.enrollment)
            .joinedload(Enrollment.user)
            .joinedload(User.profile),
            joinedload(EnrollmentTaskResult.task).joinedload(RoadmapAssessmentTask.roadmap_item),
        )
        .filter(EnrollmentTaskResult.id == submission_id)
    )
    if grading_schema_ready:
        query = query.options(
            joinedload(EnrollmentTaskResult.task)
            .joinedload(RoadmapAssessmentTask.current_grading_scheme_version)
            .joinedload(TaskGradingSchemeVersion.components)
            .joinedload(TaskGradingComponent.rubric_levels),
            joinedload(EnrollmentTaskResult.grading_scheme_version)
            .joinedload(TaskGradingSchemeVersion.components)
            .joinedload(TaskGradingComponent.rubric_levels),
        )
    if attempt_grading_ready:
        query = query.options(
            joinedload(EnrollmentTaskResult.component_scores).joinedload(AttemptComponentScore.component),
            joinedload(EnrollmentTaskResult.latest_ai_evaluation)
            .joinedload(AttemptAiEvaluation.component_suggestions)
            .joinedload(AttemptAiComponentSuggestion.component),
            joinedload(EnrollmentTaskResult.ai_evaluations)
            .joinedload(AttemptAiEvaluation.component_suggestions)
            .joinedload(AttemptAiComponentSuggestion.component),
        )

    attempt = query.one_or_none()
    if not attempt:
        raise ServiceNotFoundError("Submission not found")
    return attempt


def get_submission_detail(
    db: Session,
    *,
    submission_id: UUID,
    actor: User,
) -> dict[str, Any]:
    grading_schema_ready = _grading_scheme_tables_available(db)
    attempt_grading_ready = _attempt_grading_tables_available(db)
    attempt = _load_submission_attempt_or_404(
        db,
        submission_id=submission_id,
        grading_schema_ready=grading_schema_ready,
        attempt_grading_ready=attempt_grading_ready,
    )
    require_lecturer_or_admin_for_enrollment(db, enrollment_id=attempt.enrollment_id, actor=actor)

    detail = (
        build_attempt_grading_detail(attempt)
        if grading_schema_ready and attempt_grading_ready
        else {
            "attempt": attempt,
            "grading_scheme": (
                serialize_scheme_version(attempt.grading_scheme_version)
                if grading_schema_ready and attempt.grading_scheme_version is not None
                else None
            ),
            "component_scores": [],
            "latest_ai_evaluation": None,
        }
    )
    user = attempt.enrollment.user if attempt.enrollment else None
    profile = getattr(user, "profile", None)
    task = attempt.task
    item = task.roadmap_item

    return {
        **detail,
        "student": {
            "user_id": user.id if user is not None else attempt.enrollment.user_id,
            "username": getattr(user, "username", "") if user is not None else "",
            "full_name": getattr(profile, "full_name", None) if profile is not None else None,
            "email": getattr(user, "email", None) if user is not None else None,
            "university_id": getattr(profile, "university_id", None) if profile is not None else None,
        },
        "assessment": serialize_assessment_task_for_output(
            db,
            task=task,
            actor_user_id=str(actor.id),
            grading_schema_ready=grading_schema_ready,
        ),
        "roadmap_item": {
            "id": item.id,
            "title": item.title,
            "week_no": item.week_no,
            "status": _enum_value(item.status),
        },
        "workflow_status": _derive_submission_workflow_status(
            attempt,
            attempt_grading_ready=attempt_grading_ready,
        ),
    }


def create_submission_ai_evaluation(
    db: Session,
    *,
    submission_id: UUID,
    actor: User,
) -> dict[str, Any]:
    if not _grading_scheme_tables_available(db) or not _attempt_grading_tables_available(db):
        raise ServiceValidationError(
            "AI grading is unavailable because the grading migration has not been fully applied. "
            + _grading_migration_hint()
        )

    attempt = _load_submission_attempt_or_404(db, submission_id=submission_id)
    require_lecturer_or_admin_for_enrollment(db, enrollment_id=attempt.enrollment_id, actor=actor)

    scheme_version = attempt.grading_scheme_version or ensure_task_grading_scheme(
        db,
        task=attempt.task,
        actor_user_id=str(actor.id),
    )
    if attempt.grading_scheme_version_id is None:
        attempt.grading_scheme_version_id = scheme_version.id

    if not can_auto_grade_attempt(attempt, scheme_version):
        raise ServiceValidationError("Submission is not eligible for AI grading suggestions")

    create_pending_ai_evaluation(db, attempt=attempt, trigger_source="manual_retry")
    db.commit()
    return get_submission_detail(db, submission_id=submission_id, actor=actor)


def finalize_submission(
    db: Session,
    *,
    submission_id: UUID,
    actor: User,
    score: float | None = None,
    feedback: str | None = None,
    rubric_scores: dict[str, float] | None = None,
    component_scores: list[dict[str, Any]] | None = None,
    use_ai_suggestions: bool = False,
) -> dict[str, Any]:
    if not _grading_scheme_tables_available(db) or not _attempt_grading_tables_available(db):
        raise ServiceValidationError(
            "Final grading is unavailable because the grading migration has not been fully applied. "
            + _grading_migration_hint()
        )

    attempt = _load_submission_attempt_or_404(db, submission_id=submission_id)
    require_lecturer_or_admin_for_enrollment(db, enrollment_id=attempt.enrollment_id, actor=actor)

    current_status = _enum_value(attempt.status)
    if attempt.finalized_at is not None or current_status in {
        EnrollmentTaskStatus.graded.value,
        EnrollmentTaskStatus.completed.value,
    }:
        raise ServiceConflictError("Submission has already been finalized")

    grade_attempt(
        db,
        enrollment_id=attempt.enrollment_id,
        task_id=attempt.task_id,
        attempt_no=int(attempt.attempt_no),
        actor=actor,
        score=score,
        feedback=feedback,
        rubric_scores=rubric_scores,
        component_scores=component_scores,
        use_ai_suggestions=use_ai_suggestions,
    )
    return get_submission_detail(db, submission_id=submission_id, actor=actor)
