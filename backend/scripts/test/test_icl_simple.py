#!/usr/bin/env python3
"""
Simple interactive ICL confidence scorer.

Quick test tool for trying different queries and seeing confidence scores.

Usage:
    python test_icl_simple.py
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.llm.llama_cpp_subclient import LLMSubclient
from app.services.intelligent_confidence_layer import IntelligentConfidenceLayer


async def score_query(icl: IntelligentConfidenceLayer, query: str):
    """Score a single query and display results."""
    print(f"\nQuery: {query}")
    print("-" * 80)
    
    try:
        import time
        start = time.perf_counter()
        scores, raw_llm_output = await icl.compute(query, return_raw_llm=True)
        latency = (time.perf_counter() - start) * 1000
        
        # Display scores with visual bars
        def score_bar(score: float, threshold: float) -> str:
            bar_length = 20
            filled = int(score * bar_length)
            bar = "█" * filled + "░" * (bar_length - filled)
            status = "✓" if score > threshold else "✗"
            return f"{bar} {score:.3f} {status}"
        
        print(f"\nBloom Detector:  {score_bar(scores['bloom_conf'], 0.4)} (threshold: 0.4)")
        print(f"CBC Mapper:      {score_bar(scores['cbc_conf'], 0.5)} (threshold: 0.5)")
        print(f"RAG Engine:      {score_bar(scores['rag_conf'], 0.6)} (threshold: 0.6)")
        
        print(f"\nLatency: {latency:.0f}ms")
        
        # Gating summary
        gates = []
        if scores['bloom_conf'] > 0.4:
            gates.append("Bloom")
        if scores['cbc_conf'] > 0.5:
            gates.append("CBC")
        if scores['rag_conf'] > 0.6:
            gates.append("RAG")
        
        if gates:
            print(f"Will run: {', '.join(gates)}")
        else:
            print("All components gated (skipped)")
        
        # Show raw LLM output
        print(f"\nRaw LLM Output:")
        if raw_llm_output:
            print(f"  {raw_llm_output}")
        else:
            print("  (No LLM output - fallback to heuristics)")
        
    except Exception as e:
        print(f"Error: {e}")


async def interactive_mode():
    """Run in interactive mode."""
    print("="*80)
    print("  ICL Confidence Scorer - Interactive Mode")
    print("="*80)
    print("\nInitializing...")
    
    try:
        llm_subclient = LLMSubclient()
        icl = IntelligentConfidenceLayer(llm_subclient)
        print("✓ Ready!\n")
    except Exception as e:
        print(f"✗ Initialization failed: {e}")
        return
    
    print("Enter queries to test (or 'quit' to exit)")
    print("Examples:")
    print("  - Explain machine learning")
    print("  - Solve x^2 + 5x + 6 = 0")
    print("  - What is photosynthesis?")
    print()
    
    while True:
        try:
            query = input("\n> ").strip()
            
            if not query:
                continue
            
            if query.lower() in ['quit', 'exit', 'q']:
                print("\nGoodbye!")
                break
            
            await score_query(icl, query)
            
        except KeyboardInterrupt:
            print("\n\nGoodbye!")
            break
        except EOFError:
            break


async def batch_mode():
    """Run predefined test queries."""
    print("="*80)
    print("  ICL Confidence Scorer - Batch Mode")
    print("="*80)
    print("\nInitializing...")
    
    try:
        llm_subclient = LLMSubclient()
        icl = IntelligentConfidenceLayer(llm_subclient)
        print("✓ Ready!\n")
    except Exception as e:
        print(f"✗ Initialization failed: {e}")
        return
    
    test_queries = [
        # High bloom, low CBC, high RAG
        "Explain how neural networks learn from data",
        
        # Low bloom, high CBC, low RAG
        "Solve x^2 + 5x + 6 = 0",
        
        # Medium all
        "What is machine learning?",
        
        # High bloom, medium CBC, high RAG
        "Compare supervised and unsupervised learning approaches",
        
        # Low bloom, low CBC, low RAG
        "Hi",
        
        # High bloom, low CBC, medium RAG
        "Why is the sky blue?",
        
        # Medium bloom, high CBC, medium RAG
        "Calculate the derivative of x^3 + 2x^2",
        
        # High bloom, medium CBC, high RAG
        "Analyze the time complexity of quicksort algorithm",
    ]
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n[{i}/{len(test_queries)}]")
        await score_query(icl, query)
        
        if i < len(test_queries):
            print("\n" + "─"*80)


def main():
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--batch":
        asyncio.run(batch_mode())
    else:
        asyncio.run(interactive_mode())


if __name__ == "__main__":
    main()
