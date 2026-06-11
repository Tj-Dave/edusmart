from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


UserRoleType = Literal[
    "admin",
    "lecturer",
    "student",
    "teaching_assistant",
    "department_head",
]


class AdminUserProfileOut(BaseModel):
    full_name: Optional[str] = None
    university_id: Optional[str] = None
    department: Optional[str] = None
    faculty: Optional[str] = None
    program: Optional[str] = None
    year_of_study: Optional[int] = None
    phone: Optional[str] = None

    class Config:
        from_attributes = True


class AdminUserOut(BaseModel):
    id: UUID
    username: str
    email: Optional[str] = None
    role: str
    auth_provider: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    profile: Optional[AdminUserProfileOut] = None

    class Config:
        from_attributes = True


class AdminUserCreateRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=120)
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=6, max_length=256)
    role: UserRoleType

    full_name: Optional[str] = None
    university_id: Optional[str] = None
    department: Optional[str] = None
    faculty: Optional[str] = None
    program: Optional[str] = None
    year_of_study: Optional[int] = None
    phone: Optional[str] = None


class AdminUserUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[UserRoleType] = None
    is_active: Optional[bool] = None
    full_name: Optional[str] = None
    university_id: Optional[str] = None
    department: Optional[str] = None
    faculty: Optional[str] = None
    program: Optional[str] = None
    year_of_study: Optional[int] = None
    phone: Optional[str] = None


class FacultyOut(BaseModel):
    id: UUID
    name: str
    code: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class DepartmentOut(BaseModel):
    id: UUID
    faculty_id: UUID
    name: str
    code: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class InstitutionConfigUpdateRequest(BaseModel):
    university_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    logo_url: Optional[str] = None
    academic_calendar: Optional[dict[str, Any]] = None
    policy: Optional[dict[str, Any]] = None

    email_policy_mode: Optional[Literal["none", "allowlist", "denylist"]] = None
    allowed_email_domains: Optional[list[str]] = None
    email_whitelist: Optional[list[str]] = None
    email_blacklist: Optional[list[str]] = None

    rag_model_name: Optional[str] = None
    rag_embedding_strategy: Optional[str] = None


class InstitutionConfigOut(BaseModel):
    id: int
    university_name: str
    logo_url: Optional[str] = None
    academic_calendar: dict[str, Any]
    policy: dict[str, Any]
    email_policy_mode: str
    allowed_email_domains: list[str] = Field(default_factory=list)
    email_whitelist: list[str] = Field(default_factory=list)
    email_blacklist: list[str] = Field(default_factory=list)
    rag_model_name: Optional[str] = None
    rag_embedding_strategy: Optional[str] = None
    rag_last_rebuild_at: Optional[datetime] = None
    rag_rebuild_requested_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    faculties: list[FacultyOut] = Field(default_factory=list)
    departments: list[DepartmentOut] = Field(default_factory=list)


class FacultyCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: Optional[str] = Field(default=None, max_length=64)


class FacultyUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    code: Optional[str] = Field(default=None, max_length=64)
    is_active: Optional[bool] = None


class DepartmentCreateRequest(BaseModel):
    faculty_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    code: Optional[str] = Field(default=None, max_length=64)


class DepartmentUpdateRequest(BaseModel):
    faculty_id: Optional[UUID] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    code: Optional[str] = Field(default=None, max_length=64)
    is_active: Optional[bool] = None


class RAGMonitoringOverviewOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    ingestion: dict[str, Any]
    vector_store: dict[str, Any]
    query_performance: dict[str, Any]
    infrastructure: dict[str, Any]
    rag_config: dict[str, Any]
    model_config_data: dict[str, Any] = Field(default_factory=dict, alias="model_config")


class RAGControlRequest(BaseModel):
    rag_model_name: Optional[str] = None
    rag_embedding_strategy: Optional[str] = None
    request_rebuild: bool = False


class ActionOut(BaseModel):
    ok: bool
    message: str
