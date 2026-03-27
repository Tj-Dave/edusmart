# app/db/models.py
from __future__ import annotations

import enum
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Numeric,
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    BigInteger,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
# -----------------------------
# Notification System Enums & Models
# -----------------------------
class NotificationChannel(str, enum.Enum):
    in_app = "in_app"
    email = "email"
    push = "push"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)  # in_app, email, push
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    meta: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, name="metadata")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user = relationship("User")


class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    title_template: Mapped[str] = mapped_column(String(255), nullable=False)
    body_template: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    assignment_email: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    assignment_push: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    marketing_email: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    payment_email: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user = relationship("User")


# -----------------------------
# Enums (must match PostgreSQL enums)
# -----------------------------
class UserRole(str, enum.Enum):
    student = "student"
    lecturer = "lecturer"
    admin = "admin"


class AuthProvider(str, enum.Enum):
    local = "local"
    google = "google"


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


# -----------------------------
# courses
# -----------------------------
class Course(Base):
    """
    PK is course_code (TEXT) e.g. SWE3101
    """
    __tablename__ = "courses"

    course_code: Mapped[str] = mapped_column(Text, primary_key=True)
    course_name: Mapped[str] = mapped_column(Text, nullable=False)

    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    department: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    faculty: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    credits: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    offerings: Mapped[List["CourseOffering"]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint("length(trim(course_code)) > 0", name="courses_code_not_empty"),
        CheckConstraint("length(trim(course_name)) > 0", name="courses_name_not_empty"),
        Index("idx_courses_is_active", "is_active"),
    )


# -----------------------------
# course_offerings
# -----------------------------
class CourseOffering(Base):
    __tablename__ = "course_offerings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    course_code: Mapped[str] = mapped_column(
        Text,
        ForeignKey("courses.course_code", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    term: Mapped[str] = mapped_column(Text, nullable=False, index=True)  # e.g. 2026-S1
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    cohort: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    section: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    lecturer_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    enrollment_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True, unique=True)
    enrollment_key_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")


    # Relationships
    course: Mapped["Course"] = relationship(back_populates="offerings", lazy="joined")
    lecturer: Mapped[Optional["User"]] = relationship(foreign_keys=[lecturer_user_id])

    enrollments: Mapped[List["Enrollment"]] = relationship(
        back_populates="offering",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint("length(trim(term)) > 0", name="course_offerings_term_not_empty"),
        # ✅ matches your SQL: UNIQUE INDEX on (course_code, term, COALESCE(cohort,''), COALESCE(section,''))
        Index(
            "uq_course_offerings_identity",
            "course_code",
            "term",
            func.coalesce(cohort, ""),
            func.coalesce(section, ""),
            unique=True,
        ),
        Index("idx_course_offerings_course_code", "course_code"),
        Index("idx_course_offerings_term", "term"),
        Index("idx_course_offerings_lecturer", "lecturer_user_id"),
    )


# -----------------------------
# enrollments
# -----------------------------
class Enrollment(Base):
    __tablename__ = "enrollments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    offering_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_offerings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # kept TEXT with a CHECK like your SQL (no enum required)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="active")
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    offering: Mapped["CourseOffering"] = relationship(back_populates="enrollments", lazy="joined")
    user: Mapped["User"] = relationship(back_populates="enrollments")

    events: Mapped[List["EnrollmentEvent"]] = relationship(
        back_populates="enrollment",
        cascade="all, delete-orphan",
        order_by="EnrollmentEvent.id",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('active','dropped','completed','blocked')",
            name="enrollments_status_valid",
        ),
        UniqueConstraint("offering_id", "user_id", name="uq_enrollment_unique"),
        Index("idx_enrollments_user", "user_id"),
        Index("idx_enrollments_offering", "offering_id"),
    )


