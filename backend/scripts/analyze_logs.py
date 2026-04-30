#!/usr/bin/env python3
"""
Pipeline Log Analyzer

Utility script for analyzing pipeline logs and generating insights.

Usage:
    python analyze_logs.py --file logs/pipeline_logs.jsonl
    python analyze_logs.py --file logs/pipeline_logs.jsonl --trace abc123
    python analyze_logs.py --file logs/pipeline_logs.jsonl --stats
"""

import argparse
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any


def load_logs(log_file: Path) -> list[dict[str, Any]]:
    """Load logs from JSONL file."""
    logs = []
    with open(log_file, "r", encoding="utf-8") as f:
        for line in f:
            try:
                logs.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return logs


def filter_by_trace(logs: list[dict], trace_id: str) -> list[dict]:
    """Filter logs by trace ID."""
    return [log for log in logs if log.get("trace_id") == trace_id]


def calculate_stage_stats(logs: list[dict]) -> dict[str, dict]:
    """Calculate statistics by stage."""
    stage_latencies = defaultdict(list)
    stage_counts = defaultdict(int)
    
    for log in logs:
        stage = log.get("stage")
        if stage:
            stage_counts[stage] += 1
            if "latency_ms" in log:
                stage_latencies[stage].append(log["latency_ms"])
    
    stats = {}
    for stage in stage_counts:
        stats[stage] = {
            "count": stage_counts[stage],
        }
        
        if stage in stage_latencies and stage_latencies[stage]:
            latencies = stage_latencies[stage]
            stats[stage].update({
                "avg_latency_ms": sum(latencies) / len(latencies),
                "min_latency_ms": min(latencies),
                "max_latency_ms": max(latencies),
            })
    
    return stats


def find_slow_requests(logs: list[dict], threshold_ms: float = 3000) -> list[dict]:
    """Find requests with total latency above threshold."""
    slow_requests = []
    for log in logs:
        if log.get("stage") == "final_response":
            total_latency = log.get("total_latency_ms", 0)
            if total_latency > threshold_ms:
                slow_requests.append(log)
    return slow_requests


def find_errors(logs: list[dict]) -> list[dict]:
    """Find all error logs."""
    return [log for log in logs if log.get("stage") == "error"]


def analyze_confidence_scores(logs: list[dict]) -> dict[str, dict]:
    """Analyze ICL confidence scores."""
    bloom_scores = []
    cbc_scores = []
    rag_scores = []
    
    for log in logs:
        if log.get("stage") == "icl_confidence":
            if "bloom_conf" in log:
                bloom_scores.append(log["bloom_conf"])
            if "cbc_conf" in log:
                cbc_scores.append(log["cbc_conf"])
            if "rag_conf" in log:
                rag_scores.append(log["rag_conf"])
    
    def score_stats(scores):
        if not scores:
            return {}
        return {
            "avg": sum(scores) / len(scores),
            "min": min(scores),
            "max": max(scores),
            "count": len(scores),
        }
    
    return {
        "bloom": score_stats(bloom_scores),
        "cbc": score_stats(cbc_scores),
        "rag": score_stats(rag_scores),
    }


def analyze_gating(logs: list[dict]) -> dict[str, dict]:
    """Analyze how often components are gated."""
    gating_stats = defaultdict(lambda: {"total": 0, "gated": 0})
    
    for log in logs:
        stage = log.get("stage")
        if stage in ["bloom_detector", "cbc_mapper", "rag_engine"]:
            gating_stats[stage]["total"] += 1
            if log.get("gated"):
                gating_stats[stage]["gated"] += 1
    
    # Calculate percentages
    for stage in gating_stats:
        total = gating_stats[stage]["total"]
        gated = gating_stats[stage]["gated"]
        gating_stats[stage]["gated_pct"] = (gated / total * 100) if total > 0 else 0
    
    return dict(gating_stats)


def print_trace_timeline(logs: list[dict], trace_id: str):
    """Print timeline of events for a trace."""
    trace_logs = filter_by_trace(logs, trace_id)
    
    if not trace_logs:
        print(f"No logs found for trace ID: {trace_id}")
        return
    
    print(f"\n{'='*80}")
    print(f"Timeline for Trace ID: {trace_id}")
    print(f"{'='*80}\n")
    
    for log in trace_logs:
        timestamp = log.get("timestamp", "")
        stage = log.get("stage", "unknown")
        latency = log.get("latency_ms")
        
        print(f"[{timestamp}] {stage:20s}", end="")
        if latency is not None:
            print(f" ({latency:.2f}ms)", end="")
        print()
        
        # Print key details for each stage
        if stage == "input":
            print(f"  Query: {log.get('query', '')[:60]}...")
            print(f"  User: {log.get('user_id')}, Course: {log.get('course_id')}")
        
        elif stage == "icl_confidence":
            print(f"  Bloom: {log.get('bloom_conf'):.2f}, CBC: {log.get('cbc_conf'):.2f}, RAG: {log.get('rag_conf'):.2f}")
        
        elif stage == "bloom_detector":
            print(f"  Level: {log.get('bloom_level')}, Gated: {log.get('gated')}")
        
        elif stage == "cbc_mapper":
            print(f"  Competency: {log.get('competency')}, Gated: {log.get('gated')}")
        
        elif stage == "rag_engine":
            print(f"  Chunks: {log.get('num_chunks')}, Gated: {log.get('gated')}")
        
        elif stage == "llm_input":
            print(f"  Prompt length: {log.get('prompt_length')} chars")
        
        elif stage == "llm_output":
            print(f"  Response length: {log.get('response_length')} chars")
        
        elif stage == "final_response":
            print(f"  Total latency: {log.get('total_latency_ms'):.2f}ms")
            print(f"  Citations: {log.get('num_citations')}")
        
        elif stage == "error":
            print(f"  Error stage: {log.get('error_stage')}")
            print(f"  Error: {log.get('error_message')}")
        
        print()


