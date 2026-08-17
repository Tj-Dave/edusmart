from __future__ import annotations

from typing import Optional

from .embedding_service import HARAGEmbeddingService
from .schemas import SemanticChildMatch
from .storage_service import HARAGStorageService


class SemanticChildRetriever:
    def __init__(self, storage: HARAGStorageService, embeddings: HARAGEmbeddingService):
        self.storage = storage
        self.embeddings = embeddings

    def retrieve(
        self,
        query: str,
        *,
        course_code: str,
        course_offering_id: Optional[str],
        limit: int = 16,
    ) -> list[SemanticChildMatch]:
        return self.storage.semantic_search(
            query_embedding=self.embeddings.embed_query(query),
            course_code=course_code,
            course_offering_id=course_offering_id,
            limit=limit,
        )
