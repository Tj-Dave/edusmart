from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.postgres import get_db
from app.models.gamification_schemas import GamificationOverviewOut, OfferingLeaderboardOut
from app.routes._service_errors import to_http_exception
from app.services.access_control import require_enrollment_read_access
from app.services.auth.deps import get_current_user
from app.services.gamification_service import get_gamification_overview, get_offering_leaderboard_for_enrollment

router = APIRouter(tags=["gamification"])


@router.get("/enrollments/{enrollment_id}/gamification", response_model=GamificationOverviewOut)
def enrollment_gamification_overview_endpoint(
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
        out = get_gamification_overview(
            db,
            enrollment_id=enrollment_id,
        )
        db.commit()
        return out
    except Exception as err:
        db.rollback()
        raise to_http_exception(err)


@router.get("/enrollments/{enrollment_id}/leaderboard", response_model=OfferingLeaderboardOut)
def enrollment_leaderboard_endpoint(
    enrollment_id: UUID,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        require_enrollment_read_access(
            db,
            enrollment_id=enrollment_id,
            actor=current_user,
        )
        out = get_offering_leaderboard_for_enrollment(
            db,
            enrollment_id=enrollment_id,
            limit=limit,
        )
        db.commit()
        return out
    except Exception as err:
        db.rollback()
        raise to_http_exception(err)
