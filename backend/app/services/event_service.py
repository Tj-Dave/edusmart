from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import Enrollment, EnrollmentEvent
from app.services.domain_errors import ServiceValidationError


def _note_to_text(note: dict[str, Any] | str | None) -> str | None:
    if note is None:
        return None
    if isinstance(note, str):
        return note
    return json.dumps(note, default=str, sort_keys=True)


def emit_enrollment_event(
    db: Session,
    *,
    enrollment_id: str,
    event_type: str,
    actor_user_id: str | None,
    note: dict[str, Any] | str | None = None,
) -> EnrollmentEvent:
    if not event_type or not event_type.strip():
        raise ServiceValidationError("event_type is required")

    ev = EnrollmentEvent(
        enrollment_id=enrollment_id,
        event_type=event_type.strip(),
        actor_user_id=actor_user_id,
        note=_note_to_text(note),
    )
    db.add(ev)
    db.flush()
    return ev


def emit_event_for_offering_enrollments(
    db: Session,
    *,
    offering_id: str,
    event_type: str,
    actor_user_id: str | None,
    note: dict[str, Any] | str | None = None,
) -> int:
    enrollments = (
        db.query(Enrollment.id)
        .filter(Enrollment.offering_id == offering_id)
        .all()
    )
    for row in enrollments:
        emit_enrollment_event(
            db,
            enrollment_id=str(row.id),
            event_type=event_type,
            actor_user_id=actor_user_id,
            note=note,
        )
    return len(enrollments)

