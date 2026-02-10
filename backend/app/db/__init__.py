try:
    from .vector_store import VectorStore
    __all__ = ["VectorStore"]
except ImportError:
    # ChromaDB optional for initialization scripts
    __all__ = []