# -----------------------------
# enrollment_events
# -----------------------------
class EnrollmentEvent(Base):
    __tablename__ = "enrollment_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    enrollment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    actor_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    enrollment: Mapped["Enrollment"] = relationship(back_populates="events")
    actor: Mapped[Optional["User"]] = relationship(foreign_keys=[actor_user_id])

    __table_args__ = (
        CheckConstraint("length(trim(event_type)) > 0", name="enrollment_events_type_not_empty"),
        Index("idx_enrollment_events_enrollment", "enrollment_id"),
        Index("idx_enrollment_events_actor", "actor_user_id"),
    )


# -----------------------------
# users
# -----------------------------
class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    username: Mapped[str] = mapped_column(Text, nullable=False, unique=True)

    password_hash: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="user_role"), nullable=False)
    auth_provider: Mapped[AuthProvider] = mapped_column(
        SAEnum(AuthProvider, name="auth_provider"),
        nullable=False,
        server_default="local",
    )

    google_sub: Mapped[Optional[str]] = mapped_column(Text, nullable=True, unique=True)
    email: Mapped[Optional[str]] = mapped_column(Text, nullable=True, unique=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    profile: Mapped[Optional["UserProfile"]] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    auth_sessions: Mapped[List["AuthSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    chat_sessions: Mapped[List["ChatSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # ✅ new: enrollments
    enrollments: Mapped[List["Enrollment"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint(
            "(auth_provider <> 'local') OR (password_hash IS NOT NULL)",
            name="users_password_required_for_local",
        ),
    )


# -----------------------------
# user_profiles (1:1)
# -----------------------------
class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    full_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    university_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    department: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    faculty: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    program: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    year_of_study: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    phone: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="profile")


# -----------------------------
# auth_sessions (refresh tokens)
# -----------------------------
class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    refresh_token_hash: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(INET, nullable=True)

    user: Mapped["User"] = relationship(back_populates="auth_sessions")


# -----------------------------
# chat_sessions (one row per thread)
# -----------------------------
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ✅ now FK -> courses.course_code (ON DELETE SET NULL)
    course_id: Mapped[Optional[str]] = mapped_column(
        Text,
        ForeignKey("courses.course_code", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="chat_sessions")

    # Optional convenience relationship (not required, but helpful)
    course: Mapped[Optional["Course"]] = relationship()

    messages: Mapped[List["ChatMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.id",
    )

    memory_state: Mapped[Optional["MemoryState"]] = relationship(
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_chat_sessions_course_id", "course_id"),
    )


# -----------------------------
# chat_messages (turns)
# -----------------------------
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    session_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    role: Mapped[MessageRole] = mapped_column(SAEnum(MessageRole, name="message_role"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    session: Mapped["ChatSession"] = relationship(back_populates="messages")
    user: Mapped["User"] = relationship()

    __table_args__ = (
        CheckConstraint("length(trim(content)) > 0", name="chat_messages_content_not_empty"),
    )


# -----------------------------
# memory_state (summarization progress)
# -----------------------------
class MemoryState(Base):
    __tablename__ = "memory_state"

    session_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        primary_key=True,
    )

    last_summarized_message_id: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    session: Mapped["ChatSession"] = relationship(back_populates="memory_state")


# -----------------------------
# ingestion documents registry
# -----------------------------
class IngestionStatus(str, enum.Enum):
    queued = "queued"
    ingesting = "ingesting"
    partial_success = "partial_success"
    success = "success"
    failed = "failed"


class IngestedDocument(Base):
    """
    Registry for uploaded/ingested files.

    This is the source of truth for document_id stability.
    We dedupe by (course_id, uploader_user_id, file_hash).
    """
    __tablename__ = "ingested_documents"

    document_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    uploader_user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ✅ now FK -> courses.course_code (ON DELETE CASCADE)
    course_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("courses.course_code", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    original_filename: Mapped[str] = mapped_column(Text, nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # sha256 hex
    size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    storage_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[IngestionStatus] = mapped_column(
        SAEnum(IngestionStatus, name="ingestion_status"),
        nullable=False,
        server_default="queued",
        index=True,
    )

    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    total_chunks: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    stored_vectors: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    processed_images: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    ocr_pending: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    ocr_ingested_chunks: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    uploader: Mapped["User"] = relationship()
    course: Mapped["Course"] = relationship()

    __table_args__ = (
        UniqueConstraint("course_id", "uploader_user_id", "file_hash", name="uq_ingested_doc_course_uploader_hash"),
        Index("idx_ingested_documents_course_id", "course_id"),
    )

# -------------------------------------------------------------------
# Curriculum Spec + Roadmap + Assessments + Progress Tracking (NEW)
# -------------------------------------------------------------------

# -----------------------------
# Enums (new)
# -----------------------------
class CourseSpecStatus(str, enum.Enum):
    draft_extracted = "draft_extracted"
    lecturer_review = "lecturer_review"
    approved_active = "approved_active"
    archived = "archived"


class RoadmapItemStatus(str, enum.Enum):
    draft = "draft"
    approved_active = "approved_active"
    archived = "archived"


class AssessmentTaskType(str, enum.Enum):
    quiz = "quiz"
    assignment = "assignment"
    lab = "lab"
    project = "project"
    case_study = "case_study"
    simulation = "simulation"
    field_task = "field_task"
    reflection = "reflection"
    presentation = "presentation"
    peer_review = "peer_review"
    other = "other"


class AttemptScoringRule(str, enum.Enum):
    best = "best"
    latest = "latest"
    average = "average"
    first = "first"


class EnrollmentRoadmapStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    submitted = "submitted"
    completed = "completed"
    blocked = "blocked"
    skipped = "skipped"


class EnrollmentTaskStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    submitted = "submitted"
    graded = "graded"
    completed = "completed"


class AttemptScoreSource(str, enum.Enum):
    manual = "manual"
    ai_accepted = "ai_accepted"
    hybrid = "hybrid"
    legacy = "legacy"


class ComponentScoreSource(str, enum.Enum):
    manual = "manual"
    ai_accepted = "ai_accepted"
    legacy = "legacy"


class AiEvaluationStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


# -----------------------------
# offering_course_specs
# -----------------------------
class OfferingCourseSpec(Base):
    """
    Structured course spec extracted from an uploaded course blueprint document
    and approved by the lecturer.

    - 1 offering can have multiple specs over time (drafts, archived)
    - but only one can be approved_active at a time (enforced by app logic;
      optionally enforce with a partial unique index later).
    """
    __tablename__ = "offering_course_specs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    course_offering_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_offerings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # blueprint doc used (optional pointer; spec can exist even without doc link)
    source_document_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ingested_documents.document_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status: Mapped[CourseSpecStatus] = mapped_column(
        SAEnum(CourseSpecStatus, name="course_spec_status"),
        nullable=False,
        server_default="draft_extracted",
        index=True,
    )

    # Extracted structured content: CLOs, competencies, assessment plan, hours, etc.
    spec_json: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")

    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    approved_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships (optional)
    offering: Mapped["CourseOffering"] = relationship()
    source_document: Mapped[Optional["IngestedDocument"]] = relationship()
    created_by: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by_user_id])
    approved_by: Mapped[Optional["User"]] = relationship(foreign_keys=[approved_by_user_id])

    __table_args__ = (
        Index("idx_offering_course_specs_offering", "course_offering_id"),
        Index("idx_offering_course_specs_status", "status"),
        CheckConstraint("jsonb_typeof(spec_json) = 'object'", name="offering_course_specs_spec_json_object"),
    )


# -----------------------------
# offering_roadmap_items
# -----------------------------
class OfferingRoadmapItem(Base):
    __tablename__ = "offering_roadmap_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    course_offering_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_offerings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # traceability to the extracted spec snapshot that generated this roadmap
    spec_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("offering_course_specs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False)
    week_no: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    title: Mapped[str] = mapped_column(Text, nullable=False)
    key_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    teaching_activity: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    estimated_hours: Mapped[Optional[float]] = mapped_column(Numeric(4, 1), nullable=True)

    # Denormalized helper for UI (truth source is roadmap_assessment_tasks)
    assessment_task_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    status: Mapped[RoadmapItemStatus] = mapped_column(
        SAEnum(RoadmapItemStatus, name="roadmap_item_status"),
        nullable=False,
        server_default="draft",
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    offering: Mapped["CourseOffering"] = relationship()
    spec: Mapped[Optional["OfferingCourseSpec"]] = relationship()
    assessment_tasks: Mapped[List["RoadmapAssessmentTask"]] = relationship(
        back_populates="roadmap_item",
        cascade="all, delete-orphan",
        order_by="RoadmapAssessmentTask.display_order",
    )

    __table_args__ = (
        UniqueConstraint("course_offering_id", "sequence_no", name="uq_offering_roadmap_sequence"),
        CheckConstraint("sequence_no > 0", name="offering_roadmap_sequence_positive"),
        CheckConstraint("(week_no IS NULL) OR (week_no > 0)", name="offering_roadmap_week_positive"),
        CheckConstraint("length(trim(title)) > 0", name="offering_roadmap_title_not_empty"),
        Index("idx_offering_roadmap_offering", "course_offering_id"),
        Index("idx_offering_roadmap_status", "status"),
    )


# -----------------------------
# roadmap_assessment_tasks
# -----------------------------
class RoadmapAssessmentTask(Base):
    __tablename__ = "roadmap_assessment_tasks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    roadmap_item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("offering_roadmap_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(Text, nullable=False)

    task_type: Mapped[AssessmentTaskType] = mapped_column(
        SAEnum(AssessmentTaskType, name="assessment_task_type"),
        nullable=False,
        server_default="quiz",
        index=True,
    )

    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Practical-learning scaffolding fields (optional for non-practical tasks)
    practical_brief: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    required_tools: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expected_artifact: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    safety_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rubric_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    current_grading_scheme_version_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "task_grading_scheme_versions.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_roadmap_tasks_current_grading_scheme_version",
        ),
        nullable=True,
        index=True,
    )

    max_score: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, server_default="100")
    weight: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)

    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    # Lecturer-controlled attempt policy
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    attempt_scoring_rule: Mapped[AttemptScoringRule] = mapped_column(
        SAEnum(AttemptScoringRule, name="attempt_scoring_rule"),
        nullable=False,
        server_default="best",
    )

    # Lecturer-controlled late submission policy
    allow_late_submission: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    late_penalty_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    roadmap_item: Mapped["OfferingRoadmapItem"] = relationship(back_populates="assessment_tasks")
    current_grading_scheme_version: Mapped[Optional["TaskGradingSchemeVersion"]] = relationship(
        foreign_keys=[current_grading_scheme_version_id],
        post_update=True,
    )
    grading_scheme_versions: Mapped[List["TaskGradingSchemeVersion"]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskGradingSchemeVersion.version_no",
        foreign_keys="TaskGradingSchemeVersion.task_id",
    )
    task_results: Mapped[List["EnrollmentTaskResult"]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="EnrollmentTaskResult.attempt_no",
    )

    __table_args__ = (
        CheckConstraint("length(trim(title)) > 0", name="roadmap_tasks_title_not_empty"),
        CheckConstraint("max_attempts >= 1", name="roadmap_tasks_max_attempts_min_1"),
        CheckConstraint("max_score > 0", name="roadmap_tasks_max_score_positive"),
        CheckConstraint("(weight IS NULL) OR (weight >= 0)", name="roadmap_tasks_weight_nonneg"),
        CheckConstraint(
            "(late_penalty_percent IS NULL) OR (late_penalty_percent >= 0 AND late_penalty_percent <= 100)",
            name="roadmap_tasks_late_penalty_range",
        ),
        Index("idx_roadmap_tasks_item", "roadmap_item_id"),
        Index("idx_roadmap_tasks_active", "is_active"),
        Index("idx_roadmap_tasks_type", "task_type"),
        Index("idx_roadmap_tasks_current_scheme", "current_grading_scheme_version_id"),
    )


# -----------------------------
# enrollment_roadmap_progress
# -----------------------------
class EnrollmentRoadmapProgress(Base):
    __tablename__ = "enrollment_roadmap_progress"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    enrollment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    roadmap_item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("offering_roadmap_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[EnrollmentRoadmapStatus] = mapped_column(
        SAEnum(EnrollmentRoadmapStatus, name="enrollment_roadmap_status"),
        nullable=False,
        server_default="not_started",
        index=True,
    )

    completion_percent: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    # rollup performance (optional but helpful)
    avg_score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    best_score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    total_score: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    max_total_score: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    enrollment: Mapped["Enrollment"] = relationship()
    roadmap_item: Mapped["OfferingRoadmapItem"] = relationship()

    __table_args__ = (
        UniqueConstraint("enrollment_id", "roadmap_item_id", name="uq_enrollment_roadmap_unique"),
        CheckConstraint("completion_percent >= 0 AND completion_percent <= 100", name="enrollment_progress_pct_range"),
        Index("idx_enrollment_roadmap_enrollment", "enrollment_id"),
        Index("idx_enrollment_roadmap_item", "roadmap_item_id"),
        Index("idx_enrollment_roadmap_status", "status"),
    )


# -----------------------------
# enrollment_task_results (per attempt)
# -----------------------------
class EnrollmentTaskResult(Base):
    __tablename__ = "enrollment_task_results"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    enrollment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roadmap_assessment_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[EnrollmentTaskStatus] = mapped_column(
        SAEnum(EnrollmentTaskStatus, name="enrollment_task_status"),
        nullable=False,
        server_default="not_started",
        index=True,
    )

    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")

    score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    score_source: Mapped[Optional[AttemptScoreSource]] = mapped_column(
        SAEnum(AttemptScoreSource, name="attempt_score_source"),
        nullable=True,
        index=True,
    )

    # snapshots protect history if lecturer edits task definition later
    max_score_snapshot: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, server_default="100")
    weight_snapshot: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    grading_scheme_version_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_grading_scheme_versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    latest_ai_evaluation_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "attempt_ai_evaluations.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_enrollment_task_results_latest_ai_evaluation",
        ),
        nullable=True,
        index=True,
    )

    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    graded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    graded_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Practical evidence and rubric scoring metadata
    artifact_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reflection_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submission_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rubric_scores_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    enrollment: Mapped["Enrollment"] = relationship()
    task: Mapped["RoadmapAssessmentTask"] = relationship(back_populates="task_results")
    graded_by: Mapped[Optional["User"]] = relationship(foreign_keys=[graded_by_user_id])
    grading_scheme_version: Mapped[Optional["TaskGradingSchemeVersion"]] = relationship()
    latest_ai_evaluation: Mapped[Optional["AttemptAiEvaluation"]] = relationship(
        foreign_keys=[latest_ai_evaluation_id],
        post_update=True,
    )
    component_scores: Mapped[List["AttemptComponentScore"]] = relationship(
        back_populates="attempt",
        cascade="all, delete-orphan",
        order_by="AttemptComponentScore.created_at",
    )
    ai_evaluations: Mapped[List["AttemptAiEvaluation"]] = relationship(
        back_populates="attempt",
        cascade="all, delete-orphan",
        order_by="AttemptAiEvaluation.created_at",
        foreign_keys="AttemptAiEvaluation.attempt_id",
    )

    __table_args__ = (
        UniqueConstraint("enrollment_id", "task_id", "attempt_no", name="uq_enrollment_task_attempt"),
        CheckConstraint("attempt_no >= 1", name="enrollment_task_attempt_min_1"),
        CheckConstraint("(score IS NULL) OR (score >= 0)", name="enrollment_task_score_nonneg"),
        Index("idx_enrollment_task_enrollment", "enrollment_id"),
        Index("idx_enrollment_task_task", "task_id"),
        Index("idx_enrollment_task_grader", "graded_by_user_id"),
        Index("idx_enrollment_task_status", "status"),
        Index("idx_enrollment_task_scheme", "grading_scheme_version_id"),
        Index("idx_enrollment_task_latest_ai_eval", "latest_ai_evaluation_id"),
    )


# -----------------------------
# grading_templates
# -----------------------------
class GradingTemplate(Base):
    __tablename__ = "grading_templates"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    owner_user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    latest_version_no: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    owner: Mapped["User"] = relationship()
    versions: Mapped[List["GradingTemplateVersion"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="GradingTemplateVersion.version_no",
    )

    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="grading_templates_name_not_empty"),
        CheckConstraint("latest_version_no >= 1", name="grading_templates_latest_version_min_1"),
        Index("idx_grading_templates_owner", "owner_user_id"),
        Index("idx_grading_templates_active", "is_active"),
    )


