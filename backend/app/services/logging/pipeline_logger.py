"""
Pipeline Logger - Non-intrusive observability layer for AI pipeline execution.

This module provides structured logging for every stage of the AI pipeline
without affecting business logic, model outputs, or introducing significant latency.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)


class PipelineLogger:
    """
    Centralized, non-blocking logger for AI pipeline execution.
    
    Captures structured logs at every pipeline stage for observability,
    debugging, and research analysis.
    
    Features:
    - Async-safe and thread-safe
    - Non-blocking writes via background queue
    - Structured JSON logging (JSONL format)
    - Automatic truncation of large content
    - Trace ID support for request tracking
    """

    # Content truncation limits (characters)
    MAX_QUERY_LENGTH = 1000
    MAX_PROMPT_LENGTH = 5000
    MAX_RESPONSE_LENGTH = 5000
    MAX_CHUNK_LENGTH = 500
    MAX_MEMORY_LENGTH = 1000

    def __init__(self, log_dir: str | Path = "logs", max_queue_size: int = 1000):
        """
        Initialize the pipeline logger.
        
        Args:
            log_dir: Directory for log files
            max_queue_size: Maximum size of the async write queue
        """
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        self.log_file = self.log_dir / "pipeline_logs.jsonl"
        
        # Async queue for non-blocking writes
        self.queue: asyncio.Queue = asyncio.Queue(maxsize=max_queue_size)
        
        # Background writer task
        self._writer_task: asyncio.Task | None = None
        self._shutdown = False
        
        logger.info(f"PipelineLogger initialized: {self.log_file}")

    async def start(self):
        """Start the background writer task."""
        if self._writer_task is None or self._writer_task.done():
            self._shutdown = False
            self._writer_task = asyncio.create_task(self._background_writer())
            logger.info("PipelineLogger background writer started")

    async def stop(self):
        """Stop the background writer and flush remaining logs."""
        self._shutdown = True
        if self._writer_task:
            await self._writer_task
            logger.info("PipelineLogger background writer stopped")

    async def _background_writer(self):
        """Background task that writes queued logs to disk."""
        while not self._shutdown or not self.queue.empty():
            try:
                # Wait for log entry with timeout
                log_entry = await asyncio.wait_for(self.queue.get(), timeout=1.0)
                
                # Write to file
                with open(self.log_file, "a", encoding="utf-8") as f:
                    f.write(json.dumps(log_entry, default=str) + "\n")
                
                self.queue.task_done()
                
            except asyncio.TimeoutError:
                # No logs in queue, continue waiting
                continue
            except Exception as e:
                logger.error(f"PipelineLogger write error: {e}", exc_info=True)

    def log_event(self, stage: str, data: dict[str, Any]) -> None:
        """
        Synchronous log event (for thread pool compatibility).
        
        Args:
            stage: Pipeline stage name
            data: Event data dictionary
        """
        try:
            # Try to add to queue without blocking
            self.queue.put_nowait(self._build_log_entry(stage, data))
        except asyncio.QueueFull:
            logger.warning(f"PipelineLogger queue full, dropping log for stage: {stage}")
        except Exception as e:
            logger.error(f"PipelineLogger error: {e}", exc_info=True)

    async def alog_event(self, stage: str, data: dict[str, Any]) -> None:
        """
        Async log event.
        
        Args:
            stage: Pipeline stage name
            data: Event data dictionary
        """
        try:
            await self.queue.put(self._build_log_entry(stage, data))
        except Exception as e:
            logger.error(f"PipelineLogger error: {e}", exc_info=True)

    def _build_log_entry(self, stage: str, data: dict[str, Any]) -> dict[str, Any]:
        """
        Build structured log entry.
        
        Args:
            stage: Pipeline stage name
            data: Event data
            
        Returns:
            Structured log entry dictionary
        """
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "stage": stage,
        }
        
        # Add all data fields
        entry.update(data)
        
        return entry

    # ========================================================================
    # Stage-specific logging methods
    # ========================================================================

    def log_input(
        self,
        *,
        query: str,
        user_id: str,
        session_id: UUID | str,
        course_id: str,
        trace_id: str | None = None,
    ) -> None:
        """
        Log pipeline input stage.
        
        Args:
            query: User query
            user_id: User identifier
            session_id: Session identifier
            course_id: Course identifier
            trace_id: Optional trace ID for request tracking
        """
        self.log_event("input", {
            "trace_id": trace_id,
            "user_id": user_id,
            "session_id": str(session_id),
            "course_id": course_id,
            "query": self._truncate(query, self.MAX_QUERY_LENGTH),
            "query_length": len(query),
        })

    def log_confidence_scores(
        self,
        *,
        trace_id: str | None,
        scores: dict[str, float],
        latency_ms: float | None = None,
    ) -> None:
        """
        Log ICL confidence scores.
        
        Args:
            trace_id: Request trace ID
            scores: Confidence scores dictionary
            latency_ms: ICL computation latency in milliseconds
        """
        self.log_event("icl_confidence", {
            "trace_id": trace_id,
            "bloom_conf": scores.get("bloom_conf"),
            "cbc_conf": scores.get("cbc_conf"),
            "rag_conf": scores.get("rag_conf"),
            "latency_ms": latency_ms,
        })

    def log_bloom_detection(
        self,
        *,
        trace_id: str | None,
        query: str,
        bloom_level: str,
        gated: bool = False,
        latency_ms: float | None = None,
    ) -> None:
        """
        Log Bloom taxonomy detection.
        
        Args:
            trace_id: Request trace ID
            query: Input query
            bloom_level: Detected Bloom level
            gated: Whether detection was skipped due to low confidence
            latency_ms: Detection latency in milliseconds
        """
        self.log_event("bloom_detector", {
            "trace_id": trace_id,
            "input_query": self._truncate(query, self.MAX_QUERY_LENGTH),
            "bloom_level": bloom_level,
            "gated": gated,
            "latency_ms": latency_ms,
        })

    def log_competency_mapping(
        self,
        *,
        trace_id: str | None,
        query: str,
        competency: str | None,
        gated: bool = False,
        latency_ms: float | None = None,
    ) -> None:
        """
        Log CBC competency mapping.
        
        Args:
            trace_id: Request trace ID
            query: Input query
            competency: Mapped competency (or None if skipped)
            gated: Whether mapping was skipped due to low confidence
            latency_ms: Mapping latency in milliseconds
        """
        self.log_event("cbc_mapper", {
            "trace_id": trace_id,
            "input_query": self._truncate(query, self.MAX_QUERY_LENGTH),
            "competency": competency,
            "gated": gated,
            "latency_ms": latency_ms,
        })

    def log_rag_retrieval(
        self,
        *,
        trace_id: str | None,
        query: str,
        course_id: str,
        chunks: list[dict[str, Any]],
        gated: bool = False,
        latency_ms: float | None = None,
    ) -> None:
        """
        Log RAG retrieval stage.
        
        Args:
            trace_id: Request trace ID
            query: Input query
            course_id: Course identifier
            chunks: Retrieved document chunks
            gated: Whether retrieval was skipped due to low confidence
            latency_ms: Retrieval latency in milliseconds
        """
        # Extract metadata and truncate content
        chunk_metadata = []
        for chunk in chunks:
            metadata = {
                "doc_id": chunk.get("doc_id"),
                "chunk_id": chunk.get("chunk_id"),
                "similarity": chunk.get("similarity"),
                "content_preview": self._truncate(
                    chunk.get("context", ""),
                    self.MAX_CHUNK_LENGTH
                ),
                "content_length": len(chunk.get("context", "")),
            }
            chunk_metadata.append(metadata)
        
        self.log_event("rag_engine", {
            "trace_id": trace_id,
            "input_query": self._truncate(query, self.MAX_QUERY_LENGTH),
            "course_id": course_id,
            "num_chunks": len(chunks),
            "chunks": chunk_metadata,
            "gated": gated,
            "latency_ms": latency_ms,
        })

    def log_prompt_construction(
        self,
        *,
        trace_id: str | None,
        query: str,
        bloom_level: str,
        competency: str | None,
        num_context_chunks: int,
        has_memory: bool,
        final_prompt: str,
    ) -> None:
        """
        Log final prompt construction (LLM input).
        
        Args:
            trace_id: Request trace ID
            query: Original user query
            bloom_level: Bloom taxonomy level
            competency: CBC competency mapping
            num_context_chunks: Number of RAG context chunks
            has_memory: Whether memory context is included
            final_prompt: Complete prompt sent to LLM
        """
        self.log_event("llm_input", {
            "trace_id": trace_id,
            "query": self._truncate(query, self.MAX_QUERY_LENGTH),
            "bloom_level": bloom_level,
            "competency": competency,
            "num_context_chunks": num_context_chunks,
            "has_memory": has_memory,
            "prompt": self._truncate(final_prompt, self.MAX_PROMPT_LENGTH),
            "prompt_length": len(final_prompt),
        })

    def log_llm_generation(
        self,
        *,
        trace_id: str | None,
        response: str,
        token_count: int | None = None,
        latency_ms: float | None = None,
    ) -> None:
        """
        Log LLM generation output.
        
        Args:
            trace_id: Request trace ID
            response: LLM response text
            token_count: Number of tokens generated (if available)
            latency_ms: Generation latency in milliseconds
        """
        self.log_event("llm_output", {
            "trace_id": trace_id,
            "response": self._truncate(response, self.MAX_RESPONSE_LENGTH),
            "response_length": len(response),
            "token_count": token_count,
            "latency_ms": latency_ms,
        })

    def log_final_response(
        self,
        *,
        trace_id: str | None,
        message_id: int | None,
        query: str,
        response: str,
        bloom_level: str,
        course_id: str,
        num_citations: int,
        total_latency_ms: float | None = None,
    ) -> None:
        """
        Log final API response.
        
        Args:
            trace_id: Request trace ID
            message_id: Database message ID
            query: Original query
            response: Final response text
            bloom_level: Bloom level used
            course_id: Course identifier
            num_citations: Number of citations included
            total_latency_ms: Total pipeline latency in milliseconds
        """
        self.log_event("final_response", {
            "trace_id": trace_id,
            "message_id": message_id,
            "query": self._truncate(query, self.MAX_QUERY_LENGTH),
            "response": self._truncate(response, self.MAX_RESPONSE_LENGTH),
            "bloom_level": bloom_level,
            "course_id": course_id,
            "num_citations": num_citations,
            "total_latency_ms": total_latency_ms,
        })

    def log_error(
        self,
        *,
        trace_id: str | None,
        stage: str,
        error: str,
        error_type: str | None = None,
    ) -> None:
        """
        Log pipeline error.
        
        Args:
            trace_id: Request trace ID
            stage: Stage where error occurred
            error: Error message
            error_type: Error type/class name
        """
        self.log_event("error", {
            "trace_id": trace_id,
            "error_stage": stage,
            "error_message": error,
            "error_type": error_type,
        })

    # ========================================================================
    # Utility methods
    # ========================================================================

    def _truncate(self, text: str, max_length: int) -> str:
        """
        Safely truncate text to maximum length.
        
        Args:
            text: Text to truncate
            max_length: Maximum length
            
        Returns:
            Truncated text with ellipsis if needed
        """
        if not text:
            return ""
        
        if len(text) <= max_length:
            return text
        
        return text[:max_length] + "..."

    def generate_trace_id(self) -> str:
        """
        Generate a unique trace ID for request tracking.
        
        Returns:
            Trace ID string
        """
        import uuid
        return str(uuid.uuid4())


# ============================================================================
# Context manager for timing stages
# ============================================================================

class StageTimer:
    """Context manager for timing pipeline stages."""
    
    def __init__(self):
        self.start_time: float | None = None
        self.end_time: float | None = None
    
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.perf_counter()
    
    @property
    def latency_ms(self) -> float | None:
        """Get latency in milliseconds."""
        if self.start_time is not None and self.end_time is not None:
            return (self.end_time - self.start_time) * 1000
        return None
