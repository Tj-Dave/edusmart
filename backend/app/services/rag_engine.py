from typing import List, Dict
from sentence_transformers import SentenceTransformer
from app.db.vector_store import VectorStore

class RAGEngine:
    """Retrieval-Augmented Generation engine for document retrieval"""
    
    def __init__(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.vector_store = VectorStore()
    
    def retrieve(self, query: str, competency: List[Dict], n_results: int = 5) -> List[str]:
        """Retrieve relevant document chunks for the query"""
        # Embed the user query
        query_embedding = self.model.encode([query])[0].tolist()
        
        # Query the vector store
        results = self.vector_store.query(query_embedding, n_results)
        
        # Extract document texts
        if results['documents'] and len(results['documents']) > 0:
            return results['documents'][0]  # First query result
        
        return ["No relevant documents found."]