class GradingTemplateVersion(Base):
    __tablename__ = "grading_template_versions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    template_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grading_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    scheme_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    auto_grading_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    auto_grading_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    template: Mapped["GradingTemplate"] = relationship(back_populates="versions")
    created_by: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by_user_id])
    components: Mapped[List["GradingTemplateComponent"]] = relationship(
        back_populates="template_version",
        cascade="all, delete-orphan",
        order_by="GradingTemplateComponent.display_order",
    )

    __table_args__ = (
        UniqueConstraint("template_id", "version_no", name="uq_grading_template_version"),
        CheckConstraint("version_no >= 1", name="grading_template_versions_version_min_1"),
        Index("idx_grading_template_versions_template", "template_id"),
    )


class GradingTemplateComponent(Base):
    __tablename__ = "grading_template_components"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    template_version_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grading_template_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    component_key: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    max_points: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_auto_gradable: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    manual_only: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    template_version: Mapped["GradingTemplateVersion"] = relationship(back_populates="components")
    rubric_levels: Mapped[List["GradingTemplateRubricLevel"]] = relationship(
        back_populates="component",
        cascade="all, delete-orphan",
        order_by="GradingTemplateRubricLevel.display_order",
    )

    __table_args__ = (
        UniqueConstraint("template_version_id", "component_key", name="uq_grading_template_component_key"),
        CheckConstraint("length(trim(component_key)) > 0", name="grading_template_components_key_not_empty"),
        CheckConstraint("length(trim(label)) > 0", name="grading_template_components_label_not_empty"),
        CheckConstraint("max_points > 0", name="grading_template_components_points_positive"),
        CheckConstraint("display_order >= 0", name="grading_template_components_display_order_nonneg"),
        CheckConstraint("(manual_only = false) OR (is_auto_gradable = false)", name="grading_template_components_manual_only_rule"),
        Index("idx_grading_template_components_version", "template_version_id"),
    )


