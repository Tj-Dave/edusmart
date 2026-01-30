import unittest
from app.services.bloom_detector import BloomDetector

class TestBloomDetector(unittest.TestCase):
    def setUp(self):
        self.detector = BloomDetector()

    def test_detect_remember(self):
        query = "What is the definition of photosynthesis?"
        result = self.detector.detect(query)
        self.assertIsInstance(result, str)
        self.assertIn(result, list(self.detector.BLOOM_EXAMPLES.keys()))

    # def test_detect_understand(self):
    #     query = "Explain how this process works."
    #     result = self.detector.detect(query)
    #     self.assertIsInstance(result, str)
    #     self.assertIn(result, list(self.detector.BLOOM_EXAMPLES.keys()))

    # def test_detect_apply(self):
    #     query = "How do I apply this formula?"
    #     result = self.detector.detect(query)
    #     self.assertIsInstance(result, str)
    #     self.assertIn(result, list(self.detector.BLOOM_EXAMPLES.keys()))

    # def test_detect_analyze(self):
    #     query = "Compare these two methods."
    #     result = self.detector.detect(query)
    #     self.assertIsInstance(result, str)
    #     self.assertIn(result, list(self.detector.BLOOM_EXAMPLES.keys()))

    # def test_detect_evaluate(self):
    #     query = "Which approach is better?"
    #     result = self.detector.detect(query)
    #     self.assertIsInstance(result, str)
    #     self.assertIn(result, list(self.detector.BLOOM_EXAMPLES.keys()))

    # def test_detect_create(self):
    #     query = "Design a new solution."
    #     result = self.detector.detect(query)
    #     self.assertIsInstance(result, str)
    #     self.assertIn(result, list(self.detector.BLOOM_EXAMPLES.keys()))

if __name__ == '__main__':
    unittest.main()