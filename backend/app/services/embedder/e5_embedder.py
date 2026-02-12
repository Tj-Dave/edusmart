from sentence_transformers import SentenceTransformer
from typing import List


class E5Embedder:
    def __init__(self, model_name: str = "intfloat/e5-base-v2", device: str = "cpu"):
        self.model = SentenceTransformer(model_name, device=device)

    def embed_query(self, query: str) -> List[float]:
        return self.model.encode(
            f"query: {query.strip()}",
            normalize_embeddings=True
        ).tolist()

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        processed = []
        for t in texts:
            clean = t.strip().replace("\n", " ")
            processed.append(f"passage: {clean}")

        return self.model.encode(
            processed,
            normalize_embeddings=True,
            batch_size=16,
            show_progress_bar=False
        ).tolist()
