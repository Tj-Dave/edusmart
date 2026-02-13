# app/db/metadata_store.py
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.models import IngestedDocument, IngestionStatus


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(chunk_size)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def get_or_create_document(
    db: Session,
    *,
    course_id: str,
    uploader_user_id: str,
    file_path: Path,
    mime_type: Optional[str] = None,
    storage_path: Optional[str] = None,
) -> Tuple[IngestedDocument, bool]:
    """
    Returns (doc_row, created).
    Stable identity: (course_id, uploader_user_id, file_hash)
    """
    file_path = file_path.resolve()
    file_hash = sha256_file(file_path)
    size_bytes = file_path.stat().st_size

    stmt = select(IngestedDocument).where(
        IngestedDocument.course_id == course_id,
        IngestedDocument.uploader_user_id == uploader_user_id,
        IngestedDocument.file_hash == file_hash,
    )
    existing = db.execute(stmt).scalar_one_or_none()
    if existing:
        # update light fields that might change
        existing.original_filename = file_path.name
        existing.size_bytes = size_bytes
        existing.mime_type = mime_type
        existing.storage_path = storage_path
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing, False

    doc = IngestedDocument(
        course_id=course_id,
        uploader_user_id=uploader_user_id,
        original_filename=file_path.name,
        file_hash=file_hash,
        size_bytes=size_bytes,
        mime_type=mime_type,
        storage_path=storage_path,
        status=IngestionStatus.queued,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc, True


def set_status(
    db: Session,
    document_id: str,
    status: IngestionStatus,
    *,
    error_message: Optional[str] = None,
) -> None:
    doc = db.get(IngestedDocument, document_id)
    if not doc:
        return
    doc.status = status
    doc.error_message = error_message
    db.add(doc)
    db.commit()


def update_counts(
    db: Session,
    *,
    document_id: str,
    total_chunks: int,
    stored_vectors: int,
    processed_images: int,
    ocr_pending: int,
    ocr_ingested_chunks: int,
) -> None:
    doc = db.get(IngestedDocument, document_id)
    if not doc:
        return
    doc.total_chunks = total_chunks
    doc.stored_vectors = stored_vectors
    doc.processed_images = processed_images
    doc.ocr_pending = ocr_pending
    doc.ocr_ingested_chunks = ocr_ingested_chunks
    db.add(doc)
    db.commit()
