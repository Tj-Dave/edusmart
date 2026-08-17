from __future__ import annotations

import time
from typing import Optional

from sqlalchemy.orm import Session

from .embedding_service import HARAGEmbeddingService
from .evidence_packager import EvidencePackager
from .fusion_ranker import ParentCentricFusionRanker
from .relationship_retriever import RelationshipRetriever
from .routing_placeholder import RetrievalRoutingPlaceholder
from .schemas import HARAGRetrievalPackage, RetrievalWeights
from .semantic_retriever import SemanticChildRetriever
from .storage_service import HARAGStorageService
from .summary_activator import SummaryActivator


class HARAGRetrievalOrchestrator:
    def __init__(self, *, embedder, weights: RetrievalWeights | None = None):
        self.embedder = embedder
        self.weights = weights or RetrievalWeights()
        self.router = RetrievalRoutingPlaceholder()

    def retrieve(
        self,
        db: Session,
        *,
        query: str,
        course_code: Optional[str],
        course_offering_id: Optional[str],
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        dev_mode: bool = False,
        record_run: bool = True,
    ) -> HARAGRetrievalPackage:
        start = time.perf_counter()
        if not course_code:
            return HARAGRetrievalPackage(
                query=query,
                rag_triggered=False,
                course_code=course_code,
                course_offering_id=course_offering_id,
                parents=[],
                child_evidence=[],
                summaries=[],
                citations=[],
                channel_weights=self.weights.as_dict(),
                trace={"reason": "missing_course_code"},
            )

        storage = HARAGStorageService(db)
        embedding_service = HARAGEmbeddingService(self.embedder)
        channels = self.router.channels_for_query(query)

        semantic_matches = (
            SemanticChildRetriever(storage, embedding_service).retrieve(
                query,
                course_code=course_code,
                course_offering_id=course_offering_id,
            )
            if "semantic" in channels
            else []
        )
        relationship_matches = (
            RelationshipRetriever(storage).retrieve(
                query,
                course_code=course_code,
                course_offering_id=course_offering_id,
            )
            if "relationship" in channels
            else []
        )

        ranker = ParentCentricFusionRanker(storage, weights=self.weights)
        parents, parent_trace = ranker.rank(
            semantic_matches=semantic_matches,
            relationship_matches=relationship_matches,
        )
        summaries = SummaryActivator(storage).activate(parents)
        trace = {
            "channels": channels,
            "semantic_child_matches": [m.__dict__ for m in semantic_matches],
            "relationship_child_matches": [m.__dict__ for m in relationship_matches],
            "aggregated_parent_scores": parent_trace,
            "summary_activation": [s.__dict__ for s in summaries],
        }
        package = EvidencePackager().package(
            query=query,
            rag_triggered=True,
            course_code=course_code,
            course_offering_id=course_offering_id,
            parents=parents,
            summaries=summaries,
            weights=self.weights,
            trace=trace if dev_mode else {"parent_count": len(parents), "summary_count": len(summaries)},
        )

        if record_run:
            latency_ms = int((time.perf_counter() - start) * 1000)
            package.retrieval_run_id = storage.record_retrieval_run(
                query=query,
                user_id=user_id,
                session_id=session_id,
                course_code=course_code,
                course_offering_id=course_offering_id,
                triggered=True,
                channel_weights=self.weights.as_dict(),
                trace=trace if dev_mode else {"parent_count": len(parents), "summary_count": len(summaries)},
                latency_ms=latency_ms,
            )
        return package
