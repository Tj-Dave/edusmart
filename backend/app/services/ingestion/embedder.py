"""
EmbeddingService for EduSmart ingestion pipeline.
"""
from typing import List, Dict, Any
from uuid import uuid4
from pydantic import BaseModel
import structlog
from sentence_transformers import SentenceTransformer
from .text_chunker import Chunk

logger = structlog.get_logger()


class EmbeddingResult(BaseModel):
    chunk_id: str
    chunk_text: str
    embedding: List[float]
    metadata: Dict[str, Any]


class EmbeddingService:
    """Generates vector embeddings for chunks using all-MiniLM-L6-v2."""

    def __init__(self, batch_size: int = 8):
        self.model = SentenceTransformer("all-MiniLM-L6-v2")
        self.batch_size = batch_size
        logger.info("EmbeddingService initialized", batch_size=batch_size)

    def embed_chunks(self, chunks: List[Chunk]) -> List[EmbeddingResult]:
        """
        Generates embeddings for a list of chunks.

        Args:
            chunks: List of Chunk objects.

        Returns:
            List of embedding results.
        """
        results = []
        texts = [chunk.text for chunk in chunks]
        metadatas = [chunk.metadata for chunk in chunks]
        
        try:
            for i in range(0, len(texts), self.batch_size):
                batch_texts = texts[i:i+self.batch_size]
                batch_metas = metadatas[i:i+self.batch_size]
                embeddings = self.model.encode(batch_texts, show_progress_bar=False, device="cpu")
                
                for j, emb in enumerate(embeddings):
                    results.append(EmbeddingResult(
                        chunk_id=str(uuid4()),
                        chunk_text=batch_texts[j],
                        embedding=emb.tolist(),
                        metadata=batch_metas[j]
                    ))
            logger.info("Embeddings generated", count=len(results))
        except Exception as e:
            logger.error("Embedding failed", error=str(e))
        
        return results
