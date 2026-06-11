from __future__ import annotations

from datetime import datetime, timezone
import os
from pathlib import Path
import shutil
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db import crud_courses, crud_users
from app.db.models import (
    Course,
    CourseOffering,
    Department,
    Faculty,
    ChildChunk,
    DocumentSharingRequest,
    IngestedDocument,
    InstitutionSettings,
    RetrievalRun,
    User,
    UserProfile,
    UserRole,
)
from app.db.postgres import get_db
from app.models.admin_schemas import (
    ActionOut,
    AdminUserCreateRequest,
    AdminUserOut,
    AdminUserUpdateRequest,
    DepartmentCreateRequest,
    DepartmentOut,
    DepartmentUpdateRequest,
    FacultyCreateRequest,
    FacultyOut,
    FacultyUpdateRequest,
    InstitutionConfigOut,
    InstitutionConfigUpdateRequest,
    RAGControlRequest,
    RAGMonitoringOverviewOut,
)
from app.models.course_schemas import CourseCreate, CourseOut, CourseUpdate
from app.services.auth.deps import require_current_user_roles
from app.services.harag.storage_service import HARAGStorageService

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _list_to_strings(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _ensure_institution_settings(db: Session) -> InstitutionSettings:
    row = db.query(InstitutionSettings).filter(InstitutionSettings.id == 1).one_or_none()
    if row:
        return row

    row = InstitutionSettings(id=1, university_name="EduSmart Institution")
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _serialize_institution(db: Session, row: InstitutionSettings) -> InstitutionConfigOut:
    faculties = db.query(Faculty).order_by(Faculty.name.asc()).all()
    departments = db.query(Department).order_by(Department.name.asc()).all()
    return InstitutionConfigOut(
        id=row.id,
        university_name=row.university_name,
        logo_url=row.logo_url,
        academic_calendar=row.academic_calendar_json or {},
        policy=row.policy_json or {},
        email_policy_mode=row.email_policy_mode,
        allowed_email_domains=_list_to_strings(row.allowed_email_domains),
        email_whitelist=_list_to_strings(row.email_whitelist_json),
        email_blacklist=_list_to_strings(row.email_blacklist_json),
        rag_model_name=row.rag_model_name,
        rag_embedding_strategy=row.rag_embedding_strategy,
        rag_last_rebuild_at=row.rag_last_rebuild_at,
        rag_rebuild_requested_at=row.rag_rebuild_requested_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
        faculties=faculties,
        departments=departments,
    )


# -------------------------
# Users
# -------------------------
@router.get("/users", response_model=list[AdminUserOut])
def admin_list_users(
    role: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0, le=100000),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    query = db.query(User).options(joinedload(User.profile))

    if role:
        normalized = role.strip().lower()
        allowed_roles = {r.value for r in UserRole}
        if normalized not in allowed_roles:
            raise HTTPException(status_code=400, detail="Invalid role filter")
        query = query.filter(User.role == UserRole(normalized))
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if q:
        like = f"%{q.strip()}%"
        query = query.outerjoin(UserProfile, UserProfile.user_id == User.id)
        query = query.filter(
            or_(
                User.username.ilike(like),
                User.email.ilike(like),
                UserProfile.full_name.ilike(like),
            )
        )

    return query.order_by(User.created_at.desc()).distinct().offset(offset).limit(limit).all()


@router.post("/users", response_model=AdminUserOut)
def admin_create_user(
    payload: AdminUserCreateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    try:
        role = UserRole(payload.role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user role")

    try:
        return crud_users.create_user_local(
            db,
            username=payload.username.strip(),
            password=payload.password,
            role=role,
            email=str(payload.email) if payload.email else None,
            full_name=payload.full_name,
            university_id=payload.university_id,
            department=payload.department,
            faculty=payload.faculty,
            program=payload.program,
            year_of_study=payload.year_of_study,
            phone=payload.phone,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def admin_update_user(
    user_id: UUID,
    payload: AdminUserUpdateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    user = db.query(User).options(joinedload(User.profile)).filter(User.id == user_id).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email is not None:
        user.email = str(payload.email)
    if payload.role is not None:
        try:
            user.role = UserRole(payload.role)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user role")
    if payload.is_active is not None:
        user.is_active = bool(payload.is_active)

    profile = user.profile
    if profile is None:
        from app.db.models import UserProfile

        profile = UserProfile(user_id=user.id)
        db.add(profile)
        db.flush()

    if payload.full_name is not None:
        profile.full_name = payload.full_name
    if payload.university_id is not None:
        profile.university_id = payload.university_id
    if payload.department is not None:
        profile.department = payload.department
    if payload.faculty is not None:
        profile.faculty = payload.faculty
    if payload.program is not None:
        profile.program = payload.program
    if payload.year_of_study is not None:
        profile.year_of_study = payload.year_of_study
    if payload.phone is not None:
        profile.phone = payload.phone

    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/deactivate", response_model=ActionOut)
def admin_deactivate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    user = db.query(User).filter(User.id == user_id).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    return {"ok": True, "message": "User deactivated"}


@router.post("/users/{user_id}/activate", response_model=ActionOut)
def admin_activate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    user = db.query(User).filter(User.id == user_id).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    db.commit()
    return {"ok": True, "message": "User activated"}


# -------------------------
# Course definitions
# -------------------------
@router.get("/courses", response_model=list[CourseOut])
def admin_list_courses(
    q: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0, le=100000),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    return crud_courses.list_courses(db, q=q, is_active=is_active, limit=limit, offset=offset)


@router.post("/courses", response_model=CourseOut)
def admin_create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
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


@router.patch("/courses/{course_code}", response_model=CourseOut)
def admin_update_course(
    course_code: str,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
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


@router.delete("/courses/{course_code}", response_model=ActionOut)
def admin_delete_course(
    course_code: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    code = (course_code or "").strip()
    course = db.query(Course).filter(Course.course_code == code).one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    offering_exists = db.query(CourseOffering.id).filter(CourseOffering.course_code == code).first() is not None
    if offering_exists:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete course definition with existing offerings. Deactivate instead.",
        )

    db.delete(course)
    db.commit()
    return {"ok": True, "message": "Course deleted"}


# -------------------------
# Institution config
# -------------------------
@router.get("/institution", response_model=InstitutionConfigOut)
def admin_get_institution(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    settings_row = _ensure_institution_settings(db)
    return _serialize_institution(db, settings_row)


@router.put("/institution", response_model=InstitutionConfigOut)
def admin_update_institution(
    payload: InstitutionConfigUpdateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    row = _ensure_institution_settings(db)
    update_data = payload.model_dump(exclude_unset=True)

    if "university_name" in update_data:
        row.university_name = update_data["university_name"]
    if "logo_url" in update_data:
        row.logo_url = update_data["logo_url"]
    if "academic_calendar" in update_data and update_data["academic_calendar"] is not None:
        row.academic_calendar_json = update_data["academic_calendar"]
    if "policy" in update_data and update_data["policy"] is not None:
        row.policy_json = update_data["policy"]
    if "email_policy_mode" in update_data:
        row.email_policy_mode = update_data["email_policy_mode"]
    if "allowed_email_domains" in update_data:
        row.allowed_email_domains = _list_to_strings(update_data["allowed_email_domains"])
    if "email_whitelist" in update_data:
        row.email_whitelist_json = _list_to_strings(update_data["email_whitelist"])
    if "email_blacklist" in update_data:
        row.email_blacklist_json = _list_to_strings(update_data["email_blacklist"])
    if "rag_model_name" in update_data:
        row.rag_model_name = update_data["rag_model_name"]
    if "rag_embedding_strategy" in update_data:
        row.rag_embedding_strategy = update_data["rag_embedding_strategy"]

    db.commit()
    db.refresh(row)
    return _serialize_institution(db, row)


@router.post("/institution/faculties", response_model=FacultyOut)
def admin_create_faculty(
    payload: FacultyCreateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    row = Faculty(name=payload.name.strip(), code=(payload.code or "").strip() or None)
    db.add(row)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Faculty already exists or is invalid")
    db.refresh(row)
    return row


@router.patch("/institution/faculties/{faculty_id}", response_model=FacultyOut)
def admin_update_faculty(
    faculty_id: UUID,
    payload: FacultyUpdateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    row = db.query(Faculty).filter(Faculty.id == faculty_id).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Faculty not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data:
        row.name = update_data["name"].strip()
    if "code" in update_data:
        row.code = (update_data["code"] or "").strip() or None
    if "is_active" in update_data:
        row.is_active = bool(update_data["is_active"])

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Faculty already exists or is invalid")
    db.refresh(row)
    return row


@router.delete("/institution/faculties/{faculty_id}", response_model=ActionOut)
def admin_delete_faculty(
    faculty_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    row = db.query(Faculty).filter(Faculty.id == faculty_id).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Faculty not found")
    db.delete(row)
    db.commit()
    return {"ok": True, "message": "Faculty deleted"}


@router.post("/institution/departments", response_model=DepartmentOut)
def admin_create_department(
    payload: DepartmentCreateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    faculty = db.query(Faculty).filter(Faculty.id == payload.faculty_id).one_or_none()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")

    row = Department(
        faculty_id=payload.faculty_id,
        name=payload.name.strip(),
        code=(payload.code or "").strip() or None,
    )
    db.add(row)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Department already exists or is invalid")
    db.refresh(row)
    return row


@router.patch("/institution/departments/{department_id}", response_model=DepartmentOut)
def admin_update_department(
    department_id: UUID,
    payload: DepartmentUpdateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    row = db.query(Department).filter(Department.id == department_id).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Department not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "faculty_id" in update_data and update_data["faculty_id"] is not None:
        faculty = db.query(Faculty).filter(Faculty.id == update_data["faculty_id"]).one_or_none()
        if not faculty:
            raise HTTPException(status_code=404, detail="Faculty not found")
        row.faculty_id = update_data["faculty_id"]
    if "name" in update_data:
        row.name = update_data["name"].strip()
    if "code" in update_data:
        row.code = (update_data["code"] or "").strip() or None
    if "is_active" in update_data:
        row.is_active = bool(update_data["is_active"])

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Department already exists or is invalid")
    db.refresh(row)
    return row


@router.delete("/institution/departments/{department_id}", response_model=ActionOut)
def admin_delete_department(
    department_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    row = db.query(Department).filter(Department.id == department_id).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Department not found")
    db.delete(row)
    db.commit()
    return {"ok": True, "message": "Department deleted"}


# -------------------------
# RAG monitoring & controls
# -------------------------
@router.get("/rag", response_model=RAGMonitoringOverviewOut)
def admin_rag_overview(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    settings_row = _ensure_institution_settings(db)

    status_rows = (
        db.query(IngestedDocument.status, func.count(IngestedDocument.document_id))
        .group_by(IngestedDocument.status)
        .all()
    )
    status_breakdown = {
        (row[0].value if hasattr(row[0], "value") else str(row[0])): int(row[1]) for row in status_rows
    }
    total_docs = int(sum(status_breakdown.values()))

    total_chunks = int(db.query(func.coalesce(func.sum(IngestedDocument.total_chunks), 0)).scalar() or 0)
    total_vectors = int(db.query(func.coalesce(func.sum(IngestedDocument.stored_vectors), 0)).scalar() or 0)
    harag_child_chunks = int(db.query(func.count(ChildChunk.id)).scalar() or 0)
    retrieval_runs = int(db.query(func.count(RetrievalRun.id)).scalar() or 0)
    failed_docs = int(status_breakdown.get("failed", 0))

    vector_store_info: dict[str, Any] = {
        "available": True,
        "backend": "postgresql_pgvector",
        "child_chunk_vectors": harag_child_chunks,
        "legacy_chroma": {"available": False, "collection_count": 0, "collections": []},
    }
    storage_bytes = 0
    try:
        from app.db.vector_store import VectorStore

        vs = VectorStore()
        collections = []
        for col in vs.client.list_collections():
            count = 0
            try:
                count = int(vs.client.get_collection(col.name).count())
            except Exception:
                count = 0
            collections.append({"name": col.name, "items": count})
        vector_store_info["legacy_chroma"] = {
            "available": True,
            "collection_count": len(collections),
            "collections": collections[:200],
        }
    except Exception:
        pass

    chroma_path = Path(settings.BASE_DIR) / "data" / "chroma_db"
    if chroma_path.exists():
        for item in chroma_path.rglob("*"):
            if item.is_file():
                storage_bytes += item.stat().st_size

    cpu_load = None
    try:
        cpu_load = os.getloadavg()[0]
    except Exception:
        cpu_load = None

    disk_total = 0
    disk_used = 0
    try:
        usage = shutil.disk_usage(str(chroma_path.parent))
        disk_total = int(usage.total)
        disk_used = int(usage.used)
    except Exception:
        pass

    rag_config = {
        "active_query_model": str(settings.query_llm_model_path),
        "active_final_model": str(settings.final_llm_model_path),
        "configured_rag_model_name": settings_row.rag_model_name,
        "configured_embedding_strategy": settings_row.rag_embedding_strategy,
        "last_rebuild_at": settings_row.rag_last_rebuild_at,
        "rebuild_requested_at": settings_row.rag_rebuild_requested_at,
    }

    return {
        "ingestion": {
            "total_documents": total_docs,
            "status_breakdown": status_breakdown,
            "total_chunks": total_chunks,
            "total_vectors": total_vectors,
            "harag_child_chunks": harag_child_chunks,
            "failed_documents": failed_docs,
        },
        "vector_store": vector_store_info,
        "query_performance": {
            "available": True,
            "retrieval_runs": retrieval_runs,
        },
        "infrastructure": {
            "cpu_load_1m": cpu_load,
            "disk_total_bytes": disk_total,
            "disk_used_bytes": disk_used,
            "vector_storage_bytes": storage_bytes,
            "vector_storage_path": str(chroma_path),
        },
        "rag_config": rag_config,
        "model_config": rag_config,
    }


@router.patch("/rag", response_model=ActionOut)
def admin_rag_control(
    payload: RAGControlRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    settings_row = _ensure_institution_settings(db)
    if payload.rag_model_name is not None:
        settings_row.rag_model_name = payload.rag_model_name.strip() or None
    if payload.rag_embedding_strategy is not None:
        settings_row.rag_embedding_strategy = payload.rag_embedding_strategy.strip() or None
    if payload.request_rebuild:
        settings_row.rag_rebuild_requested_at = datetime.now(timezone.utc)

    db.commit()
    return {"ok": True, "message": "RAG configuration updated"}


@router.get("/rag/sharing-requests")
def admin_list_document_sharing_requests(
    status: str | None = Query(default="pending"),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_current_user_roles("admin")),
):
    query = db.query(DocumentSharingRequest).join(IngestedDocument, IngestedDocument.document_id == DocumentSharingRequest.document_id)
    if status:
        query = query.filter(DocumentSharingRequest.status == status)
    rows = query.order_by(DocumentSharingRequest.requested_at.desc()).limit(200).all()
    return [
        {
            "id": str(row.id),
            "document_id": str(row.document_id),
            "course_code": row.course_code,
            "course_offering_id": str(row.course_offering_id) if row.course_offering_id else None,
            "requested_by_user_id": str(row.requested_by_user_id) if row.requested_by_user_id else None,
            "reviewed_by_user_id": str(row.reviewed_by_user_id) if row.reviewed_by_user_id else None,
            "status": row.status,
            "rationale": row.rationale,
            "review_note": row.review_note,
            "requested_at": row.requested_at,
            "reviewed_at": row.reviewed_at,
            "document": {
                "filename": row.document.original_filename if row.document else None,
                "source_scope": row.document.source_scope if row.document else None,
            },
        }
        for row in rows
    ]


@router.post("/rag/sharing-requests/{request_id}/approve", response_model=ActionOut)
def admin_approve_document_sharing_request(
    request_id: UUID,
    review_note: str | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_current_user_roles("admin")),
):
    row = db.query(DocumentSharingRequest).filter(DocumentSharingRequest.id == request_id).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Sharing request not found")
    doc = db.query(IngestedDocument).filter(IngestedDocument.document_id == row.document_id).one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    row.status = "approved"
    row.reviewed_by_user_id = admin.id
    row.reviewed_at = datetime.now(timezone.utc)
    row.review_note = review_note
    doc.source_scope = "course_shared_approved"
    db.commit()
    HARAGStorageService(db).update_document_scope(document_id=str(doc.document_id), source_scope="course_shared_approved")
    return {"ok": True, "message": "Document sharing approved"}


@router.post("/rag/sharing-requests/{request_id}/reject", response_model=ActionOut)
def admin_reject_document_sharing_request(
    request_id: UUID,
    review_note: str | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_current_user_roles("admin")),
):
    row = db.query(DocumentSharingRequest).filter(DocumentSharingRequest.id == request_id).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Sharing request not found")
    doc = db.query(IngestedDocument).filter(IngestedDocument.document_id == row.document_id).one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    row.status = "rejected"
    row.reviewed_by_user_id = admin.id
    row.reviewed_at = datetime.now(timezone.utc)
    row.review_note = review_note
    doc.source_scope = "course_shared_rejected"
    db.commit()
    HARAGStorageService(db).update_document_scope(document_id=str(doc.document_id), source_scope="course_shared_rejected")
    return {"ok": True, "message": "Document sharing rejected"}