class GradingTemplateRubricLevel(Base):
    __tablename__ = "grading_template_rubric_levels"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    component_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grading_template_components.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    label: Mapped[str] = mapped_column(Text, nullable=False)
    min_points: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    max_points: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    descriptor: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    component: Mapped["GradingTemplateComponent"] = relationship(back_populates="rubric_levels")

    __table_args__ = (
        CheckConstraint("length(trim(label)) > 0", name="grading_template_rubric_label_not_empty"),
        CheckConstraint("length(trim(descriptor)) > 0", name="grading_template_rubric_descriptor_not_empty"),
        CheckConstraint("min_points >= 0", name="grading_template_rubric_min_nonneg"),
        CheckConstraint("max_points >= min_points", name="grading_template_rubric_range_valid"),
        CheckConstraint("display_order >= 0", name="grading_template_rubric_display_order_nonneg"),
        Index("idx_grading_template_rubric_component", "component_id"),
    )


# -----------------------------
# task_grading_scheme_versions
# -----------------------------
class TaskGradingSchemeVersion(Base):
    __tablename__ = "task_grading_scheme_versions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roadmap_assessment_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    scheme_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_template_version_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grading_template_versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    auto_grading_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    auto_grading_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    task: Mapped["RoadmapAssessmentTask"] = relationship(
        back_populates="grading_scheme_versions",
        foreign_keys=[task_id],
    )
    source_template_version: Mapped[Optional["GradingTemplateVersion"]] = relationship()
    created_by: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by_user_id])
    components: Mapped[List["TaskGradingComponent"]] = relationship(
        back_populates="scheme_version",
        cascade="all, delete-orphan",
        order_by="TaskGradingComponent.display_order",
    )

    __table_args__ = (
        UniqueConstraint("task_id", "version_no", name="uq_task_grading_scheme_version"),
        CheckConstraint("version_no >= 1", name="task_grading_scheme_versions_version_min_1"),
        Index("idx_task_grading_scheme_versions_task", "task_id"),
        Index("idx_task_grading_scheme_versions_template", "source_template_version_id"),
    )


