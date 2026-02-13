from __future__ import annotations

from typing import List, Optional
from sentence_transformers import SentenceTransformer


class E5Embedder:
    """
    E5 embedder wrapper.

    - Query embeddings use:  "query: ..."
    - Passage embeddings use: "passage: ..."
    - normalize_embeddings=True is recommended for cosine similarity + Chroma.
    """

    def __init__(
        self,
        model_name: str = "intfloat/e5-base-v2",
        device: str = "cpu",
        batch_size: int = 16,
        max_chars: int = 6000,  # prevents huge OCR blobs wasting time
    ):
        self.model = SentenceTransformer(model_name, device=device)
        self.batch_size = batch_size
        self.max_chars = max_chars

    def _clean(self, t: str) -> str:
        # Fast normalization; keep it cheap.
        s = (t or "").strip().replace("\n", " ")
        if self.max_chars and len(s) > self.max_chars:
            s = s[: self.max_chars]
        return s

    # ---- Queries ----
    def embed_query(self, query: str) -> List[float]:
        vec = self.model.encode(
            f"query: {self._clean(query)}",
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return vec.tolist()

    def embed_queries(self, queries: List[str]) -> List[List[float]]:
        processed = [f"query: {self._clean(q)}" for q in queries]
        vecs = self.model.encode(
            processed,
            normalize_embeddings=True,
            batch_size=self.batch_size,
            show_progress_bar=False,
        )
        return vecs.tolist()

    # ---- Passages ----
    def embed_passages(self, texts: List[str]) -> List[List[float]]:
        processed = [f"passage: {self._clean(t)}" for t in texts]
        vecs = self.model.encode(
            processed,
            normalize_embeddings=True,
            batch_size=self.batch_size,
            show_progress_bar=False,
        )
        return vecs.tolist()

    # Backwards compatibility with your existing name
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        return self.embed_passages(texts)
