"""admin governance foundation

Revision ID: 9bd94f83f34c
Revises: 47bf113d1142
Create Date: 2026-04-27 10:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "9bd94f83f34c"
down_revision: Union[str, Sequence[str], None] = "47bf113d1142"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'teaching_assistant'")
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'department_head'")

    op.create_table(
        "institution_settings",
        sa.Column("id", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column(
            "university_name",
            sa.String(length=255),
            nullable=False,
            server_default=sa.text("'EduSmart Institution'"),
        ),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column(
            "academic_calendar_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "policy_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("email_policy_mode", sa.String(length=32), nullable=False, server_default=sa.text("'none'")),
        sa.Column("allowed_email_domains", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("email_whitelist_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("email_blacklist_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("rag_model_name", sa.String(length=128), nullable=True),
        sa.Column("rag_embedding_strategy", sa.String(length=128), nullable=True),
        sa.Column("rag_last_rebuild_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rag_rebuild_requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("length(trim(university_name)) > 0", name="institution_settings_name_not_empty"),
        sa.CheckConstraint(
            "email_policy_mode IN ('none','allowlist','denylist')",
            name="institution_settings_email_policy_mode_valid",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(academic_calendar_json) = 'object'",
            name="institution_settings_calendar_object",
        ),
        sa.CheckConstraint("jsonb_typeof(policy_json) = 'object'", name="institution_settings_policy_object"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute("INSERT INTO institution_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING")

    op.create_table(
        "faculties",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("length(trim(name)) > 0", name="faculties_name_not_empty"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "departments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("faculty_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("length(trim(name)) > 0", name="departments_name_not_empty"),
        sa.ForeignKeyConstraint(["faculty_id"], ["faculties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("faculty_id", "name", name="uq_departments_faculty_name"),
    )
    op.create_index("idx_departments_faculty_id", "departments", ["faculty_id"], unique=False)

    op.execute(
        """
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS trigger AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_institution_settings_updated_at
        BEFORE UPDATE ON institution_settings
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_faculties_updated_at
        BEFORE UPDATE ON faculties
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_departments_updated_at
        BEFORE UPDATE ON departments
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_departments_faculty_id", table_name="departments")
    op.execute("DROP TRIGGER IF EXISTS trg_departments_updated_at ON departments")
    op.execute("DROP TRIGGER IF EXISTS trg_faculties_updated_at ON faculties")
    op.execute("DROP TRIGGER IF EXISTS trg_institution_settings_updated_at ON institution_settings")
    op.drop_table("departments")
    op.drop_table("faculties")
    op.drop_table("institution_settings")
    # PostgreSQL enum values are intentionally retained.
