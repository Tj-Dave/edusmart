from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.db.models import (
    Enrollment,
    EnrollmentRoadmapProgress,
    EnrollmentTaskResult,
    EnrollmentTaskStatus,
    OfferingRoadmapItem,
    RoadmapAssessmentTask,
    EnrollmentRoadmapStatus,
)
from app.services.domain_errors import ServiceNotFoundError, ServiceValidationError
from app.services.event_service import emit_enrollment_event


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_float(v: Any) -> float | None:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def _weight(task: RoadmapAssessmentTask) -> float:
    w = _to_float(task.weight)
    return w if w is not None else 1.0


def missing_progress_item_ids(active_item_ids: list[UUID], existing_item_ids: set[UUID]) -> list[UUID]:
    return [item_id for item_id in active_item_ids if item_id not in existing_item_ids]


def select_score_by_rule(
    rule: str,
    attempts: list[EnrollmentTaskResult],
) -> tuple[float, int | None]:
    scored = [a for a in attempts if a.score is not None]
    if not scored:
        return 0.0, None

    scored = sorted(scored, key=lambda x: x.attempt_no)
    rule = (rule or "best").lower().strip()

    if rule == "latest":
        best = scored[-1]
        return float(best.score), best.attempt_no

    if rule == "first":
        first = scored[0]
        return float(first.score), first.attempt_no

    if rule == "average":
        avg = sum(float(a.score) for a in scored) / len(scored)
        return avg, scored[-1].attempt_no

    # default: best
    best = max(scored, key=lambda x: float(x.score))
    return float(best.score), best.attempt_no


def ensure_progress_rows_for_enrollment(
    db: Session,
    *,
    enrollment_id: UUID,
) -> list[EnrollmentRoadmapProgress]:
    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).one_or_none()
    if not enrollment:
        raise ServiceNotFoundError("Enrollment not found")

    active_items = (
        db.query(OfferingRoadmapItem.id)
        .filter(
            OfferingRoadmapItem.course_offering_id == enrollment.offering_id,
            OfferingRoadmapItem.status == "approved_active",
        )
        .order_by(OfferingRoadmapItem.sequence_no.asc())
        .all()
    )
    active_item_ids = [row.id for row in active_items]
    if not active_item_ids:
        return []

    existing_rows = (
        db.query(EnrollmentRoadmapProgress)
        .filter(
            EnrollmentRoadmapProgress.enrollment_id == enrollment_id,
            EnrollmentRoadmapProgress.roadmap_item_id.in_(active_item_ids),
        )
        .all()
    )
    existing_ids = {row.roadmap_item_id for row in existing_rows}
    to_create = missing_progress_item_ids(active_item_ids, existing_ids)

    for item_id in to_create:
        row = EnrollmentRoadmapProgress(
            enrollment_id=enrollment_id,
            roadmap_item_id=item_id,
            status=EnrollmentRoadmapStatus.not_started,
            completion_percent=0,
        )
        db.add(row)

    if to_create:
        db.flush()
        existing_rows = (
            db.query(EnrollmentRoadmapProgress)
            .filter(
                EnrollmentRoadmapProgress.enrollment_id == enrollment_id,
                EnrollmentRoadmapProgress.roadmap_item_id.in_(active_item_ids),
            )
            .all()
        )

    return existing_rows


