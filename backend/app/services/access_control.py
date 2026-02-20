from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import CourseOffering, Enrollment, User, UserRole
from app.services.domain_errors import ServiceNotFoundError, ServicePermissionError


def _role_value(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def is_admin(user: User) -> bool:
    return _role_value(user) == UserRole.admin.value


def is_lecturer(user: User) -> bool:
    return _role_value(user) == UserRole.lecturer.value


def is_student(user: User) -> bool:
    return _role_value(user) == UserRole.student.value


def require_role(user: User, *, allowed: set[str]) -> None:
    role = _role_value(user)
    if role not in allowed:
        raise ServicePermissionError("You do not have permission to perform this action")


def get_offering_or_404(db: Session, offering_id: UUID) -> CourseOffering:
    offering = db.query(CourseOffering).filter(CourseOffering.id == offering_id).one_or_none()
    if not offering:
        raise ServiceNotFoundError("Course offering not found")
    return offering


def require_lecturer_or_admin_for_offering(
    db: Session,
    *,
    offering_id: UUID,
    actor: User,
) -> CourseOffering:
    offering = get_offering_or_404(db, offering_id)

    if is_admin(actor):
        return offering

    if not is_lecturer(actor):
        raise ServicePermissionError("Only lecturers/admin can manage this offering")

    if not offering.lecturer_user_id:
        raise ServicePermissionError("Offering has no assigned lecturer")

    if str(offering.lecturer_user_id) != str(actor.id):
        raise ServicePermissionError("You can only manage your own offerings")

    return offering


def get_enrollment_or_404(db: Session, enrollment_id: UUID) -> Enrollment:
    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).one_or_none()
    if not enrollment:
        raise ServiceNotFoundError("Enrollment not found")
    return enrollment


def require_student_owner_or_admin_for_enrollment(
    db: Session,
    *,
    enrollment_id: UUID,
    actor: User,
) -> Enrollment:
    enrollment = get_enrollment_or_404(db, enrollment_id)
    if is_admin(actor):
        return enrollment
    if not is_student(actor):
        raise ServicePermissionError("Only students/admin can perform this action")
    if str(enrollment.user_id) != str(actor.id):
        raise ServicePermissionError("You can only access your own enrollment")
    return enrollment


def require_lecturer_or_admin_for_enrollment(
    db: Session,
    *,
    enrollment_id: UUID,
    actor: User,
) -> Enrollment:
    enrollment = get_enrollment_or_404(db, enrollment_id)
    if is_admin(actor):
        return enrollment

    if not is_lecturer(actor):
        raise ServicePermissionError("Only lecturers/admin can perform this action")

    offering = (
        db.query(CourseOffering)
        .filter(CourseOffering.id == enrollment.offering_id)
        .one_or_none()
    )
    if not offering:
        raise ServiceNotFoundError("Course offering not found")

    if not offering.lecturer_user_id or str(offering.lecturer_user_id) != str(actor.id):
        raise ServicePermissionError("You can only access enrollments for your own offerings")

    return enrollment

