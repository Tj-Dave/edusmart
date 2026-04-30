#!/usr/bin/env python3
"""
Standalone test script for ICL confidence scoring.

Tests the Intelligent Confidence Layer (ICL) with the LLM subclient
to verify confidence score generation for a given query.

Usage:
    python test_icl_confidence.py
    python test_icl_confidence.py --query "Explain machine learning"
    python test_icl_confidence.py --query "Solve x^2 + 5x + 6 = 0" --verbose
"""

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.llm.llama_cpp_subclient import LLMSubclient
from app.services.intelligent_confidence_layer import IntelligentConfidenceLayer


def print_header(text: str):
    """Print formatted header."""
    print(f"\n{'='*80}")
    print(f"  {text}")
    print(f"{'='*80}\n")


def print_section(text: str):
    """Print formatted section."""
    print(f"\n--- {text} ---\n")


async def test_confidence_scoring(query: str, verbose: bool = False):
    """
    Test ICL confidence scoring for a given query.
    
    Args:
        query: User query to test
        verbose: Whether to print detailed output
    """
    print_header("ICL Confidence Scoring Test")
    
    print(f"Query: \"{query}\"\n")
    
    # Initialize LLM subclient
    print("Initializing LLM subclient...")
    try:
        llm_subclient = LLMSubclient()
        print("✓ LLM subclient initialized successfully\n")
    except Exception as e:
        print(f"✗ Failed to initialize LLM subclient: {e}")
        return
    
    # Initialize ICL
    print("Initializing Intelligent Confidence Layer...")
    try:
        icl = IntelligentConfidenceLayer(llm_subclient)
        print("✓ ICL initialized successfully\n")
    except Exception as e:
        print(f"✗ Failed to initialize ICL: {e}")
        return
    
    # Compute confidence scores
    print_section("Computing Confidence Scores")
    
    start_time = time.perf_counter()
    
    try:
        scores, raw_llm_output = await icl.compute(query, return_raw_llm=True)
        end_time = time.perf_counter()
        latency_ms = (end_time - start_time) * 1000
        print("✓ Confidence scores computed successfully\n")
        # Display results
        print_section("Results")
        print(f"Bloom Confidence:      {scores['bloom_conf']:.3f}")
        print(f"CBC Confidence:        {scores['cbc_conf']:.3f}")
        print(f"RAG Confidence:        {scores['rag_conf']:.3f}")
        print(f"\nComputation Time:      {latency_ms:.2f}ms")
        # Gating decisions
        print_section("Gating Decisions")
        BLOOM_THRESHOLD = 0.4
        CBC_THRESHOLD = 0.5
        RAG_THRESHOLD = 0.6
        bloom_gate = scores['bloom_conf'] > BLOOM_THRESHOLD
        cbc_gate = scores['cbc_conf'] > CBC_THRESHOLD
        rag_gate = scores['rag_conf'] > RAG_THRESHOLD
        print(f"Bloom Detector:        {'✓ RUN' if bloom_gate else '✗ SKIP'} (threshold: {BLOOM_THRESHOLD})")
        print(f"CBC Mapper:            {'✓ RUN' if cbc_gate else '✗ SKIP'} (threshold: {CBC_THRESHOLD})")
        print(f"RAG Engine:            {'✓ RUN' if rag_gate else '✗ SKIP'} (threshold: {RAG_THRESHOLD})")
        # Show raw LLM output
        print_section("Raw LLM Output")
        if raw_llm_output is not None:
            print(raw_llm_output)
        else:
            print("(No LLM output or fallback to heuristics)")
        # Verbose output
        if verbose:
            print_section("Detailed Analysis")
            heuristic_scores = icl._heuristic_scores(query)
            print("Heuristic Scores (for comparison):")
            print(f"  Bloom: {heuristic_scores['bloom_conf']:.3f}")
            print(f"  CBC:   {heuristic_scores['cbc_conf']:.3f}")
            print(f"  RAG:   {heuristic_scores['rag_conf']:.3f}")
            print("\nScore Breakdown:")
            print(f"  Alpha (LLM weight):     {icl.ALPHA}")
            print(f"  1-Alpha (Heuristic):    {1 - icl.ALPHA}")
            print("\nQuery Analysis:")
            print(f"  Length: {len(query)} characters")
            print(f"  Words:  {len(query.split())} words")
            q_lower = query.lower()
            bloom_keywords = ["explain", "define", "analyze", "why", "how", "compare", "evaluate", "create"]
            cbc_keywords = ["solve", "calculate", "derive", "prove", "compute", "formula"]
            found_bloom = [kw for kw in bloom_keywords if kw in q_lower]
            found_cbc = [kw for kw in cbc_keywords if kw in q_lower]
            if found_bloom:
                print(f"  Bloom keywords found: {', '.join(found_bloom)}")
            if found_cbc:
                print(f"  CBC keywords found: {', '.join(found_cbc)}")
        # JSON output
        print_section("JSON Output")
        output = {
            "query": query,
            "scores": {
                "bloom_conf": scores['bloom_conf'],
                "cbc_conf": scores['cbc_conf'],
                "rag_conf": scores['rag_conf'],
            },
            "gating": {
                "bloom_detector": bloom_gate,
                "cbc_mapper": cbc_gate,
                "rag_engine": rag_gate,
            },
            "latency_ms": latency_ms,
        }
        print(json.dumps(output, indent=2))
        print_header("Test Completed Successfully")
    except Exception as e:
        print(f"✗ Error computing confidence scores: {e}")
        if verbose:
            import traceback
            print("\nTraceback:")
            traceback.print_exc()