def print_stats(logs: list[dict]):
    """Print comprehensive statistics."""
    print(f"\n{'='*80}")
    print("Pipeline Statistics")
    print(f"{'='*80}\n")
    
    print(f"Total log entries: {len(logs)}")
    
    # Stage statistics
    print("\n--- Stage Statistics ---")
    stage_stats = calculate_stage_stats(logs)
    for stage, stats in sorted(stage_stats.items()):
        print(f"\n{stage}:")
        print(f"  Count: {stats['count']}")
        if "avg_latency_ms" in stats:
            print(f"  Avg latency: {stats['avg_latency_ms']:.2f}ms")
            print(f"  Min latency: {stats['min_latency_ms']:.2f}ms")
            print(f"  Max latency: {stats['max_latency_ms']:.2f}ms")
    
    # Confidence scores
    print("\n--- Confidence Score Statistics ---")
    conf_stats = analyze_confidence_scores(logs)
    for component, stats in conf_stats.items():
        if stats:
            print(f"\n{component}:")
            print(f"  Avg: {stats['avg']:.3f}")
            print(f"  Min: {stats['min']:.3f}")
            print(f"  Max: {stats['max']:.3f}")
            print(f"  Count: {stats['count']}")
    
    # Gating statistics
    print("\n--- Gating Statistics ---")
    gating_stats = analyze_gating(logs)
    for stage, stats in gating_stats.items():
        print(f"\n{stage}:")
        print(f"  Total: {stats['total']}")
        print(f"  Gated: {stats['gated']} ({stats['gated_pct']:.1f}%)")
    
    # Slow requests
    print("\n--- Slow Requests (>3s) ---")
    slow_requests = find_slow_requests(logs)
    print(f"Count: {len(slow_requests)}")
    for req in slow_requests[:5]:  # Show top 5
        print(f"  Trace: {req.get('trace_id')}, Latency: {req.get('total_latency_ms'):.2f}ms")
    
    # Errors
    print("\n--- Errors ---")
    errors = find_errors(logs)
    print(f"Count: {len(errors)}")
    for error in errors[:5]:  # Show top 5
        print(f"  Trace: {error.get('trace_id')}, Stage: {error.get('error_stage')}")
        print(f"  Error: {error.get('error_message')}")


def main():
    parser = argparse.ArgumentParser(description="Analyze pipeline logs")
    parser.add_argument("--file", type=str, default="logs/pipeline_logs.jsonl",
                        help="Path to log file")
    parser.add_argument("--trace", type=str, help="Show timeline for specific trace ID")
    parser.add_argument("--stats", action="store_true", help="Show statistics")
    parser.add_argument("--errors", action="store_true", help="Show errors only")
    parser.add_argument("--slow", type=float, help="Show slow requests above threshold (ms)")
    
    args = parser.parse_args()
    
    log_file = Path(args.file)
    if not log_file.exists():
        print(f"Error: Log file not found: {log_file}")
        return
    
    print(f"Loading logs from: {log_file}")
    logs = load_logs(log_file)
    print(f"Loaded {len(logs)} log entries")
    
    if args.trace:
        print_trace_timeline(logs, args.trace)
    
    elif args.stats:
        print_stats(logs)
    
    elif args.errors:
        errors = find_errors(logs)
        print(f"\nFound {len(errors)} errors:\n")
        for error in errors:
            print(f"Trace: {error.get('trace_id')}")
            print(f"Stage: {error.get('error_stage')}")
            print(f"Error: {error.get('error_message')}")
            print(f"Type: {error.get('error_type')}")
            print()
    
    elif args.slow is not None:
        slow_requests = find_slow_requests(logs, args.slow)
        print(f"\nFound {len(slow_requests)} slow requests (>{args.slow}ms):\n")
        for req in slow_requests:
            print(f"Trace: {req.get('trace_id')}")
            print(f"Latency: {req.get('total_latency_ms'):.2f}ms")
            print(f"Query: {req.get('query', '')[:60]}...")
            print()
    
    else:
        print("\nUse --stats, --trace <id>, --errors, or --slow <ms> to analyze logs")
        print("Example: python analyze_logs.py --stats")


if __name__ == "__main__":
    main()
