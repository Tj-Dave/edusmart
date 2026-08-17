from __future__ import annotations

from app.services.competency_mapper import CompetencyMapper
from app.services.harag.child_chunker import OverlappingChildChunker
from app.services.harag.fusion_ranker import ParentCentricFusionRanker
from app.services.harag.grounding_checker import EvidenceGroundingChecker
from app.services.harag.parent_chunker import DynamicParentChunker
from app.services.harag.relationship_extractor import RelationshipExtractor
from app.services.harag.schemas import (
    HARAGRetrievalPackage,
    H1SummaryEvidence,
    ParentChunkBlock,
    RankedParent,
    RelationshipChildMatch,
    RetrievalWeights,
    SectionBlock,
    SemanticChildMatch,
)
from app.services.harag.storage_service import HARAGStorageService
from app.services.harag.structural_parser import StructuralParser
from app.services.harag.summary_activator import SummaryActivator


def _words(prefix: str, count: int) -> str:
    return " ".join(f"{prefix}{i}" for i in range(count))


def test_h1_summary_linkage_and_parent_boundaries():
    text = "# Intro\n" + _words("intro", 260) + "\n# Advanced\n" + _words("advanced", 260)
    sections = StructuralParser().parse(
        text,
        document_id="doc",
        course_code="SWE3202",
        course_offering_id="offering",
    )
    assert [section.heading_text for section in sections] == ["Intro", "Advanced"]
    chunker = DynamicParentChunker()
    for section in sections:
        section.id = f"section-{section.section_order}"
        parents = chunker.chunk(section, summary_id=f"summary-{section.section_order}")
        assert parents
        assert all(parent.summary_id == f"summary-{section.section_order}" for parent in parents)
        assert all(parent.heading_lineage["h1"] == section.heading_text for parent in parents)
        assert all("advanced" not in parent.text for parent in parents if section.heading_text == "Intro")


def test_child_overlap_behavior():
    parent = ParentChunkBlock(
        document_id="doc",
        summary_id="summary",
        section_id="section",
        course_code="SWE3202",
        course_offering_id="offering",
        chunk_order=0,
        text=_words("token", 260),
        token_count=260,
        heading_lineage={"h1": "Intro"},
        citation_anchor={"title": "Intro"},
        id="parent",
    )
    children = OverlappingChildChunker().chunk(parent)
    assert len(children) >= 2
    assert all(80 <= child.token_count <= 120 for child in children[:-1])
    assert children[1].overlap_prev_tokens > 0
    first_tail = children[0].text.split()[-children[1].overlap_prev_tokens :]
    second_head = children[1].text.split()[: children[1].overlap_prev_tokens]
    assert first_tail == second_head


class _FakeStorage:
    def fetch_parents(self, parent_ids):
        return {
            "p1": {
                "id": "p1",
                "summary_id": "s1",
                "document_id": "d1",
                "text": "Parent one evidence",
                "heading_lineage": {"h1": "Intro"},
                "citation_anchor": {"title": "Intro"},
                "source": "note.pdf",
            },
            "p2": {
                "id": "p2",
                "summary_id": "s2",
                "document_id": "d1",
                "text": "Parent two evidence",
                "heading_lineage": {"h1": "Advanced"},
                "citation_anchor": {"title": "Advanced"},
                "source": "note.pdf",
            },
        }

    def fetch_summaries(self, summary_ids):
        return {
            "s1": {"id": "s1", "document_id": "d1", "h1_title": "Intro", "summary_text": "Intro summary"},
            "s2": {"id": "s2", "document_id": "d1", "h1_title": "Advanced", "summary_text": "Advanced summary"},
        }


