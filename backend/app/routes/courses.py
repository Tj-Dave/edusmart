# app/routes/courses.py
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.services.auth.deps import get_current_user
from app.db.models import UserRole, User

from app.db import crud_courses
from app.models.course_schemas import (
    CourseCreate, CourseUpdate, CourseOut,
    ActionOut,
    OfferingCreate,
    OfferingEnrollmentKeyUpdate,
    OfferingOut,
    OfferingUpdate,
)

router = APIRouter(prefix="/courses", tags=["courses"])


# -------------------------
# Courses
# -------------------------
@router.post("", response_model=CourseOut)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return crud_courses.create_course(
            db,
            course_code=payload.course_code,
            course_name=payload.course_name,
            description=payload.description,
            department=payload.department,
            faculty=payload.faculty,
            level=payload.level,
            credits=payload.credits,
            is_active=payload.is_active,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[CourseOut])
def list_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    q: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0, le=100000),
):
    return crud_courses.list_courses(db, q=q, is_active=is_active, limit=limit, offset=offset)


# -------------------------
# Offerings
# -------------------------
@router.post("/offerings", response_model=OfferingOut)
def create_offering(
    payload: OfferingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Optional but recommended: only lecturers/admin create offerings
    if current_user.role not in {UserRole.lecturer, UserRole.admin}:
        raise HTTPException(status_code=403, detail="Only lecturers/admin can create course offerings")

    # Optional: prevent lecturer from creating offerings for someone else unless admin
    lecturer_id = payload.lecturer_user_id
    if lecturer_id and str(lecturer_id) != str(current_user.id) and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Lecturers can only assign themselves as lecturer_user_id")

    try:
        return crud_courses.create_offering(
            db,
            course_code=payload.course_code,
            term=payload.term,
            year=payload.year,
            cohort=payload.cohort,
            section=payload.section,
            lecturer_user_id=lecturer_id or str(current_user.id),
            is_active=payload.is_active,
            enrollment_key=payload.enrollment_key,
            auto_generate_enrollment_key=payload.auto_generate_enrollment_key,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/offerings", response_model=list[OfferingOut])
def list_offerings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    course_code: Optional[str] = Query(default=None),
    year: Optional[int] = Query(default=None),
    term: Optional[str] = Query(default=None),
    cohort: Optional[str] = Query(default=None),
    section: Optional[str] = Query(default=None),
    lecturer_user_id: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0, le=100000),
):
    return crud_courses.list_offerings(
        db,
        course_code=course_code,
        year=year,
        term=term,
        cohort=cohort,
        section=section,
        lecturer_user_id=lecturer_user_id,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )


@router.patch("/offerings/{offering_id}/active", response_model=OfferingOut)
def set_offering_active(
    offering_id: UUID,
    is_active: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Optional but recommended
    if current_user.role not in {UserRole.lecturer, UserRole.admin}:
        raise HTTPException(status_code=403, detail="Only lecturers/admin can update offerings")

    try:
        return crud_courses.set_offering_active(db, offering_id=offering_id, is_active=is_active)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/offerings/{offering_id}", response_model=OfferingOut)
def update_offering(
    offering_id: UUID,
    payload: OfferingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.lecturer, UserRole.admin}:
        raise HTTPException(status_code=403, detail="Only lecturers/admin can update offerings")

    existing = crud_courses.get_offering(db, offering_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Offering not found")

    if (
        current_user.role == UserRole.lecturer
        and existing.lecturer_user_id
        and str(existing.lecturer_user_id) != str(current_user.id)
    ):
        raise HTTPException(status_code=403, detail="Lecturers can only update their own offerings")

    try:
        return crud_courses.update_offering(
            db,
            offering_id=offering_id,
            **payload.model_dump(exclude_unset=True),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/offerings/{offering_id}/enrollment-key", response_model=OfferingOut)
def set_offering_enrollment_key(
    offering_id: UUID,
    payload: OfferingEnrollmentKeyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.lecturer, UserRole.admin}:
        raise HTTPException(status_code=403, detail="Only lecturers/admin can set enrollment keys")

    try:
        return crud_courses.set_offering_enrollment_key(
            db,
            offering_id=offering_id,
            open_enrollment=payload.open_enrollment,
            enrollment_key=payload.enrollment_key,
            auto_generate=payload.auto_generate,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/offerings/{offering_id}", response_model=ActionOut)
def delete_offering(
    offering_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.lecturer, UserRole.admin}:
        raise HTTPException(status_code=403, detail="Only lecturers/admin can delete offerings")

    existing = crud_courses.get_offering(db, offering_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Offering not found")

    if (
        current_user.role == UserRole.lecturer
        and existing.lecturer_user_id
        and str(existing.lecturer_user_id) != str(current_user.id)
    ):
        raise HTTPException(status_code=403, detail="Lecturers can only delete their own offerings")

    try:
        crud_courses.delete_offering(db, offering_id=offering_id)
        return {"ok": True, "message": "Offering deleted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{course_code}", response_model=CourseOut)
def get_course(
    course_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = crud_courses.get_course(db, course_code)
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    return c


@router.patch("/{course_code}", response_model=CourseOut)
def update_course(
    course_code: str,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return crud_courses.update_course(
            db,
            course_code=course_code,
            course_name=payload.course_name,
            description=payload.description,
            department=payload.department,
            faculty=payload.faculty,
            level=payload.level,
            credits=payload.credits,
            is_active=payload.is_active,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
