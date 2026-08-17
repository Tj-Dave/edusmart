from __future__ import annotations

from collections import defaultdict

from .schemas import H1SummaryEvidence, RankedParent
from .storage_service import HARAGStorageService


class SummaryActivator:
    """Activates H1 summaries structurally from ranked parent links."""

    def __init__(self, storage: HARAGStorageService):
        self.storage = storage

    def activate(self, parents: list[RankedParent], *, limit: int = 4) -> list[H1SummaryEvidence]:
        scores: dict[str, float] = defaultdict(float)
        for parent in parents:
            scores[parent.summary_id] += parent.score
        summaries = self.storage.fetch_summaries(list(scores.keys()))
        out: list[H1SummaryEvidence] = []
        for summary_id, score in sorted(scores.items(), key=lambda item: item[1], reverse=True)[:limit]:
            row = summaries.get(summary_id)
            if row:
                out.append(
                    H1SummaryEvidence(
                        summary_id=summary_id,
                        document_id=str(row["document_id"]),
                        h1_title=row["h1_title"],
                        summary_text=row["summary_text"],
                        activation_score=round(float(score), 6),
                    )
                )
        return out
