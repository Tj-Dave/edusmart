from __future__ import annotations

import re

from .schemas import H1SummaryBlock, SectionBlock


def count_tokens(text: str) -> int:
    return len((text or "").split())


class H1SummaryGenerator:
    """Generates one H1-level summary per section with a local-only fallback."""

    def __init__(self, llm_subclient=None):
        self.llm_subclient = llm_subclient

    def summarize(self, section: SectionBlock) -> H1SummaryBlock:
        summary = self._local_llm_summary(section) or self._extractive_summary(section.content)
        return H1SummaryBlock(
            document_id=section.document_id,
            section_id=section.id or "",
            course_code=section.course_code,
            course_offering_id=section.course_offering_id,
            h1_title=section.heading_text,
            summary_text=summary,
            token_count=count_tokens(summary),
            source_scope=section.source_scope,
        )

    def _local_llm_summary(self, section: SectionBlock) -> str:
        if self.llm_subclient is None:
            return ""
        prompt = f"""Summarize this course document H1 section in 2-3 concise sentences.

H1: {section.heading_text}
TEXT:
{section.content[:3500]}

Summary:"""
        try:
            raw = self.llm_subclient.generate(prompt, False)
        except TypeError:
            try:
                raw = self.llm_subclient.generate(prompt)
            except Exception:
                return ""
        except Exception:
            return ""
        return re.sub(r"\s+", " ", (raw or "").strip())[:1000]

    @staticmethod
    def _extractive_summary(text: str) -> str:
        sentences = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", (text or "").strip()))
        selected = [s.strip() for s in sentences if len(s.strip()) > 25][:3]
        if selected:
            return " ".join(selected)
        words = (text or "").split()
        return " ".join(words[:90]) if words else "No summary available."
