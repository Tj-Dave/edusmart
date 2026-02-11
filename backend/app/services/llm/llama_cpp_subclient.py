import json
from llama_cpp import Llama
from app.core.config import settings
from typing import List


def extract_first_json_object(text: str) -> dict:
    start = text.find("{")
    if start == -1:
        raise ValueError("No JSON object start '{' found in output.")

    decoder = json.JSONDecoder()
    obj, _ = decoder.raw_decode(text[start:])
    return obj


class LLMSubclient:
    def __init__(self):
        self.llm = Llama(
            model_path=str(settings.query_llm_model_path),
            n_ctx=settings.QUERY_LLM_CONTEXT_SIZE,
            n_threads=settings.QUERY_LLM_THREADS,
            verbose=False,
        )

    def _generate(self, prompt: str) -> str:
        result = self.llm(
            prompt,
            max_tokens=settings.QUERY_LLM_MAX_TOKENS,
            temperature=settings.QUERY_LLM_TEMPERATURE,
            top_p=settings.QUERY_LLM_TOP_P,
            stop=["<|assistant|>", "<|user|>", "</s>", "Instruction", "\n\n"],
        )
        return result["choices"][0]["text"].strip()

    def generate_multi_queries(self, user_query: str, n: int = 5) -> List[str]:
        prompt = f"""
Rewrite the user query into {n} short alternative queries that keep the same meaning.
Return ONLY valid JSON in this format:
{{"queries":["...","..."]}}

User query:
"{user_query}"
"""

        text = self._generate(prompt)
        data = extract_first_json_object(text)

        queries = data.get("queries")
        if not isinstance(queries, list) or len(queries) != n:
            raise ValueError(f"Expected {n} queries, got: {queries}")

        return [str(q).strip() for q in queries if str(q).strip()]
