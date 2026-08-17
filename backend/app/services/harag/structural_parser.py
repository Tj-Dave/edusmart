from __future__ import annotations

import re
from typing import Optional

from .schemas import SectionBlock, SourceScope

_HEADING_RE = re.compile(r"^\s*(#{1,3})\s+(.+?)\s*$")
_NUMBERED_H1_RE = re.compile(r"^\s*(?:chapter|unit|module|section)\s+\d+[:.\-\s]+(.+)$", re.IGNORECASE)
_NUMBERED_HEAD_RE = re.compile(r"^\s*(\d+(?:\.\d+){0,2})\s+(.+?)\s*$")


def _normalize_heading(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip()) or "Untitled Section"


class StructuralParser:
    """Builds V1 H1-bounded section blocks from plain extracted text."""

    def parse(
        self,
        text: str,
        *,
        document_id: str,
        course_code: str,
        course_offering_id: Optional[str],
        source_scope: SourceScope = "offering_only",
    ) -> list[SectionBlock]:
        clean = (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
        if not clean:
            return []

        headings: list[tuple[int, str, int, int]] = []
        offset = 0
        for line in clean.splitlines(keepends=True):
            stripped = line.strip()
            level = 0
            title = ""
            md = _HEADING_RE.match(stripped)
            if md:
                level = len(md.group(1))
                title = md.group(2)
            elif _NUMBERED_H1_RE.match(stripped):
                level = 1
                title = stripped
            else:
                numbered = _NUMBERED_HEAD_RE.match(stripped)
                if numbered:
                    depth = numbered.group(1).count(".") + 1
                    level = min(depth, 3)
                    title = numbered.group(2)

            if level == 1:
                headings.append((level, _normalize_heading(title), offset, offset + len(line)))
            offset += len(line)

        if not headings:
            return [
                SectionBlock(
                    document_id=document_id,
                    course_code=course_code,
                    course_offering_id=course_offering_id,
                    heading_level=1,
                    heading_text="Document",
                    heading_lineage={"h1": "Document"},
                    section_order=0,
                    content=clean,
                    char_start=0,
                    char_end=len(clean),
                    source_scope=source_scope,
                )
            ]

        sections: list[SectionBlock] = []
        for idx, (_level, heading, start, heading_end) in enumerate(headings):
            end = headings[idx + 1][2] if idx + 1 < len(headings) else len(clean)
            content = clean[heading_end:end].strip()
            if not content:
                content = heading
            sections.append(
                SectionBlock(
                    document_id=document_id,
                    course_code=course_code,
                    course_offering_id=course_offering_id,
                    heading_level=1,
                    heading_text=heading,
                    heading_lineage={"h1": heading},
                    section_order=idx,
                    content=content,
                    char_start=start,
                    char_end=end,
                    source_scope=source_scope,
                )
            )
        return sections
