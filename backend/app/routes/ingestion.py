"""
Ingestion API endpoints for EduSmart.
"""
from __future__ import annotations

from fastapi.concurrency import run_in_threadpool
from pathlib import Path
from typing import Any, Dict, Optional
import mimetypes
import re
from uuid import uuid4

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.postgres import get_db

from app.services.ingestion import IngestionPipeline
from app.services.auth.deps import get_current_user
from app.db.models import User

router = APIRouter(prefix="/ingest", tags=["ingestion"])

# Singleton pipeline instance (loads models once)
_pipeline: Optional[IngestionPipeline] = None


def get_pipeline() -> IngestionPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = IngestionPipeline()
    return _pipeline


_ALLOWED_EXTS = {"pdf", "docx", "pptx"}


def _safe_filename(name: str) -> str:
    """Keep filename safe for filesystem usage."""
    name = (name or "").strip()
    name = name.replace("\\", "_").replace("/", "_")
    name = re.sub(r"[^a-zA-Z0-9._ -]+", "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    if not name:
        return f"upload_{uuid4().hex}"
    return name


@router.post("/upload")
async def upload_document(
    course_id: str = Query(..., description="Course identifier selected from UI"),
    file: UploadFile = File(...),
    keep_file: bool = Query(True, description="Keep uploaded file on disk after ingestion"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Upload and process an educational document (PDF, DOCX, PPTX).

    Stores vectors into the course collection (course_<course_id>) and
    writes an ingestion registry row in Postgres (stable document_id).

    Returns ingestion stats + document_id.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    ext = file.filename.split(".")[-1].lower()
    if ext not in _ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, PPTX are allowed")

    # optional: only lecturers/admin can ingest
    # if current_user.role.value not in ("lecturer", "admin"):
    #     raise HTTPException(status_code=403, detail="Only lecturers/admin can upload materials")

    uploader_user_id = str(current_user.id)
    uploader_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    pipeline = get_pipeline()

    # Save uploaded file
    uploads_dir = Path(settings.BASE_DIR) / "data" / "uploads" / _safe_filename(course_id)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    safe_name = _safe_filename(file.filename)
    saved_path = uploads_dir / f"{uuid4().hex[:10]}_{safe_name}"

    try:
        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        with open(saved_path, "wb") as f:
            f.write(data)

        mime_type, _ = mimetypes.guess_type(str(saved_path))

        # Pipeline runs sync → use threadpool
        result = await run_in_threadpool(
            pipeline.ingest,
            saved_path,
            course_id=course_id,
            uploader_user_id=uploader_user_id,
            uploader_role=uploader_role,
            course_meta={"course_id": course_id},
            extra_meta={"original_filename": file.filename},
            reingest_mode="upsert",
            db=db,
            mime_type=mime_type,
            storage_path=str(saved_path),
        )

        if not keep_file:
            saved_path.unlink(missing_ok=True)

        return {
            "document_id": result.document_id,
            "status": result.status,
            "total_chunks": result.total_chunks,
            "stored_vectors": getattr(result, "stored_vectors", 0),
            "processed_images": result.processed_images,
            "ocr_pending": result.ocr_pending,
            "ocr_ingested_chunks": getattr(result, "ocr_ingested_chunks", 0),
            "warnings": getattr(result, "warnings", []),
            "course_id": course_id,
            "filename": file.filename,
            "saved_path": str(saved_path) if keep_file else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        # keep file for debugging unless explicitly asked not to
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
