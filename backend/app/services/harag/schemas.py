from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Optional


SourceScope = Literal[
    "offering_only",
    "course_shared_pending",
    "course_shared_approved",
    "course_shared_rejected",
]

PARENT_MIN_TOKENS = 200
PARENT_MAX_TOKENS = 600
CHILD_MIN_TOKENS = 80
CHILD_MAX_TOKENS = 120
CHILD_OVERLAP_TOKENS = 24


@dataclass
class SectionBlock:
    document_id: str
    course_code: str
    course_offering_id: Optional[str]
    heading_level: int
    heading_text: str
    heading_lineage: dict[str, Any]
    section_order: int
    content: str
    char_start: int = 0
    char_end: int = 0
    source_scope: SourceScope = "offering_only"
    id: Optional[str] = None


@dataclass
class H1SummaryBlock:
    document_id: str
    section_id: str
    course_code: str
    course_offering_id: Optional[str]
    h1_title: str
    summary_text: str
    token_count: int
    source_scope: SourceScope = "offering_only"
    id: Optional[str] = None


@dataclass
class ParentChunkBlock:
    document_id: str
    summary_id: str
    section_id: str
    course_code: str
    course_offering_id: Optional[str]
    chunk_order: int
    text: str
    token_count: int
    heading_lineage: dict[str, Any]
    citation_anchor: dict[str, Any]
    source_scope: SourceScope = "offering_only"
    char_start: int = 0
    char_end: int = 0
    id: Optional[str] = None


@dataclass
class ChildChunkBlock:
    document_id: str
    parent_id: str
    summary_id: str
    course_code: str
    course_offering_id: Optional[str]
    chunk_order: int
    text: str
    token_count: int
    overlap_prev_tokens: int
    heading_lineage: dict[str, Any]
    source_scope: SourceScope = "offering_only"
    char_start: int = 0
    char_end: int = 0
    embedding: list[float] = field(default_factory=list)
    id: Optional[str] = None


@dataclass
class ExtractedEntityItem:
    text: str
    entity_type: str = "concept"
    confidence: float = 0.65
    child_id: Optional[str] = None


@dataclass
class ExtractedRelationshipItem:
    subject: str
    predicate: str
    object: str
    evidence_text: str
    confidence: float = 0.65
    extraction_method: str = "local_llm"
    child_id: Optional[str] = None


@dataclass
class SemanticChildMatch:
    child_id: str
    parent_id: str
    summary_id: str
    document_id: str
    text: str
    score: float
    distance: float
    source_scope: str
    heading_lineage: dict[str, Any]
    citation_anchor: dict[str, Any]
    source: str


@dataclass
class RelationshipChildMatch:
    child_id: str
    parent_id: str
    summary_id: str
    document_id: str
    text: str
    score: float
    relationship: dict[str, Any]
    source_scope: str
    heading_lineage: dict[str, Any]
    citation_anchor: dict[str, Any]
    source: str


@dataclass
class RetrievalWeights:
    semantic: float = 1.0
    relationship: float = 0.65

    def as_dict(self) -> dict[str, float]:
        return {"semantic": self.semantic, "relationship": self.relationship}


@dataclass
class RankedParent:
    parent_id: str
    summary_id: str
    document_id: str
    text: str
    score: float
    channel_scores: dict[str, float]
    child_evidence: list[dict[str, Any]]
    heading_lineage: dict[str, Any]
    citation_anchor: dict[str, Any]
    source: str


@dataclass
class H1SummaryEvidence:
    summary_id: str
    document_id: str
    h1_title: str
    summary_text: str
    activation_score: float


@dataclass
class HARAGRetrievalPackage:
    query: str
    rag_triggered: bool
    course_code: Optional[str]
    course_offering_id: Optional[str]
    parents: list[RankedParent]
    child_evidence: list[dict[str, Any]]
    summaries: list[H1SummaryEvidence]
    citations: list[dict[str, Any]]
    channel_weights: dict[str, float]
    grounding: dict[str, Any] = field(default_factory=dict)
    trace: dict[str, Any] = field(default_factory=dict)
    retrieval_run_id: Optional[str] = None

    def context_blocks(self, max_parents: int = 4) -> list[str]:
        blocks: list[str] = []
        for parent in self.parents[:max_parents]:
            anchor = parent.citation_anchor or {}
            title = anchor.get("title") or parent.heading_lineage.get("h1") or parent.source
            blocks.append(f"[{title}] {parent.text.strip()}")
        return blocks

    def to_dev_trace(self) -> dict[str, Any]:
        return {
            "rag_triggered": self.rag_triggered,
            "course_code": self.course_code,
            "course_offering_id": self.course_offering_id,
            "semantic_child_matches": self.trace.get("semantic_child_matches", []),
            "relationship_child_matches": self.trace.get("relationship_child_matches", []),
            "aggregated_parent_scores": self.trace.get("aggregated_parent_scores", []),
            "linked_h1_summaries": [summary.__dict__ for summary in self.summaries],
            "selected_parent_chunks": [parent.__dict__ for parent in self.parents],
            "channel_weights": self.channel_weights,
            "grounding": self.grounding,
            "retrieval_run_id": self.retrieval_run_id,
        }
