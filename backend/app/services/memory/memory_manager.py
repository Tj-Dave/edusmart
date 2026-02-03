from __future__ import annotations

import os
import time
import sqlite3
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Callable, Tuple

from app.db.vector_store import VectorStore
from app.services.llm.llama_cpp_subclient import LLMSubclient  # adjust import path to yours


@dataclass
class ChatMessage:
    role: str
    content: str
    ts: float


class MemoryManager:
    """
    Continuity module:
    - Short-term memory: recent chat turns from SQLite (fast)
    - Long-term memory: summarized chunks stored in Chroma ("memories")
    - Summarizer: Phi-3 mini via your LLMSubclient (only when needed)

    You MUST pass an embedding function:
      embed_texts(List[str]) -> List[List[float]]
    Use the same embedder you already use for documents (SBERT, instructor, etc.)
    """

    def __init__(
        self,
        sqlite_path: str,
        vector_store: VectorStore,
        embed_query: Callable[[str], List[float]],
        embed_texts: Callable[[List[str]], List[List[float]]],
        phi3: Optional[LLMSubclient] = None,
        app_namespace: str = "edusmart",
        # short-term settings
        recent_pairs: int = 6,                 # ~6 (user+assistant) pairs
        max_recent_chars: int = 6000,          # cheap trimming to keep prompt small
        # summarization settings
        summarize_after_messages: int = 24,    # when total messages exceed this
        summarize_chunk_messages: int = 12,    # summarize in chunks
        min_messages_to_summarize: int = 8,
        # long-term retrieval
        memory_top_k: int = 6,
    ):
        self.sqlite_path = sqlite_path
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

        self._init_db()

    # -----------------------------
    # DB setup
    # -----------------------------
    def _init_db(self) -> None:
        os.makedirs(os.path.dirname(self.sqlite_path), exist_ok=True)
        with sqlite3.connect(self.sqlite_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    ts REAL NOT NULL
                );
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_chat_user_session_id
                ON chat_messages(user_id, session_id, id);
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS session_state (
                    user_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    last_summarized_id INTEGER DEFAULT 0,
                    updated_ts REAL NOT NULL,
                    PRIMARY KEY (user_id, session_id)
                );
            """)
            conn.commit()

    # -----------------------------
    # Public: append message
    # -----------------------------
    def append_message(self, user_id: str, session_id: str, role: str, content: str) -> int:
        ts = time.time()
        with sqlite3.connect(self.sqlite_path) as conn:
            cur = conn.execute(
                "INSERT INTO chat_messages(user_id, session_id, role, content, ts) VALUES (?, ?, ?, ?, ?)",
                (user_id, session_id, role, content, ts),
            )
            msg_id = int(cur.lastrowid)

            conn.execute(
                "INSERT INTO session_state(user_id, session_id, last_summarized_id, updated_ts) "
                "VALUES(?, ?, COALESCE((SELECT last_summarized_id FROM session_state WHERE user_id=? AND session_id=?), 0), ?) "
                "ON CONFLICT(user_id, session_id) DO UPDATE SET updated_ts=excluded.updated_ts",
                (user_id, session_id, user_id, session_id, ts),
            )
            conn.commit()

        return msg_id

    # -----------------------------
    # Short-term: recent messages
    # -----------------------------
    def get_recent_messages(self, user_id: str, session_id: str) -> List[ChatMessage]:
        # We want recent_pairs of (user+assistant) => *2 messages
        limit = self.recent_pairs * 2

        with sqlite3.connect(self.sqlite_path) as conn:
            rows = conn.execute(
                "SELECT role, content, ts FROM chat_messages "
                "WHERE user_id=? AND session_id=? "
                "ORDER BY id DESC LIMIT ?",
                (user_id, session_id, limit),
            ).fetchall()

        msgs = [ChatMessage(role=r[0], content=r[1], ts=float(r[2])) for r in reversed(rows)]
        return self._trim_recent_by_chars(msgs, self.max_recent_chars)

    def _trim_recent_by_chars(self, msgs: List[ChatMessage], max_chars: int) -> List[ChatMessage]:
        # CPU-cheap trimming: keep last messages until char budget reached
        total = 0
        kept: List[ChatMessage] = []
        for m in reversed(msgs):
            c = m.content.strip()
            size = len(c) + 20
            if kept and total + size > max_chars:
                break
            total += size
            kept.append(m)
        return list(reversed(kept))

    # -----------------------------
    # Long-term: store + retrieve
    # -----------------------------
    def get_relevant_memories(self, user_id: str, session_id: str, query_text: str) -> List[Dict[str, Any]]:
        q_emb = self.embed_query(query_text)

        where = {
            "$and": [
                {"app": self.app},
                {"kind": "memory"},
                {"user_id": user_id},
                # {"session_id": session_id},
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
            out.append({
                "text": text,
                "score": float(dist),
                "metadata": meta or {}
            })
        return out


    # -----------------------------
    # Summarization: Phi3 mini
    # -----------------------------
    def maybe_summarize(self, user_id: str, session_id: str) -> Optional[str]:
        """
        Summarize older messages into a compact memory and store in Chroma.
        Returns created summary (or None).
        """
        if self.phi3 is None:
            return None

        with sqlite3.connect(self.sqlite_path) as conn:
            total = conn.execute(
                "SELECT COUNT(*) FROM chat_messages WHERE user_id=? AND session_id=?",
                (user_id, session_id)
            ).fetchone()[0]

            state = conn.execute(
                "SELECT last_summarized_id FROM session_state WHERE user_id=? AND session_id=?",
                (user_id, session_id)
            ).fetchone()
            last_summarized_id = int(state[0]) if state else 0

        if total < self.summarize_after_messages:
            return None

        # Pull a chunk after last_summarized_id
        with sqlite3.connect(self.sqlite_path) as conn:
            rows = conn.execute(
                "SELECT id, role, content FROM chat_messages "
                "WHERE user_id=? AND session_id=? AND id>? "
                "ORDER BY id ASC LIMIT ?",
                (user_id, session_id, last_summarized_id, self.summarize_chunk_messages)
            ).fetchall()

        if len(rows) < self.min_messages_to_summarize:
            return None

        newest_id = last_summarized_id
        transcript_lines = []
        for mid, role, content in rows:
            newest_id = max(newest_id, int(mid))
            c = (content or "").strip()
            if len(c) > 1000:
                c = c[:1000] + "…"
            transcript_lines.append(f"{role.upper()}: {c}")

        transcript = "\n".join(transcript_lines)

        summary_prompt = self._summary_prompt(transcript)
        summary = self.phi3._generate(summary_prompt).strip()  # uses your existing generation settings

        if not summary or len(summary) < 40:
            return None

        # Embed + store in Chroma
        emb = self.embed_texts([summary])[0]

        mem_meta = {
            "app": self.app,
            "kind": "memory",
            "user_id": user_id,
            "session_id": session_id,
            "source": "phi3-mini",
            "from_message_id": last_summarized_id + 1,
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

        # Update state
        with sqlite3.connect(self.sqlite_path) as conn:
            conn.execute(
                "UPDATE session_state SET last_summarized_id=?, updated_ts=? WHERE user_id=? AND session_id=?",
                (newest_id, time.time(), user_id, session_id)
            )
            conn.commit()

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
    def build_context_pack(self, user_id: str, session_id: str, user_query: str) -> Dict[str, Any]:
        recent = self.get_recent_messages(user_id, session_id)
        memories = self.get_relevant_memories(user_id, session_id, user_query)

        return {
            "recent_messages": [m.__dict__ for m in recent],
            "relevant_memories": memories,
        }
