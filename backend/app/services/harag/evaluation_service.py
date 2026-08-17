from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Optional

from sqlalchemy.orm import Session

from .retrieval_orchestrator import HARAGRetrievalOrchestrator


class HARAGEvaluationService:
    """Offline retrieval evaluation for JSON/JSONL datasets."""

    def __init__(self, *, orchestrator: HARAGRetrievalOrchestrator):
        self.orchestrator = orchestrator

    def run_file(
        self,
        db: Session,
        *,
        dataset_path: Path,
        default_course_code: Optional[str] = None,
        default_course_offering_id: Optional[str] = None,
    ) -> dict[str, Any]:
        examples = self._load_examples(dataset_path)
        results = []
        latencies = []
        hits = 0
        parent_hits = 0
        for item in examples:
            start = time.perf_counter()
            package = self.orchestrator.retrieve(
                db,
                query=item["query"],
                course_code=item.get("course_code") or default_course_code,
                course_offering_id=item.get("course_offering_id") or default_course_offering_id,
                dev_mode=False,
                record_run=False,
            )
            latency_ms = int((time.perf_counter() - start) * 1000)
            latencies.append(latency_ms)
            expected_children = {str(v) for v in item.get("expected_child_ids", [])}
            expected_parents = {str(v) for v in item.get("expected_parent_ids", [])}
            got_children = {e["child_id"] for e in package.child_evidence if e.get("child_id")}
            got_parents = {p.parent_id for p in package.parents}
            hit = bool(expected_children & got_children) if expected_children else False
            parent_hit = bool(expected_parents & got_parents) if expected_parents else False
            hits += int(hit)
            parent_hits += int(parent_hit)
            results.append(
                {
                    "query": item["query"],
                    "hit": hit,
                    "parent_hit": parent_hit,
                    "latency_ms": latency_ms,
                    "selected_parent_ids": list(got_parents),
                    "semantic_relationship_mix": package.channel_weights,
                    "grounding_coverage": package.grounding.get("coverage_score"),
                }
            )
        total = max(1, len(examples))
        return {
            "example_count": len(examples),
            "evidence_hit_rate": hits / total,
            "parent_selection_hit_rate": parent_hits / total,
            "avg_latency_ms": sum(latencies) / total,
            "results": results,
        }

    @staticmethod
    def _load_examples(path: Path) -> list[dict[str, Any]]:
        if path.suffix.lower() == ".jsonl":
            return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
        data = json.loads(path.read_text())
        if isinstance(data, dict):
            return data.get("examples", [])
        return data if isinstance(data, list) else []
