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
from app.services.document_text_extractor import extract_text_from_bytes
from app.services.domain_errors import ServiceNotFoundError, ServiceValidationError
from app.services.roadmap_service import generate_roadmap_from_spec

_ALLOWED_SPEC_EXTENSIONS = {".pdf", ".docx"}
_ALLOWED_EXTRACT_MODES = {"extract_only", "extract_and_draft_roadmap"}

# ── Prompt budget constants ─────────────────────────────────────────────────
# At ~3 chars/token: 6000 doc chars ≈ 2000 tokens + 500 schema ≈ 2500 total input
# leaves ~2700 comfortable headroom below 8192 ctx before 3072 output tokens
_PROMPT_DOC_CHARS = 6_000

_SPEC_SCHEMA_DESCRIPTION = """Return ONLY a single valid JSON object. No markdown, no explanation.

Required top-level keys and types:
- meta: {source_filename, course_id, extracted_at}
- course_header: {course_name, course_code, level, credit_units(int), prerequisites(str[]), description, rationale, aim, contact_hours:{lectures,practicals,total}}
- learning_outcomes: [{code, bloom_level, statement}]
- competencies: [{category, items(str[])}]
- assessment_plan: [{component, mode, week(int|null), weight_percent}]
- roadmap_items: [{
    sequence_no(int), week_no(int), clo_ref(str), title(str),
    key_content(str), teaching_activity(str), competences_emphasised(str),
    assessment_task(str), estimated_hours(int),
    tasks: [{title, task_type(quiz|assignment|lab|project|case_study|simulation|field_task|reflection|presentation|peer_review|other), description, max_score(default 100), is_required(bool)}]
  }]

Rules: Every roadmap_item MUST match an actual week in the document. Do not invent content. Include one task per assessment deliverable named in the document."""


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


def _default_spec_json(doc: IngestedDocument, raw_text: str = "") -> dict:
    """
    Minimal fallback spec that still signals to the lecturer what was found.
    Used only when the LLM is unavailable or fails to return valid JSON.
    """
    return {
        "meta": {
            "source_document_id": str(doc.document_id),
            "source_filename": doc.original_filename,
            "course_id": doc.course_id,
            "extracted_at": datetime.now(timezone.utc).isoformat(),
            "extraction_note": "LLM extraction failed or unavailable. Raw text preview attached for manual review.",
            "raw_text_preview": raw_text[:1000] if raw_text else "",
        },
        "course_header": {
            "course_name": "",
            "course_code": doc.course_id or "",
            "level": "",
            "credit_units": None,
            "prerequisites": [],
            "description": "",
            "rationale": "",
            "aim": "",
            "contact_hours": {"lectures": None, "practicals": None, "total": None},
        },
        "learning_outcomes": [],
        "competencies": [],
        "assessment_plan": [],
        "roadmap_items": [],
    }


def _validate_spec_json(obj: dict) -> dict:
    """
    Ensure all required top-level keys are present; fill missing ones with safe defaults.
    Prevents a partially-extracted spec from causing downstream KeyErrors.
    """
    required_keys = {
        "meta": dict,
        "course_header": dict,
        "learning_outcomes": list,
        "competencies": list,
        "assessment_plan": list,
        "roadmap_items": list,
    }
    for key, expected_type in required_keys.items():
        if key not in obj or not isinstance(obj[key], expected_type):
            obj[key] = expected_type()

    # Ensure each roadmap_item has required fields
    cleaned_items = []
    for idx, item in enumerate(obj.get("roadmap_items", []), start=1):
        if not isinstance(item, dict):
            continue
        item.setdefault("sequence_no", idx)
        item.setdefault("week_no", idx)
        item.setdefault("clo_ref", "")
        item.setdefault("title", f"Week {idx}")
        item.setdefault("key_content", "")
        item.setdefault("teaching_activity", "")
        item.setdefault("competences_emphasised", "")
        item.setdefault("assessment_task", "")
        item.setdefault("estimated_hours", None)
        item.setdefault("tasks", [])
        # Validate tasks list
        valid_tasks = []
        for task in item.get("tasks", []):
            if isinstance(task, dict) and task.get("title"):
                task.setdefault("task_type", "assignment")
                task.setdefault("description", "")
                task.setdefault("max_score", 100)
                task.setdefault("is_required", True)
                valid_tasks.append(task)
        item["tasks"] = valid_tasks
        cleaned_items.append(item)
    obj["roadmap_items"] = cleaned_items
    return obj