async def test_multiple_queries(queries: list[str], verbose: bool = False):
    """
    Test ICL confidence scoring for multiple queries.
    
    Args:
        queries: List of queries to test
        verbose: Whether to print detailed output
    """
    print_header("ICL Confidence Scoring - Multiple Queries Test")
    
    # Initialize components once
    print("Initializing components...")
    try:
        llm_subclient = LLMSubclient()
        icl = IntelligentConfidenceLayer(llm_subclient)
        print("✓ Components initialized\n")
    except Exception as e:
        print(f"✗ Initialization failed: {e}")
        return
    
    results = []
    
    for i, query in enumerate(queries, 1):
        print(f"\n[{i}/{len(queries)}] Testing: \"{query[:60]}{'...' if len(query) > 60 else ''}\"")
        
        try:
            start_time = time.perf_counter()
            scores, raw_llm_output = await icl.compute(query, return_raw_llm=True)
            latency_ms = (time.perf_counter() - start_time) * 1000
            
            results.append({
                "query": query,
                "scores": scores,
                "latency_ms": latency_ms,
                "raw_llm_output": raw_llm_output,
            })
            
            print(f"  Bloom: {scores['bloom_conf']:.3f} | CBC: {scores['cbc_conf']:.3f} | RAG: {scores['rag_conf']:.3f} | {latency_ms:.0f}ms")
            
            if verbose and raw_llm_output:
                print(f"  Raw LLM: {raw_llm_output[:80]}{'...' if len(raw_llm_output) > 80 else ''}")
            
        except Exception as e:
            print(f"  ✗ Error: {e}")
            results.append({
                "query": query,
                "error": str(e),
            })
    
    # Summary
    print_section("Summary")
    
    successful = [r for r in results if "scores" in r]
    failed = [r for r in results if "error" in r]
    
    print(f"Total queries:     {len(queries)}")
    print(f"Successful:        {len(successful)}")
    print(f"Failed:            {len(failed)}")
    
    if successful:
        avg_latency = sum(r["latency_ms"] for r in successful) / len(successful)
        print(f"Avg latency:       {avg_latency:.2f}ms")
        
        # Average scores
        avg_bloom = sum(r["scores"]["bloom_conf"] for r in successful) / len(successful)
        avg_cbc = sum(r["scores"]["cbc_conf"] for r in successful) / len(successful)
        avg_rag = sum(r["scores"]["rag_conf"] for r in successful) / len(successful)
        
        print(f"\nAverage Scores:")
        print(f"  Bloom: {avg_bloom:.3f}")
        print(f"  CBC:   {avg_cbc:.3f}")
        print(f"  RAG:   {avg_rag:.3f}")
    
    if verbose and successful:
        print_section("Detailed Results")
        for i, result in enumerate(successful, 1):
            print(f"\n[{i}] Query: {result['query'][:60]}...")
            print(f"    Scores: Bloom={result['scores']['bloom_conf']:.3f}, CBC={result['scores']['cbc_conf']:.3f}, RAG={result['scores']['rag_conf']:.3f}")
            print(f"    Latency: {result['latency_ms']:.2f}ms")
            if result.get('raw_llm_output'):
                print(f"    Raw LLM Output: {result['raw_llm_output']}")


def main():
    parser = argparse.ArgumentParser(
        description="Test ICL confidence scoring with LLM subclient",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test with default query
  python test_icl_confidence.py
  
  # Test with custom query
  python test_icl_confidence.py --query "Explain neural networks"
  
  # Test with verbose output
  python test_icl_confidence.py --query "Solve x^2 + 5x + 6 = 0" --verbose
  
  # Test multiple predefined queries
  python test_icl_confidence.py --batch
        """
    )
    
    parser.add_argument(
        "--query",
        type=str,
        help="Query to test (default: 'Explain machine learning algorithms')"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print detailed output including heuristic scores and analysis"
    )
    
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Test multiple predefined queries"
    )
    
    args = parser.parse_args()
    
    if args.batch:
        # Predefined test queries
        test_queries = [
            "Explain machine learning algorithms",
            "What is the capital of France?",
            "Solve the quadratic equation x^2 + 5x + 6 = 0",
            "Define photosynthesis",
            "How do neural networks work?",
            "Calculate the derivative of x^3 + 2x^2 - 5x + 1",
            "Why is the sky blue?",
            "Compare supervised and unsupervised learning",
            "What is recursion in programming?",
            "Analyze the causes of World War II",
        ]
        
        asyncio.run(test_multiple_queries(test_queries, args.verbose))
    else:
        # Single query test
        query = args.query or "Explain machine learning algorithms"
        asyncio.run(test_confidence_scoring(query, args.verbose))


if __name__ == "__main__":
    main()
