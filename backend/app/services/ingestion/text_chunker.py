"""
SemanticChunker for EduSmart ingestion pipeline.

Semantic (practical) chunking:
1) Structure-aware segmentation into blocks (pages/slides/headings/blank lines/bullets)
2) Pack blocks into chunks with target/max/min word budgets + overlap
3) Optional embedding-aware boundary detection using E5 (normalized vectors -> cosine similarity)

Designed for:
- PDFs with [Page N] markers
- PPTX with [Slide N] markers
- DOCX with [Heading] markers
- OCR text (can be noisy / long): includes hard-splitting protection
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field
import re
import math


# --- markers injected by DocumentLoader ---
_PAGE_RE = re.compile(r"\[Page\s+(\d+)\]", re.IGNORECASE)
_SLIDE_RE = re.compile(r"\[Slide\s+(\d+)\]", re.IGNORECASE)
_HEADING_RE = re.compile(r"\[Heading\]\s*(.+)", re.IGNORECASE)

# bullets / numbering (kept loose, works for most notes)
_BULLET_LINE_RE = re.compile(r"^\s*([-*•]|(\d+[\.\)]))\s+.+$", re.MULTILINE)


class Chunk(BaseModel):
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    chunk_index: int
    char_start: Optional[int] = None
    char_end: Optional[int] = None

    @property
    def chunk_text(self) -> str:
        return self.text


@dataclass
class Block:
    text: str
    char_start: int
    char_end: int
    loc: Dict[str, Any]  # page/slide/heading markers carried per-block

    @property
    def words(self) -> int:
        return len(self.text.split())


def _cosine(a: List[float], b: List[float]) -> float:
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na <= 0.0 or nb <= 0.0:
        return 0.0
    return dot / (math.sqrt(na) * math.sqrt(nb))


class SemanticChunker:
    def __init__(
        self,
        *,
        # word budgets (fast + stable)
        target_words: int = 220,
        max_words: int = 320,
        min_words: int = 80,
        overlap_words: int = 40,

        # long-run safety (OCR blobs, no punctuation)
        hard_block_max_words: int = 380,

        # embedding-aware boundaries
        use_embeddings: bool = True,
        # tuned for E5 normalized embeddings; adjust later with eval
        split_sim_threshold: float = 0.48,  # <= this => strong topic break
        merge_sim_threshold: float = 0.74,  # >= this => likely same topic, keep together

        # embedder must expose embed_passages(list[str]) -> list[list[float]]
        embedder: Optional[Any] = None,
        # if docs are tiny, skip embedding-boundaries
        min_blocks_for_embeddings: int = 8,
    ):
        self.target_words = target_words
        self.max_words = max_words
        self.min_words = min_words
        self.overlap_words = overlap_words

        self.hard_block_max_words = hard_block_max_words

        self.use_embeddings = use_embeddings
        self.split_sim_threshold = split_sim_threshold
        self.merge_sim_threshold = merge_sim_threshold
        self.embedder = embedder
        self.min_blocks_for_embeddings = min_blocks_for_embeddings

    def chunk(self, text: str, metadata: Dict[str, Any]) -> List[Chunk]:
        if not text or not text.strip():
            return []

        norm = self._normalize(text)
        blocks = self._segment_into_blocks(norm)
        if not blocks:
            return []

        boundaries: Optional[Set[int]] = None
        if (
            self.use_embeddings
            and self.embedder is not None
            and len(blocks) >= self.min_blocks_for_embeddings
        ):
            boundaries = self._embedding_boundaries(blocks)

        chunks: List[Chunk] = []
        chunk_index = 0

        current_parts: List[str] = []
        current_words = 0
        chunk_char_start: Optional[int] = None
        chunk_char_end: Optional[int] = None

        current_loc: Dict[str, Any] = {"page": None, "slide": None, "heading": None}

        def flush():
            nonlocal chunk_index, current_parts, current_words, chunk_char_start, chunk_char_end, current_loc

            combined = "\n".join([p for p in current_parts if p.strip()]).strip()
            if not combined:
                return

            md = dict(metadata)
            md.update(current_loc)
            md["chunk_index"] = chunk_index

            chunks.append(
                Chunk(
                    text=combined,
                    metadata=md,
                    chunk_index=chunk_index,
                    char_start=chunk_char_start,
                    char_end=chunk_char_end,
                )
            )
            chunk_index += 1

            # overlap (tail words)
            if self.overlap_words > 0:
                tail = self._tail_words(combined, self.overlap_words)
                current_parts = [tail] if tail else []
                current_words = len(tail.split()) if tail else 0
            else:
                current_parts = []
                current_words = 0

            chunk_char_start = None
            chunk_char_end = None
            # keep current_loc (helps continuity), or reset if you prefer.

        for i, b in enumerate(blocks):
            # respect semantic boundaries: start new chunk at boundary
            if boundaries is not None and i in boundaries and current_parts:
                flush()

            # update location markers
            current_loc = self._merge_loc(current_loc, b.loc)

            # init offsets
            if chunk_char_start is None:
                chunk_char_start = b.char_start

            # if block too large, split hard
            if b.words > self.hard_block_max_words:
                pieces = self._hard_split_words(b.text.split(), self.max_words)
                for piece in pieces:
                    pw = len(piece.split())
                    if current_words + pw > self.max_words and current_parts:
                        flush()
                    current_parts.append(piece)
                    current_words += pw
                    chunk_char_end = b.char_end
                    if current_words >= self.target_words:
                        flush()
                continue

            # normal packing by budget
            if current_words + b.words > self.max_words and current_parts:
                flush()

            current_parts.append(b.text)
            current_words += b.words
            chunk_char_end = b.char_end

            # near target: flush unless boundary says keep going
            if current_words >= self.target_words:
                # if we have boundaries and next block is NOT boundary, we can keep packing
                if boundaries is not None and (i + 1) < len(blocks) and (i + 1) not in boundaries:
                    continue
                flush()

        if current_parts:
            flush()

        # merge tiny tail chunk if needed
        if len(chunks) >= 2 and len(chunks[-1].text.split()) < self.min_words:
            prev = chunks[-2]
            last = chunks[-1]
            prev.text = (prev.text + "\n" + last.text).strip()
            prev.char_end = last.char_end
            chunks.pop()

        return chunks

    # -----------------------------
    # Segmentation
    # -----------------------------
    def _normalize(self, text: str) -> str:
        # collapse spaces but keep newlines (structure)
        text = re.sub(r"[ \t]+", " ", text)
        return text.strip()

    def _segment_into_blocks(self, text: str) -> List[Block]:
        """
        Build blocks that roughly map to human structure:
        - split into paragraphs (blank lines)
        - keep bullet lists together
        - preserve page/slide/heading markers in loc
        """
        blocks: List[Block] = []
        current_loc: Dict[str, Any] = {"page": None, "slide": None, "heading": None}

        # paragraph split
        paras = re.split(r"\n\s*\n+", text)
        cursor = 0

        for para in paras:
            raw = para
            p = raw.strip()
            if not p:
                cursor += len(raw) + 2
                continue

            # offsets (best-effort)
            idx = text.find(raw, cursor)
            if idx == -1:
                idx = cursor
            start = idx
            end = idx + len(raw)
            cursor = end

            # update loc from markers inside this paragraph
            current_loc = self._update_loc_from_text(p, current_loc)

            # If paragraph contains many bullet lines, keep as a single block.
            # Otherwise, it is already paragraph-based.
            blocks.append(Block(text=p, char_start=start, char_end=end, loc=dict(current_loc)))

        # fallback if somehow empty
        if not blocks and text.strip():
            blocks = [Block(text=text.strip(), char_start=0, char_end=len(text), loc=current_loc)]

        return blocks

    def _update_loc_from_text(self, t: str, loc: Dict[str, Any]) -> Dict[str, Any]:
        out = dict(loc)

        m = _PAGE_RE.search(t)
        if m:
            out["page"] = int(m.group(1))

        m = _SLIDE_RE.search(t)
        if m:
            out["slide"] = int(m.group(1))

        m = _HEADING_RE.search(t)
        if m:
            heading = (m.group(1) or "").strip()
            if heading:
                out["heading"] = heading

        return out

    def _merge_loc(self, a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
        out = dict(a)
        for k, v in b.items():
            if v is not None:
                out[k] = v
        return out

    # -----------------------------
    # Embedding-aware boundaries
    # -----------------------------
    def _embedding_boundaries(self, blocks: List[Block]) -> Set[int]:
        """
        Decide where to start a new chunk using adjacent block similarity + structure changes.
        Returns a set of indices i meaning: "start new chunk at block i".
        """
        texts = [b.text for b in blocks]
        vecs = self.embedder.embed_passages(texts)

        boundaries: Set[int] = set()

        for i in range(1, len(blocks)):
            sim = _cosine(vecs[i - 1], vecs[i])

            # strong topic break
            if sim <= self.split_sim_threshold:
                boundaries.add(i)
                continue

            # strong continuity
            if sim >= self.merge_sim_threshold:
                continue

            # mid-zone: respect structure transitions
            prev_loc = blocks[i - 1].loc
            curr_loc = blocks[i].loc
            if (
                prev_loc.get("heading") != curr_loc.get("heading")
                or prev_loc.get("page") != curr_loc.get("page")
                or prev_loc.get("slide") != curr_loc.get("slide")
            ):
                boundaries.add(i)

        return boundaries

    # -----------------------------
    # Utilities
    # -----------------------------
    def _tail_words(self, text: str, n: int) -> str:
        words = text.split()
        if not words:
            return ""
        return " ".join(words[-n:])

    def _hard_split_words(self, words: List[str], max_words: int) -> List[str]:
        parts: List[str] = []
        for i in range(0, len(words), max_words):
            parts.append(" ".join(words[i : i + max_words]))
        return parts
