from __future__ import annotations

import re

from .schemas import ExtractedEntityItem

_PHRASE_RE = re.compile(r"\b[A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,3}\b")


class EntityExtractor:
    """Small offline extractor for grounded child-level concepts."""

    def extract(self, text: str, *, limit: int = 8) -> list[ExtractedEntityItem]:
        seen: set[str] = set()
        out: list[ExtractedEntityItem] = []
        for match in _PHRASE_RE.finditer(text or ""):
            value = match.group(0).strip()
            if len(value) < 3 or value.lower() in seen:
                continue
            seen.add(value.lower())
            out.append(ExtractedEntityItem(text=value))
            if len(out) >= limit:
                break
        return out
