from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import Enrollment, StudentBadge, StudentGamificationProfile, XpEvent
from app.services.domain_errors import ServiceNotFoundError


BADGES: dict[str, dict[str, str]] = {
    "first_attempt": {
        "title": "First Attempt",
        "description": "Created your first assessment attempt.",
    },
    "practical_finisher": {
        "title": "Practical Finisher",
        "description": "Submitted a practical task with artifact evidence.",
    },
    "reflective_learner": {
        "title": "Reflective Learner",
        "description": "Submitted at least 3 reflective practical attempts.",
    },
    "high_achiever": {
        "title": "High Achiever",
        "description": "Earned high scores in graded attempts.",
    },
    "streak_7": {
        "title": "Consistency Streak",
        "description": "Stayed active for 7 consecutive days.",
    },
}


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _level_from_xp(xp_total: int) -> tuple[int, int, int]:
    level = 1
    remaining = max(0, int(xp_total))
    threshold = 100 * level

    while remaining >= threshold:
        remaining -= threshold
        level += 1
        threshold = 100 * level

    xp_in_level = remaining
    xp_to_next_level = max(0, threshold - remaining)
    return level, xp_in_level, xp_to_next_level


def _ensure_profile(db: Session, user_id: UUID | str) -> StudentGamificationProfile:
    profile = (
        db.query(StudentGamificationProfile)
        .filter(StudentGamificationProfile.user_id == user_id)
        .one_or_none()
    )
    if profile:
        return profile

    profile = StudentGamificationProfile(
        user_id=user_id,
        xp_total=0,
        level=1,
        streak_days=0,
    )
    db.add(profile)
    db.flush()
    return profile


def _award_badge_if_missing(
    db: Session,
    *,
    user_id: UUID | str,
    badge_code: str,
) -> None:
    if badge_code not in BADGES:
        return

    existing = (
        db.query(StudentBadge.id)
        .filter(StudentBadge.user_id == user_id, StudentBadge.badge_code == badge_code)
        .first()
    )
    if existing:
        return

    badge_meta = BADGES[badge_code]
    badge = StudentBadge(
        user_id=user_id,
        badge_code=badge_code,
        title=badge_meta["title"],
        description=badge_meta.get("description"),
    )
    db.add(badge)
    db.flush()


def _evaluate_badges(db: Session, *, user_id: UUID | str, profile: StudentGamificationProfile) -> None:
    first_attempts = (
        db.query(XpEvent.id)
        .filter(XpEvent.user_id == user_id, XpEvent.event_type == "attempt_created")
        .count()
    )
    if first_attempts >= 1:
        _award_badge_if_missing(db, user_id=user_id, badge_code="first_attempt")

    practical_submits = (
        db.query(XpEvent.id)
        .filter(XpEvent.user_id == user_id, XpEvent.event_type == "practical_submit")
        .count()
    )
    if practical_submits >= 1:
        _award_badge_if_missing(db, user_id=user_id, badge_code="practical_finisher")

    reflective_events = (
        db.query(XpEvent.id)
        .filter(XpEvent.user_id == user_id, XpEvent.event_type == "reflection_bonus")
        .count()
    )
    if reflective_events >= 3:
        _award_badge_if_missing(db, user_id=user_id, badge_code="reflective_learner")

    high_score_events = (
        db.query(XpEvent.id)
        .filter(XpEvent.user_id == user_id, XpEvent.event_type == "high_score_bonus")
        .count()
    )
    if high_score_events >= 3:
        _award_badge_if_missing(db, user_id=user_id, badge_code="high_achiever")

    if int(profile.streak_days or 0) >= 7:
        _award_badge_if_missing(db, user_id=user_id, badge_code="streak_7")


def award_xp_event(
    db: Session,
    *,
    user_id: UUID | str,
    enrollment_id: UUID | str | None,
    event_type: str,
    xp_delta: int,
    reason: str,
    metadata_json: dict[str, Any] | None = None,
) -> StudentGamificationProfile:
    delta = int(xp_delta)
    if delta == 0:
        return _ensure_profile(db, user_id)

    profile = _ensure_profile(db, user_id)

    today = _today()
    prev = profile.last_activity_date.date() if profile.last_activity_date else None
    if prev is None:
        profile.streak_days = 1
    elif prev == today:
        pass
    elif (today - prev).days == 1:
        profile.streak_days = int(profile.streak_days or 0) + 1
    else:
        profile.streak_days = 1

    profile.last_activity_date = datetime.now(timezone.utc)
    profile.xp_total = max(0, int(profile.xp_total or 0) + delta)
    level, _xp_in_level, _xp_to_next = _level_from_xp(profile.xp_total)
    profile.level = level

    ev = XpEvent(
        user_id=user_id,
        enrollment_id=enrollment_id,
        event_type=event_type,
        xp_delta=delta,
        reason=reason,
        metadata_json=metadata_json,
    )
    db.add(ev)
    db.flush()

    _evaluate_badges(db, user_id=user_id, profile=profile)
    return profile


