from __future__ import annotations

from collections import defaultdict
from typing import Any

from .schemas import RankedParent, RelationshipChildMatch, RetrievalWeights, SemanticChildMatch
from .storage_service import HARAGStorageService


class ParentCentricFusionRanker:
    """Aggregates child evidence upward into weighted parent scores."""

    def __init__(self, storage: HARAGStorageService, weights: RetrievalWeights | None = None):
        self.storage = storage
        self.weights = weights or RetrievalWeights()

    def rank(
        self,
        *,
        semantic_matches: list[SemanticChildMatch],
        relationship_matches: list[RelationshipChildMatch],
        limit: int = 6,
    ) -> tuple[list[RankedParent], list[dict[str, Any]]]:
        child_support: dict[str, dict[str, Any]] = {}
        for match in semantic_matches:
            item = child_support.setdefault(match.child_id, self._base_child(match))
            item["channels"]["semantic"] = item["channels"].get("semantic", 0.0) + match.score * self.weights.semantic
            item["raw_channels"]["semantic"] = match.score

        for match in relationship_matches:
            item = child_support.setdefault(match.child_id, self._base_child(match))
            item["channels"]["relationship"] = item["channels"].get("relationship", 0.0) + match.score * self.weights.relationship
            item["raw_channels"]["relationship"] = match.score
            item.setdefault("relationships", []).append(match.relationship)

        parent_scores: dict[str, float] = defaultdict(float)
        parent_channel_scores: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        parent_children: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for child in child_support.values():
            parent_id = child["parent_id"]
            for channel, score in child["channels"].items():
                parent_scores[parent_id] += score
                parent_channel_scores[parent_id][channel] += score
            parent_children[parent_id].append(child)

        parents = self.storage.fetch_parents(list(parent_scores.keys()))
        ranked: list[RankedParent] = []
        for parent_id, score in sorted(parent_scores.items(), key=lambda item: item[1], reverse=True)[:limit]:
            row = parents.get(parent_id)
            if not row:
                continue
            ranked.append(
                RankedParent(
                    parent_id=parent_id,
                    summary_id=str(row["summary_id"]),
                    document_id=str(row["document_id"]),
                    text=row["text"],
                    score=round(float(score), 6),
                    channel_scores={k: round(float(v), 6) for k, v in parent_channel_scores[parent_id].items()},
                    child_evidence=parent_children[parent_id],
                    heading_lineage=row["heading_lineage"] or {},
                    citation_anchor=row["citation_anchor"] or {},
                    source=row["source"] or "lecturer upload",
                )
            )

        trace = [
            {
                "parent_id": parent.parent_id,
                "score": parent.score,
                "channel_scores": parent.channel_scores,
                "supporting_child_count": len(parent.child_evidence),
                "citation_anchor": parent.citation_anchor,
            }
            for parent in ranked
        ]
        return ranked, trace

    @staticmethod
    def _base_child(match: SemanticChildMatch | RelationshipChildMatch) -> dict[str, Any]:
        return {
            "child_id": match.child_id,
            "parent_id": match.parent_id,
            "summary_id": match.summary_id,
            "document_id": match.document_id,
            "text": match.text,
            "source_scope": match.source_scope,
            "heading_lineage": match.heading_lineage,
            "citation_anchor": match.citation_anchor,
            "source": match.source,
            "channels": {},
            "raw_channels": {},
        }
