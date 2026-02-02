from typing import List, Dict
import pandas as pd
import numpy as np
from pathlib import Path
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from app.core.config import settings


class CompetencyMapper:
    """
    Maps user queries to CBC values using E5 embedding similarity
    against a precomputed CBC embedding index.
    """

    BASE_PATH = Path(settings.BASE_DIR) / "backend" / "app" / "utils"

    CSV_PATH = BASE_PATH / "cbc_metadata.csv"
    EMBEDDINGS_PATH = BASE_PATH / "cbc_embeddings.npy"

    def __init__(self):
        # Load E5 model
        self.model = SentenceTransformer("intfloat/e5-base-v2")

        # Load CBC metadata
        self.cbc_data = pd.read_csv(self.CSV_PATH)

        # Load precomputed embeddings
        self.cbc_embeddings = np.load(self.EMBEDDINGS_PATH)

        # Sanity check
        assert len(self.cbc_data) == self.cbc_embeddings.shape[0], (
            "Mismatch between CBC rows and embedding vectors"
        )

    def map(self, query: str, top_k: int = 5) -> List[Dict]:
        """
        Returns top-k CBC values aligned with the user query.
        Confidence score is in range [0, 1].
        """

        if not query or not query.strip():
            return []

        # Encode query using E5 format
        query_embedding = self.model.encode(
            "query: " + query,
            normalize_embeddings=True
        )

        # Compute cosine similarity
        similarities = cosine_similarity(
            [query_embedding],
            self.cbc_embeddings
        )[0]

        # Convert similarity [-1,1] → [0,1]
        confidence_scores = (similarities + 1) / 2

        # Rank results
        ranked_indices = np.argsort(confidence_scores)[::-1][:top_k]

        results = []
        for idx in ranked_indices:
            score = float(confidence_scores[idx])

            # Optional threshold to avoid weak matches
            if score < 0.4:
                continue

            results.append({
                "value": self.cbc_data.iloc[idx]["Value"],
                "confidence": round(score, 3)
            })

        return results