def _summaries_for_item(
    *,
    item: OfferingRoadmapItem,
    attempts_by_task: dict[UUID, list[EnrollmentTaskResult]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    active_tasks = [t for t in item.assessment_tasks if t.is_active]
    required_tasks = [t for t in active_tasks if t.is_required]

    summaries: list[dict[str, Any]] = []
    total_score = 0.0
    max_total_score = 0.0
    weighted_scored_sum = 0.0
    scored_weight_sum = 0.0
    best_score = None

    required_completed = 0
    required_submitted = 0

    for task in active_tasks:
        attempts = attempts_by_task.get(task.id, [])
        selected_score, selected_attempt_no = select_score_by_rule(task.attempt_scoring_rule, attempts)
        latest_status = None
        if attempts:
            latest_status = sorted(attempts, key=lambda x: x.attempt_no)[-1].status
            latest_status = latest_status.value if hasattr(latest_status, "value") else str(latest_status)

        weight = _weight(task)
        max_total_score += float(task.max_score) * weight
        total_score += selected_score * weight

        if selected_attempt_no is not None:
            weighted_scored_sum += selected_score * weight
            scored_weight_sum += weight
            if best_score is None or selected_score > best_score:
                best_score = selected_score

        done_statuses = {EnrollmentTaskStatus.graded.value, EnrollmentTaskStatus.completed.value}
        submitted_statuses = done_statuses | {EnrollmentTaskStatus.submitted.value}
        status_values = {
            a.status.value if hasattr(a.status, "value") else str(a.status)
            for a in attempts
        }
        if task in required_tasks:
            if status_values.intersection(done_statuses):
                required_completed += 1
            if status_values.intersection(submitted_statuses):
                required_submitted += 1

        summaries.append(
            {
                "task_id": task.id,
                "selected_score": round(selected_score, 4),
                "selected_attempt_no": selected_attempt_no,
                "attempts_count": len(attempts),
                "latest_status": latest_status,
            }
        )

    required_count = len(required_tasks)
    if required_count == 0:
        completion_percent = 100 if active_tasks else 0
    else:
        completion_percent = int(round((required_completed / required_count) * 100))

    avg_score = None
    if scored_weight_sum > 0:
        avg_score = weighted_scored_sum / scored_weight_sum

    return summaries, {
        "completion_percent": completion_percent,
        "required_count": required_count,
        "required_completed": required_completed,
        "required_submitted": required_submitted,
        "total_score": total_score,
        "max_total_score": max_total_score,
        "avg_score": avg_score,
        "best_score": best_score,
        "active_task_count": len(active_tasks),
    }


def recompute_item_progress(
    db: Session,
    *,
    enrollment_id: UUID,
    roadmap_item_id: UUID,
    actor_user_id: str | None = None,
    emit_events: bool = True,
) -> tuple[EnrollmentRoadmapProgress, list[dict[str, Any]]]:
    item = (
        db.query(OfferingRoadmapItem)
        .options(joinedload(OfferingRoadmapItem.assessment_tasks))
        .filter(OfferingRoadmapItem.id == roadmap_item_id)
        .one_or_none()
    )
    if not item:
        raise ServiceNotFoundError("Roadmap item not found")

    progress = (
        db.query(EnrollmentRoadmapProgress)
        .filter(
            EnrollmentRoadmapProgress.enrollment_id == enrollment_id,
            EnrollmentRoadmapProgress.roadmap_item_id == roadmap_item_id,
        )
        .one_or_none()
    )
    if not progress:
        progress = EnrollmentRoadmapProgress(
            enrollment_id=enrollment_id,
            roadmap_item_id=roadmap_item_id,
            status=EnrollmentRoadmapStatus.not_started,
            completion_percent=0,
        )
        db.add(progress)
        db.flush()

    task_ids = [t.id for t in item.assessment_tasks if t.is_active]
    attempts: list[EnrollmentTaskResult] = []
    if task_ids:
        attempts = (
            db.query(EnrollmentTaskResult)
            .filter(
                EnrollmentTaskResult.enrollment_id == enrollment_id,
                EnrollmentTaskResult.task_id.in_(task_ids),
            )
            .order_by(EnrollmentTaskResult.task_id.asc(), EnrollmentTaskResult.attempt_no.asc())
            .all()
        )
    attempts_by_task: dict[UUID, list[EnrollmentTaskResult]] = defaultdict(list)
    for row in attempts:
        attempts_by_task[row.task_id].append(row)

    summaries, metrics = _summaries_for_item(item=item, attempts_by_task=attempts_by_task)

    prev_status = progress.status.value if hasattr(progress.status, "value") else str(progress.status)
    now = _now()

    progress.completion_percent = metrics["completion_percent"]
    progress.total_score = round(metrics["total_score"], 4)
    progress.max_total_score = round(metrics["max_total_score"], 4)
    progress.avg_score = round(metrics["avg_score"], 4) if metrics["avg_score"] is not None else None
    progress.best_score = round(metrics["best_score"], 4) if metrics["best_score"] is not None else None

    has_attempts = any(s["attempts_count"] > 0 for s in summaries)
    if metrics["completion_percent"] >= 100 and metrics["required_count"] >= 0:
        new_status = EnrollmentRoadmapStatus.completed.value
    elif metrics["required_count"] > 0 and metrics["required_submitted"] == metrics["required_count"]:
        new_status = EnrollmentRoadmapStatus.submitted.value
    elif has_attempts or progress.started_at is not None:
        new_status = EnrollmentRoadmapStatus.in_progress.value
    else:
        new_status = EnrollmentRoadmapStatus.not_started.value

    progress.status = EnrollmentRoadmapStatus(new_status)
    if new_status in {
        EnrollmentRoadmapStatus.in_progress.value,
        EnrollmentRoadmapStatus.submitted.value,
        EnrollmentRoadmapStatus.completed.value,
    } and progress.started_at is None:
        progress.started_at = now
    if new_status in {EnrollmentRoadmapStatus.submitted.value, EnrollmentRoadmapStatus.completed.value}:
        if progress.submitted_at is None:
            progress.submitted_at = now
    if new_status == EnrollmentRoadmapStatus.completed.value:
        if progress.completed_at is None:
            progress.completed_at = now

    if emit_events and prev_status != new_status:
        if prev_status == EnrollmentRoadmapStatus.not_started.value and new_status != EnrollmentRoadmapStatus.not_started.value:
            emit_enrollment_event(
                db,
                enrollment_id=str(enrollment_id),
                event_type="roadmap_item_started",
                actor_user_id=actor_user_id,
                note={"roadmap_item_id": str(roadmap_item_id)},
            )
        if new_status == EnrollmentRoadmapStatus.completed.value:
            emit_enrollment_event(
                db,
                enrollment_id=str(enrollment_id),
                event_type="roadmap_item_completed",
                actor_user_id=actor_user_id,
                note={
                    "roadmap_item_id": str(roadmap_item_id),
                    "completion_percent": progress.completion_percent,
                },
            )

    db.flush()
    return progress, summaries


def get_enrollment_roadmap_view(
    db: Session,
    *,
    enrollment_id: UUID,
    actor_user_id: str | None = None,
) -> dict[str, Any]:
    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).one_or_none()
    if not enrollment:
        raise ServiceNotFoundError("Enrollment not found")

    ensure_progress_rows_for_enrollment(db, enrollment_id=enrollment_id)

    items = (
        db.query(OfferingRoadmapItem)
        .options(joinedload(OfferingRoadmapItem.assessment_tasks))
        .filter(
            OfferingRoadmapItem.course_offering_id == enrollment.offering_id,
            OfferingRoadmapItem.status == "approved_active",
        )
        .order_by(OfferingRoadmapItem.sequence_no.asc())
        .all()
    )

    out_items: list[dict[str, Any]] = []
    for item in items:
        progress, summaries = recompute_item_progress(
            db,
            enrollment_id=enrollment_id,
            roadmap_item_id=item.id,
            actor_user_id=actor_user_id,
            emit_events=False,
        )
        out_items.append(
            {
                "item": item,
                "progress": progress,
                "task_summaries": summaries,
            }
        )

    db.flush()

    return {
        "enrollment_id": enrollment.id,
        "offering_id": enrollment.offering_id,
        "items": out_items,
    }


def start_roadmap_item(
    db: Session,
    *,
    enrollment_id: UUID,
    roadmap_item_id: UUID,
    actor_user_id: str,
) -> EnrollmentRoadmapProgress:
    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).one_or_none()
    if not enrollment:
        raise ServiceNotFoundError("Enrollment not found")

    item = (
        db.query(OfferingRoadmapItem)
        .filter(OfferingRoadmapItem.id == roadmap_item_id)
        .one_or_none()
    )
    if not item:
        raise ServiceNotFoundError("Roadmap item not found")

    if str(item.course_offering_id) != str(enrollment.offering_id):
        raise ServiceValidationError("Roadmap item does not belong to this enrollment's offering")

    if item.status != "approved_active":
        raise ServiceValidationError("Roadmap item is not active")

    rows = ensure_progress_rows_for_enrollment(db, enrollment_id=enrollment_id)
    progress = next((r for r in rows if str(r.roadmap_item_id) == str(roadmap_item_id)), None)
    if progress is None:
        progress = EnrollmentRoadmapProgress(
            enrollment_id=enrollment_id,
            roadmap_item_id=roadmap_item_id,
            status=EnrollmentRoadmapStatus.not_started,
            completion_percent=0,
        )
        db.add(progress)
        db.flush()

    prev_status = progress.status.value if hasattr(progress.status, "value") else str(progress.status)
    if prev_status == EnrollmentRoadmapStatus.not_started.value:
        progress.status = EnrollmentRoadmapStatus.in_progress
        progress.started_at = progress.started_at or _now()
        emit_enrollment_event(
            db,
            enrollment_id=str(enrollment_id),
            event_type="roadmap_item_started",
            actor_user_id=actor_user_id,
            note={"roadmap_item_id": str(roadmap_item_id)},
        )

    db.commit()
    db.refresh(progress)
    return progress
