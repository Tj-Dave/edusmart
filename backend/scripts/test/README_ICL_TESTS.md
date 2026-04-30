# ICL Confidence Scoring Test Scripts

## Overview

Standalone test scripts for testing the Intelligent Confidence Layer (ICL) with the LLM subclient in isolation, without running the full pipeline.

## Scripts

### 1. `test_icl_simple.py` - Interactive Quick Test

**Best for**: Quick testing and experimentation

**Features**:
- Interactive mode: Enter queries and see results immediately
- Batch mode: Test predefined queries
- Visual score bars
- Gating decisions displayed
- Minimal output, easy to read

**Usage**:

```bash
# Interactive mode (default)
cd backend
python scripts/test_icl_simple.py

# Batch mode (test predefined queries)
python scripts/test_icl_simple.py --batch
```

**Interactive Example**:
```
> Explain machine learning

Query: Explain machine learning
--------------------------------------------------------------------------------

Bloom Detector:  ████████████████░░░░ 0.812 ✓ (threshold: 0.4)
CBC Mapper:      ████████░░░░░░░░░░░░ 0.423 ✗ (threshold: 0.5)
RAG Engine:      ██████████████░░░░░░ 0.734 ✓ (threshold: 0.6)

Latency: 145ms
Will run: Bloom, RAG
```

### 2. `test_icl_confidence.py` - Comprehensive Test

**Best for**: Detailed analysis and debugging

**Features**:
- Single query testing with detailed output
- Multiple query batch testing
- Verbose mode with heuristic comparison
- JSON output for programmatic use
- Keyword analysis
- Score breakdown

**Usage**:

```bash
cd backend

# Test with default query
python scripts/test_icl_confidence.py

# Test with custom query
python scripts/test_icl_confidence.py --query "Explain neural networks"

# Test with verbose output
python scripts/test_icl_confidence.py --query "Solve x^2 + 5x + 6 = 0" --verbose

# Test multiple predefined queries
python scripts/test_icl_confidence.py --batch

# Test with verbose batch mode
python scripts/test_icl_confidence.py --batch --verbose
```

**Example Output**:

```
================================================================================
  ICL Confidence Scoring Test
================================================================================

Query: "Explain machine learning algorithms"

Initializing LLM subclient...
✓ LLM subclient initialized successfully

Initializing Intelligent Confidence Layer...
✓ ICL initialized successfully

--- Computing Confidence Scores ---

✓ Confidence scores computed successfully

--- Results ---

Bloom Confidence:      0.812
CBC Confidence:        0.423
RAG Confidence:        0.734

Computation Time:      145.32ms

--- Gating Decisions ---

Bloom Detector:        ✓ RUN (threshold: 0.4)
CBC Mapper:            ✗ SKIP (threshold: 0.5)
RAG Engine:            ✓ RUN (threshold: 0.6)

--- JSON Output ---

{
  "query": "Explain machine learning algorithms",
  "scores": {
    "bloom_conf": 0.812,
    "cbc_conf": 0.423,
    "rag_conf": 0.734
  },
  "gating": {
    "bloom_detector": true,
    "cbc_mapper": false,
    "rag_engine": true
  },
  "latency_ms": 145.32
}
```

## Understanding the Output

### Confidence Scores

Each score is a float between 0.0 and 1.0:

- **Bloom Confidence**: Likelihood that the query requires Bloom taxonomy analysis
  - High (>0.7): Clear cognitive learning task (explain, analyze, compare)
  - Medium (0.4-0.7): Some cognitive elements
  - Low (<0.4): Simple factual query

- **CBC Confidence**: Likelihood that the query aligns with curriculum competencies
  - High (>0.7): Clear curriculum-aligned task (solve, calculate, derive)
  - Medium (0.5-0.7): Some curriculum elements
  - Low (<0.5): General knowledge query

- **RAG Confidence**: Likelihood that the query needs course-specific documents
  - High (>0.7): Requires detailed context from course materials
  - Medium (0.6-0.7): May benefit from context
  - Low (<0.6): Can be answered from general knowledge

### Gating Decisions

Based on thresholds:
- **Bloom Detector**: Runs if score > 0.4
- **CBC Mapper**: Runs if score > 0.5
- **RAG Engine**: Runs if score > 0.6

✓ = Component will run  
✗ = Component will be skipped (gated)

### Latency

Time taken to compute confidence scores:
- Typical: 100-200ms
- Includes LLM call + heuristic computation + fusion

## Test Query Examples

### High Bloom, Low CBC, High RAG
```bash
python scripts/test_icl_simple.py
> Explain how neural networks learn from data
```

### Low Bloom, High CBC, Low RAG
```bash
python scripts/test_icl_simple.py
> Solve x^2 + 5x + 6 = 0
```

### High All
```bash
python scripts/test_icl_simple.py
> Compare supervised and unsupervised learning and explain when to use each
```

### Low All
```bash
python scripts/test_icl_simple.py
> Hi
```

## Verbose Mode Details

When using `--verbose` with `test_icl_confidence.py`, you get:

1. **Heuristic Scores**: Raw heuristic scores before fusion
2. **Score Breakdown**: Alpha weight and fusion formula
3. **Query Analysis**: Length, word count, keyword detection
4. **Keyword Matches**: Which bloom/CBC keywords were found

Example:
```bash
python scripts/test_icl_confidence.py --query "Explain neural networks" --verbose
```

## Troubleshooting

### Script fails to import modules

**Error**: `ModuleNotFoundError: No module named 'app'`

**Solution**: Run from the `backend` directory:
```bash
cd backend
python scripts/test_icl_confidence.py
```

### LLM subclient initialization fails

**Error**: `Failed to initialize LLM subclient`

**Solution**: Check that:
1. Model files exist in the configured path
2. `.env` file is properly configured
3. You have sufficient memory/resources

### Slow performance

**Issue**: Scores take >500ms to compute

**Possible causes**:
- CPU-only inference (expected)
- Large model loaded
- First query (model loading overhead)

**Note**: Subsequent queries should be faster (~100-200ms)

## Integration with Pipeline

These test scripts use the same components as the full pipeline:
- `LLMSubclient` - Same LLM client used in production
- `IntelligentConfidenceLayer` - Same ICL implementation
- Same thresholds and scoring logic

Results from these tests should match what you see in the full pipeline logs.

## See Also

- [ICL Documentation](../docs/INTELLIGENT_CONFIDENCE_LAYER.md)
- [LLM Subclient Overrides](../docs/LLM_SUBCLIENT_OVERRIDES.md)
- [Pipeline Logger](../docs/PIPELINE_LOGGER.md)
