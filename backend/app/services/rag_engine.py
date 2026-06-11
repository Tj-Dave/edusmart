from app.db.vector_store import VectorStore
from app.services.embedder.e5_embedder import E5Embedder
from typing import List, Dict, Any

class RAGEngine:
    """Retrieval-Augmented Generation engine for document retrieval"""

    def __init__(self, vector_store: VectorStore, embedder: E5Embedder):
        self.vector_store = vector_store
        self.embedder = embedder

    def retrieve(self, query: str, *, course_id: str, n_results: int = 5):
        course_id = course_id.strip() or "documents"
        collection = self.vector_store.course_collection_name(course_id)
        qvec = self.embedder.embed_query(query)
        results = self.vector_store.query_embeddings(
            collection=collection,
            query_embeddings=[qvec],
            n_results=n_results,
            where=None,
        )
        return [row["context"] for row in self._format_results_bundle(results)]

    def retrieve_bundle(self, query: str, *, course_id: str, n_results: int = 5) -> List[Dict[str, Any]]:
        course_id = course_id.strip() or "documents"
        collection = self.vector_store.course_collection_name(course_id)
        qvec = self.embedder.embed_query(query)
        results = self.vector_store.query_embeddings(
            collection=collection,
            query_embeddings=[qvec],
            n_results=n_results,
            where=None,
        )
        return self._format_results_bundle(results)

    def _format_results_bundle(self, results: Dict[str, Any]) -> List[Dict[str, Any]]:
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

        ids = (results.get("ids") or [[]])[0]

        out: List[Dict[str, Any]] = []
        for idx, (doc, md, dist) in enumerate(zip(docs, metas, dists)):
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

            snippet = doc.strip()
            out.append(
                {
                    "chunk_id": ids[idx] if idx < len(ids) else None,
                    "context": f"{prefix}\n{snippet}",
                    "text": snippet,
                    "source": src,
                    "content_type": ctype,
                    "citation": {
                        "id": md.get("document_id") or (ids[idx] if idx < len(ids) else None),
                        "title": heading or src,
                        "snippet": snippet[:280],
                        "source": src,
                        "role": md.get("uploader_role"),
                        "uploader_role": md.get("uploader_role"),
                        "url": md.get("url") or md.get("source_url"),
                        "document_id": md.get("document_id"),
                        "content_type": ctype,
                        "page": page,
                        "slide": slide,
                    },
                    "distance": dist,
                }
            )

        return out
