# app/db/models.py
from __future__ import annotations

import enum
from typing import List, Optional
from datetime import datetime

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

    # Mirrors your DB CHECK: local auth must have a password_hash
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
        primary_key=True
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
    course_id: Mapped[str] = mapped_column(Text, nullable=True, index=True)
    title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="chat_sessions")

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

    # who uploaded
    uploader_user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # course scope (string because your course table isn't shown yet)
    course_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)

    # file identity
    original_filename: Mapped[str] = mapped_column(Text, nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # sha256 hex
    size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # optional storage pointer (local path / s3 key / etc)
    storage_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ingestion status
    status: Mapped[IngestionStatus] = mapped_column(
        SAEnum(IngestionStatus, name="ingestion_status"),
        nullable=False,
        server_default="queued",
        index=True,
    )

    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # useful counters
    total_chunks: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    stored_vectors: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    processed_images: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    ocr_pending: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    ocr_ingested_chunks: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    uploader: Mapped["User"] = relationship()

    __table_args__ = (
        UniqueConstraint("course_id", "uploader_user_id", "file_hash", name="uq_ingested_doc_course_uploader_hash"),
    )