def test_relationship_retrieval_and_parent_score_aggregation_summary_activation():
    semantic = [
        SemanticChildMatch("c1", "p1", "s1", "d1", "child text", 0.9, 0.1, "offering_only", {}, {}, "note.pdf"),
        SemanticChildMatch("c2", "p2", "s2", "d1", "child text", 0.3, 0.7, "offering_only", {}, {}, "note.pdf"),
    ]
    relationship = [
        RelationshipChildMatch(
            "c1",
            "p1",
            "s1",
            "d1",
            "child text",
            0.8,
            {"subject": "A", "predicate": "causes", "object": "B"},
            "offering_only",
            {},
            {},
            "note.pdf",
        )
    ]
    parents, trace = ParentCentricFusionRanker(_FakeStorage(), RetrievalWeights(semantic=1.0, relationship=0.5)).rank(
        semantic_matches=semantic,
        relationship_matches=relationship,
    )
    assert parents[0].parent_id == "p1"
    assert parents[0].channel_scores["semantic"] == 0.9
    assert parents[0].channel_scores["relationship"] == 0.4
    assert trace[0]["supporting_child_count"] == 1
    summaries = SummaryActivator(_FakeStorage()).activate(parents)
    assert summaries[0].summary_id == "s1"


def test_relationship_extractor_heuristic_returns_grounded_child_evidence():
    relations = RelationshipExtractor().extract("Recursion causes repeated stack frames. Algorithms require clear inputs.")
    assert relations
    assert relations[0].evidence_text
    assert relations[0].extraction_method == "heuristic"


def test_competency_fallback_order_without_loading_embeddings(monkeypatch):
    mapper = object.__new__(CompetencyMapper)
    calls = []

    def structured(**kwargs):
        calls.append(("structured", kwargs))
        if kwargs.get("course_offering_id") == "offering":
            return [{"value": "Problem solving", "source": "offering_spec"}]
        if kwargs.get("course_code") == "SWE3202":
            return [{"value": "Critical thinking", "source": "course_spec"}]
        return []

    monkeypatch.setattr(mapper, "_structured_competencies", structured)
    monkeypatch.setattr(mapper, "_rank_structured", lambda query, comps, top_k: comps)
    monkeypatch.setattr(mapper, "_legacy_map", lambda query, top_k: [{"value": "Legacy", "source": "legacy_csv"}])

    assert mapper.map("query", db=object(), course_offering_id="offering", course_code="SWE3202")[0]["source"] == "offering_spec"
    assert mapper.map("query", db=object(), course_offering_id=None, course_code="SWE3202")[0]["source"] == "course_spec"
    assert mapper.map("query", db=object(), course_offering_id=None, course_code=None)[0]["source"] == "legacy_csv"


def test_sharing_approval_scope_filter_sql():
    scope_sql = HARAGStorageService._scope_sql("c")
    assert "course_shared_approved" in scope_sql
    assert "course_offering_id = :course_offering_id" in scope_sql


def test_grounding_and_dev_package_visibility_shape():
    parent = RankedParent(
        parent_id="p1",
        summary_id="s1",
        document_id="d1",
        text="Recursion uses repeated function calls and stack frames.",
        score=1.0,
        channel_scores={"semantic": 1.0},
        child_evidence=[{"child_id": "c1"}],
        heading_lineage={"h1": "Recursion"},
        citation_anchor={"title": "Recursion"},
        source="note.pdf",
    )
    package = HARAGRetrievalPackage(
        query="What is recursion?",
        rag_triggered=True,
        course_code="SWE3202",
        course_offering_id="offering",
        parents=[parent],
        child_evidence=parent.child_evidence,
        summaries=[H1SummaryEvidence("s1", "d1", "Recursion", "Summary", 1.0)],
        citations=[],
        channel_weights={"semantic": 1.0, "relationship": 0.65},
    )
    diagnostics = EvidenceGroundingChecker().check("Recursion uses stack frames.", package)
    package.grounding = diagnostics
    trace = package.to_dev_trace()
    assert diagnostics["coverage_score"] > 0
    assert trace["selected_parent_chunks"][0]["parent_id"] == "p1"
