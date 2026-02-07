from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Callable
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.vector_store import VectorStore
from app.db.models import ChatMessage as PgChatMessage, MemoryState, MessageRole
from app.services.llm.llama_cpp_subclient import LLMSubclient


@dataclass
class ChatMessage:
    role: str
    content: str
    ts: float


class MemoryManagerPG:
    """
    Continuity module aligned with Postgres chat storage:

    - Short-term memory: recent chat turns from PostgreSQL chat_messages
    - Summarization progress: stored in PostgreSQL memory_state
    - Long-term memory: summarized chunks stored in Chroma ("memories")
    - Summarizer: Phi-3 mini via LLMSubclient (only when needed)

    You must pass:
      embed_query(str) -> List[float]
      embed_texts(List[str]) -> List[List[float]]
    """

    def __init__(
        self,
        vector_store: VectorStore,
        embed_query: Callable[[str], List[float]],
        embed_texts: Callable[[List[str]], List[List[float]]],
        phi3: Optional[LLMSubclient] = None,
        app_namespace: str = "edusmart",
        recent_pairs: int = 6,
        max_recent_chars: int = 6000,
        summarize_after_messages: int = 24,
        summarize_chunk_messages: int = 12,
        min_messages_to_summarize: int = 8,
        memory_top_k: int = 6,
    ):
        self.vs = vector_store
        self.embed_query = embed_query
        self.embed_texts = embed_texts
        self.phi3 = phi3
        self.app = app_namespace

        self.recent_pairs = recent_pairs
        self.max_recent_chars = max_recent_chars

        self.summarize_after_messages = summarize_after_messages
        self.summarize_chunk_messages = summarize_chunk_messages
        self.min_messages_to_summarize = min_messages_to_summarize

        self.memory_top_k = memory_top_k

    # -----------------------------
    # Short-term: recent messages from Postgres
    # -----------------------------
    def get_recent_messages(self, db: Session, user_id: str, session_id: UUID) -> List[ChatMessage]:
        limit = self.recent_pairs * 2

        rows: List[PgChatMessage] = (
            db.query(PgChatMessage)
            .filter(PgChatMessage.user_id == user_id, PgChatMessage.session_id == session_id)
            .order_by(PgChatMessage.id.desc())
            .limit(limit)
            .all()
        )

        # reverse to chronological
        rows = list(reversed(rows))

        msgs = [
            ChatMessage(
                role=str(r.role.value) if hasattr(r.role, "value") else str(r.role),
                content=r.content,
                ts=r.created_at.timestamp() if getattr(r, "created_at", None) else time.time(),
            )
            for r in rows
        ]
        return self._trim_recent_by_chars(msgs, self.max_recent_chars)

    def _trim_recent_by_chars(self, msgs: List[ChatMessage], max_chars: int) -> List[ChatMessage]:
        total = 0
        kept: List[ChatMessage] = []
        for m in reversed(msgs):
            c = (m.content or "").strip()
            size = len(c) + 20
            if kept and total + size > max_chars:
                break
            total += size
            kept.append(m)
        return list(reversed(kept))

    # -----------------------------
    # Long-term: retrieve from Chroma
    # -----------------------------
    def get_relevant_memories(self, user_id: str, session_id: UUID, query_text: str) -> List[Dict[str, Any]]:
        q_emb = self.embed_query(query_text)

        where = {
            "$and": [
                {"app": self.app},
                {"kind": "memory"},
                {"user_id": user_id},
                # Uncomment if you want memory scoped to a single chat:
                # {"session_id": str(session_id)},
            ]
        }

        results = self.vs.query_embeddings(
            collection="memories",
            query_embeddings=[q_emb],
            n_results=self.memory_top_k,
            where=where,
        )

        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        dists = results.get("distances", [[]])[0]

        out = []
        for text, meta, dist in zip(docs, metas, dists):
            out.append({"text": text, "score": float(dist), "metadata": meta or {}})
        return out

    # -----------------------------
    # Summarization using Postgres memory_state
    # -----------------------------
    def maybe_summarize(self, db: Session, user_id: str, session_id: UUID) -> Optional[str]:
        if self.phi3 is None:
            return None

        total = (
            db.query(PgChatMessage)
            .filter(PgChatMessage.user_id == user_id, PgChatMessage.session_id == session_id)
            .count()
        )
        if total < self.summarize_after_messages:
            return None

        state = db.query(MemoryState).filter(MemoryState.session_id == session_id).one_or_none()
        if state is None:
            state = MemoryState(session_id=session_id, last_summarized_message_id=0)
            db.add(state)
            db.commit()
            db.refresh(state)

        last_id = int(state.last_summarized_message_id or 0)

        rows: List[PgChatMessage] = (
            db.query(PgChatMessage)
            .filter(
                PgChatMessage.user_id == user_id,
                PgChatMessage.session_id == session_id,
                PgChatMessage.id > last_id,
            )
            .order_by(PgChatMessage.id.asc())
            .limit(self.summarize_chunk_messages)
            .all()
        )

        if len(rows) < self.min_messages_to_summarize:
            return None

        newest_id = last_id
        transcript_lines = []
        for r in rows:
            newest_id = max(newest_id, int(r.id))
            c = (r.content or "").strip()
            if len(c) > 1000:
                c = c[:1000] + "…"
            role = r.role.value if hasattr(r.role, "value") else str(r.role)
            transcript_lines.append(f"{role.upper()}: {c}")

        transcript = "\n".join(transcript_lines)
        summary = self.phi3._generate(self._summary_prompt(transcript)).strip()

        if not summary or len(summary) < 40:
            return None

        emb = self.embed_texts([summary])[0]

        mem_meta = {
            "app": self.app,
            "kind": "memory",
            "user_id": user_id,
            "session_id": str(session_id),
            "source": "phi3-mini",
            "from_message_id": last_id + 1,
            "to_message_id": newest_id,
            "created_ts": time.time(),
        }

        mem_id = f"{self.app}:{user_id}:{session_id}:mem:{int(time.time())}:{newest_id}"

        self.vs.add_texts(
            collection="memories",
            texts=[summary],
            embeddings=[emb],
            metadatas=[mem_meta],
            ids=[mem_id],
        )

        state.last_summarized_message_id = newest_id
        db.commit()

        return summary

    def _summary_prompt(self, transcript: str) -> str:
        return f"""
You are a memory summarizer for an educational assistant.

Summarize the transcript into 5-10 bullet points capturing:
- User goals/intents
- Topics covered and what has been explained
- Important constraints/preferences stated by the user
- Open questions or next steps

Rules:
- Bullet points only.
- Be concise and factual.
- No fluff.
- Do not invent.

Transcript:
{transcript}

Memory bullets:
""".strip()

    # -----------------------------
    # One-call context pack
    # -----------------------------
    def build_context_pack(self, db: Session, user_id: str, session_id: UUID, user_query: str) -> Dict[str, Any]:
        recent = self.get_recent_messages(db, user_id, session_id)
        memories = self.get_relevant_memories(user_id, session_id, user_query)
        return {
            "recent_messages": [m.__dict__ for m in recent],
            "relevant_memories": memories,
        }
