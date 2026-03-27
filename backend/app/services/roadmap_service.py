from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.db.models import (
    CourseSpecStatus,
    OfferingCourseSpec,
    OfferingRoadmapItem,
    RoadmapItemStatus,
    RoadmapAssessmentTask,
)
from app.db.models import User
from app.services.access_control import require_lecturer_or_admin_for_offering
from app.services.domain_errors import (
    ServiceNotFoundError,
    ServiceValidationError,
)
from app.services.event_service import emit_event_for_offering_enrollments
from app.services.grading_scheme_service import create_task_grading_scheme_version


def _to_float(v: Any) -> float | None:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def _parse_dt(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def _normalized_item_payloads(spec_json: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Normalize roadmap_items from the canonical spec JSON into the shape expected
    by generate_roadmap_from_spec().

    Canonical fields consumed (from the new schema):
      sequence_no, week_no, clo_ref, title, key_content, teaching_activity,
      competences_emphasised, assessment_task, estimated_hours, tasks[]
    """
    if not isinstance(spec_json, dict):
        return []

    candidates = spec_json.get("roadmap_items")
    if not isinstance(candidates, list):
        # Legacy fallback key
        candidates = spec_json.get("modules")
    if not isinstance(candidates, list):
        return []

    out: list[dict[str, Any]] = []
    for idx, raw in enumerate(candidates, start=1):
        if not isinstance(raw, dict):
            continue

        title = (raw.get("title") or raw.get("name") or f"Week {idx}").strip() or f"Week {idx}"

        # ── Build rich key_content for students ──────────────────────────────
        # Combine what the spec says: key content, CLO tag, competence, activity
        key_content_parts = []
        if raw.get("key_content"):
            key_content_parts.append(raw["key_content"].strip())
        if raw.get("clo_ref"):
            key_content_parts.append(f"Learning Outcome: {raw['clo_ref']}")
        if raw.get("competences_emphasised"):
            key_content_parts.append(f"Competence Focus: {raw['competences_emphasised']}")
        if raw.get("teaching_activity"):
            key_content_parts.append(f"Activity: {raw['teaching_activity']}")
        key_content = " | ".join(key_content_parts) if key_content_parts else None

        # ── Normalise tasks[] ────────────────────────────────────────────────
        raw_tasks = raw.get("tasks") if isinstance(raw.get("tasks"), list) else []

        # If the spec only named the assessment_task but didn't expand it into
        # tasks[], synthesise a minimal task entry from assessment_task name
        if not raw_tasks and raw.get("assessment_task"):
            raw_tasks = [
                {
                    "title": raw["assessment_task"],
                    "task_type": _infer_task_type(raw["assessment_task"]),
                    "description": f"Assessment deliverable for Week {raw.get('week_no', idx)}: {raw['assessment_task']}",
                    "max_score": 100,
                    "is_required": True,
                }
            ]

        out.append(
            {
                "sequence_no": int(raw.get("sequence_no") or idx),
                "week_no": raw.get("week_no"),
                "clo_ref": raw.get("clo_ref", ""),
                "title": title,
                "key_content": key_content,
                "teaching_activity": raw.get("teaching_activity"),
                "estimated_hours": _to_float(raw.get("estimated_hours")),
                "tasks": raw_tasks,
            }
        )
    return out


def _infer_task_type(task_name: str) -> str:
    """Heuristically map an assessment task name to a task_type enum value."""
    name = (task_name or "").lower()
    if any(k in name for k in ("quiz", "test", "mcq")):
        return "quiz"
    if any(k in name for k in ("lab", "practical", "crud", "demo", "app", "bundle", "module")):
        return "lab"
    if any(k in name for k in ("presentation", "defense", "milestone", "demo")):
        return "presentation"
    if any(k in name for k in ("report", "documentation", "note", "writing")):
        return "assignment"
    if any(k in name for k in ("prototype", "wireframe", "design", "ui")):
        return "project"
    if any(k in name for k in ("peer", "review")):
        return "peer_review"
    if any(k in name for k in ("field", "survey")):
        return "field_task"
    if any(k in name for k in ("case", "scenario")):
        return "case_study"
    if any(k in name for k in ("reflect", "journal")):
        return "reflection"
    return "assignment"


def refresh_assessment_task_count(db: Session, *, roadmap_item_id: UUID) -> int:
    count = (
        db.query(RoadmapAssessmentTask)
        .filter(
            RoadmapAssessmentTask.roadmap_item_id == roadmap_item_id,
            RoadmapAssessmentTask.is_active == True,  # noqa: E712
        )
        .count()
    )
    item = db.query(OfferingRoadmapItem).filter(OfferingRoadmapItem.id == roadmap_item_id).one_or_none()
    if item:
        item.assessment_task_count = count
    db.flush()
    return count


def generate_roadmap_from_spec(
    db: Session,
    *,
    offering_id: UUID,
    actor: User,
    spec_id: UUID | None = None,
    archive_existing_drafts: bool = True,
) -> list[OfferingRoadmapItem]:
    offering = require_lecturer_or_admin_for_offering(db, offering_id=offering_id, actor=actor)

    spec_query = db.query(OfferingCourseSpec).filter(OfferingCourseSpec.course_offering_id == offering_id)
    if spec_id is not None:
        spec = spec_query.filter(OfferingCourseSpec.id == spec_id).one_or_none()
        if not spec:
            raise ServiceNotFoundError("Course spec not found")
    else:
        spec = spec_query.filter(OfferingCourseSpec.status == CourseSpecStatus.approved_active).one_or_none()
        if not spec:
            raise ServiceValidationError("No approved course spec found for this offering")

    if archive_existing_drafts:
        (
            db.query(OfferingRoadmapItem)
            .filter(
                OfferingRoadmapItem.course_offering_id == offering_id,
                OfferingRoadmapItem.status == RoadmapItemStatus.draft,
            )
            .update({"status": RoadmapItemStatus.archived}, synchronize_session=False)
        )

    payloads = _normalized_item_payloads(spec.spec_json or {})
    if not payloads:
        payloads = [
            {
                "sequence_no": 1,
                "week_no": 1,
                "title": "Foundational course orientation",
                "key_content": "Generated placeholder roadmap item",
                "teaching_activity": "Lecturer review required",
                "estimated_hours": None,
                "tasks": [],
            }
        ]

    created_items: list[OfferingRoadmapItem] = []
    for p in payloads:
        item = OfferingRoadmapItem(
            course_offering_id=offering_id,
            spec_id=spec.id,
            sequence_no=p["sequence_no"],
            week_no=p["week_no"],
            title=p["title"],
            key_content=p["key_content"],
            teaching_activity=p["teaching_activity"],
            estimated_hours=p["estimated_hours"],
            status=RoadmapItemStatus.draft,
            assessment_task_count=0,
        )
        db.add(item)
        db.flush()

        for idx, t in enumerate(p.get("tasks", []), start=1):
            if not isinstance(t, dict):
                continue
            task = RoadmapAssessmentTask(
                roadmap_item_id=item.id,
                title=(t.get("title") or f"{item.title} task {idx}").strip(),
                task_type=(t.get("task_type") or "quiz"),
                description=t.get("description"),
                max_score=float(t.get("max_score") or 100),
                weight=_to_float(t.get("weight")),
                due_at=_parse_dt(t.get("due_at")),
                is_required=bool(t.get("is_required", True)),
                display_order=int(t.get("display_order") or idx),
                is_active=bool(t.get("is_active", True)),
                max_attempts=max(int(t.get("max_attempts") or 1), 1),
                attempt_scoring_rule=(t.get("attempt_scoring_rule") or "best"),
                allow_late_submission=bool(t.get("allow_late_submission", False)),
                late_penalty_percent=_to_float(t.get("late_penalty_percent")),
            )
            db.add(task)
            db.flush()
            create_task_grading_scheme_version(
                db,
                task=task,
                grading_scheme={
                    "scheme_name": task.title,
                    "auto_grading_enabled": False,
                    "auto_grading_instructions": None,
                    "components": [
                        {
                            "key": "overall",
                            "label": "Overall",
                            "description": None,
                            "max_points": float(task.max_score),
                            "display_order": 0,
                            "is_auto_gradable": False,
                            "manual_only": False,
                        }
                    ],
                    "rubric_levels": [],
                },
                actor_user_id=str(actor.id),
            )

        refresh_assessment_task_count(db, roadmap_item_id=item.id)
        created_items.append(item)

    emit_event_for_offering_enrollments(
        db,
        offering_id=str(offering.id),
        event_type="roadmap_generated",
        actor_user_id=str(actor.id),
        note={
            "offering_id": str(offering.id),
            "spec_id": str(spec.id),
            "items_created": len(created_items),
        },
    )
    db.commit()

    for item in created_items:
        db.refresh(item)
    return created_items


def list_roadmap_items(
    db: Session,
    *,
    offering_id: UUID,
    actor: User,
    status: str = "approved_active",
) -> list[OfferingRoadmapItem]:
    require_lecturer_or_admin_for_offering(db, offering_id=offering_id, actor=actor)
    q = (
        db.query(OfferingRoadmapItem)
        .options(joinedload(OfferingRoadmapItem.assessment_tasks))
        .filter(OfferingRoadmapItem.course_offering_id == offering_id)
    )
    status = (status or "approved_active").strip().lower()
    if status == "all":
        pass
    elif status in {"draft", "approved_active", "archived"}:
        q = q.filter(OfferingRoadmapItem.status == RoadmapItemStatus(status))
    else:
        raise ServiceValidationError("Invalid roadmap status filter")

    return q.order_by(OfferingRoadmapItem.sequence_no.asc()).all()


def activate_roadmap(
    db: Session,
    *,
    offering_id: UUID,
    actor: User,
    archive_existing_active: bool = True,
) -> int:
    offering = require_lecturer_or_admin_for_offering(db, offering_id=offering_id, actor=actor)
    draft_items = (
        db.query(OfferingRoadmapItem)
        .filter(
            OfferingRoadmapItem.course_offering_id == offering_id,
            OfferingRoadmapItem.status == RoadmapItemStatus.draft,
        )
        .all()
    )
    if not draft_items:
        raise ServiceValidationError("No draft roadmap items found to activate")

    if archive_existing_active:
        (
            db.query(OfferingRoadmapItem)
            .filter(
                OfferingRoadmapItem.course_offering_id == offering_id,
                OfferingRoadmapItem.status == RoadmapItemStatus.approved_active,
            )
            .update({"status": RoadmapItemStatus.archived}, synchronize_session=False)
        )

    for item in draft_items:
        item.status = RoadmapItemStatus.approved_active

    emit_event_for_offering_enrollments(
        db,
        offering_id=str(offering.id),
        event_type="roadmap_activated",
        actor_user_id=str(actor.id),
        note={"offering_id": str(offering.id), "item_count": len(draft_items)},
    )
    db.commit()
    return len(draft_items)


def create_roadmap_item(
    db: Session,
    *,
    offering_id: UUID,
    actor: User,
    payload: dict[str, Any],
) -> OfferingRoadmapItem:
    require_lecturer_or_admin_for_offering(db, offering_id=offering_id, actor=actor)

    item = OfferingRoadmapItem(
        course_offering_id=offering_id,
        sequence_no=payload["sequence_no"],
        week_no=payload.get("week_no"),
        title=payload["title"],
        key_content=payload.get("key_content"),
        teaching_activity=payload.get("teaching_activity"),
        estimated_hours=payload.get("estimated_hours"),
        status=RoadmapItemStatus(payload["status"]) if payload.get("status") else RoadmapItemStatus.draft,
        assessment_task_count=0,
    )
    db.add(item)
    db.flush()
    db.commit()
    db.refresh(item)
    return item


def update_roadmap_item(
    db: Session,
    *,
    item_id: UUID,
    actor: User,
    payload: dict[str, Any],
) -> OfferingRoadmapItem:
    item = db.query(OfferingRoadmapItem).filter(OfferingRoadmapItem.id == item_id).one_or_none()
    if not item:
        raise ServiceNotFoundError("Roadmap item not found")
    require_lecturer_or_admin_for_offering(db, offering_id=item.course_offering_id, actor=actor)

    for field in [
        "sequence_no",
        "week_no",
        "title",
        "key_content",
        "teaching_activity",
        "estimated_hours",
        "status",
    ]:
        if field in payload and payload[field] is not None:
            if field == "status":
                setattr(item, field, RoadmapItemStatus(payload[field]))
            else:
                setattr(item, field, payload[field])

    db.commit()
    db.refresh(item)
    return item


def archive_roadmap_item(
    db: Session,
    *,
    item_id: UUID,
    actor: User,
) -> OfferingRoadmapItem:
    item = db.query(OfferingRoadmapItem).filter(OfferingRoadmapItem.id == item_id).one_or_none()
    if not item:
        raise ServiceNotFoundError("Roadmap item not found")
    require_lecturer_or_admin_for_offering(db, offering_id=item.course_offering_id, actor=actor)

    item.status = RoadmapItemStatus.archived
    emit_event_for_offering_enrollments(
        db,
        offering_id=str(item.course_offering_id),
        event_type="roadmap_item_archived",
        actor_user_id=str(actor.id),
        note={"roadmap_item_id": str(item.id)},
    )
    db.commit()
    db.refresh(item)
    return item


def delete_roadmap_item(
    db: Session,
    *,
    item_id: UUID,
    actor: User,
) -> None:
    item = db.query(OfferingRoadmapItem).filter(OfferingRoadmapItem.id == item_id).one_or_none()
    if not item:
        raise ServiceNotFoundError("Roadmap item not found")
    require_lecturer_or_admin_for_offering(db, offering_id=item.course_offering_id, actor=actor)

    offering_id = str(item.course_offering_id)
    deleted_item_id = str(item.id)

    db.delete(item)

    emit_event_for_offering_enrollments(
        db,
        offering_id=offering_id,
        event_type="roadmap_item_deleted",
        actor_user_id=str(actor.id),
        note={"roadmap_item_id": deleted_item_id},
    )
    db.commit()
