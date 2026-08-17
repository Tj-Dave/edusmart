from __future__ import annotations

from typing import Optional

from .schemas import RelationshipChildMatch
from .storage_service import HARAGStorageService


class RelationshipRetriever:
    def __init__(self, storage: HARAGStorageService):
        self.storage = storage

    def retrieve(
        self,
        query: str,
        *,
        course_code: str,
        course_offering_id: Optional[str],
        limit: int = 12,
    ) -> list[RelationshipChildMatch]:
        return self.storage.relationship_search(
            query=query,
            course_code=course_code,
            course_offering_id=course_offering_id,
            limit=limit,
        )
