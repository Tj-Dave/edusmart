# app/db/crud_courses.py
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

import secrets
import re

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_


from app.db.models import Course, CourseOffering, Enrollment, EnrollmentEvent

# -------------------------
# Helper functions
# -------------------------
def _normalize_course_code(code: str) -> str:
    # keep it clean for keys: SWE3101, CSC-101 -> SWE3101, CSC101
    return re.sub(r"[^A-Za-z0-9]+", "", (code or "").strip()).upper()

def _generate_enrollment_key(course_code: str) -> str:
    # includes course code + short random token
    # Example: SWE3101-7K3P9X
    token = secrets.token_hex(3).upper()  # 6 hex chars
    return f"{_normalize_course_code(course_code)}-{token}"



# -------------------------
# Courses
# -------------------------
def create_course(
    db: Session,
    *,
    course_code: str,
    course_name: Optional[str] = None,
    description: Optional[str] = None,
    department: Optional[str] = None,
    faculty: Optional[str] = None,
    level: Optional[int] = None,
    credits: Optional[int] = None,
    is_active: bool = True,
) -> Course:
    code = (course_code or "").strip()
    if not code:
        raise ValueError("course_code is required")

    name = (course_name or "").strip() or code  # fallback: use code as name if empty

    exists = db.query(Course).filter(Course.course_code == code).one_or_none()
    if exists:
        raise ValueError("Course already exists")

    c = Course(
        course_code=code,
        course_name=name,
        description=description,
        department=department,
        faculty=faculty,
        level=level,
        credits=credits,
        is_active=is_active,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def get_course(db: Session, course_code: str) -> Optional[Course]:
    code = (course_code or "").strip()
    if not code:
        return None
    return db.query(Course).filter(Course.course_code == code).one_or_none()


def list_courses(
    db: Session,
    *,
    q: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = 200,
    offset: int = 0,
) -> List[Course]:
    qry = db.query(Course)

    if is_active is not None:
        qry = qry.filter(Course.is_active == is_active)

    if q:
        t = f"%{q.strip()}%"
        qry = qry.filter(or_(Course.course_code.ilike(t), Course.course_name.ilike(t)))

    return qry.order_by(Course.course_code.asc()).offset(offset).limit(limit).all()


def update_course(
    db: Session,
    *,
    course_code: str,
    course_name: Optional[str] = None,
    description: Optional[str] = None,
    department: Optional[str] = None,
    faculty: Optional[str] = None,
    level: Optional[int] = None,
    credits: Optional[int] = None,
    is_active: Optional[bool] = None,
) -> Course:
    c = get_course(db, course_code)
    if not c:
        raise ValueError("Course not found")

    if course_name is not None:
        c.course_name = (course_name or "").strip() or c.course_name
    if description is not None:
        c.description = description
    if department is not None:
        c.department = department
    if faculty is not None:
        c.faculty = faculty
    if level is not None:
        c.level = level
    if credits is not None:
        c.credits = credits
    if is_active is not None:
        c.is_active = is_active

    db.commit()
    db.refresh(c)
    return c


# -------------------------
# Offerings
# -------------------------
def create_offering(
    db: Session,
    *,
    course_code: str,
    term: str,
    year: Optional[int] = None,
    cohort: Optional[str] = None,
    section: Optional[str] = None,
    lecturer_user_id: Optional[str] = None,
    is_active: bool = True,
    enrollment_key: Optional[str] = None,
    auto_generate_enrollment_key: bool = False,
) -> CourseOffering:
    code = (course_code or "").strip()
    if not code:
        raise ValueError("course_code is required")

    t = (term or "").strip()
    if not t:
        raise ValueError("term is required")

    c = get_course(db, code)
    if not c:
        raise ValueError("Course not found")

    key = (enrollment_key or "").strip() if enrollment_key is not None else None
    if key == "":
        key = None

    generated = False
    if auto_generate_enrollment_key and key is None:
        # retry a few times in case of rare collisions
        for _ in range(5):
            candidate = _generate_enrollment_key(code)
            exists = db.query(CourseOffering).filter(CourseOffering.enrollment_key == candidate).one_or_none()
            if not exists:
                key = candidate
                generated = True
                break
        if key is None:
            raise ValueError("Failed to generate a unique enrollment key")

    o = CourseOffering(
        course_code=code,
        term=t,
        year=year,
        cohort=(cohort or None),
        section=(section or None),
        lecturer_user_id=lecturer_user_id,
        is_active=is_active,
        enrollment_key=key,
        enrollment_key_generated=generated,
    )
    db.add(o)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise ValueError(f"Offering already exists or invalid: {e}")

    db.refresh(o)
    return o

def set_offering_enrollment_key(
    db: Session,
    *,
    offering_id: UUID,
    open_enrollment: bool,
    enrollment_key: Optional[str] = None,
    auto_generate: bool = False,
) -> CourseOffering:

    o = get_offering(db, offering_id)
    if not o:
        raise ValueError("Offering not found")

    # -------------------------
    # Open Enrollment
    # -------------------------
    if open_enrollment:
        o.enrollment_key = None
        o.enrollment_key_generated = False
        db.commit()
        db.refresh(o)
        return o

    # -------------------------
    # Closed Enrollment
    # -------------------------
    key = (enrollment_key or "").strip() if enrollment_key else None

    if not key and not auto_generate:
        raise ValueError("Provide enrollment_key or set auto_generate=True")

    generated = False

    if auto_generate and not key:
        for _ in range(5):
            candidate = _generate_enrollment_key(o.course_code)
            exists = db.query(CourseOffering).filter(
                CourseOffering.enrollment_key == candidate
            ).one_or_none()
            if not exists:
                key = candidate
                generated = True
                break
        if not key:
            raise ValueError("Failed to generate unique enrollment key")

    o.enrollment_key = key
    o.enrollment_key_generated = generated

    db.commit()
    db.refresh(o)
    return o



def get_offering(db: Session, offering_id: UUID) -> Optional[CourseOffering]:
    return db.query(CourseOffering).filter(CourseOffering.id == offering_id).one_or_none()


def list_offerings(
    db: Session,
    *,
    course_code: Optional[str] = None,
    year: Optional[int] = None,
    term: Optional[str] = None,
    cohort: Optional[str] = None,
    section: Optional[str] = None,
    lecturer_user_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = 200,
    offset: int = 0,
) -> List[CourseOffering]:
    qry = db.query(CourseOffering)

    if course_code:
        qry = qry.filter(CourseOffering.course_code == course_code.strip())
    if year is not None:
        qry = qry.filter(CourseOffering.year == year)
    if term:
        qry = qry.filter(CourseOffering.term == term.strip())
    if cohort is not None:
        qry = qry.filter(CourseOffering.cohort == cohort)
    if section is not None:
        qry = qry.filter(CourseOffering.section == section)
    if lecturer_user_id is not None:
        qry = qry.filter(CourseOffering.lecturer_user_id == lecturer_user_id)
    if is_active is not None:
        qry = qry.filter(CourseOffering.is_active == is_active)

    return qry.order_by(CourseOffering.updated_at.desc()).offset(offset).limit(limit).all()


def set_offering_active(db: Session, *, offering_id: UUID, is_active: bool) -> CourseOffering:
    o = get_offering(db, offering_id)
    if not o:
        raise ValueError("Offering not found")
    o.is_active = is_active
    db.commit()
    db.refresh(o)
    return o


# -------------------------
# Enrollments + Events (OPEN or KEY enrollment)
# -------------------------
_ALLOWED_ENROLLMENT_STATUS = {"active", "dropped", "completed", "blocked"}


def preview_offering_by_key(db: Session, *, enrollment_key: str) -> CourseOffering:
    key = (enrollment_key or "").strip()
    if not key:
        raise ValueError("enrollment_key is required")

    offering = (
        db.query(CourseOffering)
        .options(joinedload(CourseOffering.course))
        .filter(CourseOffering.enrollment_key == key)
        .one_or_none()
    )
    ...
    return offering


def enroll_user_by_key(
    db: Session,
    *,
    enrollment_key: str,
    student_user_id: str,
    actor_user_id: str,
    note: Optional[str] = None,
) -> Enrollment:
    """
    CLOSED offering enrollment (key required):
    - resolve offering by key
    - ensure offering active
    - ensure offering is CLOSED (has a key)
    - create enrollment if not already enrolled
    - create EnrollmentEvent

    Returns Enrollment with offering + offering.course eagerly loaded
    so API can serialize nested details (Option 1).
    """

    key = (enrollment_key or "").strip()
    if not key:
        raise ValueError("enrollment_key is required")

    # ✅ Resolve offering by key (and eager-load its course for consistent behavior)
    offering = (
        db.query(CourseOffering)
        .options(joinedload(CourseOffering.course))
        .filter(CourseOffering.enrollment_key == key)
        .one_or_none()
    )
    if not offering:
        raise ValueError("Invalid enrollment key")
    if not offering.is_active:
        raise ValueError("Course offering is not active")

    # must be CLOSED (key-based) to use this
    if offering.enrollment_key is None:
        raise ValueError("This course offering is open. Enroll by selecting the offering instead.")

    # ✅ If already enrolled, return fully-hydrated enrollment (with offering+course)
    existing = (
        db.query(Enrollment)
        .filter(Enrollment.offering_id == offering.id, Enrollment.user_id == student_user_id)
        .one_or_none()
    )
    if existing:
        full_existing = _get_enrollment_with_offering_and_course(db, existing.id)
        return full_existing or existing

    # ✅ Create enrollment + event in a single transaction
    try:
        e = Enrollment(
            offering_id=offering.id,
            user_id=student_user_id,
            status="active",
        )
        db.add(e)
        db.flush()  # get e.id before commit

        ev = EnrollmentEvent(
            enrollment_id=e.id,
            event_type="enrolled",
            actor_user_id=actor_user_id,
            note=note,
        )
        db.add(ev)

        db.commit()
    except Exception:
        db.rollback()
        raise

    # ✅ Return the enrollment reloaded with offering + course
    full = _get_enrollment_with_offering_and_course(db, e.id)
    return full or e


def enroll_user_open_offering(
    db: Session,
    *,
    offering_id: UUID,
    user_id: str,
    created_by_user_id: str,
    note: Optional[str] = None,
) -> Enrollment:
    """
    OPEN offering enrollment (NO key):
    - offering_id must exist
    - offering must be active
    - offering must be OPEN (enrollment_key IS NULL)

    Returns Enrollment with offering + offering.course eagerly loaded
    so API can serialize nested details (Option 1).
    """

    # ✅ Load offering (optionally eager-load course so checks + return payload are consistent)
    o = (
        db.query(CourseOffering)
        .options(joinedload(CourseOffering.course))
        .filter(CourseOffering.id == offering_id)
        .one_or_none()
    )
    if not o:
        raise ValueError("Offering not found")
    if not o.is_active:
        raise ValueError("Course offering is not active")
    if o.enrollment_key is not None:
        raise ValueError("This course offering is closed. Use the enrollment key to enroll.")

    # ✅ If already enrolled, return fully-hydrated enrollment (with offering+course)
    existing = (
        db.query(Enrollment)
        .filter(Enrollment.offering_id == offering_id, Enrollment.user_id == user_id)
        .one_or_none()
    )
    if existing:
        full_existing = _get_enrollment_with_offering_and_course(db, existing.id)
        return full_existing or existing

    # ✅ Create enrollment + event in a single transaction
    try:
        e = Enrollment(
            offering_id=offering_id,
            user_id=user_id,
            status="active",
        )
        db.add(e)
        db.flush()  # get e.id without committing yet

        ev = EnrollmentEvent(
            enrollment_id=e.id,
            event_type="enrolled",
            actor_user_id=created_by_user_id,
            note=note,
        )
        db.add(ev)

        db.commit()
    except Exception:
        db.rollback()
        raise

    # ✅ Return the enrollment reloaded with offering + course
    full = _get_enrollment_with_offering_and_course(db, e.id)
    return full or e

def get_enrollment(db: Session, enrollment_id: UUID) -> Optional[Enrollment]:
    return (
        db.query(Enrollment)
        .options(joinedload(Enrollment.offering).joinedload(CourseOffering.course))
        .filter(Enrollment.id == enrollment_id)
        .one_or_none()
    )

def list_enrollments(
    db: Session,
    *,
    offering_id: Optional[UUID] = None,
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
) -> List[Enrollment]:
    qry = (
        db.query(Enrollment)
        .options(
            joinedload(Enrollment.offering).joinedload(CourseOffering.course)
        )
    )

    if offering_id is not None:
        qry = qry.filter(Enrollment.offering_id == offering_id)
    if user_id is not None:
        qry = qry.filter(Enrollment.user_id == user_id)
    if status is not None:
        qry = qry.filter(Enrollment.status == status)

    return qry.order_by(Enrollment.updated_at.desc()).offset(offset).limit(limit).all()



def set_enrollment_status(
    db: Session,
    *,
    enrollment_id: UUID,
    new_status: str,
    actor_user_id: str,
    note: Optional[str] = None,
) -> Enrollment:
    e = get_enrollment(db, enrollment_id)
    if not e:
        raise ValueError("Enrollment not found")

    s = (new_status or "").strip().lower()
    if s not in _ALLOWED_ENROLLMENT_STATUS:
        raise ValueError("Invalid enrollment status")

    if e.status != s:
        e.status = s
        db.commit()
        db.refresh(e)

        ev = EnrollmentEvent(
            enrollment_id=e.id,
            event_type="status_changed",
            actor_user_id=actor_user_id,
            note=note or f"Status -> {s}",
        )
        db.add(ev)
        db.commit()

    return e


def list_enrollment_events(
    db: Session,
    *,
    enrollment_id: UUID,
    limit: int = 200,
    offset: int = 0,
) -> List[EnrollmentEvent]:
    return (
        db.query(EnrollmentEvent)
        .filter(EnrollmentEvent.enrollment_id == enrollment_id)
        .order_by(EnrollmentEvent.id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

def _get_enrollment_with_offering_and_course(db: Session, enrollment_id: UUID) -> Optional[Enrollment]:
    return (
        db.query(Enrollment)
        .options(joinedload(Enrollment.offering).joinedload(CourseOffering.course))
        .filter(Enrollment.id == enrollment_id)
        .one_or_none()
    )
