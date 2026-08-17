from __future__ import annotations

import json
import re

from .schemas import ExtractedRelationshipItem


class RelationshipExtractor:
    """Extracts child-grounded relationships using the local LLM subclient when available."""

    def __init__(self, llm_subclient=None):
        self.llm_subclient = llm_subclient

    def extract(self, text: str, *, limit: int = 5) -> list[ExtractedRelationshipItem]:
        if not (text or "").strip():
            return []
        llm_items = self._extract_with_local_llm(text, limit=limit)
        if llm_items:
            return llm_items[:limit]
        return self._heuristic_extract(text, limit=limit)

    def _extract_with_local_llm(self, text: str, *, limit: int) -> list[ExtractedRelationshipItem]:
        if self.llm_subclient is None:
            return []
        prompt = f"""Extract up to {limit} factual relationships from this course chunk.
Return JSON only as an array of objects with subject, predicate, object, evidence_text, confidence.

CHUNK:
{text[:1800]}

JSON:"""
        try:
            raw = self.llm_subclient.generate(prompt, False)
        except TypeError:
            try:
                raw = self.llm_subclient.generate(prompt)
            except Exception:
                return []
        except Exception:
            return []

        try:
            start = raw.find("[")
            end = raw.rfind("]")
            if start == -1 or end == -1:
                return []
            data = json.loads(raw[start : end + 1])
        except Exception:
            return []

        out: list[ExtractedRelationshipItem] = []
        for item in data if isinstance(data, list) else []:
            if not isinstance(item, dict):
                continue
            subject = str(item.get("subject") or "").strip()
            predicate = str(item.get("predicate") or "related_to").strip()
            obj = str(item.get("object") or "").strip()
            evidence = str(item.get("evidence_text") or text[:240]).strip()
            if subject and obj:
                out.append(
                    ExtractedRelationshipItem(
                        subject=subject,
                        predicate=predicate,
                        object=obj,
                        evidence_text=evidence[:500],
                        confidence=float(item.get("confidence") or 0.7),
                        extraction_method="local_llm",
                    )
                )
        return out

    @staticmethod
    def _heuristic_extract(text: str, *, limit: int) -> list[ExtractedRelationshipItem]:
        patterns = [
            (r"(.{3,80}?)\s+(?:is|are|refers to|means)\s+(.{3,100}?)(?:[.;]|$)", "defines"),
            (r"(.{3,80}?)\s+(?:causes|leads to|results in)\s+(.{3,100}?)(?:[.;]|$)", "causes"),
            (r"(.{3,80}?)\s+(?:requires|uses|depends on)\s+(.{3,100}?)(?:[.;]|$)", "requires"),
        ]
        out: list[ExtractedRelationshipItem] = []
        compact = re.sub(r"\s+", " ", text or "")
        for pattern, predicate in patterns:
            for match in re.finditer(pattern, compact, flags=re.IGNORECASE):
                subject = match.group(1).strip(" -,:")
                obj = match.group(2).strip(" -,:")
                if subject and obj and len(subject.split()) <= 10:
                    out.append(
                        ExtractedRelationshipItem(
                            subject=subject[:180],
                            predicate=predicate,
                            object=obj[:180],
                            evidence_text=match.group(0)[:500],
                            confidence=0.55,
                            extraction_method="heuristic",
                        )
                    )
                    if len(out) >= limit:
                        return out
        return out
