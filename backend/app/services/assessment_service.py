from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import (
    EnrollmentTaskResult,
    EnrollmentTaskStatus,
    OfferingRoadmapItem,
    RoadmapAssessmentTask,
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
from app.services.progress_service import ensure_progress_rows_for_enrollment, recompute_item_progress
from app.services.roadmap_service import refresh_assessment_task_count


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_float(v: Any) -> float | None:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


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

    task = RoadmapAssessmentTask(
        roadmap_item_id=item.id,
        title=payload["title"],
        task_type=payload.get("task_type") or "quiz",
        description=payload.get("description"),
        max_score=float(payload.get("max_score") or 100),
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

    for field in [
        "title",
        "task_type",
        "description",
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

    if int(task.max_attempts) < 1:
        raise ServiceValidationError("max_attempts must be >= 1")

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
    payload: dict[str, Any] | None = None,
) -> tuple[EnrollmentTaskResult, Any]:
    enrollment = require_student_owner_or_admin_for_enrollment(db, enrollment_id=enrollment_id, actor=actor)
    task, item = _task_and_item_or_404(db, task_id)

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
        evidence_url=evidence_url,
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
    payload: dict[str, Any] | None = None,
) -> tuple[EnrollmentTaskResult, Any]:
    enrollment = require_student_owner_or_admin_for_enrollment(db, enrollment_id=enrollment_id, actor=actor)
    task, item = _task_and_item_or_404(db, task_id)
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

    attempt.status = EnrollmentTaskStatus.submitted
    attempt.submitted_at = now
    if evidence_url is not None:
        attempt.evidence_url = evidence_url
    if payload is not None:
        payload_text = f"payload={payload}"
        attempt.feedback = f"{attempt.feedback}\n{payload_text}".strip() if attempt.feedback else payload_text

    emit_enrollment_event(
        db,
        enrollment_id=str(enrollment_id),
        event_type="attempt_submitted",
        actor_user_id=str(actor.id),
        note={"task_id": str(task_id), "attempt_no": attempt_no, "is_late": is_late},
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
    score: float,
    feedback: str | None = None,
) -> tuple[EnrollmentTaskResult, Any]:
    enrollment = require_lecturer_or_admin_for_enrollment(db, enrollment_id=enrollment_id, actor=actor)
    task, item = _task_and_item_or_404(db, task_id)
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

    current_status = attempt.status.value if hasattr(attempt.status, "value") else str(attempt.status)
    if current_status in {EnrollmentTaskStatus.not_started.value, EnrollmentTaskStatus.in_progress.value}:
        raise ServiceValidationError("Attempt must be submitted before grading")

    raw = max(0.0, float(score))
    max_snapshot = float(attempt.max_score_snapshot)
    if raw > max_snapshot:
        raw = max_snapshot

    is_late = False
    if attempt.submitted_at:
        is_late = evaluate_submission_deadline(
            due_at=task.due_at,
            submitted_at=attempt.submitted_at,
            allow_late_submission=bool(task.allow_late_submission),
        )

    effective = apply_late_penalty(raw, _to_float(task.late_penalty_percent) if is_late else None)
    effective = max(0.0, min(effective, max_snapshot))

    attempt.score = round(effective, 4)
    attempt.status = EnrollmentTaskStatus.graded
    attempt.graded_at = _now()
    attempt.graded_by_user_id = actor.id
    if feedback:
        attempt.feedback = feedback
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
