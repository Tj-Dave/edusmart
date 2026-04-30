"""
Unit tests for PipelineLogger.

Tests verify non-blocking logging, structured output, truncation,
and thread-safety without affecting pipeline execution.
"""

import asyncio
import json
import pytest
import tempfile
from pathlib import Path
from uuid import uuid4

from app.services.logging.pipeline_logger import PipelineLogger, StageTimer


class TestPipelineLogger:
    """Test suite for PipelineLogger."""

    @pytest.fixture
    async def logger(self):
        """Create a temporary logger instance."""
        with tempfile.TemporaryDirectory() as tmpdir:
            logger = PipelineLogger(log_dir=tmpdir, max_queue_size=100)
            await logger.start()
            yield logger
            await logger.stop()

    @pytest.fixture
    def log_file(self, logger):
        """Get the log file path."""
        return logger.log_file

    @pytest.mark.asyncio
    async def test_logger_initialization(self):
        """Test logger initializes correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            logger = PipelineLogger(log_dir=tmpdir)
            
            assert logger.log_dir == Path(tmpdir)
            assert logger.log_file == Path(tmpdir) / "pipeline_logs.jsonl"
            assert logger.queue.maxsize == 1000

    @pytest.mark.asyncio
    async def test_log_input_stage(self, logger, log_file):
        """Test logging input stage."""
        trace_id = "test_trace_123"
        
        logger.log_input(
            query="What is machine learning?",
            user_id="user_123",
            session_id=uuid4(),
            course_id="CS101",
            trace_id=trace_id,
        )
        
        # Wait for background writer
        await asyncio.sleep(0.1)
        
        # Read log file
        with open(log_file, "r") as f:
            log = json.loads(f.readline())
        
        assert log["stage"] == "input"
        assert log["trace_id"] == trace_id
        assert log["user_id"] == "user_123"
        assert log["course_id"] == "CS101"
        assert log["query"] == "What is machine learning?"
        assert log["query_length"] == 26
        assert "timestamp" in log

    @pytest.mark.asyncio
    async def test_log_confidence_scores(self, logger, log_file):
        """Test logging ICL confidence scores."""
        trace_id = "test_trace_456"
        scores = {
            "bloom_conf": 0.75,
            "cbc_conf": 0.62,
            "rag_conf": 0.88,
        }
        
        logger.log_confidence_scores(
            trace_id=trace_id,
            scores=scores,
            latency_ms=145.3,
        )
        
        await asyncio.sleep(0.1)
        
        with open(log_file, "r") as f:
            log = json.loads(f.readline())
        
        assert log["stage"] == "icl_confidence"
        assert log["bloom_conf"] == 0.75
        assert log["cbc_conf"] == 0.62
        assert log["rag_conf"] == 0.88
        assert log["latency_ms"] == 145.3

    @pytest.mark.asyncio
    async def test_log_bloom_detection(self, logger, log_file):
        """Test logging Bloom detection."""
        logger.log_bloom_detection(
            trace_id="trace_789",
            query="Explain neural networks",
            bloom_level="understand",
            gated=False,
            latency_ms=12.5,
        )
        
        await asyncio.sleep(0.1)
        
        with open(log_file, "r") as f:
            log = json.loads(f.readline())
        
        assert log["stage"] == "bloom_detector"
        assert log["bloom_level"] == "understand"
        assert log["gated"] is False
        assert log["latency_ms"] == 12.5

    @pytest.mark.asyncio
    async def test_log_competency_mapping(self, logger, log_file):
        """Test logging CBC competency mapping."""
        logger.log_competency_mapping(
            trace_id="trace_abc",
            query="Solve quadratic equation",
            competency="MATH.ALG.002",
            gated=False,
            latency_ms=23.7,
        )
        
        await asyncio.sleep(0.1)
        
        with open(log_file, "r") as f:
            log = json.loads(f.readline())
        
        assert log["stage"] == "cbc_mapper"
        assert log["competency"] == "MATH.ALG.002"
        assert log["gated"] is False

    @pytest.mark.asyncio
    async def test_log_rag_retrieval(self, logger, log_file):
        """Test logging RAG retrieval."""
        chunks = [
            {
                "doc_id": "doc_123",
                "chunk_id": "chunk_1",
                "similarity": 0.92,
                "context": "Machine learning is a subset of AI...",
            },
            {
                "doc_id": "doc_456",
                "chunk_id": "chunk_2",
                "similarity": 0.85,
                "context": "Neural networks are computational models...",
            },
        ]
        
        logger.log_rag_retrieval(
            trace_id="trace_def",
            query="What is ML?",
            course_id="CS101",
            chunks=chunks,
            gated=False,
            latency_ms=87.4,
        )
        
        await asyncio.sleep(0.1)
        
        with open(log_file, "r") as f:
            log = json.loads(f.readline())
        
        assert log["stage"] == "rag_engine"
        assert log["num_chunks"] == 2
        assert len(log["chunks"]) == 2
        assert log["chunks"][0]["doc_id"] == "doc_123"
        assert log["chunks"][0]["similarity"] == 0.92
        assert "content_preview" in log["chunks"][0]

    @pytest.mark.asyncio
    async def test_log_prompt_construction(self, logger, log_file):
        """Test logging prompt construction."""
        logger.log_prompt_construction(
            trace_id="trace_ghi",
            query="Explain AI",
            bloom_level="understand",
            competency="CS.AI.001",
            num_context_chunks=3,
            has_memory=True,
            final_prompt="You are an AI tutor. Context: ...",
        )
        
        await asyncio.sleep(0.1)
        
        with open(log_file, "r") as f:
            log = json.loads(f.readline())
        
        assert log["stage"] == "llm_input"
        assert log["bloom_level"] == "understand"
        assert log["num_context_chunks"] == 3
        assert log["has_memory"] is True
        assert "prompt" in log

    @pytest.mark.asyncio
    async def test_log_llm_generation(self, logger, log_file):
        """Test logging LLM generation."""
        logger.log_llm_generation(
            trace_id="trace_jkl",
            response="AI is a field of computer science...",
            token_count=150,
            latency_ms=2100.5,
        )
        
        await asyncio.sleep(0.1)
        
        with open(log_file, "r") as f:
            log = json.loads(f.readline())
        
        assert log["stage"] == "llm_output"
        assert log["token_count"] == 150
        assert log["latency_ms"] == 2100.5
        assert "response" in log

    @pytest.mark.asyncio
    async def test_log_final_response(self, logger, log_file):
        """Test logging final response."""
        logger.log_final_response(
            trace_id="trace_mno",
            message_id=12345,
            query="What is AI?",
            response="AI is artificial intelligence...",
            bloom_level="understand",
            course_id="CS101",
            num_citations=3,
            total_latency_ms=2543.8,
        )
        
        await asyncio.sleep(0.1)
        
        with open(log_file, "r") as f:
            log = json.loads(f.readline())
        
        assert log["stage"] == "final_response"
        assert log["message_id"] == 12345
        assert log["num_citations"] == 3
        assert log["total_latency_ms"] == 2543.8

    @pytest.mark.asyncio
    async def test_log_error(self, logger, log_file):
        """Test logging errors."""
        logger.log_error(
            trace_id="trace_pqr",
            stage="rag_engine",
            error="Connection timeout",
            error_type="TimeoutError",
        )
        
        await asyncio.sleep(0.1)
        
        with open(log_file, "r") as f:
            log = json.loads(f.readline())
        
        assert log["stage"] == "error"
        assert log["error_stage"] == "rag_engine"
        assert log["error_message"] == "Connection timeout"
        assert log["error_type"] == "TimeoutError"

    @pytest.mark.asyncio
    async def test_truncation(self, logger, log_file):
        """Test content truncation."""
        long_query = "x" * 2000  # Exceeds MAX_QUERY_LENGTH (1000)
        
        logger.log_input(
            query=long_query,
            user_id="user_123",
            session_id=uuid4(),
            course_id="CS101",
            trace_id="trace_truncate",
        )
        
        await asyncio.sleep(0.1)
        
        with open(log_file, "r") as f:
            log = json.loads(f.readline())
        
        # Should be truncated to 1000 + "..."
        assert len(log["query"]) == 1003
        assert log["query"].endswith("...")
        assert log["query_length"] == 2000  # Original length preserved

    @pytest.mark.asyncio
    async def test_multiple_logs_same_trace(self, logger, log_file):
        """Test multiple logs with same trace ID."""
        trace_id = "trace_multi"
        
        logger.log_input(
            query="Test query",
            user_id="user_123",
            session_id=uuid4(),
            course_id="CS101",
            trace_id=trace_id,
        )
        
        logger.log_bloom_detection(
            trace_id=trace_id,
            query="Test query",
            bloom_level="apply",
            gated=False,
            latency_ms=10.0,
        )
        
        logger.log_final_response(
            trace_id=trace_id,
            message_id=999,
            query="Test query",
            response="Test response",
            bloom_level="apply",
            course_id="CS101",
            num_citations=0,
            total_latency_ms=500.0,
        )
        
        await asyncio.sleep(0.2)
        
        # Read all logs
        with open(log_file, "r") as f:
            logs = [json.loads(line) for line in f]
        
        # All should have same trace_id
        assert len(logs) == 3
        assert all(log["trace_id"] == trace_id for log in logs)
        
        # Stages should be in order
        assert logs[0]["stage"] == "input"
        assert logs[1]["stage"] == "bloom_detector"
        assert logs[2]["stage"] == "final_response"

    @pytest.mark.asyncio
    async def test_async_log_event(self, logger, log_file):
        """Test async logging method."""
        await logger.alog_event("test_stage", {
            "trace_id": "async_test",
            "data": "test_data",
        })
        
        await asyncio.sleep(0.1)
        
        with open(log_file, "r") as f:
            log = json.loads(f.readline())
        
        assert log["stage"] == "test_stage"
        assert log["trace_id"] == "async_test"
        assert log["data"] == "test_data"

    @pytest.mark.asyncio
    async def test_generate_trace_id(self, logger):
        """Test trace ID generation."""
        trace_id = logger.generate_trace_id()
        
        assert isinstance(trace_id, str)
        assert len(trace_id) == 36  # UUID format
        assert trace_id.count("-") == 4

    def test_stage_timer(self):
        """Test StageTimer context manager."""
        import time
        
        with StageTimer() as timer:
            time.sleep(0.01)  # Sleep 10ms
        
        assert timer.latency_ms is not None
        assert timer.latency_ms >= 10.0
        assert timer.latency_ms < 50.0  # Should be close to 10ms

    @pytest.mark.asyncio
    async def test_queue_full_handling(self):
        """Test behavior when queue is full."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create logger with small queue
            logger = PipelineLogger(log_dir=tmpdir, max_queue_size=2)
            await logger.start()
            
            # Fill queue
            logger.log_event("test1", {"data": "1"})
            logger.log_event("test2", {"data": "2"})
            
            # This should trigger queue full warning (not crash)
            logger.log_event("test3", {"data": "3"})
            
            await logger.stop()
            
            # Should have logged first 2 events
            log_file = Path(tmpdir) / "pipeline_logs.jsonl"
            with open(log_file, "r") as f:
                logs = [json.loads(line) for line in f]
            
            assert len(logs) >= 2

    @pytest.mark.asyncio
    async def test_jsonl_format(self, logger, log_file):
        """Test that logs are valid JSONL format."""
        # Log multiple events
        for i in range(5):
            logger.log_event(f"stage_{i}", {
                "trace_id": f"trace_{i}",
                "data": f"data_{i}",
            })
        
        await asyncio.sleep(0.2)
        
        # Each line should be valid JSON
        with open(log_file, "r") as f:
            for line in f:
                log = json.loads(line)  # Should not raise
                assert "timestamp" in log
                assert "stage" in log

    @pytest.mark.asyncio
    async def test_concurrent_logging(self, logger, log_file):
        """Test thread-safe concurrent logging."""
        async def log_task(task_id: int):
            for i in range(10):
                logger.log_event(f"task_{task_id}", {
                    "trace_id": f"trace_{task_id}_{i}",
                    "iteration": i,
                })
        
        # Run multiple concurrent logging tasks
        await asyncio.gather(*[log_task(i) for i in range(5)])
        
        await asyncio.sleep(0.5)
        
        # Should have 50 logs (5 tasks * 10 iterations)
        with open(log_file, "r") as f:
            logs = [json.loads(line) for line in f]
        
        assert len(logs) == 50
