import unittest
import logging
from app.services.llm.llama_cpp_subclient import LLMSubclient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TestPhiCpp(unittest.TestCase):
    def setUp(self):
        self.subclient = LLMSubclient()

    def test_generate_multi_queries(self):
        """Test generating 5 different queries from a single input query"""
        original_query = "Explain the causes of World War I"
        
        logger.info(f"Original Query: {original_query}")
        logger.info("Generating 5 alternative queries using Phi 3 mini model...")
        
        try:
            generated_queries = self.subclient.generate_multi_queries(original_query, n=5)
            
            logger.info(f"Generated {len(generated_queries)} alternative queries:")
            for i, query in enumerate(generated_queries, 1):
                logger.info(f"  {i}. {query}")
            
            # Assertions
            self.assertIsInstance(generated_queries, list)
            self.assertEqual(len(generated_queries), 5)
            for query in generated_queries:
                self.assertIsInstance(query, str)
                self.assertGreater(len(query.strip()), 0)
                
        except Exception as e:
            logger.error(f"Error generating queries: {e}")
            raise
        
if __name__ == '__main__':
    unittest.main()