from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class BadgeOut(BaseModel):
    id: UUID
    badge_code: str
    title: str
    description: str | None = None
    awarded_at: Any

    class Config:
        from_attributes = True


class XpEventOut(BaseModel):
    id: int
    event_type: str
    xp_delta: int
    reason: str | None = None
    metadata_json: dict[str, Any] | None = None
    created_at: Any

    class Config:
        from_attributes = True


class GamificationOverviewOut(BaseModel):
    enrollment_id: UUID
    user_id: UUID
    xp_total: int
    level: int
    streak_days: int
    xp_in_level: int
    xp_to_next_level: int
    badges: list[BadgeOut] = []
    recent_events: list[XpEventOut] = []


class LeaderboardEntryOut(BaseModel):
    rank: int
    enrollment_id: UUID
    user_id: UUID
    display_name: str
    xp_total: int
    level: int
    streak_days: int
    is_viewer: bool = False


class OfferingLeaderboardOut(BaseModel):
    offering_id: UUID
    enrollment_id: UUID
    viewer_user_id: UUID
    viewer_rank: int | None = None
    total_participants: int
    entries: list[LeaderboardEntryOut] = []
