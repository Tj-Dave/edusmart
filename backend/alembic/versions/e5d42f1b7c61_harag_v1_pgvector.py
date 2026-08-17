"""harag v1 pgvector

Revision ID: e5d42f1b7c61
Revises: 9bd94f83f34c
Create Date: 2026-05-10 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "e5d42f1b7c61"
down_revision: Union[str, Sequence[str], None] = "9bd94f83f34c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.add_column("ingested_documents", sa.Column("course_offering_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(
        "ingested_documents",
        sa.Column("source_scope", sa.Text(), nullable=False, server_default="offering_only"),
    )
    op.create_index("ix_ingested_documents_course_offering_id", "ingested_documents", ["course_offering_id"])
    op.create_index("ix_ingested_documents_source_scope", "ingested_documents", ["source_scope"])
    op.create_foreign_key(
        "fk_ingested_documents_course_offering_id",
        "ingested_documents",
        "course_offerings",
        ["course_offering_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_check_constraint(
        "ingested_documents_source_scope_valid",
        "ingested_documents",
        "source_scope IN ('offering_only','course_shared_pending','course_shared_approved','course_shared_rejected')",
    )
    op.drop_constraint("uq_ingested_doc_course_uploader_hash", "ingested_documents", type_="unique")
    op.create_unique_constraint(
        "uq_ingested_doc_course_offering_uploader_hash",
        "ingested_documents",
        ["course_id", "course_offering_id", "uploader_user_id", "file_hash"],
    )

    jsonb = postgresql.JSONB(astext_type=sa.Text())
    uuid = postgresql.UUID(as_uuid=True)

    op.create_table(
        "document_sections",
        sa.Column("id", uuid, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", uuid, nullable=False),
        sa.Column("course_offering_id", uuid, nullable=True),
        sa.Column("course_code", sa.Text(), nullable=False),
        sa.Column("heading_level", sa.Integer(), nullable=False),
        sa.Column("heading_text", sa.Text(), nullable=False),
        sa.Column("heading_lineage", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("section_order", sa.Integer(), nullable=False),
        sa.Column("char_start", sa.Integer(), nullable=True),
        sa.Column("char_end", sa.Integer(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("source_scope", sa.Text(), nullable=False, server_default="offering_only"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("heading_level >= 1", name="document_sections_heading_level_positive"),
        sa.ForeignKeyConstraint(["document_id"], ["ingested_documents.document_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_document_sections_doc_order", "document_sections", ["document_id", "section_order"])
    op.create_index("ix_document_sections_course_code", "document_sections", ["course_code"])
    op.create_index("ix_document_sections_course_offering_id", "document_sections", ["course_offering_id"])
    op.create_index("ix_document_sections_document_id", "document_sections", ["document_id"])
    op.create_index("ix_document_sections_source_scope", "document_sections", ["source_scope"])

    op.create_table(
        "h1_summaries",
        sa.Column("id", uuid, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", uuid, nullable=False),
        sa.Column("section_id", uuid, nullable=False),
        sa.Column("course_offering_id", uuid, nullable=True),
        sa.Column("course_code", sa.Text(), nullable=False),
        sa.Column("h1_title", sa.Text(), nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_scope", sa.Text(), nullable=False, server_default="offering_only"),
        sa.Column("metadata", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["document_id"], ["ingested_documents.document_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["section_id"], ["document_sections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for name in ("course_code", "course_offering_id", "document_id", "section_id", "source_scope"):
        op.create_index(f"ix_h1_summaries_{name}", "h1_summaries", [name])

    op.create_table(
        "parent_chunks",
        sa.Column("id", uuid, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", uuid, nullable=False),
        sa.Column("summary_id", uuid, nullable=False),
        sa.Column("section_id", uuid, nullable=False),
        sa.Column("course_offering_id", uuid, nullable=True),
        sa.Column("course_code", sa.Text(), nullable=False),
        sa.Column("chunk_order", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("heading_lineage", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("citation_anchor", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("char_start", sa.Integer(), nullable=True),
        sa.Column("char_end", sa.Integer(), nullable=True),
        sa.Column("source_scope", sa.Text(), nullable=False, server_default="offering_only"),
        sa.Column("metadata", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["document_id"], ["ingested_documents.document_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["section_id"], ["document_sections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["summary_id"], ["h1_summaries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_parent_chunks_doc_order", "parent_chunks", ["document_id", "chunk_order"])
    for name in ("course_code", "course_offering_id", "document_id", "section_id", "source_scope", "summary_id"):
        op.create_index(f"ix_parent_chunks_{name}", "parent_chunks", [name])

    op.create_table(
        "child_chunks",
        sa.Column("id", uuid, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", uuid, nullable=False),
        sa.Column("parent_id", uuid, nullable=False),
        sa.Column("summary_id", uuid, nullable=False),
        sa.Column("course_offering_id", uuid, nullable=True),
        sa.Column("course_code", sa.Text(), nullable=False),
        sa.Column("chunk_order", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("overlap_prev_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("heading_lineage", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("char_start", sa.Integer(), nullable=True),
        sa.Column("char_end", sa.Integer(), nullable=True),
        sa.Column("source_scope", sa.Text(), nullable=False, server_default="offering_only"),
        sa.Column("metadata", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["document_id"], ["ingested_documents.document_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["parent_chunks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["summary_id"], ["h1_summaries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_child_chunks_doc_order", "child_chunks", ["document_id", "chunk_order"])
    op.create_index("idx_child_chunks_scope", "child_chunks", ["course_code", "course_offering_id", "source_scope"])
    for name in ("course_code", "course_offering_id", "document_id", "parent_id", "source_scope", "summary_id"):
        op.create_index(f"ix_child_chunks_{name}", "child_chunks", [name])

    op.create_table(
        "child_chunk_embeddings",
        sa.Column("child_id", uuid, nullable=False),
        sa.Column("embedding_json", jsonb, nullable=False),
        sa.Column("embedding_model", sa.Text(), nullable=False),
        sa.Column("embedding_dim", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["child_id"], ["child_chunks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("child_id"),
    )
    op.execute("ALTER TABLE child_chunk_embeddings ADD COLUMN embedding vector(768)")
    op.execute("CREATE INDEX idx_child_chunk_embeddings_vector ON child_chunk_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)")

    op.create_table(
        "extracted_entities",
        sa.Column("id", uuid, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", uuid, nullable=False),
        sa.Column("child_id", uuid, nullable=False),
        sa.Column("course_offering_id", uuid, nullable=True),
        sa.Column("course_code", sa.Text(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("entity_type", sa.Text(), nullable=False, server_default="concept"),
        sa.Column("confidence", sa.Numeric(5, 4), nullable=True),
        sa.Column("metadata", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["child_id"], ["child_chunks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_id"], ["ingested_documents.document_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for name in ("child_id", "course_code", "course_offering_id", "document_id"):
        op.create_index(f"ix_extracted_entities_{name}", "extracted_entities", [name])

    op.create_table(
        "extracted_relationships",
        sa.Column("id", uuid, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", uuid, nullable=False),
        sa.Column("child_id", uuid, nullable=False),
        sa.Column("course_offering_id", uuid, nullable=True),
        sa.Column("course_code", sa.Text(), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("predicate", sa.Text(), nullable=False),
        sa.Column("object", sa.Text(), nullable=False),
        sa.Column("evidence_text", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 4), nullable=True),
        sa.Column("extraction_method", sa.Text(), nullable=False, server_default="local_llm"),
        sa.Column("metadata", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["child_id"], ["child_chunks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_id"], ["ingested_documents.document_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_extracted_relationships_lookup", "extracted_relationships", ["course_code", "course_offering_id"])
    for name in ("child_id", "course_code", "course_offering_id", "document_id"):
        op.create_index(f"ix_extracted_relationships_{name}", "extracted_relationships", [name])

    op.create_table(
        "document_sharing_requests",
        sa.Column("id", uuid, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", uuid, nullable=False),
        sa.Column("course_offering_id", uuid, nullable=True),
        sa.Column("course_code", sa.Text(), nullable=False),
        sa.Column("requested_by_user_id", uuid, nullable=True),
        sa.Column("reviewed_by_user_id", uuid, nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('pending','approved','rejected')", name="document_sharing_requests_status_valid"),
        sa.ForeignKeyConstraint(["course_offering_id"], ["course_offerings.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["document_id"], ["ingested_documents.document_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    for name in ("course_code", "course_offering_id", "document_id", "requested_by_user_id", "reviewed_by_user_id", "status"):
        op.create_index(f"ix_document_sharing_requests_{name}", "document_sharing_requests", [name])

    op.create_table(
        "retrieval_runs",
        sa.Column("id", uuid, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("query_text", sa.Text(), nullable=False),
        sa.Column("user_id", uuid, nullable=True),
        sa.Column("session_id", uuid, nullable=True),
        sa.Column("course_offering_id", uuid, nullable=True),
        sa.Column("course_code", sa.Text(), nullable=True),
        sa.Column("triggered", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("channel_weights", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("trace_json", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    for name in ("course_code", "course_offering_id", "session_id", "user_id"):
        op.create_index(f"ix_retrieval_runs_{name}", "retrieval_runs", [name])

    op.create_table(
        "retrieval_evidence",
        sa.Column("id", uuid, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("retrieval_run_id", uuid, nullable=False),
        sa.Column("child_id", uuid, nullable=True),
        sa.Column("parent_id", uuid, nullable=True),
        sa.Column("summary_id", uuid, nullable=True),
        sa.Column("channel", sa.Text(), nullable=False),
        sa.Column("score", sa.Numeric(10, 6), nullable=True),
        sa.Column("metadata", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["child_id"], ["child_chunks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["parent_id"], ["parent_chunks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["retrieval_run_id"], ["retrieval_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["summary_id"], ["h1_summaries.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    for name in ("child_id", "parent_id", "retrieval_run_id", "summary_id"):
        op.create_index(f"ix_retrieval_evidence_{name}", "retrieval_evidence", [name])

    op.create_table(
        "grounding_checks",
        sa.Column("id", uuid, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("retrieval_run_id", uuid, nullable=True),
        sa.Column("message_id", sa.BigInteger(), nullable=True),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("supported_claims", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unsupported_claims", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("coverage_score", sa.Numeric(6, 5), nullable=True),
        sa.Column("diagnostics", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["retrieval_run_id"], ["retrieval_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_grounding_checks_message_id", "grounding_checks", ["message_id"])
    op.create_index("ix_grounding_checks_retrieval_run_id", "grounding_checks", ["retrieval_run_id"])

    op.create_table(
        "retrieval_eval_sets",
        sa.Column("id", uuid, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("course_code", sa.Text(), nullable=True),
        sa.Column("dataset_json", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_by_user_id", uuid, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_retrieval_eval_sets_course_code", "retrieval_eval_sets", ["course_code"])
    op.create_index("ix_retrieval_eval_sets_created_by_user_id", "retrieval_eval_sets", ["created_by_user_id"])

    op.create_table(
        "retrieval_eval_results",
        sa.Column("id", uuid, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("eval_set_id", uuid, nullable=True),
        sa.Column("metrics_json", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("result_json", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["eval_set_id"], ["retrieval_eval_sets.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_retrieval_eval_results_eval_set_id", "retrieval_eval_results", ["eval_set_id"])


def downgrade() -> None:
    for table in (
        "retrieval_eval_results",
        "retrieval_eval_sets",
        "grounding_checks",
        "retrieval_evidence",
        "retrieval_runs",
        "document_sharing_requests",
        "extracted_relationships",
        "extracted_entities",
        "child_chunk_embeddings",
        "child_chunks",
        "parent_chunks",
        "h1_summaries",
        "document_sections",
    ):
        op.drop_table(table)
    op.drop_constraint("uq_ingested_doc_course_offering_uploader_hash", "ingested_documents", type_="unique")
    op.create_unique_constraint(
        "uq_ingested_doc_course_uploader_hash",
        "ingested_documents",
        ["course_id", "uploader_user_id", "file_hash"],
    )
    op.drop_constraint("ingested_documents_source_scope_valid", "ingested_documents", type_="check")
    op.drop_constraint("fk_ingested_documents_course_offering_id", "ingested_documents", type_="foreignkey")
    op.drop_index("ix_ingested_documents_source_scope", table_name="ingested_documents")
    op.drop_index("ix_ingested_documents_course_offering_id", table_name="ingested_documents")
    op.drop_column("ingested_documents", "source_scope")
    op.drop_column("ingested_documents", "course_offering_id")
