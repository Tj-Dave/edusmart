from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.postgres import get_db
from app.models.roadmap_schemas import (
    EnrollmentProgressSummaryOut,
    EnrollmentRoadmapProgressOut,
    EnrollmentRoadmapViewOut,
)
from app.routes._service_errors import to_http_exception
from app.services.access_control import (
    require_enrollment_read_access,
    require_student_owner_or_admin_for_enrollment,
)
from app.services.auth.deps import get_current_user
from app.services.progress_service import (
    get_enrollment_progress_summary,
    get_enrollment_roadmap_view,
    start_roadmap_item,
)

router = APIRouter(tags=["progress"])


@router.get("/enrollments/{enrollment_id}/roadmap", response_model=EnrollmentRoadmapViewOut)
def enrollment_roadmap_endpoint(
    enrollment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        require_enrollment_read_access(
            db,
            enrollment_id=enrollment_id,
            actor=current_user,
        )
        view = get_enrollment_roadmap_view(
            db,
            enrollment_id=enrollment_id,
            actor_user_id=str(current_user.id),
        )
        db.commit()
        return view
    except Exception as err:
        db.rollback()
        raise to_http_exception(err)


@router.get(
    "/enrollments/{enrollment_id}/progress",
    response_model=EnrollmentProgressSummaryOut,
)
def enrollment_progress_summary_endpoint(
    enrollment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        require_enrollment_read_access(
            db,
            enrollment_id=enrollment_id,
            actor=current_user,
        )
        summary = get_enrollment_progress_summary(
            db,
            enrollment_id=enrollment_id,
            actor_user_id=str(current_user.id),
        )
        db.commit()
        return summary
    except Exception as err:
        db.rollback()
        raise to_http_exception(err)


@router.post(
    "/enrollments/{enrollment_id}/roadmap/{item_id}/start",
    response_model=EnrollmentRoadmapProgressOut,
)
def start_roadmap_item_endpoint(
    enrollment_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        require_student_owner_or_admin_for_enrollment(
            db,
            enrollment_id=enrollment_id,
            actor=current_user,
        )
        return start_roadmap_item(
            db,
            enrollment_id=enrollment_id,
            roadmap_item_id=item_id,
            actor_user_id=str(current_user.id),
        )
    except Exception as err:
        db.rollback()
        raise to_http_exception(err)
