from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.postgres import get_db
from app.models.roadmap_schemas import (
    GenericActionOut,
    RoadmapActivateRequest,
    RoadmapGenerateRequest,
    RoadmapItemCreateRequest,
    RoadmapItemOut,
    RoadmapItemUpdateRequest,
)
from app.routes._service_errors import to_http_exception
from app.services.auth.deps import get_current_user
from app.services.roadmap_service import (
    activate_roadmap,
    archive_roadmap_item,
    create_roadmap_item,
    generate_roadmap_from_spec,
    list_roadmap_items,
    update_roadmap_item,
)

router = APIRouter(tags=["roadmap"])


@router.post("/offerings/{offering_id}/roadmap/generate", response_model=list[RoadmapItemOut])
def generate_roadmap_endpoint(
    offering_id: UUID,
    payload: RoadmapGenerateRequest = Body(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        spec_id = payload.spec_id if payload else None
        archive = payload.archive_existing_drafts if payload else True
        return generate_roadmap_from_spec(
            db,
            offering_id=offering_id,
            actor=current_user,
            spec_id=spec_id,
            archive_existing_drafts=archive,
        )
    except Exception as err:
        raise to_http_exception(err)


@router.get("/offerings/{offering_id}/roadmap", response_model=list[RoadmapItemOut])
def list_roadmap_endpoint(
    offering_id: UUID,
    status: str = Query(default="approved_active"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return list_roadmap_items(
            db,
            offering_id=offering_id,
            actor=current_user,
            status=status,
        )
    except Exception as err:
        raise to_http_exception(err)


@router.post("/offerings/{offering_id}/roadmap/activate", response_model=GenericActionOut)
def activate_roadmap_endpoint(
    offering_id: UUID,
    payload: RoadmapActivateRequest = Body(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        archive = payload.archive_existing_active if payload else True
        count = activate_roadmap(
            db,
            offering_id=offering_id,
            actor=current_user,
            archive_existing_active=archive,
        )
        return {"ok": True, "message": f"Activated {count} roadmap items"}
    except Exception as err:
        raise to_http_exception(err)


@router.post("/offerings/{offering_id}/roadmap-items", response_model=RoadmapItemOut)
def create_roadmap_item_endpoint(
    offering_id: UUID,
    payload: RoadmapItemCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return create_roadmap_item(
            db,
            offering_id=offering_id,
            actor=current_user,
            payload=payload.model_dump(exclude_none=True),
        )
    except Exception as err:
        raise to_http_exception(err)


@router.patch("/roadmap-items/{item_id}", response_model=RoadmapItemOut)
def update_roadmap_item_endpoint(
    item_id: UUID,
    payload: RoadmapItemUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return update_roadmap_item(
            db,
            item_id=item_id,
            actor=current_user,
            payload=payload.model_dump(exclude_none=True),
        )
    except Exception as err:
        raise to_http_exception(err)


@router.post("/roadmap-items/{item_id}/archive", response_model=RoadmapItemOut)
def archive_roadmap_item_endpoint(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return archive_roadmap_item(db, item_id=item_id, actor=current_user)
    except Exception as err:
        raise to_http_exception(err)