class TaskGradingComponent(Base):
    __tablename__ = "task_grading_components"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    scheme_version_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_grading_scheme_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    component_key: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    max_points: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_auto_gradable: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    manual_only: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    scheme_version: Mapped["TaskGradingSchemeVersion"] = relationship(back_populates="components")
    rubric_levels: Mapped[List["TaskComponentRubricLevel"]] = relationship(
        back_populates="component",
        cascade="all, delete-orphan",
        order_by="TaskComponentRubricLevel.display_order",
    )
    component_scores: Mapped[List["AttemptComponentScore"]] = relationship(back_populates="component")
    ai_suggestions: Mapped[List["AttemptAiComponentSuggestion"]] = relationship(back_populates="component")

    __table_args__ = (
        UniqueConstraint("scheme_version_id", "component_key", name="uq_task_grading_component_key"),
        CheckConstraint("length(trim(component_key)) > 0", name="task_grading_components_key_not_empty"),
        CheckConstraint("length(trim(label)) > 0", name="task_grading_components_label_not_empty"),
        CheckConstraint("max_points > 0", name="task_grading_components_points_positive"),
        CheckConstraint("display_order >= 0", name="task_grading_components_display_order_nonneg"),
        CheckConstraint("(manual_only = false) OR (is_auto_gradable = false)", name="task_grading_components_manual_only_rule"),
        Index("idx_task_grading_components_scheme", "scheme_version_id"),
    )


