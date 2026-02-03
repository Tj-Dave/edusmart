"""
SemanticChunker for EduSmart ingestion pipeline.
"""
from typing import List, Dict, Any
from pydantic import BaseModel
import re


class Chunk(BaseModel):
    """Represents a chunk of educational content."""
    text: str
    metadata: Dict[str, Any]
    chunk_index: int


class SemanticChunker:
    """Splits text into semantic chunks optimized for educational content."""
    
    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk(self, text: str, metadata: Dict[str, Any]) -> List[Chunk]:
        """
        Splits text into semantic chunks.
        
        Args:
            text: The document text.
            metadata: Document metadata.
        
        Returns:
            List of semantic chunks.
        """
        sentences = re.split(r"(?<=[.!?])\s+", text)
        chunks = []
        chunk_text = ""
        tokens = 0
        chunk_index = 0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            sentence_tokens = len(sentence.split())
            if tokens + sentence_tokens > self.chunk_size:
                if chunk_text:
                    chunk_meta = metadata.copy()
                    chunk_meta["chunk_index"] = chunk_index
                    chunks.append(Chunk(text=chunk_text.strip(), metadata=chunk_meta, chunk_index=chunk_index))
                    chunk_index += 1
                
                chunk_text = " ".join(chunk_text.split()[-self.chunk_overlap:]) if self.chunk_overlap else ""
                tokens = len(chunk_text.split())
            
            chunk_text += " " + sentence
            tokens += sentence_tokens
        
        if chunk_text.strip():
            chunk_meta = metadata.copy()
            chunk_meta["chunk_index"] = chunk_index
            chunks.append(Chunk(text=chunk_text.strip(), metadata=chunk_meta, chunk_index=chunk_index))
        
        return chunks
