# Pipeline Logger - Observability Layer Documentation

## Overview

The Pipeline Logger is a **non-intrusive, centralized logging system** that captures structured data at every stage of the AI pipeline execution. It provides comprehensive observability for debugging, evaluation, research analysis, and system improvement without affecting model outputs or business logic.

## Architecture

### Design Principles

1. **Non-Intrusive**: Zero impact on business logic or model outputs
2. **Non-Blocking**: Async queue-based writes prevent latency impact
3. **Thread-Safe**: Safe for use in async + thread pool environments
4. **Structured**: JSON-based logging for easy parsing and analysis
5. **Comprehensive**: Captures all pipeline stages with rich metadata
6. **Safe**: Automatic truncation of large content to prevent log bloat

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Pipeline                              │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐         │
│  │ ICL  │→ │Bloom │→ │ CBC  │→ │ RAG  │→ │ LLM  │         │
│  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘         │
│     │         │         │         │         │               │
│     ↓         ↓         ↓         ↓         ↓               │
│  ┌──────────────────────────────────────────────┐          │
│  │         PipelineLogger (Async Queue)          │          │
│  └──────────────────┬───────────────────────────┘          │
│                     ↓                                        │
│  ┌──────────────────────────────────────────────┐          │
│  │    Background Writer (Non-Blocking)           │          │
│  └──────────────────┬───────────────────────────┘          │
│                     ↓                                        │
│  ┌──────────────────────────────────────────────┐          │
│  │      logs/pipeline_logs.jsonl                 │          │
│  └──────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Logged Stages

### 1. Input Stage
**Stage Name**: `input`

**Captures**:
- Raw user query (truncated to 1000 chars)
- User ID
- Session ID
- Course ID
- Trace ID (for request tracking)
- Query length

**Example**:
```json
{
  "timestamp": "2024-01-15T10:30:45.123456Z",
  "stage": "input",
  "trace_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_id": "user_123",
  "session_id": "session_456",
  "course_id": "CS101",
  "query": "Explain machine learning algorithms",
  "query_length": 35
}
```

### 2. ICL Confidence Scores
**Stage Name**: `icl_confidence`

**Captures**:
- Bloom confidence score
- CBC confidence score
- RAG confidence score
- ICL computation latency

**Example**:
```json
{
  "timestamp": "2024-01-15T10:30:45.234567Z",
  "stage": "icl_confidence",
  "trace_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "bloom_conf": 0.75,
  "cbc_conf": 0.62,
  "rag_conf": 0.88,
  "latency_ms": 145.3
}
```

### 3. Bloom Detection
**Stage Name**: `bloom_detector`

**Captures**:
- Input query (truncated)
- Detected Bloom level
- Whether detection was gated (skipped due to low confidence)
- Detection latency

**Example**:
```json
{
  "timestamp": "2024-01-15T10:30:45.345678Z",
  "stage": "bloom_detector",
  "trace_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "input_query": "Explain machine learning algorithms",
  "bloom_level": "understand",
  "gated": false,
  "latency_ms": 12.5
}
```

### 4. CBC Competency Mapping
**Stage Name**: `cbc_mapper`

**Captures**:
- Input query (truncated)
- Mapped competency (or null if skipped)
- Whether mapping was gated
- Mapping latency

**Example**:
```json
{
  "timestamp": "2024-01-15T10:30:45.456789Z",
  "stage": "cbc_mapper",
  "trace_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "input_query": "Explain machine learning algorithms",
  "competency": "AI.ML.001",
  "gated": false,
  "latency_ms": 23.7
}
```

### 5. RAG Retrieval
**Stage Name**: `rag_engine`

**Captures**:
- Input query (truncated)
- Course ID
- Number of retrieved chunks
- Chunk metadata (doc_id, chunk_id, similarity, content preview)
- Whether retrieval was gated
- Retrieval latency

**Example**:
```json
{
  "timestamp": "2024-01-15T10:30:45.567890Z",
  "stage": "rag_engine",
  "trace_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "input_query": "Explain machine learning algorithms",
  "course_id": "CS101",
  "num_chunks": 3,
  "chunks": [
    {
      "doc_id": "doc_789",
      "chunk_id": "chunk_12",
      "similarity": 0.92,
      "content_preview": "Machine learning is a subset of artificial intelligence...",
      "content_length": 1234
    }
  ],
  "gated": false,
  "latency_ms": 87.4
}
```

### 6. Prompt Construction (LLM Input)
**Stage Name**: `llm_input`

