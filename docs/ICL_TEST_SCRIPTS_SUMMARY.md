# ICL Test Scripts - Implementation Summary

## Overview

Created standalone test scripts for testing the Intelligent Confidence Layer (ICL) with the LLM subclient in isolation, allowing developers to test confidence scoring without running the full AI pipeline.

## Files Created

### 1. `scripts/test_icl_simple.py` (Interactive Quick Test)
**Purpose**: Quick, user-friendly testing with visual feedback

**Features**:
- Interactive mode: Type queries and see results immediately
- Batch mode: Test 8 predefined queries
- Visual score bars (█████░░░░░)
- Clear gating decisions (✓/✗)
- Minimal, readable output
- ~200 lines of code

**Usage**:
```bash
# Interactive mode
python scripts/test_icl_simple.py

# Batch mode
python scripts/test_icl_simple.py --batch
```

**Output Example**:
```
> Explain machine learning

Bloom Detector:  ████████████████░░░░ 0.812 ✓ (threshold: 0.4)
CBC Mapper:      ████████░░░░░░░░░░░░ 0.423 ✗ (threshold: 0.5)
RAG Engine:      ██████████████░░░░░░ 0.734 ✓ (threshold: 0.6)

Latency: 145ms
Will run: Bloom, RAG
```

### 2. `scripts/test_icl_confidence.py` (Comprehensive Test)
**Purpose**: Detailed analysis and debugging

**Features**:
- Single query testing with full details
- Multiple query batch testing
- Verbose mode with heuristic comparison
- JSON output for programmatic use
- Keyword analysis
- Score breakdown and fusion details
- ~350 lines of code

**Usage**:
```bash
# Basic test
python scripts/test_icl_confidence.py

# Custom query
python scripts/test_icl_confidence.py --query "Explain neural networks"

# Verbose mode
python scripts/test_icl_confidence.py --query "Solve x^2 + 5x + 6 = 0" --verbose

# Batch test
python scripts/test_icl_confidence.py --batch
```

**Output Example**:
```
================================================================================
  ICL Confidence Scoring Test
================================================================================

Query: "Explain machine learning algorithms"

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

### 3. `scripts/README_ICL_TESTS.md` (Documentation)
**Purpose**: Complete guide for using the test scripts

**Contents**:
- Script descriptions and features
- Usage examples for all modes
- Output interpretation guide
- Test query examples
- Troubleshooting section
- Integration notes

## Key Features

### ✅ Standalone Testing
- No need to run full pipeline
- No database required
- No authentication needed
- Direct LLM subclient + ICL testing

### ✅ Multiple Testing Modes

**Interactive Mode** (test_icl_simple.py):
- Type queries and get instant feedback
- Perfect for experimentation
- Visual score bars
- Easy to understand output

**Batch Mode** (both scripts):
- Test multiple queries at once
- Compare results across queries
- Calculate average scores and latency

**Verbose Mode** (test_icl_confidence.py):
- Detailed heuristic scores
- Keyword analysis
- Score fusion breakdown
- Query characteristics

### ✅ Developer-Friendly

**Visual Feedback**:
```
Bloom Detector:  ████████████████░░░░ 0.812 ✓
```

**Clear Gating Decisions**:
```
✓ RUN  - Component will execute
✗ SKIP - Component will be gated
```

**JSON Output**:
```json
{
  "query": "...",
  "scores": {...},
  "gating": {...},
  "latency_ms": 145.32
}
```

## Use Cases

### 1. Development & Debugging
```bash
# Test a specific query
python scripts/test_icl_confidence.py --query "Your query here" --verbose
```

### 2. Quick Experimentation
```bash
# Interactive mode
python scripts/test_icl_simple.py
> Try different queries...
```

### 3. Performance Testing
```bash
# Batch test to measure average latency
python scripts/test_icl_confidence.py --batch
```

### 4. Threshold Tuning
```bash
# Test queries and adjust thresholds based on results
python scripts/test_icl_simple.py --batch
```

### 5. Integration Verification
```bash
# Verify ICL works correctly before pipeline integration
python scripts/test_icl_confidence.py --batch --verbose
```

## Test Query Categories

### High Bloom (Cognitive Tasks)
- "Explain how neural networks learn"
- "Compare supervised and unsupervised learning"
- "Analyze the time complexity of quicksort"

### High CBC (Curriculum Tasks)
- "Solve x^2 + 5x + 6 = 0"
- "Calculate the derivative of x^3"
- "Derive the quadratic formula"

### High RAG (Context-Dependent)
- "Explain machine learning algorithms" (long, detailed)
- "Compare different sorting algorithms" (needs examples)

### Low All (Simple Queries)
- "Hi"
- "What is 2+2?"
- "Hello"

## Output Interpretation

### Confidence Scores (0.0 - 1.0)

**Bloom Confidence**:
- >0.7: Strong cognitive task (explain, analyze, compare)
- 0.4-0.7: Some cognitive elements
- <0.4: Simple factual query

**CBC Confidence**:
- >0.7: Clear curriculum task (solve, calculate, derive)
- 0.5-0.7: Some curriculum elements
- <0.5: General knowledge

**RAG Confidence**:
- >0.7: Needs detailed course context
- 0.6-0.7: May benefit from context
- <0.6: General knowledge sufficient

### Gating Thresholds

- **Bloom**: 0.4 (run if score > 0.4)
- **CBC**: 0.5 (run if score > 0.5)
- **RAG**: 0.6 (run if score > 0.6)

## Performance Expectations

- **Typical latency**: 100-200ms
- **First query**: May be slower (model loading)
- **Subsequent queries**: Faster (~100-150ms)
- **Batch average**: ~120-180ms per query

## Integration with Pipeline

These scripts use the **exact same components** as the production pipeline:
- Same `LLMSubclient` instance
- Same `IntelligentConfidenceLayer` implementation
- Same thresholds and scoring logic
- Same LLM parameters (temperature=0.0, etc.)

**Results should match pipeline logs exactly.**

## Benefits

✅ **Rapid Testing**: Test ICL without full pipeline overhead  
✅ **Debugging**: Isolate ICL behavior from other components  
✅ **Experimentation**: Try different queries quickly  
✅ **Verification**: Confirm ICL works before integration  
✅ **Performance Analysis**: Measure ICL latency in isolation  
✅ **Threshold Tuning**: Test different queries to optimize thresholds  
✅ **Documentation**: Visual examples for understanding ICL behavior

## Quick Start

### Test a Single Query
```bash
cd backend
python scripts/test_icl_simple.py
> Explain machine learning
```

### Test Multiple Queries
```bash
python scripts/test_icl_simple.py --batch
```

### Detailed Analysis
```bash
python scripts/test_icl_confidence.py --query "Your query" --verbose
```

## Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| `test_icl_simple.py` | ~200 | Interactive quick testing |
| `test_icl_confidence.py` | ~350 | Comprehensive analysis |
| `README_ICL_TESTS.md` | ~300 | Documentation |

**Total**: ~850 lines of testing infrastructure

## See Also

- [ICL Documentation](../docs/INTELLIGENT_CONFIDENCE_LAYER.md)
- [LLM Subclient Overrides](../docs/LLM_SUBCLIENT_OVERRIDES.md)
- [ICL Test Suite](../app/tests/test_intelligent_confidence_layer.py)
