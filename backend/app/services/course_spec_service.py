from __future__ import annotations

import json
import mimetypes
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import metadata_store
from app.db.models import (
    CourseSpecStatus,
    IngestedDocument,
    IngestionStatus,
    OfferingCourseSpec,
    User,
)
from app.services.access_control import require_lecturer_or_admin_for_offering
from app.services.domain_errors import ServiceNotFoundError, ServiceValidationError
from app.services.roadmap_service import generate_roadmap_from_spec

_ALLOWED_SPEC_EXTENSIONS = {".pdf", ".docx"}
_ALLOWED_EXTRACT_MODES = {"extract_only", "extract_and_draft_roadmap"}


def _safe_segment(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", (value or "").strip())
    return cleaned or "unknown"


def _safe_filename(value: str) -> str:
    raw = (value or "").strip().replace("\\", "/")
    name = raw.split("/")[-1]
    cleaned = re.sub(r"[^a-zA-Z0-9._ -]+", "_", name).strip()
    return cleaned or "uploaded_document"


def _normalize_mode(mode: str | None) -> str:
    resolved = (mode or "extract_only").strip()
    if resolved not in _ALLOWED_EXTRACT_MODES:
        raise ServiceValidationError("mode must be extract_only or extract_and_draft_roadmap")
    return resolved


def _resolve_unique_path(base_dir: Path, filename: str) -> Path:
    candidate = base_dir / filename
    if not candidate.exists():
        return candidate
    stem = candidate.stem
    suffix = candidate.suffix
    for i in range(1, 10_000):
        next_candidate = base_dir / f"{stem}_{i}{suffix}"
        if not next_candidate.exists():
            return next_candidate
    raise ServiceValidationError("Could not allocate a unique filename for upload")


def _default_spec_json(doc: IngestedDocument) -> dict:
    return {
        "metadata": {
            "source_document_id": str(doc.document_id),
            "source_filename": doc.original_filename,
            "course_id": doc.course_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "course_outcomes": [],
        "competencies": [],
        "assessment_plan": [],
        "roadmap_items": [
            {
                "sequence_no": 1,
                "week_no": 1,
                "title": "Lecturer review: generated from blueprint",
                "key_content": "Review and refine extracted outcomes and weekly plan.",
                "teaching_activity": "Validate generated draft against approved curriculum.",
                "estimated_hours": 3,
                "tasks": [],
            }
        ],
    }


def _try_llm_extract_json(llm_client, prompt: str) -> dict | None:
    if llm_client is None:
        return None
    try:
        raw = llm_client.generate(prompt)
    except Exception:
        return None
    if not raw:
        return None

    text = raw.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        return None
    try:
        obj = json.loads(text[start : end + 1])
    except Exception:
        return None
    return obj if isinstance(obj, dict) else None


def extract_course_spec(
    db: Session,
    *,
    offering_id: UUID,
    actor: User,
    document_id: UUID,
    mode: str = "extract_only",
    llm_client=None,
) -> tuple[OfferingCourseSpec, list | None]:
    mode = _normalize_mode(mode)
    offering = require_lecturer_or_admin_for_offering(db, offering_id=offering_id, actor=actor)

    doc = (
        db.query(IngestedDocument)
        .filter(IngestedDocument.document_id == document_id)
        .one_or_none()
    )
    if not doc:
        raise ServiceNotFoundError("Ingested document not found")

    if str(doc.course_id).strip().upper() != str(offering.course_code).strip().upper():
        raise ServiceValidationError("Document course_id does not match offering course")

    prompt = f"""
Extract a structured course specification JSON from this blueprint metadata.
Output ONLY JSON object with keys:
metadata, course_outcomes, competencies, assessment_plan, roadmap_items.

document_id: {doc.document_id}
filename: {doc.original_filename}
course_id: {doc.course_id}
"""
    extracted = _try_llm_extract_json(llm_client, prompt)
    spec_json = extracted if extracted else _default_spec_json(doc)

    spec = OfferingCourseSpec(
        course_offering_id=offering.id,
        source_document_id=doc.document_id,
        status=CourseSpecStatus.draft_extracted,
        spec_json=spec_json,
        created_by_user_id=actor.id,
    )
    db.add(spec)
    db.commit()
    db.refresh(spec)

    generated_items = None
    if mode == "extract_and_draft_roadmap":
        generated_items = generate_roadmap_from_spec(
            db,
            offering_id=offering_id,
            actor=actor,
            spec_id=spec.id,
            archive_existing_drafts=True,
        )

    return spec, generated_items


def extract_course_spec_from_upload(
    db: Session,
    *,
    offering_id: UUID,
    actor: User,
    filename: str,
    file_bytes: bytes,
    mime_type: str | None = None,
    mode: str = "extract_only",
    llm_client=None,
) -> tuple[OfferingCourseSpec, list | None, IngestedDocument]:
    mode = _normalize_mode(mode)
    if not file_bytes:
        raise ServiceValidationError("Uploaded file is empty")

    offering = require_lecturer_or_admin_for_offering(db, offering_id=offering_id, actor=actor)

    safe_name = _safe_filename(filename)
    suffix = Path(safe_name).suffix.lower()
    if suffix not in _ALLOWED_SPEC_EXTENSIONS:
        raise ServiceValidationError("Only PDF or DOCX files are supported for extraction")

    docs_dir = Path(settings.BASE_DIR) / "docs" / _safe_segment(str(offering.course_code)) / str(offering.id)
    docs_dir.mkdir(parents=True, exist_ok=True)

    storage_path = _resolve_unique_path(docs_dir, safe_name)
    with storage_path.open("wb") as fp:
        fp.write(file_bytes)

    resolved_mime = mime_type or mimetypes.guess_type(str(storage_path))[0]
    doc, _created = metadata_store.get_or_create_document(
        db,
        course_id=str(offering.course_code),
        uploader_user_id=str(actor.id),
        file_path=storage_path,
        mime_type=resolved_mime,
        storage_path=str(storage_path),
    )
    doc.original_filename = safe_name
    doc.storage_path = str(storage_path)
    doc.mime_type = resolved_mime
    doc.status = IngestionStatus.ingesting
    doc.error_message = None
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        spec, generated_items = extract_course_spec(
            db,
            offering_id=offering_id,
            actor=actor,
            document_id=doc.document_id,
            mode=mode,
            llm_client=llm_client,
        )
    except Exception as err:
        doc.status = IngestionStatus.failed
        doc.error_message = str(err)
        db.add(doc)
        db.commit()
        raise

    doc.status = IngestionStatus.success
    doc.error_message = None
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return spec, generated_items, doc


def update_course_spec(
    db: Session,
    *,
    spec_id: UUID,
    actor: User,
    spec_json: dict | None = None,
) -> OfferingCourseSpec:
    spec = db.query(OfferingCourseSpec).filter(OfferingCourseSpec.id == spec_id).one_or_none()
    if not spec:
        raise ServiceNotFoundError("Course spec not found")
    require_lecturer_or_admin_for_offering(db, offering_id=spec.course_offering_id, actor=actor)

    if spec_json is not None:
        if not isinstance(spec_json, dict):
            raise ServiceValidationError("spec_json must be an object")
        spec.spec_json = spec_json

    status_value = spec.status.value if hasattr(spec.status, "value") else str(spec.status)
    if status_value == CourseSpecStatus.draft_extracted.value:
        spec.status = CourseSpecStatus.lecturer_review

    db.commit()
    db.refresh(spec)
    return spec


def submit_spec_review(
    db: Session,
    *,
    spec_id: UUID,
    actor: User,
) -> OfferingCourseSpec:
    spec = db.query(OfferingCourseSpec).filter(OfferingCourseSpec.id == spec_id).one_or_none()
    if not spec:
        raise ServiceNotFoundError("Course spec not found")
    require_lecturer_or_admin_for_offering(db, offering_id=spec.course_offering_id, actor=actor)

    spec.status = CourseSpecStatus.lecturer_review
    db.commit()
    db.refresh(spec)
    return spec


def approve_course_spec(
    db: Session,
    *,
    spec_id: UUID,
    actor: User,
) -> OfferingCourseSpec:
    spec = db.query(OfferingCourseSpec).filter(OfferingCourseSpec.id == spec_id).one_or_none()
    if not spec:
        raise ServiceNotFoundError("Course spec not found")
    require_lecturer_or_admin_for_offering(db, offering_id=spec.course_offering_id, actor=actor)

    (
        db.query(OfferingCourseSpec)
        .filter(
            OfferingCourseSpec.course_offering_id == spec.course_offering_id,
            OfferingCourseSpec.status == CourseSpecStatus.approved_active,
            OfferingCourseSpec.id != spec.id,
        )
        .update({"status": CourseSpecStatus.archived}, synchronize_session=False)
    )

    spec.status = CourseSpecStatus.approved_active
    spec.approved_by_user_id = actor.id
    spec.approved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(spec)
    return spec
