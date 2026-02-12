from typing import List, Dict
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.metrics.pairwise import cosine_similarity

from app.core.config import settings
from app.services.embedder.e5_embedder import E5Embedder


class CompetencyMapper:
    """
    Maps user queries to CBC values using E5 embedding similarity
    against a precomputed CBC embedding index.
    """

    BASE_PATH = Path(settings.BASE_DIR) / "backend" / "app" / "utils"
    CSV_PATH = BASE_PATH / "cbc_metadata.csv"
    EMBEDDINGS_PATH = BASE_PATH / "cbc_embeddings.npy"

    def __init__(self, embedder: E5Embedder):
        self.embedder = embedder

        # Load CBC metadata
        self.cbc_data = pd.read_csv(self.CSV_PATH)

        # Load precomputed embeddings
        self.cbc_embeddings = np.load(self.EMBEDDINGS_PATH)

        assert len(self.cbc_data) == self.cbc_embeddings.shape[0], (
            "Mismatch between CBC rows and embedding vectors"
        )

    def map(self, query: str, top_k: int = 5) -> List[Dict]:
        if not query or not query.strip():
            return []

        # Use shared embedder
        query_embedding = np.array(self.embedder.embed_query(query))

        similarities = cosine_similarity(
            [query_embedding],
            self.cbc_embeddings
        )[0]

        confidence_scores = (similarities + 1) / 2
        ranked_indices = np.argsort(confidence_scores)[::-1][:top_k]

        results = []
        for idx in ranked_indices:
            score = float(confidence_scores[idx])
            if score < 0.4:
                continue

            results.append({
                "value": self.cbc_data.iloc[idx]["Value"],
                "confidence": round(score, 3)
            })

        return results
