from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.orm import Session

from app.db.models import AttemptAiEvaluation, User
from app.db.postgres import get_db
from app.models.roadmap_schemas import (
    AssessmentActiveUpdateRequest,
    AssessmentRoadmapGroupOut,
    AssessmentSubmissionListItemOut,
    AssessmentTaskOut,
    AttemptActionOut,
    AttemptCreateRequest,
    AttemptGradeRequest,
    AttemptGradingDetailOut,
    AttemptSubmitRequest,
    GradingTemplateCreateRequest,
    GradingTemplateOut,
    GradingTemplateUpdateRequest,
    GenericActionOut,
    RoadmapTaskOut,
    SubmissionDetailOut,
    SubmissionFinalizeRequest,
    TaskGradingSchemeOut,
    TaskCreateRequest,
    TaskReorderRequest,
    TaskUpdateRequest,
)
from app.routes._service_errors import to_http_exception
from app.services.assessment_service import (
    create_attempt,
    create_task,
    deactivate_task,
    finalize_submission,
    get_submission_detail,
    get_attempt_grading_detail,
    get_task_grading_config,
    grade_attempt,
    list_assessments_for_offering,
    list_submissions_for_assessment,
    reorder_tasks,
    serialize_assessment_task_for_output,
    create_submission_ai_evaluation,
    retry_attempt_ai_evaluation,
    submit_attempt,
    update_task,
)
from app.services.auth.deps import get_current_user
from app.services.grading_ai_service import process_ai_evaluation
from app.services.grading_template_service import (
    create_template,
    get_template,
    list_templates,
    update_template,
)

router = APIRouter(tags=["assessments"])


