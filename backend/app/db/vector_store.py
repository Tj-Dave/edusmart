import chromadb
from typing import List, Dict
from pathlib import Path
from app.core.config import settings

class VectorStore:
    """ChromaDB vector store for document retrieval"""
    
    def __init__(self):
        db_path = Path(settings.BASE_DIR) / "data" / "chroma_db"
        self.client = chromadb.PersistentClient(path=str(db_path))
        self.collection = self.client.get_or_create_collection("documents")
    
    def add_documents(self, texts: List[str], embeddings: List[List[float]], metadatas: List[Dict]):
        """Add documents to the vector store"""
        ids = [f"doc_{i}" for i in range(len(texts))]
        self.collection.add(
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )
    
    def query(self, query_embedding: List[float], n_results: int = 5) -> Dict:
        """Query the vector store for similar documents"""
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )
        return results