# Intelligent Confidence Layer (ICL) - Integration Guide

## Overview

The Intelligent Confidence Layer (ICL) is a non-breaking, modular component that computes confidence scores for three pipeline components:

- **bloom_detector** - Bloom's taxonomy level detection
- **competency_mapper** - CBC (Competency-Based Curriculum) mapping
- **rag_engine** - Retrieval-Augmented Generation

## Architecture

### Hybrid Scoring Approach

ICL uses a weighted fusion of two scoring methods:

1. **LLM-based scoring (PRIMARY)** - α = 0.85
   - Uses existing Phi-mini model via llama.cpp
   - Deterministic settings (temperature=0.0, top_p=1.0, top_k=1)
   - Per-call parameter overrides via `generate_with_overrides()` method
   - Returns structured JSON with confidence scores

2. **Heuristic scoring (SECONDARY)** - (1-α) = 0.15
   - Lightweight keyword-based scoring
   - Fast fallback when LLM fails
   - Low influence on final scores

### Final Score Calculation

```python
final_score = 0.85 * llm_score + 0.15 * heuristic_score
```

## Integration Points

### 1. Pipeline Gating

ICL scores gate the execution of expensive pipeline components:

```python
# Confidence thresholds
BLOOM_THRESHOLD = 0.4
CBC_THRESHOLD = 0.5
RAG_THRESHOLD = 0.6

# Gated execution
if scores["bloom_conf"] > BLOOM_THRESHOLD:
    bloom_level = bloom_detector.detect(query)
else:
    bloom_level = "understand"  # default

if scores["cbc_conf"] > CBC_THRESHOLD:
    competency = competency_mapper.map(query)
else:
    competency = None

if scores["rag_conf"] > RAG_THRESHOLD:
    context = rag_engine.retrieve_bundle(query, course_id)
else:
    context = []
```

### 2. Non-Breaking Design

- **No modifications** to existing components (bloom_detector, competency_mapper, rag_engine)
- **No global config changes** - LLM parameters overridden per-call via `generate_with_overrides()`
- **Thread-safe** - No shared state mutation during parameter overrides
- **Graceful fallback** - Uses heuristics if LLM fails
- **Async-compatible** - Integrates with existing async pipeline

## Usage

### Basic Usage

```python
from app.services.intelligent_confidence_layer import IntelligentConfidenceLayer

# Initialize with existing LLM client
icl = IntelligentConfidenceLayer(llm_client)

# Compute confidence scores
scores = await icl.compute(user_query)

# scores = {
#     "bloom_conf": 0.75,
#     "cbc_conf": 0.62,
#     "rag_conf": 0.88
# }
```

### Integration in Pipeline

The ICL is integrated into `run_ai_pipeline` in `/backend/app/routes/ai_query.py`:

```python
async def run_ai_pipeline(...):
    # ... existing setup ...
    
    # Compute confidence scores
    icl = IntelligentConfidenceLayer(llm_client)
    confidence_scores = await icl.compute(user_query)
    
    # Gate bloom detection
    if confidence_scores["bloom_conf"] > BLOOM_THRESHOLD:
        bloom_level = bloom_detector.detect(user_query)
    else:
        bloom_level = "understand"
    
    # Gate competency mapping
    if confidence_scores["cbc_conf"] > CBC_THRESHOLD:
        competency = competency_mapper.map(user_query)
    else:
        competency = None
    
    # Gate RAG retrieval
    if confidence_scores["rag_conf"] > RAG_THRESHOLD:
        retrieved_context = rag_engine.retrieve_bundle(user_query, course_id)
        # ... process context ...
    else:
        context_chunks = []
        citations = []
    
    # ... continue with prompt building and generation ...
```

## Heuristic Scoring Logic

The heuristic function provides fast, keyword-based scoring:

```python
def _heuristic_scores(query: str) -> dict[str, float]:
    q = query.lower()
    words = q.split()
    
    # Bloom: cognitive task indicators
    bloom_keywords = ["explain", "define", "analyze", "why", "how", "compare", "evaluate", "create"]
    bloom_conf = 0.7 if any(w in q for w in bloom_keywords) else 0.2
    
    # CBC: curriculum/problem-solving indicators
    cbc_keywords = ["solve", "calculate", "derive", "prove", "compute", "formula"]
    cbc_conf = 0.6 if any(w in q for w in cbc_keywords) else 0.3
    
    # RAG: longer queries likely need context
    rag_conf = 0.8 if len(words) > 8 else 0.3
    
    return {
        "bloom_conf": bloom_conf,
        "cbc_conf": cbc_conf,
        "rag_conf": rag_conf,
    }
```

