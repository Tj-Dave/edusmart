"""
Test the Phi-3-mini title generator function implemented in chats.py:

    async def _generate_phi_title(req: Request, text: str) -> str

Run:
  (edusmart) python -m app.tests.test_phi_title_generator

Optional env:
  TITLE_TEST_QUERIES="Explain photosynthesis|FastAPI vs Flask|RAG chunking strategy" \
    python -m app.tests.test_phi_title_generator
"""

from __future__ import annotations

import asyncio
import os
from typing import List, Optional

from starlette.requests import Request

# ✅ Import your real FastAPI app (adjust import if your app is elsewhere)
# Common options:
# from app.main import app
# from app.app import app
from app.main import app  # <-- change if needed

# ✅ Import your function directly (adjust module path if needed)
from app.routes.chats import _generate_phi_title  # <-- if your file is app/routes/chats.py


DEFAULT_TEST_QUERIES = [
    "Explain the causes of World War I",
    "Difference between mitosis and meiosis",
    "How do I connect FastAPI to PostgreSQL using SQLAlchemy?",
    "Why is my chat sidebar creating new sessions on click?",
    "How should we chunk PPTX, DOCX and scanned PDFs for RAG ingestion?",
    "Write a Spring Boot JWT login flow",
    "How do I deploy React + FastAPI for free?",
    "What is overfitting in machine learning? Give examples.",
    "Why won't my Dell WD19TBS charge my HP Victus via USB-C?",
]


def _parse_env_queries() -> List[str]:
    raw = (os.getenv("TITLE_TEST_QUERIES") or "").strip()
    if not raw:
        return []
    parts = [p.strip() for p in raw.split("|")]
    return [p for p in parts if p]


def _make_request_for_app() -> Request:
    """
    Create a minimal Starlette Request that still contains:
      req.app.state.llm_subclient
    """
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "method": "GET",
        "path": "/__phi_title_test__",
        "headers": [],
        "query_string": b"",
        "client": ("127.0.0.1", 0),
        "server": ("127.0.0.1", 8000),
        "scheme": "http",
        "app": app,
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive)


async def _startup_app_if_needed() -> None:
    """
    Ensure startup events run so app.state.llm_subclient is wired.
    If your app uses lifespan, this usually works.
    """
    # Starlette/FastAPI expose startup/shutdown on router
    try:
        await app.router.startup()
    except Exception:
        # If your app doesn't use startup hooks, ignore.
        pass


async def _shutdown_app() -> None:
    try:
        await app.router.shutdown()
    except Exception:
        pass


async def run_batch(req: Request, queries: List[str]) -> None:
    print("\n=== Batch test ===\n")

    # sanity check
    llm = getattr(req.app.state, "llm_subclient", None)
    print(f"llm_subclient present? {'YES' if llm is not None else 'NO'}")
    if llm is None:
        print("⚠️  app.state.llm_subclient is missing. Your generator will fall back.")
        print("   If you expected Phi to run, ensure app startup sets llm_subclient.\n")

    for i, q in enumerate(queries, 1):
        title = await _generate_phi_title(req, q)
        print(f"{i}. Query: {q}")
        print(f"   Title: {title!r}  (len={len(title)})")
        if len(title) > 40:
            print("   ⚠️  Title exceeds 40 characters!")
        print()


async def run_interactive(req: Request) -> None:
    print("\n=== Interactive mode ===")
    print("Type a query and press Enter. Empty line to quit.\n")

    while True:
        try:
            q = input("User query> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not q:
            break

        title = await _generate_phi_title(req, q)
        print(f"Title: {title!r}  (len={len(title)})")
        if len(title) > 40:
            print("⚠️  Title exceeds 40 characters!")
        print()


async def main() -> None:
    await _startup_app_if_needed()

    req = _make_request_for_app()
    queries = _parse_env_queries() or DEFAULT_TEST_QUERIES

    await run_batch(req, queries)
    await run_interactive(req)

    await _shutdown_app()


if __name__ == "__main__":
    asyncio.run(main())