def award_xp_safe(
    db: Session,
    *,
    user_id: UUID | str,
    enrollment_id: UUID | str | None,
    event_type: str,
    xp_delta: int,
    reason: str,
    metadata_json: dict[str, Any] | None = None,
) -> None:
    try:
        award_xp_event(
            db,
            user_id=user_id,
            enrollment_id=enrollment_id,
            event_type=event_type,
            xp_delta=xp_delta,
            reason=reason,
            metadata_json=metadata_json,
        )
    except Exception:
        # Keep core learning workflows unaffected if gamification is not yet migrated.
        return


def get_gamification_overview(
    db: Session,
    *,
    enrollment_id: UUID,
) -> dict[str, Any]:
    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).one_or_none()
    if not enrollment:
        raise ServiceNotFoundError("Enrollment not found")

    user_id = enrollment.user_id
    profile = _ensure_profile(db, user_id)

    level, xp_in_level, xp_to_next = _level_from_xp(int(profile.xp_total or 0))

    badges = (
        db.query(StudentBadge)
        .filter(StudentBadge.user_id == user_id)
        .order_by(StudentBadge.awarded_at.desc())
        .all()
    )

    recent_events = (
        db.query(XpEvent)
        .filter(XpEvent.user_id == user_id)
        .order_by(XpEvent.created_at.desc())
        .limit(20)
        .all()
    )

    return {
        "enrollment_id": enrollment.id,
        "user_id": user_id,
        "xp_total": int(profile.xp_total or 0),
        "level": int(level),
        "streak_days": int(profile.streak_days or 0),
        "xp_in_level": int(xp_in_level),
        "xp_to_next_level": int(xp_to_next),
        "badges": badges,
        "recent_events": recent_events,
    }


def get_offering_leaderboard_for_enrollment(
    db: Session,
    *,
    enrollment_id: UUID,
    limit: int = 10,
) -> dict[str, Any]:
    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).one_or_none()
    if not enrollment:
        raise ServiceNotFoundError("Enrollment not found")

    top_n = max(1, min(int(limit or 10), 100))
    offering_enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.offering_id == enrollment.offering_id)
        .all()
    )

    rows: list[dict[str, Any]] = []
    for row in offering_enrollments:
        profile = _ensure_profile(db, row.user_id)
        user = row.user
        display_name = None
        if getattr(user, "profile", None) and getattr(user.profile, "full_name", None):
            display_name = user.profile.full_name
        elif getattr(user, "username", None):
            display_name = user.username
        elif getattr(user, "email", None):
            display_name = user.email
        else:
            display_name = str(row.user_id)

        rows.append(
            {
                "enrollment_id": row.id,
                "user_id": row.user_id,
                "display_name": str(display_name),
                "xp_total": int(profile.xp_total or 0),
                "level": int(profile.level or 1),
                "streak_days": int(profile.streak_days or 0),
            }
        )

    rows.sort(
        key=lambda x: (
            -int(x["xp_total"]),
            -int(x["level"]),
            -int(x["streak_days"]),
            str(x["display_name"]).lower(),
        )
    )

    entries: list[dict[str, Any]] = []
    viewer_rank: int | None = None
    for index, row in enumerate(rows, start=1):
        is_viewer = str(row["enrollment_id"]) == str(enrollment.id)
        if is_viewer:
            viewer_rank = index
        if index <= top_n or is_viewer:
            entries.append(
                {
                    "rank": index,
                    "enrollment_id": row["enrollment_id"],
                    "user_id": row["user_id"],
                    "display_name": row["display_name"],
                    "xp_total": row["xp_total"],
                    "level": row["level"],
                    "streak_days": row["streak_days"],
                    "is_viewer": is_viewer,
                }
            )

    return {
        "offering_id": enrollment.offering_id,
        "enrollment_id": enrollment.id,
        "viewer_user_id": enrollment.user_id,
        "viewer_rank": viewer_rank,
        "total_participants": len(rows),
        "entries": entries,
    }
