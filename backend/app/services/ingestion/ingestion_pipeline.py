"""
IngestionPipeline for EduSmart ingestion pipeline.
Orchestrates document loading, semantic chunking, embedding, and OCR processing.

Key features:
- Stores into a per-course Chroma collection: course_<course_id>
- Stable document_id management via Postgres metadata_store (optional, if db session provided)
- Deterministic chunk IDs: "{document_id}:{chunk_index}"
- Upsert support (no duplicates on re-ingest)
- Optional replace mode (delete document vectors then re-add)
"""
from __future__ import annotations

from pathlib import Path
from uuid import uuid4
from typing import Any, Dict, Literal, Optional

import structlog
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .document_loader import DocumentLoader
from .text_chunker import SemanticChunker
from .ocr_engine import OCREngine

from app.services.embedder.e5_embedder import E5Embedder
from app.db.vector_store import VectorStore

# NEW: metadata registry (Postgres) for stable document IDs
from app.db import metadata_store
from app.db.models import IngestionStatus

logger = structlog.get_logger()


class IngestionResult(BaseModel):
    total_chunks: int
    processed_images: int
    ocr_pending: int
    document_id: str
    status: Literal["success", "partial_success", "failed"]

    stored_vectors: int = 0
    ocr_ingested_chunks: int = 0
    warnings: list[str] = []


