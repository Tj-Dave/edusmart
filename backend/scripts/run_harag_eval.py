from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.db.postgres import SessionLocal
from app.services.embedder.e5_embedder import E5Embedder
from app.services.harag.evaluation_service import HARAGEvaluationService
from app.services.harag.retrieval_orchestrator import HARAGRetrievalOrchestrator


def main() -> None:
    parser = argparse.ArgumentParser(description="Run offline HA-RAG retrieval evaluation.")
    parser.add_argument("dataset", type=Path, help="Path to JSON/JSONL evaluation dataset")
    parser.add_argument("--course-code", default=None)
    parser.add_argument("--course-offering-id", default=None)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        service = HARAGEvaluationService(orchestrator=HARAGRetrievalOrchestrator(embedder=E5Embedder(device="cpu")))
        result = service.run_file(
            db,
            dataset_path=args.dataset,
            default_course_code=args.course_code,
            default_course_offering_id=args.course_offering_id,
        )
        print(json.dumps(result, indent=2, default=str))
    finally:
        db.close()


if __name__ == "__main__":
    main()
