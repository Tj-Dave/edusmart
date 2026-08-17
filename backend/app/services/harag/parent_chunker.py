from __future__ import annotations

import re

from .schemas import PARENT_MAX_TOKENS, PARENT_MIN_TOKENS, ParentChunkBlock, SectionBlock
from .summary_generator import count_tokens

_BREAK_RE = re.compile(r"\n(?=\s*(?:#{2,3}\s+|\d+\.\d+\s+|[-*]\s+))")


class DynamicParentChunker:
    """Creates dynamic parent chunks inside a single H1 region."""

    min_tokens = PARENT_MIN_TOKENS
    max_tokens = PARENT_MAX_TOKENS

    def chunk(self, section: SectionBlock, *, summary_id: str, start_order: int = 0) -> list[ParentChunkBlock]:
        units = self._candidate_units(section.content)
        chunks: list[str] = []
        current: list[str] = []
        current_tokens = 0

        for unit in units:
            unit_tokens = count_tokens(unit)
            if unit_tokens > self.max_tokens:
                if current:
                    chunks.append("\n\n".join(current).strip())
                    current, current_tokens = [], 0
                chunks.extend(self._split_large_unit(unit))
                continue

            should_close = current and current_tokens >= self.min_tokens and current_tokens + unit_tokens > self.max_tokens
            if should_close:
                chunks.append("\n\n".join(current).strip())
                current, current_tokens = [unit], unit_tokens
            else:
                current.append(unit)
                current_tokens += unit_tokens

        if current:
            last = "\n\n".join(current).strip()
            if chunks and count_tokens(last) < self.min_tokens:
                merged = f"{chunks.pop()}\n\n{last}".strip()
                if count_tokens(merged) <= self.max_tokens + 80:
                    chunks.append(merged)
                else:
                    chunks.append(last)
            else:
                chunks.append(last)

        out: list[ParentChunkBlock] = []
        cursor = 0
        for idx, text in enumerate([c for c in chunks if c.strip()]):
            local_start = section.content.find(text[:80], cursor)
            if local_start == -1:
                local_start = cursor
            local_end = local_start + len(text)
            cursor = local_end
            out.append(
                ParentChunkBlock(
                    document_id=section.document_id,
                    summary_id=summary_id,
                    section_id=section.id or "",
                    course_code=section.course_code,
                    course_offering_id=section.course_offering_id,
                    chunk_order=start_order + idx,
                    text=text,
                    token_count=count_tokens(text),
                    heading_lineage=section.heading_lineage,
                    citation_anchor={
                        "title": section.heading_text,
                        "h1": section.heading_text,
                        "parent_order": start_order + idx,
                    },
                    char_start=section.char_start + max(local_start, 0),
                    char_end=section.char_start + max(local_end, 0),
                    source_scope=section.source_scope,
                )
            )
        return out

    @staticmethod
    def _candidate_units(text: str) -> list[str]:
        normalized = re.sub(r"\n{3,}", "\n\n", (text or "").strip())
        parts: list[str] = []
        for block in _BREAK_RE.split(normalized):
            block = block.strip()
            if not block:
                continue
            paragraphs = [p.strip() for p in re.split(r"\n\s*\n", block) if p.strip()]
            parts.extend(paragraphs or [block])
        return parts or [normalized]

    def _split_large_unit(self, unit: str) -> list[str]:
        words = unit.split()
        chunks: list[str] = []
        for i in range(0, len(words), self.max_tokens):
            chunk = " ".join(words[i : i + self.max_tokens]).strip()
            if chunk:
                chunks.append(chunk)
        return chunks