class IngestionPipeline:
    """
    Orchestrates document ingestion:
    - load (text + images)
    - semantic chunk (optionally embedding-aware boundaries)
    - embed passages (E5)
    - store into Chroma collection per-course
    - OCR images (and ingest OCR text if available)
    - update Postgres metadata registry for stable document_id + status (if db passed)
    """

    def __init__(self):
        logger.info("initializing_pipeline")
        self.loader = DocumentLoader()

        # Embedder must exist before chunker if chunker uses embeddings
        self.embedder = E5Embedder()

        # Semantic chunker (embedding-aware boundaries enabled by default)
        self.chunker = SemanticChunker(
            embedder=self.embedder,
            use_embeddings=True,
        )

        self.ocr_engine = OCREngine()
        self.vector_store = VectorStore()
        logger.info("pipeline_ready")

    def ingest(
        self,
        file_path: Path,
        *,
        course_id: str,
        uploader_user_id: str,
        uploader_role: str = "lecturer",
        course_meta: Optional[Dict[str, Any]] = None,
        extra_meta: Optional[Dict[str, Any]] = None,
        reingest_mode: Literal["upsert", "replace"] = "upsert",
        db: Optional[Session] = None,
        mime_type: Optional[str] = None,
        storage_path: Optional[str] = None,
    ) -> IngestionResult:
        """
        Runs the full ingestion pipeline for a document into the collection for the given course.

        Args:
            file_path: Path to the document.
            course_id: Selected course from UI (used to pick Chroma collection).
            uploader_user_id: Lecturer/user who uploaded the document (UUID string).
            uploader_role: Lecturer/admin etc.
            course_meta: Optional course context (code/title/semester, etc).
            extra_meta: Any extra metadata from UI.
            reingest_mode:
                - "upsert": overwrite same chunk ids (recommended)
                - "replace": delete all by document_id then insert
            db: Optional SQLAlchemy session; if provided, document_id becomes stable via metadata_store.
            mime_type: Optional file mime type for metadata store.
            storage_path: Optional saved location path/key for metadata store.

        Returns:
            IngestionResult
        """
        file_path = file_path.resolve()
        collection = self.vector_store.course_collection_name(course_id)
        warnings: list[str] = []

        # -----------------------------
        # Stable document_id (optional)
        # -----------------------------
        if db is not None:
            doc_row, _created = metadata_store.get_or_create_document(
                db,
                course_id=course_id,
                uploader_user_id=uploader_user_id,
                file_path=file_path,
                mime_type=mime_type,
                storage_path=storage_path or str(file_path),
            )
            document_id = str(doc_row.document_id)
            metadata_store.set_status(db, document_id, IngestionStatus.ingesting, error_message=None)
        else:
            document_id = str(uuid4())

        logger.info(
            "ingestion_started",
            file=file_path.name,
            document_id=document_id,
            course_id=course_id,
            collection=collection,
            uploader_user_id=uploader_user_id,
        )

        try:
            # Step 1: Load document
            logger.info("loading_document", file=file_path.name)
            text, images = self.loader.load(file_path)
            logger.info("document_loaded", text_length=len(text), image_count=len(images))

            # base metadata for all chunks (text + ocr)
            base_meta: Dict[str, Any] = {
                "source": file_path.name,
                "document_id": document_id,
                "course_id": course_id,
                "uploader_user_id": uploader_user_id,
                "uploader_role": uploader_role,
            }
            if course_meta:
                base_meta.update(course_meta)
            if extra_meta:
                base_meta.update(extra_meta)

            # If replace mode: delete all vectors for this doc_id in this course collection
            if reingest_mode == "replace":
                logger.info("reingest_replace_deleting", collection=collection, document_id=document_id)
                self.vector_store.delete_document(collection=collection, document_id=document_id)

            # Step 2: Chunk primary text (semantic)
            logger.info("chunking_text")
            chunks = self.chunker.chunk(text, base_meta | {"content_type": "text"})
            logger.info("text_chunked", chunk_count=len(chunks))

            stored_vectors = 0

            # Step 3: Embed + store text chunks
            if chunks:
                texts = [c.chunk_text for c in chunks]
                metadatas: list[dict] = []
                ids: list[str] = []

                for i, c in enumerate(chunks):
                    md = dict(c.metadata or {})
                    md.update(
                        {
                            "chunk_index": i,           # normalize index sequence
                            "content_type": "text",
                        }
                    )

                    # carry offsets if present
                    if getattr(c, "char_start", None) is not None:
                        md["char_start"] = c.char_start
                    if getattr(c, "char_end", None) is not None:
                        md["char_end"] = c.char_end

                    metadatas.append(md)
                    ids.append(f"{document_id}:{i}")

                logger.info("generating_embeddings", chunk_count=len(texts))
                vectors = self.embedder.embed_passages(texts)
                logger.info("embeddings_generated", embedding_count=len(vectors))

                logger.info("storing_to_vector_db", collection=collection, count=len(vectors))
                if reingest_mode == "upsert":
                    self.vector_store.upsert_texts(
                        collection=collection,
                        texts=texts,
                        embeddings=vectors,
                        metadatas=metadatas,
                        ids=ids,
                    )
                else:
                    self.vector_store.add_texts(
                        collection=collection,
                        texts=texts,
                        embeddings=vectors,
                        metadatas=metadatas,
                        ids=ids,
                    )
                stored_vectors += len(vectors)
                logger.info("stored_to_vector_db", collection=collection, count=len(vectors))

            # Step 4: OCR images (and ingest OCR text if available)
            ocr_pending_count = 0
            ocr_ingested_chunks = 0

            logger.info("processing_images", image_count=len(images))
            for img_i, image_path in enumerate(images):
                ocr_result = self.ocr_engine.process_image(image_path)

                status = getattr(ocr_result, "status", None)
                logger.debug("image_processed", image=str(image_path), ocr_status=status)

                if status == "pending":
                    ocr_pending_count += 1
                    continue

                if status == "success":
                    ocr_text = (getattr(ocr_result, "text", "") or "").strip()
                    if not ocr_text:
                        warnings.append(f"OCR produced empty text for image: {image_path}")
                        continue

                    # For OCR, you may want to disable embedding-boundaries if OCR is huge.
                    # We'll chunk with same chunker; E5 will truncate long inputs anyway.
                    ocr_chunks = self.chunker.chunk(
                        ocr_text,
                        base_meta
                        | {
                            "content_type": "ocr",
                            "image_index": img_i,
                            "image_path": str(image_path),
                        },
                    )

                    if not ocr_chunks:
                        continue

                    ocr_texts = [c.chunk_text for c in ocr_chunks]
                    ocr_metas: list[dict] = []
                    ocr_ids: list[str] = []

                    # unique deterministic OCR index space per image
                    base_offset = 1_000_000 + (img_i * 10_000)

                    for j, c in enumerate(ocr_chunks):
                        idx = base_offset + j
                        md = dict(c.metadata or {})
                        md.update(
                            {
                                "chunk_index": idx,
                                "content_type": "ocr",
                                "image_index": img_i,
                                "image_path": str(image_path),
                            }
                        )
                        if getattr(c, "char_start", None) is not None:
                            md["char_start"] = c.char_start
                        if getattr(c, "char_end", None) is not None:
                            md["char_end"] = c.char_end

                        ocr_metas.append(md)
                        ocr_ids.append(f"{document_id}:{idx}")

                    ocr_vectors = self.embedder.embed_passages(ocr_texts)

                    if reingest_mode == "upsert":
                        self.vector_store.upsert_texts(
                            collection=collection,
                            texts=ocr_texts,
                            embeddings=ocr_vectors,
                            metadatas=ocr_metas,
                            ids=ocr_ids,
                        )
                    else:
                        self.vector_store.add_texts(
                            collection=collection,
                            texts=ocr_texts,
                            embeddings=ocr_vectors,
                            metadatas=ocr_metas,
                            ids=ocr_ids,
                        )

                    stored_vectors += len(ocr_vectors)
                    ocr_ingested_chunks += len(ocr_chunks)

                else:
                    warnings.append(f"OCR failed for image: {image_path}")

            # Final status
            status_out: Literal["success", "partial_success", "failed"] = "success"
            if ocr_pending_count > 0:
                status_out = "partial_success"

            logger.info(
                "ingestion_completed",
                document_id=document_id,
                total_chunks=len(chunks),
                stored_vectors=stored_vectors,
                ocr_pending=ocr_pending_count,
                ocr_ingested_chunks=ocr_ingested_chunks,
                status=status_out,
            )

            # Update metadata store counts/status
            if db is not None:
                metadata_store.update_counts(
                    db,
                    document_id=document_id,
                    total_chunks=len(chunks),
                    stored_vectors=stored_vectors,
                    processed_images=len(images),
                    ocr_pending=ocr_pending_count,
                    ocr_ingested_chunks=ocr_ingested_chunks,
                )
                metadata_store.set_status(
                    db,
                    document_id=document_id,
                    status=IngestionStatus.partial_success if status_out == "partial_success" else IngestionStatus.success,
                    error_message=None,
                )

            return IngestionResult(
                total_chunks=len(chunks),
                processed_images=len(images),
                ocr_pending=ocr_pending_count,
                document_id=document_id,
                status=status_out,
                stored_vectors=stored_vectors,
                ocr_ingested_chunks=ocr_ingested_chunks,
                warnings=warnings,
            )

        except Exception as e:
            logger.exception("ingestion_failed", document_id=document_id, error=str(e))

            if db is not None:
                metadata_store.set_status(db, document_id=document_id, status=IngestionStatus.failed, error_message=str(e))

            return IngestionResult(
                total_chunks=0,
                processed_images=0,
                ocr_pending=0,
                document_id=document_id,
                status="failed",
                stored_vectors=0,
                ocr_ingested_chunks=0,
                warnings=[str(e)],
            )