class TaskComponentRubricLevel(Base):
    __tablename__ = "task_component_rubric_levels"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    component_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_grading_components.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    label: Mapped[str] = mapped_column(Text, nullable=False)
    min_points: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    max_points: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    descriptor: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    component: Mapped["TaskGradingComponent"] = relationship(back_populates="rubric_levels")

    __table_args__ = (
        CheckConstraint("length(trim(label)) > 0", name="task_component_rubric_label_not_empty"),
        CheckConstraint("length(trim(descriptor)) > 0", name="task_component_rubric_descriptor_not_empty"),
        CheckConstraint("min_points >= 0", name="task_component_rubric_min_nonneg"),
        CheckConstraint("max_points >= min_points", name="task_component_rubric_range_valid"),
        CheckConstraint("display_order >= 0", name="task_component_rubric_display_order_nonneg"),
        Index("idx_task_component_rubric_component", "component_id"),
    )


# -----------------------------
# attempt-level grading artifacts
# -----------------------------
class AttemptAiEvaluation(Base):
    __tablename__ = "attempt_ai_evaluations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    attempt_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("enrollment_task_results.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[AiEvaluationStatus] = mapped_column(
        SAEnum(AiEvaluationStatus, name="ai_evaluation_status"),
        nullable=False,
        server_default="pending",
        index=True,
    )
    trigger_source: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    provider: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    model_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    overall_confidence: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    suggested_total_score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    raw_response_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    error_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    attempt: Mapped["EnrollmentTaskResult"] = relationship(
        back_populates="ai_evaluations",
        foreign_keys=[attempt_id],
    )
    component_suggestions: Mapped[List["AttemptAiComponentSuggestion"]] = relationship(
        back_populates="evaluation",
        cascade="all, delete-orphan",
        order_by="AttemptAiComponentSuggestion.created_at",
    )

    __table_args__ = (
        CheckConstraint(
            "(overall_confidence IS NULL) OR (overall_confidence >= 0 AND overall_confidence <= 1)",
            name="attempt_ai_eval_confidence_range",
        ),
        CheckConstraint(
            "(suggested_total_score IS NULL) OR (suggested_total_score >= 0)",
            name="attempt_ai_eval_total_nonneg",
        ),
        Index("idx_attempt_ai_evaluations_attempt", "attempt_id"),
        Index("idx_attempt_ai_evaluations_status", "status"),
    )