**Captures**:
- Original user query (truncated)
- Bloom level used
- Competency mapping used
- Number of context chunks included
- Whether memory context is present
- Final prompt (truncated to 5000 chars)
- Prompt length

**Example**:
```json
{
  "timestamp": "2024-01-15T10:30:45.678901Z",
  "stage": "llm_input",
  "trace_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "query": "Explain machine learning algorithms",
  "bloom_level": "understand",
  "competency": "AI.ML.001",
  "num_context_chunks": 3,
  "has_memory": true,
  "prompt": "You are an AI tutor...",
  "prompt_length": 2345
}
```

### 7. LLM Generation (LLM Output)
**Stage Name**: `llm_output`

**Captures**:
- LLM response (truncated to 5000 chars)
- Response length
- Token count (if available)
- Generation latency

**Example**:
```json
{
  "timestamp": "2024-01-15T10:30:47.789012Z",
  "stage": "llm_output",
  "trace_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "response": "Machine learning algorithms are computational methods...",
  "response_length": 1567,
  "token_count": null,
  "latency_ms": 2100.5
}
```

### 8. Final Response
**Stage Name**: `final_response`

**Captures**:
- Message ID (database)
- Original query (truncated)
- Final response (truncated)
- Bloom level
- Course ID
- Number of citations
- Total pipeline latency

**Example**:
```json
{
  "timestamp": "2024-01-15T10:30:47.890123Z",
  "stage": "final_response",
  "trace_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message_id": 12345,
  "query": "Explain machine learning algorithms",
  "response": "Machine learning algorithms are computational methods...",
  "bloom_level": "understand",
  "course_id": "CS101",
  "num_citations": 3,
  "total_latency_ms": 2543.8
}
```

### 9. Error Logging
**Stage Name**: `error`

**Captures**:
- Stage where error occurred
- Error message
- Error type/class name

**Example**:
```json
{
  "timestamp": "2024-01-15T10:30:45.123456Z",
  "stage": "error",
  "trace_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "error_stage": "rag_engine",
  "error_message": "Vector store connection failed",
  "error_type": "ConnectionError"
}
```

## Usage

### Initialization

The logger is automatically initialized in `main.py`:

```python
from app.services.logging.pipeline_logger import PipelineLogger

# Initialize logger
pipeline_logger = PipelineLogger(log_dir="logs")

# Store in app state
app.state.pipeline_logger = pipeline_logger

# Start background writer on startup
@app.on_event("startup")
async def startup_event():
    await app.state.pipeline_logger.start()

# Stop background writer on shutdown
@app.on_event("shutdown")
async def shutdown_event():
    await app.state.pipeline_logger.stop()
```

### Integration in Pipeline

The logger is integrated into `run_ai_pipeline` with minimal changes:

```python
async def run_ai_pipeline(...):
    # Get logger from app state
    pipeline_logger = getattr(req.app.state, "pipeline_logger", None)
    
    # Generate trace ID
    trace_id = pipeline_logger.generate_trace_id() if pipeline_logger else None
    
    # Log input
    if pipeline_logger:
        pipeline_logger.log_input(
            query=user_query,
            user_id=user_id,
            session_id=session_id,
            course_id=course_id,
            trace_id=trace_id,
        )
    
    # ... pipeline stages with logging ...
    
    # Log final response
    if pipeline_logger:
        pipeline_logger.log_final_response(...)
```

### Timing Stages

Use the `StageTimer` context manager to measure latency:

```python
from app.services.logging.pipeline_logger import StageTimer

with StageTimer() as timer:
    result = some_expensive_operation()

# Get latency in milliseconds
latency_ms = timer.latency_ms
```

## Log File Format

### Location
```
logs/pipeline_logs.jsonl
```

### Format
- **JSONL** (JSON Lines): One JSON object per line
- Each line is a complete, valid JSON object
- Easy to parse with standard tools

### Example Log File
```jsonl
{"timestamp": "2024-01-15T10:30:45.123456Z", "stage": "input", "trace_id": "abc123", ...}
{"timestamp": "2024-01-15T10:30:45.234567Z", "stage": "icl_confidence", "trace_id": "abc123", ...}
{"timestamp": "2024-01-15T10:30:45.345678Z", "stage": "bloom_detector", "trace_id": "abc123", ...}
```

## Analysis & Querying

### Using Python

