from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncGenerator, Any

from app.services.llm.llama_cpp_client import LLMClient


class StreamEventType(str, Enum):
    """Event types for Server-Sent Events streaming."""
    TOKEN = "token"
    METADATA = "metadata"
    ERROR = "error"
    DONE = "done"
    STATUS = "status"


@dataclass
class StreamEvent:
    """Represents a Server-Sent Event for streaming responses.
    
    Attributes:
        event_type: Type of event (TOKEN, METADATA, ERROR, DONE, STATUS)
        data: Event payload as dictionary
        id: Optional event ID for client tracking
    """
    event_type: StreamEventType
    data: dict[str, Any]
    id: str | None = None

    def to_sse(self) -> str:
        """Format event according to SSE specification.
        
        Returns:
            Formatted SSE string with id, event, and data fields
        """
        lines = []
        
        if self.id:
            lines.append(f"id: {self.id}")
        
        lines.append(f"event: {self.event_type.value}")
        
        data_json = json.dumps(self.data, ensure_ascii=False)
        lines.append(f"data: {data_json}")
        
        return "\n".join(lines) + "\n\n"


class StreamingService:
    """Service for streaming LLM responses via Server-Sent Events.
    
    Handles token-by-token streaming with metadata tracking, error handling,
    and progress updates.
    """
    
    def __init__(self, llm_client: LLMClient):
        """Initialize streaming service with LLM client.
        
        Args:
            llm_client: Initialized LLMClient instance for generation
        """
        self.llm_client = llm_client

    async def stream_response(
        self,
        prompt: str,
        request_id: str | None = None,
        **generation_kwargs: Any,
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream LLM response with metadata and error handling.
        
        Args:
            prompt: Input prompt for generation
            request_id: Optional request ID for tracking
            **generation_kwargs: Additional parameters for generation
                (temperature, top_p, top_k, max_tokens)
        
        Yields:
            StreamEvent objects for STATUS, TOKEN, METADATA, DONE, or ERROR
        """
        if request_id is None:
            request_id = str(uuid.uuid4())
        
        start_time = time.time()
        accumulated_text = ""
        token_count = 0
        last_metadata_token = 0
        
        try:
            yield StreamEvent(
                event_type=StreamEventType.STATUS,
                data={
                    "status": "started",
                    "request_id": request_id,
                    "timestamp": start_time,
                },
                id=request_id,
            )
            
            async for token in self.llm_client.generate_stream_async(
                prompt=prompt,
                **generation_kwargs,
            ):
                accumulated_text += token
                token_count += 1
                
                yield StreamEvent(
                    event_type=StreamEventType.TOKEN,
                    data={
                        "token": token,
                        "partial_text": accumulated_text,
                        "token_count": token_count,
                    },
                    id=f"{request_id}-{token_count}",
                )
                
                if token_count - last_metadata_token >= 10:
                    elapsed = time.time() - start_time
                    tokens_per_sec = token_count / elapsed if elapsed > 0 else 0
                    
                    yield StreamEvent(
                        event_type=StreamEventType.METADATA,
                        data={
                            "token_count": token_count,
                            "elapsed_seconds": round(elapsed, 2),
                            "tokens_per_second": round(tokens_per_sec, 2),
                        },
                        id=f"{request_id}-meta-{token_count}",
                    )
                    
                    last_metadata_token = token_count
            
            end_time = time.time()
            elapsed = end_time - start_time
            tokens_per_sec = token_count / elapsed if elapsed > 0 else 0
            
            yield StreamEvent(
                event_type=StreamEventType.DONE,
                data={
                    "status": "completed",
                    "full_response": accumulated_text,
                    "total_tokens": token_count,
                    "elapsed_seconds": round(elapsed, 2),
                    "tokens_per_second": round(tokens_per_sec, 2),
                    "request_id": request_id,
                },
                id=f"{request_id}-done",
            )
            
        except Exception as e:
            elapsed = time.time() - start_time
            
            yield StreamEvent(
                event_type=StreamEventType.ERROR,
                data={
                    "status": "error",
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "partial_response": accumulated_text,
                    "tokens_generated": token_count,
                    "elapsed_seconds": round(elapsed, 2),
                    "request_id": request_id,
                },
                id=f"{request_id}-error",
            )
