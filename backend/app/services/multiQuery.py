from typing import List
from app.services.llm.llama_cpp_subclient import LLMSubclient

class MultiQuery:
    """Service for generating multiple query variants"""
    
    def __init__(self, subclient: LLMSubclient):
        self.subclient = subclient
    
    def generate_variants(self, user_query: str, n: int = 5) -> List[str]:
        """Generate n variants of the user query"""
        return self.subclient.generate_multi_queries(user_query, n)