```python
import json

# Read all logs
with open("logs/pipeline_logs.jsonl", "r") as f:
    logs = [json.loads(line) for line in f]

# Filter by trace ID
trace_logs = [log for log in logs if log.get("trace_id") == "abc123"]

# Calculate average latency by stage
from collections import defaultdict
latencies = defaultdict(list)
for log in logs:
    if "latency_ms" in log:
        latencies[log["stage"]].append(log["latency_ms"])

avg_latencies = {
    stage: sum(times) / len(times)
    for stage, times in latencies.items()
}
```

### Using jq (Command Line)

```bash
# Get all logs for a specific trace ID
cat logs/pipeline_logs.jsonl | jq 'select(.trace_id == "abc123")'

# Calculate average RAG latency
cat logs/pipeline_logs.jsonl | jq -s '
  [.[] | select(.stage == "rag_engine") | .latency_ms] |
  add / length
'

# Count queries by course
cat logs/pipeline_logs.jsonl | jq -s '
  [.[] | select(.stage == "input") | .course_id] |
  group_by(.) | map({course: .[0], count: length})
'

# Find slow queries (>3 seconds total latency)
cat logs/pipeline_logs.jsonl | jq '
  select(.stage == "final_response" and .total_latency_ms > 3000)
'
```

## Performance Considerations

### Latency Impact

- **Synchronous overhead**: ~0.1ms per log call (queue insertion)
- **Async overhead**: Negligible (background writer)
- **Total impact**: <1% of pipeline latency

### Memory Usage

- **Queue size**: Configurable (default: 1000 entries)
- **Per-entry size**: ~1-5 KB (after truncation)
- **Total memory**: <5 MB under normal load

### Disk Usage

- **Per-request logs**: ~10-20 KB (all stages)
- **Daily volume** (1000 requests): ~10-20 MB
- **Monthly volume**: ~300-600 MB

### Recommendations

1. **Log rotation**: Implement daily/weekly log rotation
2. **Archival**: Move old logs to cold storage
3. **Monitoring**: Alert on queue full events
4. **Analysis**: Regularly analyze logs for performance insights

## Truncation Limits

To prevent log bloat, content is automatically truncated:

| Content Type | Max Length | Truncation Marker |
|--------------|------------|-------------------|
| Query | 1000 chars | "..." |
| Prompt | 5000 chars | "..." |
| Response | 5000 chars | "..." |
| Chunk Preview | 500 chars | "..." |
| Memory Context | 1000 chars | "..." |

## Security & Privacy

### Sensitive Data Handling

- **Memory context**: Truncated to prevent full conversation exposure
- **User queries**: Logged for debugging (consider PII implications)
- **Responses**: Logged for evaluation (consider content sensitivity)

### Recommendations

1. **Access control**: Restrict log file access to authorized personnel
2. **Retention policy**: Define log retention periods
3. **Anonymization**: Consider anonymizing user IDs in production
4. **Compliance**: Ensure logging complies with data protection regulations

## Troubleshooting

### Logs not appearing

**Cause**: Background writer not started

**Solution**: Ensure startup event is called:
```python
await app.state.pipeline_logger.start()
```

### Queue full warnings

**Cause**: High request volume or slow disk writes

**Solution**: Increase queue size or optimize disk I/O:
```python
pipeline_logger = PipelineLogger(max_queue_size=5000)
```

### Large log files

**Cause**: High request volume or insufficient truncation

**Solution**: Implement log rotation:
```bash
# Rotate logs daily
mv logs/pipeline_logs.jsonl logs/pipeline_logs_$(date +%Y%m%d).jsonl
```

## Future Enhancements

Potential improvements:

1. **Database backend**: Store logs in PostgreSQL for advanced querying
2. **Real-time monitoring**: Stream logs to monitoring dashboard
3. **Aggregation**: Pre-compute metrics (avg latency, error rates)
4. **Sampling**: Log only a percentage of requests in production
5. **Compression**: Compress old logs to save disk space
6. **Alerting**: Trigger alerts on anomalies (high latency, errors)

## Summary

The Pipeline Logger provides:

✅ **Comprehensive observability** - All pipeline stages logged  
✅ **Non-intrusive** - Zero impact on business logic  
✅ **Non-blocking** - Async queue prevents latency impact  
✅ **Structured** - JSON format for easy analysis  
✅ **Thread-safe** - Safe for async + thread pool use  
✅ **Production-ready** - Robust error handling and truncation  
✅ **Trace support** - Request tracking via trace IDs  
✅ **Performance-conscious** - Minimal overhead (<1%)
