from __future__ import annotations

from .schemas import HARAGRetrievalPackage, H1SummaryEvidence, RankedParent, RetrievalWeights


class EvidencePackager:
    def package(
        self,
        *,
        query: str,
        rag_triggered: bool,
        course_code: str | None,
        course_offering_id: str | None,
        parents: list[RankedParent],
        summaries: list[H1SummaryEvidence],
        weights: RetrievalWeights,
        trace: dict,
    ) -> HARAGRetrievalPackage:
        child_evidence = []
        citations = []
        seen_parent: set[str] = set()
        for parent in parents:
            child_evidence.extend(parent.child_evidence)
            if parent.parent_id not in seen_parent:
                seen_parent.add(parent.parent_id)
                anchor = parent.citation_anchor or {}
                citations.append(
                    {
                        "id": parent.parent_id,
                        "document_id": parent.document_id,
                        "title": anchor.get("title") or anchor.get("h1") or parent.source,
                        "snippet": parent.text[:320],
                        "source": parent.source,
                        "role": "lecturer",
                        "uploader_role": "lecturer",
                        "content_type": "parent_chunk",
                        "heading_lineage": parent.heading_lineage,
                        "score": parent.score,
                    }
                )

        return HARAGRetrievalPackage(
            query=query,
            rag_triggered=rag_triggered,
            course_code=course_code,
            course_offering_id=course_offering_id,
            parents=parents,
            child_evidence=child_evidence,
            summaries=summaries,
            citations=citations,
            channel_weights=weights.as_dict(),
            trace=trace,
        )
