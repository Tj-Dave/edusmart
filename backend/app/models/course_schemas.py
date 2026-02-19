# app/models/course_schemas.py
from __future__ import annotations

from typing import Optional, Any, List, Literal
from uuid import UUID
from pydantic import BaseModel, Field


EnrollmentStatus = Literal["active", "dropped", "completed", "blocked"]


# -------------------------
# Courses
# -------------------------
class CourseCreate(BaseModel):
    course_code: str = Field(..., min_length=3, max_length=32)
    course_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    department: Optional[str] = Field(default=None, max_length=200)
    faculty: Optional[str] = Field(default=None, max_length=200)
    level: Optional[int] = Field(default=None, ge=1, le=10)
    credits: Optional[int] = Field(default=None, ge=0, le=60)
    is_active: bool = True


class CourseUpdate(BaseModel):
    course_name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = None
    department: Optional[str] = Field(default=None, max_length=200)
    faculty: Optional[str] = Field(default=None, max_length=200)
    level: Optional[int] = Field(default=None, ge=1, le=10)
    credits: Optional[int] = Field(default=None, ge=0, le=60)
    is_active: Optional[bool] = None


class CourseOut(BaseModel):
    course_code: str
    course_name: str
    description: Optional[str]
    department: Optional[str]
    faculty: Optional[str]
    level: Optional[int]
    credits: Optional[int]
    is_active: bool
    created_at: Any
    updated_at: Any

    class Config:
        from_attributes = True


# -------------------------
# Offerings
# -------------------------
class OfferingCreate(BaseModel):
    course_code: str = Field(..., min_length=3, max_length=32)
    term: str = Field(..., min_length=1, max_length=64)
    year: Optional[int] = Field(default=None, ge=1990, le=2100)
    cohort: Optional[str] = Field(default=None, max_length=64)
    section: Optional[str] = Field(default=None, max_length=64)
    lecturer_user_id: Optional[UUID] = None 
    is_active: bool = True
    enrollment_key: Optional[str] = None
    auto_generate_enrollment_key: bool = False



class OfferingOut(BaseModel):
    id: UUID
    course_code: str
    term: str
    year: Optional[int]
    cohort: Optional[str]
    section: Optional[str]
    lecturer_user_id: Optional[UUID]
    is_active: bool
    created_at: Any
    updated_at: Any
    enrollment_key: Optional[str]
    enrollment_key_generated: bool
    course: Optional[CourseOut] = None

    class Config:
        from_attributes = True

# -------------------------
# Offering Enrollment Key Update
# -------------------------
class OfferingEnrollmentKeyUpdate(BaseModel):
    """
    Controls whether enrollment is open or closed.

    Rules:
    - If open_enrollment = True  → enrollment_key will be set to NULL.
    - If open_enrollment = False:
        - If enrollment_key provided → use it.
        - If auto_generate = True → system generates one.
    """

    open_enrollment: bool = Field(
        ...,
        description="If true, enrollment becomes open (no key required)."
    )

    enrollment_key: Optional[str] = Field(
        default=None,
        min_length=3,
        max_length=120,
        description="Custom enrollment key (used only if open_enrollment=False)."
    )

    auto_generate: bool = Field(
        default=False,
        description="Auto-generate key if open_enrollment=False and no enrollment_key provided."
    )



# -------------------------
# Enrollments + Events
# -------------------------
class EnrollmentCreateByKey(BaseModel):
    enrollment_key: str = Field(..., min_length=1, max_length=120)
    user_id: Optional[UUID] = None
    note: Optional[str] = None

class EnrollmentCreate(BaseModel):
    offering_id: UUID
    user_id: Optional[UUID] = None
    note: Optional[str] = None


class EnrollmentOut(BaseModel):
    id: UUID
    offering_id: UUID
    user_id: UUID 
    status: str
    enrolled_at: Any
    ended_at: Optional[Any]
    created_at: Any
    updated_at: Any
    offering: Optional[OfferingOut] = None

    class Config:
        from_attributes = True


class EnrollmentStatusUpdate(BaseModel):
    status: EnrollmentStatus
    note: Optional[str] = None


class EnrollmentEventOut(BaseModel):
    id: int
    enrollment_id: UUID
    event_type: str
    actor_user_id: Optional[UUID] = None 
    note: Optional[str]
    created_at: Any

    class Config:
        from_attributes = True
