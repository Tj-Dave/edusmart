from sentence_transformers import SentenceTransformer
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

class BloomDetector:
    """
    Detects Bloom's cognitive level from a user query
    using SBERT sentence similarity.
    """

    # Example sentences for each Bloom level
    BLOOM_EXAMPLES = {
        "Remember": [
            "Define the concept",
            "List the main points",
            "What is the definition of",
            "Name the components",
            "Identify the key terms"
        ],
        "Understand": [
            "Explain how this works",
            "Describe the process",
            "What does this mean",
            "Summarize the main idea",
            "Interpret the results"
        ],
        "Apply": [
            "How do I solve this problem",
            "Apply this method to",
            "Use this formula to calculate",
            "Demonstrate the technique",
            "Show me how to implement"
        ],
        "Analyze": [
            "Compare these approaches",
            "What are the differences between",
            "Analyze the relationship",
            "Examine the causes",
            "Break down the components"
        ],
        "Evaluate": [
            "Which approach is better",
            "Assess the effectiveness",
            "Critique this method",
            "Justify your choice",
            "Evaluate the pros and cons"
        ],
        "Create": [
            "Design a solution for",
            "Create a new approach",
            "Develop a plan to",
            "Construct a framework",
            "Formulate a strategy"
        ]
    }

    def __init__(self, model_name: str = "all-MiniLM-L6-v2", device: str = "cpu"):
        self.model = SentenceTransformer(model_name, device=device)
        self._encode_examples()

    def _encode_examples(self):
        """Pre-encode all example sentences for efficiency"""
        self.encoded_examples = {}
        for level, examples in self.BLOOM_EXAMPLES.items():
            self.encoded_examples[level] = self.model.encode(examples)

    def detect(self, query: str) -> str:
        """Detect Bloom level using sentence similarity"""
        query_embedding = self.model.encode([query])
        
        max_similarity = -1
        best_level = "Unknown"
        
        for level, examples_embeddings in self.encoded_examples.items():
            similarities = cosine_similarity(query_embedding, examples_embeddings)
            avg_similarity = np.mean(similarities)
            
            if avg_similarity > max_similarity:
                max_similarity = avg_similarity
                best_level = level
        
        return best_level
