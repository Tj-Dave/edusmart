from __future__ import annotations

import math
from typing import Any, Optional

from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from .schemas import (
    ChildChunkBlock,
    ExtractedEntityItem,
    ExtractedRelationshipItem,
    H1SummaryBlock,
    ParentChunkBlock,
    RelationshipChildMatch,
    SectionBlock,
    SemanticChildMatch,
)


def _vector_literal(vec: list[float]) -> str:
    return "[" + ",".join(f"{float(v):.8f}" for v in vec) + "]"


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    n = min(len(a), len(b))
    dot = sum(float(a[i]) * float(b[i]) for i in range(n))
    na = math.sqrt(sum(float(a[i]) ** 2 for i in range(n)))
    nb = math.sqrt(sum(float(b[i]) ** 2 for i in range(n)))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class HARAGStorageService:
    """PostgreSQL persistence/query layer for HA-RAG V1."""

    def __init__(self, db: Session):
        self.db = db

    def replace_document_hierarchy(
        self,
        *,
        document_id: str,
        sections: list[SectionBlock],
        summaries_by_section: dict[int, H1SummaryBlock],
        parents_by_section: dict[int, list[ParentChunkBlock]],
        children_by_parent_key: dict[tuple[int, int], list[ChildChunkBlock]],
        entities_by_child_key: dict[tuple[int, int, int], list[ExtractedEntityItem]],
        relationships_by_child_key: dict[tuple[int, int, int], list[ExtractedRelationshipItem]],
        embedding_model: str,
        metadata: dict[str, Any] | None = None,
    ) -> int:
        self.delete_document_hierarchy(document_id)
        metadata = metadata or {}

        child_count = 0
        for section_idx, section in enumerate(sections):
            section.id = self._insert_section(section, metadata=metadata)
            summary = summaries_by_section[section_idx]
            summary.section_id = section.id or ""
            summary.id = self._insert_summary(summary, metadata=metadata)

            for parent_idx, parent in enumerate(parents_by_section.get(section_idx, [])):
                parent.section_id = section.id or ""
                parent.summary_id = summary.id or ""
                parent.id = self._insert_parent(parent, metadata=metadata)

                for child_idx, child in enumerate(children_by_parent_key.get((section_idx, parent_idx), [])):
                    child.parent_id = parent.id or ""
                    child.summary_id = summary.id or ""
                    child.id = self._insert_child(child, metadata=metadata)
                    self._insert_embedding(child, embedding_model=embedding_model)
                    child_count += 1

                    for entity in entities_by_child_key.get((section_idx, parent_idx, child_idx), []):
                        entity.child_id = child.id
                        self._insert_entity(child, entity, metadata=metadata)
                    for relationship in relationships_by_child_key.get((section_idx, parent_idx, child_idx), []):
                        relationship.child_id = child.id
                        self._insert_relationship(child, relationship, metadata=metadata)

        self.db.commit()
        return child_count

    def delete_document_hierarchy(self, document_id: str) -> None:
        for table in (
            "retrieval_evidence",
            "extracted_relationships",
            "extracted_entities",
            "child_chunk_embeddings",
            "child_chunks",
            "parent_chunks",
            "h1_summaries",
            "document_sections",
        ):
            key = "child_id" if table == "child_chunk_embeddings" else "document_id"
            if table == "child_chunk_embeddings":
                self.db.execute(
                    text(
                        "DELETE FROM child_chunk_embeddings WHERE child_id IN "
                        "(SELECT id FROM child_chunks WHERE document_id = :document_id)"
                    ),
                    {"document_id": document_id},
                )
            elif table == "retrieval_evidence":
                self.db.execute(
                    text(
                        "DELETE FROM retrieval_evidence WHERE child_id IN "
                        "(SELECT id FROM child_chunks WHERE document_id = :document_id)"
                    ),
                    {"document_id": document_id},
                )
            else:
                self.db.execute(text(f"DELETE FROM {table} WHERE {key} = :document_id"), {"document_id": document_id})
        self.db.flush()

    def semantic_search(
        self,
        *,
        query_embedding: list[float],
        course_code: str,
        course_offering_id: Optional[str],
        limit: int = 16,
    ) -> list[SemanticChildMatch]:
        params = {
            "query_vec": _vector_literal(query_embedding),
            "course_code": course_code,
            "course_offering_id": course_offering_id,
            "limit": limit,
        }
        scope = self._scope_sql("c")
        sql = text(
            f"""
            SELECT c.id AS child_id, c.parent_id, c.summary_id, c.document_id, c.text,
                   c.source_scope, c.heading_lineage, p.citation_anchor,
                   d.original_filename AS source,
                   (e.embedding <=> CAST(:query_vec AS vector)) AS distance
            FROM child_chunks c
            JOIN child_chunk_embeddings e ON e.child_id = c.id
            JOIN parent_chunks p ON p.id = c.parent_id
            JOIN ingested_documents d ON d.document_id = c.document_id
            WHERE {scope}
            ORDER BY e.embedding <=> CAST(:query_vec AS vector)
            LIMIT :limit
            """
        )
        try:
            rows = self.db.execute(sql, params).mappings().all()
            return [
                SemanticChildMatch(
                    child_id=str(row["child_id"]),
                    parent_id=str(row["parent_id"]),
                    summary_id=str(row["summary_id"]),
                    document_id=str(row["document_id"]),
                    text=row["text"],
                    distance=float(row["distance"] or 0.0),
                    score=max(0.0, 1.0 - float(row["distance"] or 0.0)),
                    source_scope=row["source_scope"],
                    heading_lineage=row["heading_lineage"] or {},
                    citation_anchor=row["citation_anchor"] or {},
                    source=row["source"] or "lecturer upload",
                )
                for row in rows
            ]
        except Exception:
            self.db.rollback()
            return self._semantic_search_json_fallback(
                query_embedding=query_embedding,
                course_code=course_code,
                course_offering_id=course_offering_id,
                limit=limit,
            )

    def relationship_search(
        self,
        *,
        query: str,
        course_code: str,
        course_offering_id: Optional[str],
        limit: int = 12,
    ) -> list[RelationshipChildMatch]:
        terms = [t.lower() for t in query.split() if len(t) > 3][:8]
        if not terms:
            return []
        like = "%" + "%".join(terms[:3]) + "%"
        params = {"course_code": course_code, "course_offering_id": course_offering_id, "like": like, "limit": limit}
        scope = self._scope_sql("c")
        rows = self.db.execute(
            text(
                f"""
                SELECT c.id AS child_id, c.parent_id, c.summary_id, c.document_id, c.text,
                       c.source_scope, c.heading_lineage, p.citation_anchor,
                       d.original_filename AS source,
                       r.subject, r.predicate, r.object, r.evidence_text, r.confidence
                FROM extracted_relationships r
                JOIN child_chunks c ON c.id = r.child_id
                JOIN parent_chunks p ON p.id = c.parent_id
                JOIN ingested_documents d ON d.document_id = c.document_id
                WHERE {scope}
                  AND lower(r.subject || ' ' || r.predicate || ' ' || r.object || ' ' || r.evidence_text) LIKE :like
                ORDER BY r.confidence DESC NULLS LAST, r.created_at DESC
                LIMIT :limit
                """
            ),
            params,
        ).mappings().all()
        out: list[RelationshipChildMatch] = []
        for row in rows:
            confidence = float(row["confidence"] or 0.55)
            out.append(
                RelationshipChildMatch(
                    child_id=str(row["child_id"]),
                    parent_id=str(row["parent_id"]),
                    summary_id=str(row["summary_id"]),
                    document_id=str(row["document_id"]),
                    text=row["text"],
                    score=confidence,
                    relationship={
                        "subject": row["subject"],
                        "predicate": row["predicate"],
                        "object": row["object"],
                        "evidence_text": row["evidence_text"],
                        "confidence": confidence,
                    },
                    source_scope=row["source_scope"],
                    heading_lineage=row["heading_lineage"] or {},
                    citation_anchor=row["citation_anchor"] or {},
                    source=row["source"] or "lecturer upload",
                )
            )
        return out

    def fetch_parents(self, parent_ids: list[str]) -> dict[str, dict[str, Any]]:
        if not parent_ids:
            return {}
        stmt = text(
                """
                SELECT p.id, p.summary_id, p.document_id, p.text, p.heading_lineage, p.citation_anchor,
                       d.original_filename AS source
                FROM parent_chunks p
                JOIN ingested_documents d ON d.document_id = p.document_id
                WHERE p.id IN :parent_ids
                """
            ).bindparams(bindparam("parent_ids", expanding=True))
        rows = self.db.execute(
            stmt,
            {"parent_ids": parent_ids},
        ).mappings().all()
        return {str(row["id"]): dict(row) for row in rows}

    def fetch_summaries(self, summary_ids: list[str]) -> dict[str, dict[str, Any]]:
        if not summary_ids:
            return {}
        stmt = text(
                """
                SELECT id, document_id, h1_title, summary_text
                FROM h1_summaries
                WHERE id IN :summary_ids
                """
            ).bindparams(bindparam("summary_ids", expanding=True))
        rows = self.db.execute(
            stmt,
            {"summary_ids": summary_ids},
        ).mappings().all()
        return {str(row["id"]): dict(row) for row in rows}

    def record_retrieval_run(
        self,
        *,
        query: str,
        user_id: Optional[str],
        session_id: Optional[str],
        course_code: Optional[str],
        course_offering_id: Optional[str],
        triggered: bool,
        channel_weights: dict[str, float],
        trace: dict[str, Any],
        latency_ms: int,
    ) -> str:
        run_id = self.db.execute(
            text(
                """
                INSERT INTO retrieval_runs
                (query_text, user_id, session_id, course_code, course_offering_id, triggered,
                 channel_weights, trace_json, latency_ms)
                VALUES (:query_text, :user_id, :session_id, :course_code, :course_offering_id, :triggered,
                        CAST(:channel_weights AS jsonb), CAST(:trace_json AS jsonb), :latency_ms)
                RETURNING id
                """
            ),
            {
                "query_text": query,
                "user_id": user_id,
                "session_id": session_id,
                "course_code": course_code,
                "course_offering_id": course_offering_id,
                "triggered": triggered,
                "channel_weights": self._json(channel_weights),
                "trace_json": self._json(trace),
                "latency_ms": latency_ms,
            },
        ).scalar_one()
        self.db.commit()
        return str(run_id)

    def record_grounding_check(
        self,
        *,
        retrieval_run_id: Optional[str],
        message_id: Optional[int],
        answer_text: str,
        diagnostics: dict[str, Any],
    ) -> None:
        self.db.execute(
            text(
                """
                INSERT INTO grounding_checks
                (retrieval_run_id, message_id, answer_text, supported_claims, unsupported_claims, coverage_score, diagnostics)
                VALUES (:retrieval_run_id, :message_id, :answer_text, :supported_claims, :unsupported_claims,
                        :coverage_score, CAST(:diagnostics AS jsonb))
                """
            ),
            {
                "retrieval_run_id": retrieval_run_id,
                "message_id": message_id,
                "answer_text": answer_text,
                "supported_claims": int(diagnostics.get("supported_claims", 0)),
                "unsupported_claims": int(diagnostics.get("unsupported_claims", 0)),
                "coverage_score": diagnostics.get("coverage_score"),
                "diagnostics": self._json(diagnostics),
            },
        )
        self.db.commit()

    def update_document_scope(self, *, document_id: str, source_scope: str) -> None:
        for table in ("ingested_documents", "document_sections", "h1_summaries", "parent_chunks", "child_chunks"):
            column = "document_id"
            self.db.execute(
                text(f"UPDATE {table} SET source_scope = :source_scope WHERE {column} = :document_id"),
                {"source_scope": source_scope, "document_id": document_id},
            )
        self.db.commit()

    def _insert_section(self, section: SectionBlock, *, metadata: dict[str, Any]) -> str:
        return str(
            self.db.execute(
                text(
                    """
                    INSERT INTO document_sections
                    (document_id, course_offering_id, course_code, heading_level, heading_text, heading_lineage,
                     section_order, char_start, char_end, content, metadata, source_scope)
                    VALUES (:document_id, :course_offering_id, :course_code, :heading_level, :heading_text,
                            CAST(:heading_lineage AS jsonb), :section_order, :char_start, :char_end, :content,
                            CAST(:metadata AS jsonb), :source_scope)
                    RETURNING id
                    """
                ),
                {
                    **section.__dict__,
                    "metadata": self._json(metadata),
                    "heading_lineage": self._json(section.heading_lineage),
                },
            ).scalar_one()
        )

    def _insert_summary(self, summary: H1SummaryBlock, *, metadata: dict[str, Any]) -> str:
        return str(
            self.db.execute(
                text(
                    """
                    INSERT INTO h1_summaries
                    (document_id, section_id, course_offering_id, course_code, h1_title, summary_text,
                     token_count, source_scope, metadata)
                    VALUES (:document_id, :section_id, :course_offering_id, :course_code, :h1_title, :summary_text,
                            :token_count, :source_scope, CAST(:metadata AS jsonb))
                    RETURNING id
                    """
                ),
                {**summary.__dict__, "metadata": self._json(metadata)},
            ).scalar_one()
        )

    def _insert_parent(self, parent: ParentChunkBlock, *, metadata: dict[str, Any]) -> str:
        return str(
            self.db.execute(
                text(
                    """
                    INSERT INTO parent_chunks
                    (document_id, summary_id, section_id, course_offering_id, course_code, chunk_order, text,
                     token_count, heading_lineage, citation_anchor, char_start, char_end, source_scope, metadata)
                    VALUES (:document_id, :summary_id, :section_id, :course_offering_id, :course_code, :chunk_order,
                            :text, :token_count, CAST(:heading_lineage AS jsonb), CAST(:citation_anchor AS jsonb),
                            :char_start, :char_end, :source_scope, CAST(:metadata AS jsonb))
                    RETURNING id
                    """
                ),
                {
                    **parent.__dict__,
                    "heading_lineage": self._json(parent.heading_lineage),
                    "citation_anchor": self._json(parent.citation_anchor),
                    "metadata": self._json(metadata),
                },
            ).scalar_one()
        )

    def _insert_child(self, child: ChildChunkBlock, *, metadata: dict[str, Any]) -> str:
        return str(
            self.db.execute(
                text(
                    """
                    INSERT INTO child_chunks
                    (document_id, parent_id, summary_id, course_offering_id, course_code, chunk_order, text,
                     token_count, overlap_prev_tokens, heading_lineage, char_start, char_end, source_scope, metadata)
                    VALUES (:document_id, :parent_id, :summary_id, :course_offering_id, :course_code, :chunk_order,
                            :text, :token_count, :overlap_prev_tokens, CAST(:heading_lineage AS jsonb),
                            :char_start, :char_end, :source_scope, CAST(:metadata AS jsonb))
                    RETURNING id
                    """
                ),
                {**child.__dict__, "heading_lineage": self._json(child.heading_lineage), "metadata": self._json(metadata)},
            ).scalar_one()
        )

    def _insert_embedding(self, child: ChildChunkBlock, *, embedding_model: str) -> None:
        self.db.execute(
            text(
                """
                INSERT INTO child_chunk_embeddings (child_id, embedding, embedding_json, embedding_model, embedding_dim)
                VALUES (:child_id, CAST(:embedding AS vector), CAST(:embedding_json AS jsonb), :embedding_model, :embedding_dim)
                """
            ),
            {
                "child_id": child.id,
                "embedding": _vector_literal(child.embedding),
                "embedding_json": self._json(child.embedding),
                "embedding_model": embedding_model,
                "embedding_dim": len(child.embedding),
            },
        )

    def _insert_entity(self, child: ChildChunkBlock, entity: ExtractedEntityItem, *, metadata: dict[str, Any]) -> None:
        self.db.execute(
            text(
                """
                INSERT INTO extracted_entities
                (document_id, child_id, course_offering_id, course_code, text, entity_type, confidence, metadata)
                VALUES (:document_id, :child_id, :course_offering_id, :course_code, :text, :entity_type,
                        :confidence, CAST(:metadata AS jsonb))
                """
            ),
            {
                "document_id": child.document_id,
                "child_id": child.id,
                "course_offering_id": child.course_offering_id,
                "course_code": child.course_code,
                "text": entity.text,
                "entity_type": entity.entity_type,
                "confidence": entity.confidence,
                "metadata": self._json(metadata),
            },
        )

    def _insert_relationship(self, child: ChildChunkBlock, relationship: ExtractedRelationshipItem, *, metadata: dict[str, Any]) -> None:
        self.db.execute(
            text(
                """
                INSERT INTO extracted_relationships
                (document_id, child_id, course_offering_id, course_code, subject, predicate, object,
                 evidence_text, confidence, extraction_method, metadata)
                VALUES (:document_id, :child_id, :course_offering_id, :course_code, :subject, :predicate, :object,
                        :evidence_text, :confidence, :extraction_method, CAST(:metadata AS jsonb))
                """
            ),
            {
                "document_id": child.document_id,
                "child_id": child.id,
                "course_offering_id": child.course_offering_id,
                "course_code": child.course_code,
                "subject": relationship.subject,
                "predicate": relationship.predicate,
                "object": relationship.object,
                "evidence_text": relationship.evidence_text,
                "confidence": relationship.confidence,
                "extraction_method": relationship.extraction_method,
                "metadata": self._json(metadata),
            },
        )

    def _semantic_search_json_fallback(
        self,
        *,
        query_embedding: list[float],
        course_code: str,
        course_offering_id: Optional[str],
        limit: int,
    ) -> list[SemanticChildMatch]:
        scope = self._scope_sql("c")
        rows = self.db.execute(
            text(
                f"""
                SELECT c.id AS child_id, c.parent_id, c.summary_id, c.document_id, c.text,
                       c.source_scope, c.heading_lineage, p.citation_anchor, d.original_filename AS source,
                       e.embedding_json
                FROM child_chunks c
                JOIN child_chunk_embeddings e ON e.child_id = c.id
                JOIN parent_chunks p ON p.id = c.parent_id
                JOIN ingested_documents d ON d.document_id = c.document_id
                WHERE {scope}
                """
            ),
            {"course_code": course_code, "course_offering_id": course_offering_id},
        ).mappings().all()
        scored = []
        for row in rows:
            score = _cosine(query_embedding, row["embedding_json"] or [])
            scored.append((score, row))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [
            SemanticChildMatch(
                child_id=str(row["child_id"]),
                parent_id=str(row["parent_id"]),
                summary_id=str(row["summary_id"]),
                document_id=str(row["document_id"]),
                text=row["text"],
                distance=1.0 - score,
                score=score,
                source_scope=row["source_scope"],
                heading_lineage=row["heading_lineage"] or {},
                citation_anchor=row["citation_anchor"] or {},
                source=row["source"] or "lecturer upload",
            )
            for score, row in scored[:limit]
        ]

    @staticmethod
    def _scope_sql(alias: str) -> str:
        return (
            f"{alias}.course_code = :course_code AND ("
            f"(:course_offering_id IS NOT NULL AND {alias}.course_offering_id = :course_offering_id "
            f"AND {alias}.source_scope IN ('offering_only','course_shared_pending','course_shared_rejected','course_shared_approved')) "
            f"OR {alias}.source_scope = 'course_shared_approved')"
        )

    @staticmethod
    def _json(value: Any) -> str:
        import json

        return json.dumps(value, default=str)
