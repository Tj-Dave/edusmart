from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from .child_chunker import OverlappingChildChunker
from .embedding_service import HARAGEmbeddingService
from .entity_extractor import EntityExtractor
from .parent_chunker import DynamicParentChunker
from .relationship_extractor import RelationshipExtractor
from .schemas import ChildChunkBlock, ExtractedEntityItem, ExtractedRelationshipItem, H1SummaryBlock, ParentChunkBlock, SectionBlock, SourceScope
from .storage_service import HARAGStorageService
from .structural_parser import StructuralParser
from .summary_generator import H1SummaryGenerator


class HARAGIngestionOrchestrator:
    """Builds and persists the V1 H1 -> parent -> child hierarchy."""

    def __init__(self, *, embedder, llm_subclient=None, embedding_model: str = "intfloat/e5-base-v2"):
        self.parser = StructuralParser()
        self.summary_generator = H1SummaryGenerator(llm_subclient=llm_subclient)
        self.parent_chunker = DynamicParentChunker()
        self.child_chunker = OverlappingChildChunker()
        self.entity_extractor = EntityExtractor()
        self.relationship_extractor = RelationshipExtractor(llm_subclient=llm_subclient)
        self.embedding_service = HARAGEmbeddingService(embedder, model_name=embedding_model)
        self.embedding_model = embedding_model

    def ingest_text(
        self,
        db: Session,
        *,
        document_id: str,
        text: str,
        course_code: str,
        course_offering_id: Optional[str],
        source_scope: SourceScope = "offering_only",
        metadata: Optional[dict] = None,
    ) -> int:
        sections = self.parser.parse(
            text,
            document_id=document_id,
            course_code=course_code,
            course_offering_id=course_offering_id,
            source_scope=source_scope,
        )
        summaries_by_section: dict[int, H1SummaryBlock] = {}
        parents_by_section: dict[int, list[ParentChunkBlock]] = {}
        children_by_parent_key: dict[tuple[int, int], list[ChildChunkBlock]] = {}
        entities_by_child_key: dict[tuple[int, int, int], list[ExtractedEntityItem]] = {}
        relationships_by_child_key: dict[tuple[int, int, int], list[ExtractedRelationshipItem]] = {}

        child_refs: list[tuple[int, int, int, ChildChunkBlock]] = []
        global_parent_order = 0
        global_child_order = 0
        for section_idx, section in enumerate(sections):
            summary = self.summary_generator.summarize(section)
            summaries_by_section[section_idx] = summary

            parents = self.parent_chunker.chunk(section, summary_id="", start_order=global_parent_order)
            parents_by_section[section_idx] = parents
            global_parent_order += len(parents)

            for parent_idx, parent in enumerate(parents):
                children = self.child_chunker.chunk(parent, start_order=global_child_order)
                children_by_parent_key[(section_idx, parent_idx)] = children
                global_child_order += len(children)
                for child_idx, child in enumerate(children):
                    child_refs.append((section_idx, parent_idx, child_idx, child))
                    entities_by_child_key[(section_idx, parent_idx, child_idx)] = self.entity_extractor.extract(child.text)
                    relationships_by_child_key[(section_idx, parent_idx, child_idx)] = self.relationship_extractor.extract(child.text)

        embeddings = self.embedding_service.embed_children([child.text for *_idx, child in child_refs])
        for (_, _, _, child), embedding in zip(child_refs, embeddings):
            child.embedding = embedding

        return HARAGStorageService(db).replace_document_hierarchy(
            document_id=document_id,
            sections=sections,
            summaries_by_section=summaries_by_section,
            parents_by_section=parents_by_section,
            children_by_parent_key=children_by_parent_key,
            entities_by_child_key=entities_by_child_key,
            relationships_by_child_key=relationships_by_child_key,
            embedding_model=self.embedding_model,
            metadata=metadata,
        )
