from typing import List, Dict
import pandas as pd
import numpy as np
from pathlib import Path
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from app.core.config import settings


class CompetencyMapper:
    """
    Computes CBC value weights using SBERT similarity between
    Bloom level and CBC value descriptions.
    """

    CSV_PATH = Path(settings.BASE_DIR) / "data" / "bloom_cbc_map.csv"
    
    def __init__(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.cbc_data = pd.read_csv(self.CSV_PATH)
        self._encode_cbc_descriptions()

    def _encode_cbc_descriptions(self):
        """Pre-encode CBC value descriptions for efficiency"""
        descriptions = self.cbc_data['Description'].tolist()
        self.encoded_descriptions = self.model.encode(descriptions)

    def map(self, query: str, bloom_level: str) -> List[Dict]:
        if bloom_level == "Unknown":
            return [{
                "value": "General Competency Development",
                "weight": 0.5
            }]

        # Encode the bloom level
        bloom_embedding = self.model.encode([bloom_level.lower()])
        
        # Calculate similarities with CBC descriptions
        similarities = cosine_similarity(bloom_embedding, self.encoded_descriptions)[0]
        
        # Normalize similarities from [-1,1] to [0,1]
        similarities = (similarities + 1) / 2
        
        results = []
        for i, (_, row) in enumerate(self.cbc_data.iterrows()):
            # Get CSV weight for this bloom level
            csv_weight = row[bloom_level.lower()]
            
            # Get SBERT similarity score
            similarity_score = float(similarities[i])

            # Combine CSV weight and similarity (20-80 balance)
            final_weight = round((csv_weight * 0.2) + (similarity_score * 0.8), 3)
            
            if final_weight > 0:
                results.append({
                    "value": row['Value'],
                    "weight": final_weight
                })
        
        # Sort by weight descending
        results.sort(key=lambda x: x["weight"], reverse=True)
        return results
