from __future__ import annotations

from .schemas import CHILD_MAX_TOKENS, CHILD_MIN_TOKENS, CHILD_OVERLAP_TOKENS, ChildChunkBlock, ParentChunkBlock
from .summary_generator import count_tokens


class OverlappingChildChunker:
    min_tokens = CHILD_MIN_TOKENS
    max_tokens = CHILD_MAX_TOKENS
    overlap_tokens = CHILD_OVERLAP_TOKENS

    def chunk(self, parent: ParentChunkBlock, *, start_order: int = 0) -> list[ChildChunkBlock]:
        words = parent.text.split()
        if not words:
            return []
        if len(words) <= self.max_tokens:
            return [
                ChildChunkBlock(
                    document_id=parent.document_id,
                    parent_id=parent.id or "",
                    summary_id=parent.summary_id,
                    course_code=parent.course_code,
                    course_offering_id=parent.course_offering_id,
                    chunk_order=start_order,
                    text=parent.text,
                    token_count=count_tokens(parent.text),
                    overlap_prev_tokens=0,
                    heading_lineage=parent.heading_lineage,
                    char_start=parent.char_start,
                    char_end=parent.char_end,
                    source_scope=parent.source_scope,
                )
            ]

        step = max(1, self.max_tokens - self.overlap_tokens)
        out: list[ChildChunkBlock] = []
        index = 0
        order = start_order
        while index < len(words):
            end = min(index + self.max_tokens, len(words))
            if end < len(words) and end - index < self.min_tokens:
                break
            chunk_words = words[index:end]
            text = " ".join(chunk_words)
            out.append(
                ChildChunkBlock(
                    document_id=parent.document_id,
                    parent_id=parent.id or "",
                    summary_id=parent.summary_id,
                    course_code=parent.course_code,
                    course_offering_id=parent.course_offering_id,
                    chunk_order=order,
                    text=text,
                    token_count=len(chunk_words),
                    overlap_prev_tokens=0 if not out else min(self.overlap_tokens, len(chunk_words)),
                    heading_lineage=parent.heading_lineage,
                    char_start=parent.char_start,
                    char_end=parent.char_end,
                    source_scope=parent.source_scope,
                )
            )
            if end == len(words):
                break
            index += step
            order += 1
        return out
