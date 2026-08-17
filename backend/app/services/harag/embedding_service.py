from __future__ import annotations


class HARAGEmbeddingService:
    def __init__(self, embedder, *, model_name: str = "intfloat/e5-base-v2"):
        self.embedder = embedder
        self.model_name = model_name

    def embed_children(self, texts: list[str]) -> list[list[float]]:
        return self.embedder.embed_passages(texts) if texts else []

    def embed_query(self, query: str) -> list[float]:
        return self.embedder.embed_query(query)
