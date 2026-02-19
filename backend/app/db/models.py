# app/db/models.py
from __future__ import annotations

import enum
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
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
from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


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
