from app.db.vector_store import VectorStore
from app.services.embedder.e5_embedder import E5Embedder
from typing import List, Dict, Any

class RAGEngine:
    """Retrieval-Augmented Generation engine for document retrieval"""

    def __init__(self, vector_store: VectorStore, embedder: E5Embedder):
        self.vector_store = vector_store
        self.embedder = embedder

    def retrieve(self, query: str, *, course_id: str, n_results: int = 5):
        collection = self.vector_store.course_collection_name(course_id)
        qvec = self.embedder.embed_query(query)
        results = self.vector_store.query_embeddings(
            collection=collection,
            query_embeddings=[qvec],
            n_results=n_results,
            where=None,
        )
        # convert results to your context chunk format...
        return self._format_results(results)

    def _format_results(self, results: Dict[str, Any]) -> List[str]:
        """
        Chroma returns:
        {
          "documents": [[...]],
          "metadatas": [[...]],
          "distances": [[...]],
          "ids": [[...]]
        }
        We'll format into compact context strings for PromptEngine.
        """
        docs = (results.get("documents") or [[]])[0]
        metas = (results.get("metadatas") or [[]])[0]
        dists = (results.get("distances") or [[]])[0]

        out: List[str] = []
        for doc, md, dist in zip(docs, metas, dists):
            if not doc:
                continue
            md = md or {}
            src = md.get("source") or "unknown"
            heading = md.get("heading")
            page = md.get("page")
            slide = md.get("slide")
            ctype = md.get("content_type", "text")

            loc_bits = []
            if heading: loc_bits.append(f"Heading: {heading}")
            if page: loc_bits.append(f"Page: {page}")
            if slide: loc_bits.append(f"Slide: {slide}")

            loc = (" | ".join(loc_bits)) if loc_bits else ""
            prefix = f"[{ctype}] {src}"
            if loc:
                prefix += f" ({loc})"

            # Keep it compact
            out.append(f"{prefix}\n{doc.strip()}")

        return out

