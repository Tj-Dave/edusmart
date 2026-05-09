#!/usr/bin/env python3
"""
Test script for streaming functionality.

Usage:
    python test_streaming.py
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.llm.llama_cpp_client import LLMClient
from app.services.streaming_service import StreamingService, StreamEventType


async def test_streaming():
    """Test the streaming service with LLM client."""
    print("=" * 60)
    print("Testing Streaming Service")
    print("=" * 60)
    
    # Initialize services
    print("\n[1] Initializing LLM client...")
    llm_client = LLMClient()
    
    print("[2] Initializing streaming service...")
    streaming_service = StreamingService(llm_client)
    
    # Test prompt
    prompt = "Explain what is 2+2 in one sentence."
    print(f"\n[3] Streaming response for prompt: '{prompt}'")
    print("-" * 60)
    
    accumulated_text = ""
    token_count = 0
    
    async for event in streaming_service.stream_response(
        prompt=prompt,
        request_id="test-001",
    ):
        if event.event_type == StreamEventType.STATUS:
            print(f"\n[STATUS] {event.data['status']}")
            print(f"Request ID: {event.data['request_id']}")
            
        elif event.event_type == StreamEventType.TOKEN:
            token = event.data['token']
            accumulated_text = event.data['partial_text']
            token_count = event.data['token_count']
            print(token, end='', flush=True)
            
        elif event.event_type == StreamEventType.METADATA:
            print(f"\n[METADATA] Tokens: {event.data['token_count']}, "
                  f"Speed: {event.data['tokens_per_second']:.2f} tok/s, "
                  f"Elapsed: {event.data['elapsed_seconds']:.2f}s")
            
        elif event.event_type == StreamEventType.DONE:
            print(f"\n\n[DONE] Generation completed")
            print(f"Total tokens: {event.data['total_tokens']}")
            print(f"Total time: {event.data['elapsed_seconds']:.2f}s")
            print(f"Average speed: {event.data['tokens_per_second']:.2f} tok/s")
            
        elif event.event_type == StreamEventType.ERROR:
            print(f"\n\n[ERROR] {event.data['error']}")
            print(f"Error type: {event.data['error_type']}")
            print(f"Partial response: {event.data['partial_response']}")
    
    print("\n" + "=" * 60)
    print("Test completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_streaming())
