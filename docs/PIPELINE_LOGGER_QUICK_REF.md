# Pipeline Logger - Quick Reference

## Overview

Non-intrusive logging system for AI pipeline observability.

## Quick Start

### 1. Logger is Auto-Initialized

The logger is automatically initialized in `main.py` and available via `app.state.pipeline_logger`.

### 2. Basic Usage Pattern

```python
# Get logger from app state
pipeline_logger = getattr(req.app.state, "pipeline_logger", None)

# Generate trace ID for request tracking
trace_id = pipeline_logger.generate_trace_id() if pipeline_logger else None

# Log events (always check if logger exists)
if pipeline_logger:
    pipeline_logger.log_input(
        query=user_query,
        user_id=user_id,
        session_id=session_id,
        course_id=course_id,
        trace_id=trace_id,
    )
```

### 3. Timing Stages

```python
from app.services.logging.pipeline_logger import StageTimer

with StageTimer() as timer:
    result = expensive_operation()

# Get latency
latency_ms = timer.latency_ms
```

## Available Logging Methods

### Input Stage
```python
pipeline_logger.log_input(
    query=str,
    user_id=str,
    session_id=UUID,
    course_id=str,
    trace_id=str | None,
)
```

### ICL Confidence Scores
```python
pipeline_logger.log_confidence_scores(
    trace_id=str | None,
    scores=dict[str, float],
    latency_ms=float | None,
)
```

### Bloom Detection
```python
pipeline_logger.log_bloom_detection(
    trace_id=str | None,
    query=str,
    bloom_level=str,
    gated=bool,
    latency_ms=float | None,
)
```

### CBC Competency Mapping
```python
pipeline_logger.log_competency_mapping(
    trace_id=str | None,
    query=str,
    competency=str | None,
    gated=bool,
    latency_ms=float | None,
)
```

### RAG Retrieval
```python
pipeline_logger.log_rag_retrieval(
    trace_id=str | None,
    query=str,
    course_id=str,
    chunks=list[dict],
    gated=bool,
    latency_ms=float | None,
)
```

### Prompt Construction
```python
pipeline_logger.log_prompt_construction(
    trace_id=str | None,
    query=str,
    bloom_level=str,
    competency=str | None,
    num_context_chunks=int,
    has_memory=bool,
    final_prompt=str,
)
```

### LLM Generation
```python
pipeline_logger.log_llm_generation(
    trace_id=str | None,
    response=str,
    token_count=int | None,
    latency_ms=float | None,
)
```

### Final Response
```python
pipeline_logger.log_final_response(
    trace_id=str | None,
    message_id=int | None,
    query=str,
    response=str,
    bloom_level=str,
    course_id=str,
    num_citations=int,
    total_latency_ms=float | None,
)
```

### Error Logging
```python
pipeline_logger.log_error(
    trace_id=str | None,
    stage=str,
    error=str,
    error_type=str | None,
)
```

## Log Analysis

### Read Logs (Python)
```python
import json

with open("logs/pipeline_logs.jsonl", "r") as f:
    logs = [json.loads(line) for line in f]

# Filter by trace ID
trace_logs = [log for log in logs if log.get("trace_id") == "abc123"]
```

### Query Logs (jq)
```bash
# Get all logs for a trace
cat logs/pipeline_logs.jsonl | jq 'select(.trace_id == "abc123")'

# Calculate average latency
cat logs/pipeline_logs.jsonl | jq -s '
  [.[] | select(.stage == "llm_output") | .latency_ms] | add / length
'

# Find slow queries
cat logs/pipeline_logs.jsonl | jq '
  select(.stage == "final_response" and .total_latency_ms > 3000)
'
```

## Best Practices

### 1. Always Check Logger Exists
```python
if pipeline_logger:
    pipeline_logger.log_event(...)
```

### 2. Use Trace IDs
```python
trace_id = pipeline_logger.generate_trace_id() if pipeline_logger else None
# Pass trace_id to all log calls for the same request
```

### 3. Time Expensive Operations
```python
with StageTimer() as timer:
    result = operation()

if pipeline_logger:
    pipeline_logger.log_event(..., latency_ms=timer.latency_ms)
```

### 4. Log Errors
```python
try:
    result = operation()
except Exception as e:
    if pipeline_logger:
        pipeline_logger.log_error(
            trace_id=trace_id,
            stage="operation_name",
            error=str(e),
            error_type=type(e).__name__,
        )
    raise
```

## Truncation Limits

Content is automatically truncated to prevent log bloat:

- Query: 1000 chars
- Prompt: 5000 chars
- Response: 5000 chars
- Chunk preview: 500 chars
- Memory: 1000 chars

## Performance

- **Overhead**: <1% of pipeline latency
- **Non-blocking**: Async queue-based writes
- **Thread-safe**: Safe for concurrent use

## Log Location

```
logs/pipeline_logs.jsonl
```

## Common Patterns

### Full Pipeline Logging
```python
async def run_pipeline(...):
    pipeline_logger = getattr(req.app.state, "pipeline_logger", None)
    trace_id = pipeline_logger.generate_trace_id() if pipeline_logger else None
    pipeline_start = time.perf_counter()
    
    # Log input
    if pipeline_logger:
        pipeline_logger.log_input(...)
    
    # Stage 1
    with StageTimer() as timer1:
        result1 = stage1()
    if pipeline_logger:
        pipeline_logger.log_stage1(..., latency_ms=timer1.latency_ms)
    
    # Stage 2
    with StageTimer() as timer2:
        result2 = stage2()
    if pipeline_logger:
        pipeline_logger.log_stage2(..., latency_ms=timer2.latency_ms)
    
    # Final
    total_latency_ms = (time.perf_counter() - pipeline_start) * 1000
    if pipeline_logger:
        pipeline_logger.log_final_response(..., total_latency_ms=total_latency_ms)
```

### Error Handling
```python
try:
    result = operation()
except ValueError as e:
    if pipeline_logger:
        pipeline_logger.log_error(
            trace_id=trace_id,
            stage="operation",
            error=str(e),
            error_type="ValueError",
        )
    raise HTTPException(status_code=400, detail=str(e))
```

## Troubleshooting

### Logs not appearing
- Check if logger is started: `await pipeline_logger.start()`
- Check log directory exists: `logs/`
- Check file permissions

### Queue full warnings
- Increase queue size: `PipelineLogger(max_queue_size=5000)`
- Check disk I/O performance

### Large log files
- Implement log rotation
- Reduce truncation limits
- Archive old logs

## See Also

- [Full Documentation](PIPELINE_LOGGER.md)
- [Test Suite](../backend/app/tests/test_pipeline_logger.py)
- [Integration Example](../backend/app/routes/ai_query.py)
