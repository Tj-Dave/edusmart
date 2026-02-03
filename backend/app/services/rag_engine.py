from typing import List
from app.db.vector_store import VectorStore
from app.services.embedder.e5_embedder import E5Embedder


class RAGEngine:
    """Retrieval-Augmented Generation engine for document retrieval"""

    def __init__(self, vector_store: VectorStore, embedder: E5Embedder):
        self.vector_store = vector_store
        self.embedder = embedder

    def retrieve(self, query: str, n_results: int = 5) -> List[str]:
        """Retrieve relevant document chunks for the query"""
        if not query or not query.strip():
            return ["No relevant documents found."]

        # Use E5 query embedding (query: prefix + normalized)
        query_embedding = self.embedder.embed_query(query)

        # Query the vector store (documents collection)
        results = self.vector_store.query(query_embedding, n_results)

        docs = results.get("documents", [])
        if docs and len(docs) > 0 and len(docs[0]) > 0:
            return docs[0]

        return ["No relevant documents found."]