def _try_llm_extract_spec(llm_client, document_text: str, course_id: str, filename: str) -> dict | None:
    """
    Ask the LLM to extract a canonical CourseSpec JSON from the raw document text.
    Returns a validated dict or None on any failure.
    """
    if llm_client is None:
        return None

    # Trim document text to stay well within the context window budget.
    # _PROMPT_DOC_CHARS gives ~2000 input tokens; schema/system adds ~500 more.
    # Total input ~2500 tokens + 3072 max output = 5572 — comfortably under 8192.
    doc_excerpt = document_text[:_PROMPT_DOC_CHARS]

    prompt = f"""You are an academic curriculum analyst. Analyze the following course blueprint document and extract a structured course specification.

COURSE DOCUMENT (filename: {filename}, course_id: {course_id}):
===BEGIN DOCUMENT===
{doc_excerpt}
===END DOCUMENT===

{_SPEC_SCHEMA_DESCRIPTION}"""

    try:
        raw = llm_client.generate(prompt)
    except Exception:
        return None

    if not raw:
        return None

    text = raw.strip()
    # Strip any markdown fences the model may wrap around JSON
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text.strip())

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        return None

    try:
        obj = json.loads(text[start: end + 1])
    except Exception:
        return None

    if not isinstance(obj, dict):
        return None

    # Must have at least roadmap_items to be useful
    if not obj.get("roadmap_items"):
        return None

    return _validate_spec_json(obj)


def extract_course_spec(
    db: Session,
    *,
    offering_id: UUID,
    actor: User,
    document_id: UUID,
    mode: str = "extract_only",
    llm_client=None,
    document_text: str = "",
) -> tuple[OfferingCourseSpec, list | None]:
    """
    Extract a structured course spec from an already-registered IngestedDocument.
    `document_text` must be pre-extracted by the caller (see extract_course_spec_from_upload).
    """
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

    # Core fix: always attempt LLM extraction with actual document text
    extracted = None
    if document_text.strip():
        extracted = _try_llm_extract_spec(
            llm_client,
            document_text=document_text,
            course_id=str(doc.course_id),
            filename=doc.original_filename,
        )

    if extracted:
        # Stamp source metadata into the extracted spec
        extracted.setdefault("meta", {}).update(
            {
                "source_document_id": str(doc.document_id),
                "source_filename": doc.original_filename,
                "course_id": doc.course_id,
                "extracted_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        spec_json = extracted
    else:
        # Fall back to explicit skeleton so the lecturer can still edit manually
        spec_json = _default_spec_json(doc, raw_text=document_text)

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

    # ── Step 1: Extract document text FIRST (before saving to disk or DB) ──
    try:
        document_text = extract_text_from_bytes(file_bytes, safe_name)
    except ServiceValidationError as exc:
        # Text extraction failed (e.g. image-only PDF) — proceed with empty text
        # The spec will fall back to the skeleton so the lecturer can fill it manually
        document_text = ""
        _text_extraction_error = str(exc)
    else:
        _text_extraction_error = None

    # ── Step 2: Save to disk ──
    docs_dir = settings.course_specs_docs_dir_path / _safe_segment(str(offering.course_code)) / str(offering.id)
    docs_dir.mkdir(parents=True, exist_ok=True)

    storage_path = _resolve_unique_path(docs_dir, safe_name)
    with storage_path.open("wb") as fp:
        fp.write(file_bytes)

    resolved_mime = mime_type or mimetypes.guess_type(str(storage_path))[0]

    # ── Step 3: Register the document in the DB ──
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
    doc.error_message = _text_extraction_error  # surface extraction error if any
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # ── Step 4: Run LLM extraction with actual document text ──
    try:
        spec, generated_items = extract_course_spec(
            db,
            offering_id=offering_id,
            actor=actor,
            document_id=doc.document_id,
            mode=mode,
            llm_client=llm_client,
            document_text=document_text,
        )
    except Exception as err:
        doc.status = IngestionStatus.failed
        doc.error_message = str(err)
        db.add(doc)
        db.commit()
        raise

    doc.status = IngestionStatus.success
    doc.error_message = _text_extraction_error  # preserve text-extraction warning if any
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
        spec.spec_json = _validate_spec_json(spec_json)

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
