"""
Intelligent Confidence Layer (ICL)

Computes confidence scores for pipeline components (bloom_detector, competency_mapper, rag_engine)
using a hybrid approach: LLM-based scoring (primary) + heuristic scoring (secondary).
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


class IntelligentConfidenceLayer:
    """
    Non-breaking confidence scoring layer for AI pipeline components.
    
    Combines LLM-based scoring with lightweight heuristics to determine
    whether bloom_detector, competency_mapper, and rag_engine should run.
    """

    # Prompt template for LLM-based scoring (stricter JSON output)
    SCORING_PROMPT = (
        "You are a scoring engine for an AI education system.\n"
        "Given a user query, return confidence scores (0 to 1) for whether the following modules should run:\n"
        "1. bloom_detector → Does the query express a cognitive learning task?\n"
        "2. cbc_mapper → Is the query aligned with a structured curriculum outcome?\n"
        "3. rag_engine → Does the query require external course-specific documents?\n"
        "Scoring rules:\n"
        "- Be strict. Use 0.0 for irrelevant.\n"
        "- Use high values (>0.7) only when clearly needed.\n"
        "- Prefer lower scores when uncertain.\n"
        "\n"
        "CRITICAL: Output ONLY a valid JSON object starting with {{ and ending with }}.\n"
        "Do NOT include any text before or after the JSON object.\n"
        "Do NOT use markdown formatting.\n"
        "Do NOT write 'Answer:', 'Response:', or any other prefix.\n"
        "The VERY FIRST character of your response must be {{.\n"
        "The VERY LAST character of your response must be }}.\n"
        "\n"
        "If you cannot answer, output EXACTLY: {{\"bloom_conf\": 0.0, \"cbc_conf\": 0.0, \"rag_conf\": 0.0}}\n"
        "\n"
        "Query:\n\"{query}\"\n"
    )

    # Fusion weight (alpha): higher = more LLM influence
    ALPHA = 0.85

    # Expected score keys
    REQUIRED_KEYS = {"bloom_conf", "cbc_conf", "rag_conf"}

    def __init__(self, llm_client: Any):
        """
        Initialize the confidence layer.
        
        Args:
            llm_client: Existing LLM client (llama.cpp wrapper)
        """
        self.llm_client = llm_client

    async def compute(self, query: str, return_raw_llm: bool = False) -> dict[str, float] | tuple[dict[str, float], str | None]:
        """
        Compute confidence scores for pipeline components.
        
        Args:
            query: User query string
            return_raw_llm: If True, return tuple of (scores, raw_llm_output)
            
        Returns:
            Dictionary with keys: bloom_conf, cbc_conf, rag_conf
            Or tuple of (scores_dict, raw_llm_output) if return_raw_llm=True
        """
        # Compute heuristic scores (always available as fallback)
        heuristic_scores = self._heuristic_scores(query)

        # Attempt LLM-based scoring
        llm_scores, raw_llm_output = await self._llm_scores(query)

        # Fuse scores if LLM succeeded, otherwise use heuristics only
        if llm_scores is not None:
            final_scores = self._fuse_scores(llm_scores, heuristic_scores)
            logger.info(
                "ICL scores computed",
                extra={
                    "query_preview": query[:50],
                    "llm_scores": llm_scores,
                    "heuristic_scores": heuristic_scores,
                    "final_scores": final_scores,
                },
            )
        else:
            final_scores = heuristic_scores
            logger.warning(
                "ICL fallback to heuristics only",
                extra={
                    "query_preview": query[:50],
                    "heuristic_scores": heuristic_scores,
                },
            )

        if return_raw_llm:
            return final_scores, raw_llm_output
        return final_scores

    async def _llm_scores(self, query: str) -> tuple[dict[str, float] | None, str | None]:
        """
        Get confidence scores from LLM.
        
        Args:
            query: User query string
            
        Returns:
            Tuple of (scores_dict or None, raw_llm_output or None)
        """
        try:
            # Build prompt
            prompt = self.SCORING_PROMPT.format(query=query.strip())

            # Call LLM with LOCAL overrides (deterministic settings)
            raw_response = await self._call_llm_with_overrides(
                prompt=prompt,
                temperature=0.0,
                top_p=1.0,
                top_k=1,
                max_tokens=200,
            )

            if not raw_response or not raw_response.strip():
                logger.warning("ICL: LLM returned empty response")
                return None, raw_response

            # Parse JSON response
            scores = self._parse_llm_response(raw_response)
            
            # Validate schema
            if not self._validate_scores(scores):
                logger.warning("ICL: LLM scores failed validation", extra={"raw": raw_response})
                return None, raw_response

            return scores, raw_response

        except Exception as e:
            logger.error(f"ICL: LLM scoring failed: {e}", exc_info=True)
            return None, None

    async def _call_llm_with_overrides(
        self,
        prompt: str,
        temperature: float,
        top_p: float,
        top_k: int,
        max_tokens: int,
    ) -> str:
        """
        Call LLM with local parameter overrides.
        
        This method ensures we use deterministic settings for confidence scoring
        without modifying the global LLM client configuration.
        """
        # Use the new generate_with_overrides method
        if hasattr(self.llm_client, "generate_with_overrides"):
            response = await self.llm_client.generate_with_overrides(
                prompt=prompt,
                temperature=temperature,
                top_p=top_p,
                top_k=top_k,
                max_tokens=max_tokens,
            )
        # Fallback to standard generate if overrides not supported
        elif hasattr(self.llm_client, "generate"):
            logger.warning("ICL: LLM client does not support generate_with_overrides, using default params")
            response = self.llm_client.generate(prompt)
        else:
            # Last resort: call client directly
            logger.warning("ICL: Using fallback LLM call method")
            response = self.llm_client(prompt)

        return response if isinstance(response, str) else str(response)

    def _parse_llm_response(self, raw_response: str) -> dict[str, float] | None:
        """Parse LLM response into score dictionary."""
        try:
            text = raw_response.strip()
            
            # Handle common prefixes
            # Remove "Answer:", "Response:", "Output:", etc.
            for prefix in ["Answer:", "Response:", "Output:", "JSON:"]:
                if text.lower().startswith(prefix.lower()):
                    text = text[len(prefix):].strip()
            
            # Remove markdown code blocks if present
            if text.startswith("```"):
                lines = text.split("\n")
                lines = lines[1:]  # Skip opening ```
                # Find closing ```
                for i, line in enumerate(lines):
                    if line.strip().startswith("```"):
                        lines = lines[:i]
                        break
                text = "\n".join(lines).strip()
            
            # Try to find JSON object
            start_idx = text.find("{")
            end_idx = text.rfind("}")
            
            if start_idx == -1:
                return None
            
            # If no closing brace, try to fix incomplete JSON
            if end_idx == -1:
                # Assume it's just missing the closing brace
                json_str = text[start_idx:] + "}"
            else:
                json_str = text[start_idx : end_idx + 1]
            
            # Clean up: handle trailing commas
            json_str = json_str.strip()
            
            scores = json.loads(json_str)
            return scores
        
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(f"ICL: Failed to parse LLM response: {e}", extra={"raw": raw_response})
            return None

    def _validate_scores(self, scores: Any) -> bool:
        """
        Validate score dictionary schema.
        
        Args:
            scores: Parsed scores object
            
        Returns:
            True if valid, False otherwise
        """
        if not isinstance(scores, dict):
            return False

        # Check all required keys exist
        if not self.REQUIRED_KEYS.issubset(scores.keys()):
            return False

        # Check all values are floats between 0 and 1
        for key in self.REQUIRED_KEYS:
            value = scores[key]
            try:
                float_value = float(value)
                if not (0.0 <= float_value <= 1.0):
                    return False
            except (TypeError, ValueError):
                return False

        return True

    def _heuristic_scores(self, query: str) -> dict[str, float]:
        """
        Compute lightweight heuristic confidence scores.
        
        This is the fallback when LLM scoring fails, and also contributes
        to the final fused score with low weight (1 - alpha).
        
        Args:
            query: User query string
            
        Returns:
            Dictionary with heuristic scores
        """
        q = query.lower()
        words = q.split()

        # Bloom detector: cognitive task indicators
        bloom_keywords = ["explain", "define", "analyze", "why", "how", "compare", "evaluate", "create"]
        bloom_conf = 0.7 if any(w in q for w in bloom_keywords) else 0.2

        # CBC mapper: curriculum/problem-solving indicators
        cbc_keywords = ["solve", "calculate", "derive", "prove", "compute", "formula"]
        cbc_conf = 0.6 if any(w in q for w in cbc_keywords) else 0.3

        # RAG engine: longer queries likely need context
        rag_conf = 0.8 if len(words) > 8 else 0.3

        return {
            "bloom_conf": bloom_conf,
            "cbc_conf": cbc_conf,
            "rag_conf": rag_conf,
        }

    def _fuse_scores(
        self,
        llm_scores: dict[str, float],
        heuristic_scores: dict[str, float],
    ) -> dict[str, float]:
        """
        Fuse LLM and heuristic scores using weighted average.
        
        Args:
            llm_scores: Scores from LLM
            heuristic_scores: Scores from heuristics
            
        Returns:
            Fused scores (rounded to 3 decimal places)
        """
        return {
            key: round(
                self.ALPHA * float(llm_scores[key]) + (1 - self.ALPHA) * float(heuristic_scores[key]),
                3,
            )
            for key in self.REQUIRED_KEYS
        }
