import chromadb
from typing import List, Dict, Optional, Any
from pathlib import Path
from app.core.config import settings


class VectorStore:
    """
    ChromaDB vector store for document retrieval + long-term memories.

    Supports:
    - multiple collections (documents, memories, ...)
    - metadata filters (where=...)
    - embeddings-based add/query (CPU-friendly, you control embedder)
    """

    def __init__(self):
        db_path = Path(settings.BASE_DIR) / "data" / "chroma_db"
        self.client = chromadb.PersistentClient(path=str(db_path))

        # default collections (created lazily)
        self._collections: Dict[str, Any] = {}

    def _get_collection(self, name: str):
        if name not in self._collections:
            self._collections[name] = self.client.get_or_create_collection(name)
        return self._collections[name]

    # -----------------------------
    # Backwards-compatible methods (documents)
    # -----------------------------
    def add_documents(self, texts: List[str], embeddings: List[List[float]], metadatas: List[Dict]):
        """Add documents to the default 'documents' collection."""
        self.add_texts(
            collection="documents",
            texts=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=None
        )

    def query(self, query_embedding: List[float], n_results: int = 5) -> Dict:
        """Query the default 'documents' collection."""
        return self.query_embeddings(
            collection="documents",
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=None
        )

    # -----------------------------
    # New generic methods
    # -----------------------------
    def add_texts(
        self,
        collection: str,
        texts: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict],
        ids: Optional[List[str]] = None,
    ) -> None:
        col = self._get_collection(collection)

        if ids is None:
            # Avoid collisions across calls
            # Uses timestamp + index (fast, no uuid import overhead)
            import time
            base = int(time.time() * 1000)
            ids = [f"{collection}_{base}_{i}" for i in range(len(texts))]

        col.add(
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )

    def query_embeddings(
        self,
        collection: str,
        query_embeddings: List[List[float]],
        n_results: int = 5,
        where: Optional[Dict] = None,
    ) -> Dict:
        col = self._get_collection(collection)
        results = col.query(
            query_embeddings=query_embeddings,
            n_results=n_results,
            where=where
        )
        return results