@router.post("/grading-templates", response_model=GradingTemplateOut)
def create_template_endpoint(
    payload: GradingTemplateCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return create_template(
            db,
            actor=current_user,
            payload=payload.model_dump(exclude_none=True),
        )
    except Exception as err:
        raise to_http_exception(err)


@router.get("/grading-templates", response_model=list[GradingTemplateOut])
def list_templates_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return list_templates(db, actor=current_user)
    except Exception as err:
        raise to_http_exception(err)


@router.get("/grading-templates/{template_id}", response_model=GradingTemplateOut)
def get_template_endpoint(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return get_template(db, template_id=template_id, actor=current_user)
    except Exception as err:
        raise to_http_exception(err)


@router.patch("/grading-templates/{template_id}", response_model=GradingTemplateOut)
def update_template_endpoint(
    template_id: UUID,
    payload: GradingTemplateUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return update_template(
            db,
            template_id=template_id,
            actor=current_user,
            payload=payload.model_dump(exclude_none=True),
        )
    except Exception as err:
        raise to_http_exception(err)


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


@router.get("/offerings/{offering_id}/assessments", response_model=list[AssessmentRoadmapGroupOut])
def list_offering_assessments_endpoint(
    offering_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return list_assessments_for_offering(
            db,
            offering_id=offering_id,
            actor=current_user,
        )
    except Exception as err:
        raise to_http_exception(err)


@router.post("/roadmap-items/{item_id}/assessments", response_model=AssessmentTaskOut)
def create_assessment_endpoint(
    item_id: UUID,
    payload: TaskCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        task = create_task(
            db,
            roadmap_item_id=item_id,
            actor=current_user,
            payload=payload.model_dump(exclude_none=True),
        )
        return serialize_assessment_task_for_output(
            db,
            task=task,
            actor_user_id=str(current_user.id),
        )
    except Exception as err:
        raise to_http_exception(err)


@router.get("/tasks/{task_id}/grading", response_model=TaskGradingSchemeOut)
def get_task_grading_endpoint(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return get_task_grading_config(db, task_id=task_id, actor=current_user)
    except Exception as err:
        raise to_http_exception(err)


@router.patch("/assessments/{assessment_id}", response_model=AssessmentTaskOut)
def update_assessment_endpoint(
    assessment_id: UUID,
    payload: TaskUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        task = update_task(
            db,
            task_id=assessment_id,
            actor=current_user,
            payload=payload.model_dump(exclude_none=True),
        )
        return serialize_assessment_task_for_output(
            db,
            task=task,
            actor_user_id=str(current_user.id),
        )
    except Exception as err:
        raise to_http_exception(err)


@router.patch("/assessments/{assessment_id}/active", response_model=AssessmentTaskOut)
def set_assessment_active_endpoint(
    assessment_id: UUID,
    payload: AssessmentActiveUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        task = update_task(
            db,
            task_id=assessment_id,
            actor=current_user,
            payload={"is_active": payload.is_active},
        )
        return serialize_assessment_task_for_output(
            db,
            task=task,
            actor_user_id=str(current_user.id),
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


@router.get("/assessments/{assessment_id}/submissions", response_model=list[AssessmentSubmissionListItemOut])
def list_assessment_submissions_endpoint(
    assessment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return list_submissions_for_assessment(
            db,
            assessment_id=assessment_id,
            actor=current_user,
        )
    except Exception as err:
        raise to_http_exception(err)


@router.get("/submissions/{submission_id}", response_model=SubmissionDetailOut)
def get_submission_endpoint(
    submission_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return get_submission_detail(
            db,
            submission_id=submission_id,
            actor=current_user,
        )
    except Exception as err:
        raise to_http_exception(err)


@router.post("/submissions/{submission_id}/ai-grade", response_model=SubmissionDetailOut)
def ai_grade_submission_endpoint(
    submission_id: UUID,
    req: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        detail = create_submission_ai_evaluation(
            db,
            submission_id=submission_id,
            actor=current_user,
        )
        latest = detail.get("latest_ai_evaluation")
        if latest and latest.get("id"):
            background_tasks.add_task(
                process_ai_evaluation,
                evaluation_id=latest["id"],
                llm_client=getattr(req.app.state, "llm_subclient", None),
            )
        return detail
    except Exception as err:
        raise to_http_exception(err)


@router.patch("/submissions/{submission_id}/finalize", response_model=SubmissionDetailOut)
def finalize_submission_endpoint(
    submission_id: UUID,
    payload: SubmissionFinalizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return finalize_submission(
            db,
            submission_id=submission_id,
            actor=current_user,
            score=payload.score,
            feedback=payload.feedback,
            rubric_scores=payload.rubric_scores,
            component_scores=None if payload.component_scores is None else [
                row.model_dump(exclude_none=True) for row in payload.component_scores
            ],
            use_ai_suggestions=payload.use_ai_suggestions,
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
            submission_text=payload.submission_text,
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
    req: Request,
    background_tasks: BackgroundTasks,
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
            submission_text=payload.submission_text,
            payload=payload.payload,
        )
        if attempt.latest_ai_evaluation_id:
            evaluation = (
                db.query(AttemptAiEvaluation)
                .filter(AttemptAiEvaluation.id == attempt.latest_ai_evaluation_id)
                .one_or_none()
            )
            if evaluation is not None and (
                evaluation.status.value if hasattr(evaluation.status, "value") else str(evaluation.status)
            ) == "pending":
                background_tasks.add_task(
                    process_ai_evaluation,
                    evaluation_id=attempt.latest_ai_evaluation_id,
                    llm_client=getattr(req.app.state, "llm_subclient", None),
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
            component_scores=None if payload.component_scores is None else [
                row.model_dump(exclude_none=True) for row in payload.component_scores
            ],
            use_ai_suggestions=payload.use_ai_suggestions,
        )
        return {"attempt": attempt, "progress": progress}
    except Exception as err:
        raise to_http_exception(err)


@router.get(
    "/enrollments/{enrollment_id}/tasks/{task_id}/attempts/{attempt_no}/grading",
    response_model=AttemptGradingDetailOut,
)
def get_attempt_grading_endpoint(
    enrollment_id: UUID,
    task_id: UUID,
    attempt_no: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return get_attempt_grading_detail(
            db,
            enrollment_id=enrollment_id,
            task_id=task_id,
            attempt_no=attempt_no,
            actor=current_user,
        )
    except Exception as err:
        raise to_http_exception(err)


@router.post(
    "/enrollments/{enrollment_id}/tasks/{task_id}/attempts/{attempt_no}/ai-evaluation/retry",
    response_model=AttemptGradingDetailOut,
)
def retry_ai_evaluation_endpoint(
    enrollment_id: UUID,
    task_id: UUID,
    attempt_no: int,
    req: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        detail = retry_attempt_ai_evaluation(
            db,
            enrollment_id=enrollment_id,
            task_id=task_id,
            attempt_no=attempt_no,
            actor=current_user,
        )
        latest = detail.get("latest_ai_evaluation")
        if latest and latest.get("id"):
            background_tasks.add_task(
                process_ai_evaluation,
                evaluation_id=latest["id"],
                llm_client=getattr(req.app.state, "llm_subclient", None),
            )
        return detail
    except Exception as err:
        raise to_http_exception(err)