## LLM Prompt Template

The ICL uses a deterministic prompt for scoring:

```text
You are a scoring engine for an AI education system.

Given a user query, return confidence scores (0 to 1) for whether the following modules should run:

1. bloom_detector → Does the query express a cognitive learning task?
2. cbc_mapper → Is the query aligned with a structured curriculum outcome?
3. rag_engine → Does the query require external course-specific documents?

Scoring rules:
- Be strict. Use 0.0 for irrelevant.
- Use high values (>0.7) only when clearly needed.
- Prefer lower scores when uncertain.

Return ONLY valid JSON in this format:
{
  "bloom_conf": float,
  "cbc_conf": float,
  "rag_conf": float
}

Query:
"{query}"
```

## Error Handling & Fallback

ICL implements robust error handling:

1. **LLM call fails** → Use heuristic scores only
2. **JSON parsing fails** → Use heuristic scores only
3. **Validation fails** → Use heuristic scores only
4. **Any exception** → Use heuristic scores only

This ensures the pipeline never breaks due to ICL failures.

## Performance Considerations

### Latency Impact

- **LLM call**: ~100-200ms (with max_tokens=120)
- **Heuristic scoring**: <1ms
- **Total overhead**: ~100-200ms per query

### Optimization Strategies

1. **Small token budget** - max_tokens=120 keeps LLM calls fast
2. **Deterministic settings** - temperature=0.0 for consistent, fast inference
3. **Async execution** - Non-blocking integration with existing async pipeline
4. **Graceful degradation** - Fast heuristic fallback on any failure

## Testing

Run unit tests:

```bash
cd backend
pytest app/tests/test_intelligent_confidence_layer.py -v
```

Test coverage includes:
- Valid LLM responses
- LLM failure fallback
- Heuristic scoring logic
- JSON parsing (pure JSON, markdown-wrapped, with surrounding text)
- Score validation
- Score fusion
- Edge cases

## Monitoring & Logging

ICL logs key events:

```python
# Successful scoring
logger.info("ICL scores computed", extra={
    "query_preview": query[:50],
    "llm_scores": {...},
    "heuristic_scores": {...},
    "final_scores": {...}
})

# Fallback to heuristics
logger.warning("ICL fallback to heuristics only", extra={
    "query_preview": query[:50],
    "heuristic_scores": {...}
})

# LLM errors
logger.error("ICL: LLM scoring failed: {error}", exc_info=True)
```

## Configuration

### Thresholds

Adjust gating thresholds in `/backend/app/routes/ai_query.py`:

```python
BLOOM_THRESHOLD = 0.4  # Lower = more bloom detection runs
CBC_THRESHOLD = 0.5    # Lower = more competency mapping runs
RAG_THRESHOLD = 0.6    # Lower = more RAG retrieval runs
```

### Fusion Weight

Adjust LLM vs heuristic weight in `IntelligentConfidenceLayer`:

```python
ALPHA = 0.85  # Higher = more LLM influence (0.0 to 1.0)
```

## Future Enhancements

Potential improvements:

1. **Caching** - Cache scores for repeated queries
2. **Batch scoring** - Score multiple queries in parallel
3. **Adaptive thresholds** - Learn optimal thresholds from usage patterns
4. **Fine-tuned model** - Train specialized model for confidence scoring
5. **Multi-model ensemble** - Combine multiple LLM predictions

## Troubleshooting

### ICL always falls back to heuristics

**Cause**: LLM client not returning valid JSON

**Solution**: Check LLM client configuration and model compatibility

### Scores seem incorrect

**Cause**: Heuristic keywords may not match query patterns

**Solution**: Adjust heuristic keywords in `_heuristic_scores()`

### Pipeline latency increased

**Cause**: LLM calls taking too long

**Solution**: Reduce `max_tokens` or adjust thresholds to skip ICL for simple queries

## Summary

The Intelligent Confidence Layer provides:

✅ **Non-breaking integration** - No changes to existing components  
✅ **Graceful degradation** - Heuristic fallback on any failure  
✅ **Modular design** - Easy to enable/disable or replace  
✅ **Production-ready** - Robust error handling and logging  
✅ **Performance-conscious** - Minimal latency overhead  
✅ **Well-tested** - Comprehensive unit test coverage
