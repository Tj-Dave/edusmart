import unittest
import logging
from app.services.competency_mapper import CompetencyMapper

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TestCompetencyMapper(unittest.TestCase):
    def setUp(self):
        self.mapper = CompetencyMapper()

    def test_map_with_different_queries(self):
        test_queries = [
            "How are JavaScript and HTML different?",
            "Analyze the causes of climate change" 
            # "Evaluate the effectiveness of this method",
            # "Remember the key historical dates"
        ]
        
        for query in test_queries:
            results = self.mapper.map(query, top_k=5)
            logger.info(f"\nQuery: {query}")
            logger.info(f"Top 5 competency mappings:")
            for i, result in enumerate(results):
                logger.info(f"  {i+1}. {result}")
            
            self.assertIsInstance(results, list)
            self.assertLessEqual(len(results), 5)

if __name__ == '__main__':
    unittest.main()
