"""
Test the EXISTING Phi title generator from chats.py using the REAL app.state.llm_subclient.

Run:
  (edusmart) python -m app.tests.test_phi_title_generator

Optional:
  TITLE_TEST_QUERIES="Explain WW1|FastAPI Postgres SQLAlchemy|RAG chunking pptx docx" \
    python -m app.tests.test_phi_title_generator
"""

from __future__ import annotations

import os
import asyncio
from typing import List

from fastapi.testclient import TestClient
from starlette.requests import Request

# ✅ Adjust these imports to match your project
from app.main import app  # <- change if your FastAPI app lives elsewhere
from app.routes.chats import _generate_phi_title  # <- your function in chats.py


DEFAULT_TEST_QUERIES = [
    "Explain the causes of World War I",
    "Difference between mitosis and meiosis in simple terms",
    "How do I connect FastAPI to PostgreSQL using SQLAlchemy?",
    "Write a Spring Boot endpoint for login with JWT",
]


def parse_env_queries() -> List[str]:
    raw = (os.getenv("TITLE_TEST_QUERIES") or "").strip()
    if not raw:
        return []
    parts = [p.strip() for p in raw.split("|")]
    return [p for p in parts if p]


def make_request_with_app(fastapi_app) -> Request:
    """
    Build a minimal Starlette Request object with scope['app'] set,
    so your function can access req.app.state.llm_subclient.
    """
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/__phi_title_test__",
        "headers": [],
        "app": fastapi_app,
    }
    return Request(scope)


async def run_batch(client_app, queries: List[str]):
    req = make_request_with_app(client_app)

    llm = getattr(req.app.state, "llm_subclient", None)
    print(f"llm_subclient present? {'YES' if llm is not None else 'NO'}")

    for i, q in enumerate(queries, 1):
        title = await _generate_phi_title(req, q)
        print(f"{i}. Query: {q}")
        print(f"   Title: {title!r}  (len={len(title)})")
        if len(title) > 40:
            print("   ⚠️  Title exceeds 40 characters!")
        print("")


async def interactive(client_app):
    req = make_request_with_app(client_app)

    print("\n=== Interactive mode ===")
    print("Type a query and press Enter. Empty line to quit.\n")

    while True:
        q = input("User query> ").strip()
        if not q:
            break
        title = await _generate_phi_title(req, q)
        print(f"Title: {title!r}  (len={len(title)})")
        if len(title) > 40:
            print("⚠️  Title exceeds 40 characters!")
        print("")


def main():
    print("\n=== Phi-3-mini Title Generator Test (using app.state.llm_subclient) ===\n")

    queries = parse_env_queries() or DEFAULT_TEST_QUERIES

    # TestClient triggers FastAPI startup/shutdown events automatically,
    # so app.state.llm_subclient should be initialized exactly like in production.
    with TestClient(app) as client:
        asyncio.run(run_batch(client.app, queries))
        asyncio.run(interactive(client.app))

    print("Done.\n")


if __name__ == "__main__":
    main()
