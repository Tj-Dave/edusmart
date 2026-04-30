"""
Unit tests for LLMSubclient.generate_with_overrides() method.

Tests verify that per-call parameter overrides work correctly without
modifying global configuration or breaking existing functionality.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from app.services.llm.llama_cpp_subclient import LLMSubclient


class TestLLMSubclientOverrides:
    """Test suite for generate_with_overrides functionality."""

    @pytest.fixture
    def mock_llama(self):
        """Create a mock Llama instance."""
        mock = MagicMock()
        mock.return_value = {
            "choices": [{"text": "test response"}]
        }
        return mock

    @pytest.fixture
    def mock_settings(self):
        """Create mock settings."""
        settings = Mock()
        settings.LLM_MODE = "cpu"
        settings.QUERY_LLM_MODEL_CPU_PATH = "/fake/model.gguf"
        settings.QUERY_LLM_CONTEXT_SIZE = 2048
        settings.QUERY_LLM_THREADS = 4
        settings.QUERY_LLM_N_BATCH = 256
        settings.QUERY_LLM_MAX_TOKENS = 512
        settings.QUERY_LLM_TEMPERATURE = 0.7
        settings.QUERY_LLM_TOP_P = 0.9
        settings.QUERY_LLM_MODEL_FAMILY = "phi-3-mini"
        return settings

    @pytest.mark.asyncio
    async def test_generate_with_overrides_basic(self, mock_llama, mock_settings):
        """Test basic parameter override functionality."""
        with patch("app.services.llm.llama_cpp_subclient.Llama", return_value=mock_llama):
            with patch("app.services.llm.llama_cpp_subclient.settings", mock_settings):
                client = LLMSubclient()
                
                # Call with overrides
                response = await client.generate_with_overrides(
                    prompt="test prompt",
                    temperature=0.0,
                    top_p=1.0,
                    top_k=1,
                    max_tokens=120
                )
                
                # Verify response
                assert response == "test response"
                
                # Verify llama was called with overridden params
                mock_llama.assert_called_once()
                call_kwargs = mock_llama.call_args[1]
                assert call_kwargs["temperature"] == 0.0
                assert call_kwargs["top_p"] == 1.0
                assert call_kwargs["top_k"] == 1
                assert call_kwargs["max_tokens"] == 120

    @pytest.mark.asyncio
    async def test_generate_with_overrides_partial(self, mock_llama, mock_settings):
        """Test partial parameter overrides (some params use defaults)."""
        with patch("app.services.llm.llama_cpp_subclient.Llama", return_value=mock_llama):
            with patch("app.services.llm.llama_cpp_subclient.settings", mock_settings):
                client = LLMSubclient()
                
                # Call with only temperature override
                response = await client.generate_with_overrides(
                    prompt="test prompt",
                    temperature=0.0
                )
                
                # Verify response
                assert response == "test response"
                
                # Verify llama was called with mixed params
                call_kwargs = mock_llama.call_args[1]
                assert call_kwargs["temperature"] == 0.0  # overridden
                assert call_kwargs["top_p"] == 0.9  # default from settings
                assert call_kwargs["max_tokens"] == 512  # default from settings

    @pytest.mark.asyncio
    async def test_generate_with_overrides_chat_format(self, mock_settings):
        """Test overrides work with chat format mode."""
        mock_llama = MagicMock()
        mock_llama.create_chat_completion.return_value = {
            "choices": [{"message": {"content": "chat response"}}]
        }
        
        with patch("app.services.llm.llama_cpp_subclient.Llama", return_value=mock_llama):
            with patch("app.services.llm.llama_cpp_subclient.settings", mock_settings):
                client = LLMSubclient()
                
                # Call with chat format and overrides
                response = await client.generate_with_overrides(
                    prompt="test prompt",
                    use_chat_format=True,
                    temperature=0.0,
                    max_tokens=100
                )
                
                # Verify response
                assert response == "chat response"
                
                # Verify create_chat_completion was called with overrides
                mock_llama.create_chat_completion.assert_called_once()
                call_kwargs = mock_llama.create_chat_completion.call_args[1]
                assert call_kwargs["temperature"] == 0.0
                assert call_kwargs["max_tokens"] == 100

    @pytest.mark.asyncio
    async def test_generate_still_works(self, mock_llama, mock_settings):
        """Test that original generate() method still works unchanged."""
        with patch("app.services.llm.llama_cpp_subclient.Llama", return_value=mock_llama):
            with patch("app.services.llm.llama_cpp_subclient.settings", mock_settings):
                client = LLMSubclient()
                
                # Call original generate method
                response = client.generate("test prompt")
                
                # Verify response
                assert response == "test response"
                
                # Verify llama was called with default params
                call_kwargs = mock_llama.call_args[1]
                assert call_kwargs["temperature"] == 0.7  # default
                assert call_kwargs["top_p"] == 0.9  # default
                assert call_kwargs["max_tokens"] == 512  # default

    @pytest.mark.asyncio
    async def test_overrides_do_not_persist(self, mock_llama, mock_settings):
        """Test that overrides don't affect subsequent calls."""
        with patch("app.services.llm.llama_cpp_subclient.Llama", return_value=mock_llama):
            with patch("app.services.llm.llama_cpp_subclient.settings", mock_settings):
                client = LLMSubclient()
                
                # First call with overrides
                await client.generate_with_overrides(
                    prompt="test 1",
                    temperature=0.0,
                    max_tokens=100
                )
                
                # Reset mock
                mock_llama.reset_mock()
                
                # Second call without overrides (should use defaults)
                client.generate("test 2")
                
                # Verify second call uses default params
                call_kwargs = mock_llama.call_args[1]
                assert call_kwargs["temperature"] == 0.7  # default, not 0.0
                assert call_kwargs["max_tokens"] == 512  # default, not 100

    @pytest.mark.asyncio
    async def test_custom_stop_sequences(self, mock_llama, mock_settings):
        """Test that custom stop sequences can be overridden."""
        with patch("app.services.llm.llama_cpp_subclient.Llama", return_value=mock_llama):
            with patch("app.services.llm.llama_cpp_subclient.settings", mock_settings):
                client = LLMSubclient()
                
                # Call with custom stop sequences
                await client.generate_with_overrides(
                    prompt="test prompt",
                    stop=["END", "STOP"]
                )
                
                # Verify custom stop sequences were used
                call_kwargs = mock_llama.call_args[1]
                assert call_kwargs["stop"] == ["END", "STOP"]
