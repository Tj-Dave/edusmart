"""
EduSmart Ingestion Service

This package handles document ingestion for the EduSmart adaptive learning platform.
"""
from .document_loader import DocumentLoader
from .text_chunker import SemanticChunker, Chunk
from .embedder import EmbeddingService, EmbeddingResult
from .ingestion_pipeline import IngestionPipeline, IngestionResult
from .ocr_engine import OCREngine, OCRResult
from .exceptions import (
    UnsupportedFileTypeError,
    FileCorruptedError,
    ExtractionFailedError
)

__all__ = [
    "DocumentLoader",
    "SemanticChunker",
    "Chunk",
    "EmbeddingService",
    "EmbeddingResult",
    "IngestionPipeline",
    "IngestionResult",
    "OCREngine",
    "OCRResult",
    "UnsupportedFileTypeError",
    "FileCorruptedError",
    "ExtractionFailedError",
]
