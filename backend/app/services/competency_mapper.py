from typing import Any, List, Dict, Optional
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.metrics.pairwise import cosine_similarity

from app.core.config import settings
from app.services.embedder.e5_embedder import E5Embedder


class CompetencyMapper:
    """
    Maps user queries to CBC values using E5 embedding similarity
    against a precomputed CBC embedding index.
    """

    BASE_PATH = Path(settings.BASE_DIR) / "backend" / "app" / "utils"
    CSV_PATH = BASE_PATH / "cbc_metadata.csv"
    EMBEDDINGS_PATH = BASE_PATH / "cbc_embeddings.npy"

    def __init__(self, embedder: E5Embedder | None = None):
        self.embedder = embedder or E5Embedder()

        # Load CBC metadata
        self.cbc_data = pd.read_csv(self.CSV_PATH)

        # Load precomputed embeddings
        self.cbc_embeddings = np.load(self.EMBEDDINGS_PATH)

        assert len(self.cbc_data) == self.cbc_embeddings.shape[0], (
            "Mismatch between CBC rows and embedding vectors"
        )

    def map(
        self,
        query: str,
        top_k: int = 5,
        *,
        db=None,
        course_offering_id: Optional[str] = None,
        course_code: Optional[str] = None,
    ) -> List[Dict]:
        if not query or not query.strip():
            return []

        structured = self._structured_competencies(
            db=db,
            course_offering_id=course_offering_id,
            course_code=course_code,
        )
        if structured:
            return self._rank_structured(query, structured, top_k=top_k)

        return self._legacy_map(query, top_k=top_k)

    def _legacy_map(self, query: str, top_k: int = 5) -> List[Dict]:
        # Use shared embedder
        query_embedding = np.array(self.embedder.embed_query(query))

        similarities = cosine_similarity(
            [query_embedding],
            self.cbc_embeddings
        )[0]

        confidence_scores = (similarities + 1) / 2
        ranked_indices = np.argsort(confidence_scores)[::-1][:top_k]

        results = []
        for idx in ranked_indices:
            score = float(confidence_scores[idx])
            if score < 0.4:
                continue

            results.append({
                "value": self.cbc_data.iloc[idx]["Value"],
                "confidence": round(score, 3),
                "source": "legacy_csv",
            })

        return results

    def _structured_competencies(
        self,
        *,
        db,
        course_offering_id: Optional[str],
        course_code: Optional[str],
    ) -> list[dict[str, Any]]:
        if db is None:
            return []
        from app.db.models import CourseOffering, CourseSpecStatus, OfferingCourseSpec

        # Fallback order is intentional:
        # 1. competencies from the active offering's approved/current course spec
        # 2. competencies from approved specs for the broader course
        # 3. legacy CSV/npy embeddings
        if course_offering_id:
            spec = (
                db.query(OfferingCourseSpec)
                .filter(
                    OfferingCourseSpec.course_offering_id == course_offering_id,
                    OfferingCourseSpec.status == CourseSpecStatus.approved_active,
                )
                .order_by(OfferingCourseSpec.approved_at.desc().nullslast(), OfferingCourseSpec.created_at.desc())
                .first()
            )
            items = self._extract_competency_values(getattr(spec, "spec_json", None), source="offering_spec")
            if items:
                return items

        if course_code:
            specs = (
                db.query(OfferingCourseSpec)
                .join(CourseOffering, CourseOffering.id == OfferingCourseSpec.course_offering_id)
                .filter(
                    CourseOffering.course_code == course_code,
                    OfferingCourseSpec.status == CourseSpecStatus.approved_active,
                )
                .order_by(OfferingCourseSpec.approved_at.desc().nullslast(), OfferingCourseSpec.created_at.desc())
                .limit(10)
                .all()
            )
            merged: list[dict[str, Any]] = []
            seen: set[str] = set()
            for spec in specs:
                for item in self._extract_competency_values(spec.spec_json, source="course_spec"):
                    key = item["value"].lower()
                    if key not in seen:
                        seen.add(key)
                        merged.append(item)
            if merged:
                return merged
        return []

    @staticmethod
    def _extract_competency_values(spec_json: Any, *, source: str) -> list[dict[str, Any]]:
        if not isinstance(spec_json, dict):
            return []
        raw = spec_json.get("competencies") or []
        out: list[dict[str, Any]] = []
        for entry in raw:
            if isinstance(entry, str):
                out.append({"value": entry, "source": source})
            elif isinstance(entry, dict):
                category = entry.get("category")
                items = entry.get("items") or entry.get("values") or entry.get("competencies") or []
                if isinstance(items, str):
                    items = [items]
                for item in items if isinstance(items, list) else []:
                    value = str(item).strip()
                    if value:
                        out.append({"value": value, "category": category, "source": source})
        return out

    def _rank_structured(self, query: str, competencies: list[dict[str, Any]], *, top_k: int) -> list[dict]:
        texts = [item["value"] for item in competencies]
        query_embedding = np.array(self.embedder.embed_query(query))
        comp_embeddings = np.array(self.embedder.embed_passages(texts))
        similarities = cosine_similarity([query_embedding], comp_embeddings)[0]
        confidence_scores = (similarities + 1) / 2
        ranked_indices = np.argsort(confidence_scores)[::-1][:top_k]
        out = []
        for idx in ranked_indices:
            score = float(confidence_scores[idx])
            if score < 0.35:
                continue
            item = competencies[idx]
            out.append(
                {
                    "value": item["value"],
                    "confidence": round(score, 3),
                    "source": item.get("source", "structured_spec"),
                    "category": item.get("category"),
                }
            )
        return out
