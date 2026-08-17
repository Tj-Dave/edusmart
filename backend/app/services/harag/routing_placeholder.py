from __future__ import annotations


class RetrievalRoutingPlaceholder:
    """Extension point for future retrieval-mode routing.

    V1 always runs semantic and relationship retrieval once confidence gating has
    decided that RAG should execute.
    """

    def channels_for_query(self, _query: str) -> list[str]:
        return ["semantic", "relationship"]
