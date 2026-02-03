"""
IngestionPipeline for EduSmart ingestion pipeline.
Orchestrates document loading, chunking, embedding, and OCR processing.
"""
from pathlib import Path
from uuid import uuid4
from pydantic import BaseModel
from typing import Literal
import structlog

from .document_loader import DocumentLoader
from .text_chunker import SemanticChunker
from .embedder import EmbeddingService
from .ocr_engine import OCREngine
from app.db.vector_store import VectorStore

logger = structlog.get_logger()


class IngestionResult(BaseModel):
    total_chunks: int
    processed_images: int
    ocr_pending: int
    document_id: str
    status: Literal["success", "partial_success", "failed"]


class IngestionPipeline:
    """Orchestrates document ingestion: loading, chunking, embedding, and OCR."""

    def __init__(self):
        """Initialize pipeline components."""
        logger.info("initializing_pipeline")
        self.loader = DocumentLoader()
        self.chunker = SemanticChunker()
        self.embedder = EmbeddingService()
        self.ocr_engine = OCREngine()
        self.vector_store = VectorStore()
        logger.info("pipeline_ready")

    def ingest(self, file_path: Path) -> IngestionResult:
        """
        Runs the full ingestion pipeline for a document.

        Args:
            file_path: Path to the document.

        Returns:
            IngestionResult: Summary of ingestion.
        """
        document_id = str(uuid4())
        logger.info("ingestion_started", file=file_path.name, document_id=document_id)
        
        try:
            # Step 1: Load document
            logger.info("loading_document", file=file_path.name)
            text, images = self.loader.load(file_path)
            logger.info("document_loaded", text_length=len(text), image_count=len(images))
            
            # Step 2: Chunk text
            logger.info("chunking_text")
            meta = {"source": file_path.name, "document_id": document_id}
            chunks = self.chunker.chunk(text, meta)
            logger.info("text_chunked", chunk_count=len(chunks))
            
            # Step 3: Generate embeddings
            logger.info("generating_embeddings", chunk_count=len(chunks))
            embeddings = self.embedder.embed_chunks(chunks)
            logger.info("embeddings_generated", embedding_count=len(embeddings))
            
            # Step 4: Store to ChromaDB
            logger.info("storing_to_vector_db", embedding_count=len(embeddings))
            texts = [emb.chunk_text for emb in embeddings]
            vectors = [emb.embedding for emb in embeddings]
            metadatas = [emb.metadata for emb in embeddings]
            self.vector_store.add_documents(texts, vectors, metadatas)
            logger.info("stored_to_vector_db", count=len(embeddings))
            
            # Step 5: Process images with OCR
            ocr_pending_count = 0
            logger.info("processing_images", image_count=len(images))
            for image_path in images:
                ocr_result = self.ocr_engine.process_image(image_path)
                if ocr_result.status == "pending":
                    ocr_pending_count += 1
                logger.debug("image_processed", image=str(image_path), ocr_status=ocr_result.status)
            
            logger.info("ingestion_completed", document_id=document_id, total_chunks=len(chunks), ocr_pending=ocr_pending_count)
            
            return IngestionResult(
                total_chunks=len(chunks),
                processed_images=len(images),
                ocr_pending=ocr_pending_count,
                document_id=document_id,
                status="success"
            )
        
        except Exception as e:
            logger.exception("ingestion_failed", document_id=document_id, error=str(e))
            return IngestionResult(
                total_chunks=0,
                processed_images=0,
                ocr_pending=0,
                document_id=document_id,
                status="failed"
            )