class AttemptAiComponentSuggestion(Base):
    __tablename__ = "attempt_ai_component_suggestions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    evaluation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attempt_ai_evaluations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    component_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_grading_components.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    suggested_score: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    confidence: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    evaluation: Mapped["AttemptAiEvaluation"] = relationship(back_populates="component_suggestions")
    component: Mapped["TaskGradingComponent"] = relationship(back_populates="ai_suggestions")

    __table_args__ = (
        UniqueConstraint("evaluation_id", "component_id", name="uq_attempt_ai_component_suggestion"),
        CheckConstraint("suggested_score >= 0", name="attempt_ai_component_suggestion_score_nonneg"),
        CheckConstraint(
            "(confidence IS NULL) OR (confidence >= 0 AND confidence <= 1)",
            name="attempt_ai_component_suggestion_confidence_range",
        ),
        Index("idx_attempt_ai_component_suggestions_eval", "evaluation_id"),
        Index("idx_attempt_ai_component_suggestions_component", "component_id"),
    )


class AttemptComponentScore(Base):
    __tablename__ = "attempt_component_scores"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    attempt_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("enrollment_task_results.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    component_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_grading_components.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    score: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[ComponentScoreSource] = mapped_column(
        SAEnum(ComponentScoreSource, name="component_score_source"),
        nullable=False,
        server_default="manual",
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    attempt: Mapped["EnrollmentTaskResult"] = relationship(back_populates="component_scores")
    component: Mapped["TaskGradingComponent"] = relationship(back_populates="component_scores")
    created_by: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by_user_id])

    __table_args__ = (
        UniqueConstraint("attempt_id", "component_id", name="uq_attempt_component_score"),
        CheckConstraint("score >= 0", name="attempt_component_score_nonneg"),
        Index("idx_attempt_component_scores_attempt", "attempt_id"),
        Index("idx_attempt_component_scores_component", "component_id"),
    )


