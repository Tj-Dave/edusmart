"""
Unit tests for Intelligent Confidence Layer (ICL)
"""

import pytest
from unittest.mock import Mock, AsyncMock
from app.services.intelligent_confidence_layer import IntelligentConfidenceLayer


class TestIntelligentConfidenceLayer:
    """Test suite for ICL component"""

    @pytest.fixture
    def mock_llm_client(self):
        """Create a mock LLM client"""
        client = Mock()
        client.generate = Mock(return_value='{"bloom_conf": 0.8, "cbc_conf": 0.6, "rag_conf": 0.9}')
        return client

    @pytest.fixture
    def icl(self, mock_llm_client):
        """Create ICL instance with mock client"""
        return IntelligentConfidenceLayer(mock_llm_client)

    @pytest.mark.asyncio
    async def test_compute_with_valid_llm_response(self, icl, mock_llm_client):
        """Test compute with valid LLM response"""
        query = "Explain the concept of photosynthesis"
        scores = await icl.compute(query)

        assert "bloom_conf" in scores
        assert "cbc_conf" in scores
        assert "rag_conf" in scores
        assert all(0.0 <= v <= 1.0 for v in scores.values())
        mock_llm_client.generate.assert_called_once()

    @pytest.mark.asyncio
    async def test_compute_with_llm_failure_fallback(self, icl, mock_llm_client):
        """Test fallback to heuristics when LLM fails"""
        mock_llm_client.generate.side_effect = Exception("LLM error")
        query = "Explain the concept of photosynthesis"
        scores = await icl.compute(query)

        # Should still return valid scores (from heuristics)
        assert "bloom_conf" in scores
        assert "cbc_conf" in scores
        assert "rag_conf" in scores
        assert all(0.0 <= v <= 1.0 for v in scores.values())

    def test_heuristic_scores_bloom_keywords(self, icl):
        """Test heuristic scoring with bloom keywords"""
        query = "Explain why photosynthesis is important"
        scores = icl._heuristic_scores(query)

        assert scores["bloom_conf"] == 0.7  # Contains "explain" and "why"
        assert 0.0 <= scores["cbc_conf"] <= 1.0
        assert 0.0 <= scores["rag_conf"] <= 1.0

    def test_heuristic_scores_cbc_keywords(self, icl):
        """Test heuristic scoring with CBC keywords"""
        query = "Calculate the derivative of x^2"
        scores = icl._heuristic_scores(query)

        assert scores["cbc_conf"] == 0.6  # Contains "calculate"
        assert 0.0 <= scores["bloom_conf"] <= 1.0
        assert 0.0 <= scores["rag_conf"] <= 1.0

    def test_heuristic_scores_long_query(self, icl):
        """Test heuristic scoring with long query"""
        query = "This is a very long query with more than eight words in it"
        scores = icl._heuristic_scores(query)

        assert scores["rag_conf"] == 0.8  # More than 8 words
        assert 0.0 <= scores["bloom_conf"] <= 1.0
        assert 0.0 <= scores["cbc_conf"] <= 1.0

    def test_parse_llm_response_valid_json(self, icl):
        """Test parsing valid JSON response"""
        response = '{"bloom_conf": 0.8, "cbc_conf": 0.6, "rag_conf": 0.9}'
        scores = icl._parse_llm_response(response)

        assert scores is not None
        assert scores["bloom_conf"] == 0.8
        assert scores["cbc_conf"] == 0.6
        assert scores["rag_conf"] == 0.9

    def test_parse_llm_response_with_markdown(self, icl):
        """Test parsing JSON wrapped in markdown"""
        response = '```json\n{"bloom_conf": 0.8, "cbc_conf": 0.6, "rag_conf": 0.9}\n```'
        scores = icl._parse_llm_response(response)

        assert scores is not None
        assert scores["bloom_conf"] == 0.8

    def test_parse_llm_response_with_surrounding_text(self, icl):
        """Test parsing JSON with surrounding text"""
        response = 'Here are the scores: {"bloom_conf": 0.8, "cbc_conf": 0.6, "rag_conf": 0.9} as requested.'
        scores = icl._parse_llm_response(response)

        assert scores is not None
        assert scores["bloom_conf"] == 0.8

    def test_parse_llm_response_invalid(self, icl):
        """Test parsing invalid response"""
        response = "This is not JSON at all"
        scores = icl._parse_llm_response(response)

        assert scores is None

    def test_validate_scores_valid(self, icl):
        """Test validation with valid scores"""
        scores = {"bloom_conf": 0.8, "cbc_conf": 0.6, "rag_conf": 0.9}
        assert icl._validate_scores(scores) is True

    def test_validate_scores_missing_key(self, icl):
        """Test validation with missing key"""
        scores = {"bloom_conf": 0.8, "cbc_conf": 0.6}
        assert icl._validate_scores(scores) is False

    def test_validate_scores_out_of_range(self, icl):
        """Test validation with out-of-range values"""
        scores = {"bloom_conf": 1.5, "cbc_conf": 0.6, "rag_conf": 0.9}
        assert icl._validate_scores(scores) is False

        scores = {"bloom_conf": -0.1, "cbc_conf": 0.6, "rag_conf": 0.9}
        assert icl._validate_scores(scores) is False

    def test_validate_scores_invalid_type(self, icl):
        """Test validation with invalid types"""
        scores = {"bloom_conf": "high", "cbc_conf": 0.6, "rag_conf": 0.9}
        assert icl._validate_scores(scores) is False

    def test_fuse_scores(self, icl):
        """Test score fusion"""
        llm_scores = {"bloom_conf": 0.8, "cbc_conf": 0.6, "rag_conf": 0.9}
        heuristic_scores = {"bloom_conf": 0.2, "cbc_conf": 0.3, "rag_conf": 0.3}

        fused = icl._fuse_scores(llm_scores, heuristic_scores)

        # With alpha=0.85: 0.85*0.8 + 0.15*0.2 = 0.68 + 0.03 = 0.71
        assert abs(fused["bloom_conf"] - 0.71) < 0.01
        # With alpha=0.85: 0.85*0.6 + 0.15*0.3 = 0.51 + 0.045 = 0.555
        assert abs(fused["cbc_conf"] - 0.555) < 0.01
        # With alpha=0.85: 0.85*0.9 + 0.15*0.3 = 0.765 + 0.045 = 0.81
        assert abs(fused["rag_conf"] - 0.81) < 0.01

    def test_fuse_scores_all_keys_present(self, icl):
        """Test that fusion includes all required keys"""
        llm_scores = {"bloom_conf": 0.5, "cbc_conf": 0.5, "rag_conf": 0.5}
        heuristic_scores = {"bloom_conf": 0.5, "cbc_conf": 0.5, "rag_conf": 0.5}

        fused = icl._fuse_scores(llm_scores, heuristic_scores)

        assert set(fused.keys()) == {"bloom_conf", "cbc_conf", "rag_conf"}
        assert all(isinstance(v, float) for v in fused.values())
