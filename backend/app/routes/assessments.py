from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.postgres import get_db
from app.models.roadmap_schemas import (
    AttemptActionOut,
    AttemptCreateRequest,
    AttemptGradeRequest,
    AttemptSubmitRequest,
    GenericActionOut,
    RoadmapTaskOut,
    TaskCreateRequest,
    TaskReorderRequest,
    TaskUpdateRequest,
)
from app.routes._service_errors import to_http_exception
from app.services.assessment_service import (
    create_attempt,
    create_task,
    deactivate_task,
    grade_attempt,
    reorder_tasks,
    submit_attempt,
    update_task,
)
from app.services.auth.deps import get_current_user

router = APIRouter(tags=["assessments"])


@router.post("/roadmap-items/{item_id}/tasks", response_model=RoadmapTaskOut)
def create_task_endpoint(
    item_id: UUID,
    payload: TaskCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return create_task(
            db,
            roadmap_item_id=item_id,
            actor=current_user,
            payload=payload.model_dump(exclude_none=True),
        )
    except Exception as err:
        raise to_http_exception(err)


@router.patch("/tasks/{task_id}", response_model=RoadmapTaskOut)
def update_task_endpoint(
    task_id: UUID,
    payload: TaskUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return update_task(
            db,
            task_id=task_id,
            actor=current_user,
            payload=payload.model_dump(exclude_none=True),
        )
    except Exception as err:
        raise to_http_exception(err)


@router.post("/tasks/{task_id}/deactivate", response_model=GenericActionOut)
def deactivate_task_endpoint(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        deactivate_task(db, task_id=task_id, actor=current_user)
        return {"ok": True, "message": "Task deactivated"}
    except Exception as err:
        raise to_http_exception(err)


@router.post("/roadmap-items/{item_id}/tasks/reorder", response_model=list[RoadmapTaskOut])
def reorder_tasks_endpoint(
    item_id: UUID,
    payload: TaskReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return reorder_tasks(
            db,
            roadmap_item_id=item_id,
            actor=current_user,
            task_ids=payload.task_ids,
        )
    except Exception as err:
        raise to_http_exception(err)


@router.post("/enrollments/{enrollment_id}/tasks/{task_id}/attempts", response_model=AttemptActionOut)
def create_attempt_endpoint(
    enrollment_id: UUID,
    task_id: UUID,
    payload: AttemptCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        attempt, progress = create_attempt(
            db,
            enrollment_id=enrollment_id,
            task_id=task_id,
            actor=current_user,
            evidence_url=payload.evidence_url,
            artifact_url=payload.artifact_url,
            reflection_text=payload.reflection_text,
            payload=payload.payload,
        )
        return {"attempt": attempt, "progress": progress}
    except Exception as err:
        raise to_http_exception(err)


@router.post(
    "/enrollments/{enrollment_id}/tasks/{task_id}/attempts/{attempt_no}/submit",
    response_model=AttemptActionOut,
)
def submit_attempt_endpoint(
    enrollment_id: UUID,
    task_id: UUID,
    attempt_no: int,
    payload: AttemptSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        attempt, progress = submit_attempt(
            db,
            enrollment_id=enrollment_id,
            task_id=task_id,
            attempt_no=attempt_no,
            actor=current_user,
            evidence_url=payload.evidence_url,
            artifact_url=payload.artifact_url,
            reflection_text=payload.reflection_text,
            payload=payload.payload,
        )
        return {"attempt": attempt, "progress": progress}
    except Exception as err:
        raise to_http_exception(err)


@router.post(
    "/enrollments/{enrollment_id}/tasks/{task_id}/attempts/{attempt_no}/grade",
    response_model=AttemptActionOut,
)
def grade_attempt_endpoint(
    enrollment_id: UUID,
    task_id: UUID,
    attempt_no: int,
    payload: AttemptGradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        attempt, progress = grade_attempt(
            db,
            enrollment_id=enrollment_id,
            task_id=task_id,
            attempt_no=attempt_no,
            actor=current_user,
            score=payload.score,
            feedback=payload.feedback,
            rubric_scores=payload.rubric_scores,
        )
        return {"attempt": attempt, "progress": progress}
    except Exception as err:
        raise to_http_exception(err)