# -----------------------------
# student_gamification_profiles
# -----------------------------
class StudentGamificationProfile(Base):
    __tablename__ = "student_gamification_profiles"

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    xp_total: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    level: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    streak_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    last_activity_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship()

    __table_args__ = (
        CheckConstraint("xp_total >= 0", name="gamification_profile_xp_nonneg"),
        CheckConstraint("level >= 1", name="gamification_profile_level_min_1"),
        CheckConstraint("streak_days >= 0", name="gamification_profile_streak_nonneg"),
    )


# -----------------------------
# student_badges
# -----------------------------
class StudentBadge(Base):
    __tablename__ = "student_badges"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    badge_code: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship()

    __table_args__ = (
        UniqueConstraint("user_id", "badge_code", name="uq_student_badge_user_code"),
        CheckConstraint("length(trim(badge_code)) > 0", name="student_badges_code_not_empty"),
        CheckConstraint("length(trim(title)) > 0", name="student_badges_title_not_empty"),
        Index("idx_student_badges_user", "user_id"),
        Index("idx_student_badges_code", "badge_code"),
    )


# -----------------------------
# xp_events
# -----------------------------
class XpEvent(Base):
    __tablename__ = "xp_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    enrollment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("enrollments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    xp_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship()
    enrollment: Mapped[Optional["Enrollment"]] = relationship()

    __table_args__ = (
        CheckConstraint("length(trim(event_type)) > 0", name="xp_events_type_not_empty"),
        CheckConstraint("xp_delta <> 0", name="xp_events_delta_nonzero"),
        Index("idx_xp_events_user", "user_id"),
        Index("idx_xp_events_enrollment", "enrollment_id"),
        Index("idx_xp_events_type", "event_type"),
    )
