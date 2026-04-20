import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import chromadb

from app.core.config import settings


class VectorStore:
    """
    ChromaDB vector store for document retrieval + long-term memories.

    Supports:
    - persistent storage
    - multiple collections (per-course, documents, memories, ...)
    - metadata filters (where=...)
    - add/upsert/query/delete
    """

    DEFAULT_COLLECTION = "documents"

    def __init__(self):
        db_path = settings.vector_db_path
        db_path.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(path=str(db_path))
        self._collections: Dict[str, Any] = {}

    # -----------------------------
    # Collection helpers
    # -----------------------------
    def _get_collection(self, name: str):
        if name not in self._collections:
            self._collections[name] = self.client.get_or_create_collection(name)
        return self._collections[name]

    @staticmethod
    def course_collection_name(course_id: str) -> str:
        """
        Stable, safe collection name. Use course_id (DB id/uuid), not title.
        """
        safe = str(course_id).strip().replace(" ", "_")
        return f"course_{safe}"

    # -----------------------------
    # Backwards-compatible methods
    # -----------------------------
    def add_documents(self, texts: List[str], embeddings: List[List[float]], metadatas: List[Dict]):
        """Add documents to the default 'documents' collection."""
        self.add_texts(
            collection=self.DEFAULT_COLLECTION,
            texts=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=None,
        )

    def query(self, query_embedding: List[float], n_results: int = 5) -> Dict:
        """Query the default 'documents' collection."""
        return self.query_embeddings(
            collection=self.DEFAULT_COLLECTION,
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=None,
        )

    # -----------------------------
    # Core methods
    # -----------------------------
    def add_texts(
        self,
        collection: str,
        texts: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict],
        ids: Optional[List[str]] = None,
    ) -> List[str]:
        """
        Add new items. If ids not provided, generates time-based ids (not deterministic).
        Returns the ids used.
        """
        if not (len(texts) == len(embeddings) == len(metadatas)):
            raise ValueError("texts, embeddings, metadatas must have same length")

        col = self._get_collection(collection)

        if ids is None:
            base = int(time.time() * 1000)
            ids = [f"{collection}_{base}_{i}" for i in range(len(texts))]

        col.add(
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids,
        )
        return ids

    def upsert_texts(
        self,
        collection: str,
        texts: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict],
        ids: List[str],
    ) -> None:
        """
        Upsert preferred: re-ingestion updates without duplication.
        Falls back to delete(ids)+add(...) if upsert unavailable.
        """
        if not (len(texts) == len(embeddings) == len(metadatas) == len(ids)):
            raise ValueError("texts, embeddings, metadatas, ids must have same length")

        col = self._get_collection(collection)

        # Newer chroma versions often have upsert
        if hasattr(col, "upsert"):
            col.upsert(
                documents=texts,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids,
            )
            return

        # Fallback: delete by ids then add
        col.delete(ids=ids)
        col.add(
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids,
        )

    def query_embeddings(
        self,
        collection: str,
        query_embeddings: List[List[float]],
        n_results: int = 5,
        where: Optional[Dict] = None,
    ) -> Dict:
        col = self._get_collection(collection)
        return col.query(
            query_embeddings=query_embeddings,
            n_results=n_results,
            where=where,
        )

    def delete_where(self, collection: str, where: Dict) -> None:
        """
        Delete all items matching a metadata filter.
        Example: where={"document_id": "..."}
        """
        col = self._get_collection(collection)
        col.delete(where=where)

    def delete_ids(self, collection: str, ids: List[str]) -> None:
        col = self._get_collection(collection)
        col.delete(ids=ids)

    def delete_document(self, collection: str, document_id: str) -> None:
        """
        Delete all chunks of a document in a given collection.
        Requires you stored metadata with "document_id".
        """
        self.delete_where(collection=collection, where={"document_id": document_id})
