# app/routes/enrollments.py
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.services.auth.deps import get_current_user
from app.db.models import User, UserRole
from app.routes._service_errors import to_http_exception
from app.services.access_control import (
    require_enrollment_read_access,
    require_lecturer_or_admin_for_enrollment,
)

from app.db import crud_courses
from app.models.course_schemas import (
    EnrollmentCreate,
    EnrollmentCreateByKey,
    EnrollmentOut,
    EnrollmentStatusUpdate,
    EnrollmentEventOut,
    OfferingOut,
)

router = APIRouter(prefix="/enrollments", tags=["enrollments"])


@router.get("/offerings", response_model=list[OfferingOut])
def search_active_offerings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    course_code: str = Query(..., min_length=1),
    term: str | None = Query(default=None),
    year: int | None = Query(default=None, ge=1990, le=2100),
    cohort: str | None = Query(default=None),
    section: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=100000),
):
    """
    Used for OPEN offerings (enrollment_key is NULL).
    Only returns active offerings.
    """
    try:
        return crud_courses.list_offerings(
            db,
            course_code=course_code,
            term=term,
            year=year,
            cohort=cohort,
            section=section,
            is_active=True,
            limit=limit,
            offset=offset,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/preview-by-key", response_model=OfferingOut)
def preview_by_key(
    enrollment_key: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return crud_courses.preview_offering_by_key(db, enrollment_key=enrollment_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/by-key", response_model=EnrollmentOut)
def enroll_by_key(
    payload: EnrollmentCreateByKey,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_user_id = payload.user_id or str(current_user.id)
    if payload.user_id and payload.user_id != str(current_user.id):
        if current_user.role != UserRole.lecturer:
            raise HTTPException(status_code=403, detail="Not allowed to enroll other users")

    try:
        return crud_courses.enroll_user_by_key(
            db,
            enrollment_key=payload.enrollment_key,
            student_user_id=target_user_id,
            actor_user_id=str(current_user.id),
            note=payload.note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("", response_model=EnrollmentOut)
def enroll_open_offering(
    payload: EnrollmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    OPEN offering enrollment by offering_id.
    Will fail if offering is closed (has enrollment_key).
    """
    target_user_id = payload.user_id or str(current_user.id)
    if payload.user_id and payload.user_id != str(current_user.id):
        if current_user.role != UserRole.lecturer:
            raise HTTPException(status_code=403, detail="Not allowed to enroll other users")

    try:
        return crud_courses.enroll_user_open_offering(
            db,
            offering_id=payload.offering_id,
            user_id=target_user_id,
            created_by_user_id=str(current_user.id),
            note=payload.note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[EnrollmentOut])
def list_enrollments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    offering_id: UUID | None = Query(default=None),
    user_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0, le=100000),
):
    if current_user.role == UserRole.admin:
        raise HTTPException(status_code=403, detail="Admins cannot access enrollment workflows")

    resolved_user_id = user_id
    if current_user.role == UserRole.student:
        resolved_user_id = str(current_user.id)

    try:
        return crud_courses.list_enrollments(
            db,
            offering_id=offering_id,
            user_id=resolved_user_id,
            status=status,
            limit=limit,
            offset=offset,
        )
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid status value")


@router.patch("/{enrollment_id}/status", response_model=EnrollmentOut)
def set_status(
    enrollment_id: UUID,
    payload: EnrollmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.lecturer:
        raise HTTPException(status_code=403, detail="Only lecturers can update enrollment status")
    try:
        require_lecturer_or_admin_for_enrollment(
            db,
            enrollment_id=enrollment_id,
            actor=current_user,
        )
    except Exception as e:
        raise to_http_exception(e)

    try:
        return crud_courses.set_enrollment_status(
            db,
            enrollment_id=enrollment_id,
            new_status=payload.status,
            actor_user_id=str(current_user.id),
            note=payload.note,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{enrollment_id}/events", response_model=list[EnrollmentEventOut])
def list_events(
    enrollment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0, le=100000),
):
    try:
        require_enrollment_read_access(
            db,
            enrollment_id=enrollment_id,
            actor=current_user,
        )
    except Exception as e:
        raise to_http_exception(e)

    return crud_courses.list_enrollment_events(
        db,
        enrollment_id=enrollment_id,
        limit=limit,
        offset=offset,
    )
