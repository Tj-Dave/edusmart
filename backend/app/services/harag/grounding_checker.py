from __future__ import annotations

import re

from .schemas import HARAGRetrievalPackage


class EvidenceGroundingChecker:
    """Lightweight local evidence coverage diagnostic for dev mode and logs."""

    def check(self, answer: str, package: HARAGRetrievalPackage) -> dict:
        claims = [c.strip() for c in re.split(r"(?<=[.!?])\s+", answer or "") if len(c.split()) >= 5]
        evidence_text = " ".join(parent.text for parent in package.parents).lower()
        supported = 0
        details = []
        for claim in claims:
            keywords = [w.lower() for w in re.findall(r"[A-Za-z][A-Za-z0-9_-]{3,}", claim)[:8]]
            hits = sum(1 for word in keywords if word in evidence_text)
            is_supported = hits >= max(1, min(3, len(keywords) // 2))
            supported += 1 if is_supported else 0
            details.append({"claim": claim[:240], "keyword_hits": hits, "supported": is_supported})
        unsupported = max(0, len(claims) - supported)
        coverage = supported / len(claims) if claims else 1.0
        return {
            "supported_claims": supported,
            "unsupported_claims": unsupported,
            "coverage_score": round(coverage, 4),
            "claim_checks": details[:12],
            "evidence_parent_count": len(package.parents),
        }
