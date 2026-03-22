from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.postgres import get_db
from app.models.roadmap_schemas import (
    CourseSpecExtractOut,
    CourseSpecOut,
    CourseSpecUpdateRequest,
)
from app.routes._service_errors import to_http_exception
from app.services.auth.deps import get_current_user
from app.services.course_spec_service import (
    approve_course_spec,
    extract_course_spec_from_upload,
    submit_spec_review,
    update_course_spec,
)

router = APIRouter(tags=["course_specs"])


@router.post("/offerings/{offering_id}/specs/extract", response_model=CourseSpecExtractOut)
async def extract_spec_endpoint(
    offering_id: UUID,
    req: Request,
    file: UploadFile = File(...),
    mode: str = Form("extract_only"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    llm_client = getattr(req.app.state, "llm_client", None)
    file_bytes = await file.read()
    try:
        spec, generated, _document = extract_course_spec_from_upload(
            db,
            offering_id=offering_id,
            actor=current_user,
            filename=file.filename or "",
            file_bytes=file_bytes,
            mime_type=file.content_type,
            mode=mode,
            llm_client=llm_client,
        )
        return {
            "spec": spec,
            "generated_roadmap_items": generated,
        }
    except Exception as err:
        raise to_http_exception(err)


@router.patch("/specs/{spec_id}", response_model=CourseSpecOut)
def update_spec_endpoint(
    spec_id: UUID,
    payload: CourseSpecUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return update_course_spec(
            db,
            spec_id=spec_id,
            actor=current_user,
            spec_json=payload.spec_json,
        )
    except Exception as err:
        raise to_http_exception(err)


@router.post("/specs/{spec_id}/submit-review", response_model=CourseSpecOut)
def submit_spec_review_endpoint(
    spec_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return submit_spec_review(db, spec_id=spec_id, actor=current_user)
    except Exception as err:
        raise to_http_exception(err)


@router.post("/specs/{spec_id}/approve", response_model=CourseSpecOut)
def approve_spec_endpoint(
    spec_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return approve_course_spec(db, spec_id=spec_id, actor=current_user)
    except Exception as err:
        raise to_http_exception(err)
