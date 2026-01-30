import unittest
import numpy as np
from app.services.competency_mapper import CompetencyMapper

class TestCompetencyMapper(unittest.TestCase):
    def setUp(self):
        self.mapper = CompetencyMapper()

    def test_map_with_valid_bloom_level(self):
        query = "Explain the difference between supervised and unsupervised learning."
        bloom_level = "understand"
        results = self.mapper.map(query, bloom_level)
        self.assertIsInstance(results, list)
        self.assertGreater(len(results), 0)
        for r in results:
            self.assertIn("value", r)
            self.assertIn("weight", r)
            self.assertIsInstance(r["weight"], (float, np.floating))
            self.assertGreaterEqual(r["weight"], 0.0)
            self.assertLessEqual(r["weight"], 1.0)

    def test_map_with_unknown_bloom_level(self):
        query = "Some query"
        bloom_level = "Unknown"
        results = self.mapper.map(query, bloom_level)
        self.assertIsInstance(results, list)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["value"], "General Competency Development")
        self.assertEqual(results[0]["weight"], 0.5)

    def test_map_returns_sorted_results(self):
        query = "Solve this problem"
        bloom_level = "apply"
        results = self.mapper.map(query, bloom_level)
        self.assertIsInstance(results, list)
        if len(results) > 1:
            # Check if sorted in descending order
            weights = [r["weight"] for r in results]
            self.assertEqual(weights, sorted(weights, reverse=True))

if __name__ == '__main__':
    unittest.main()
