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
        # ---- Choose model path based on your .env LLM_MODE ----
        mode = (getattr(settings, "LLM_MODE", "cpu") or "cpu").strip().lower()

        if mode == "gpu":
            model_path = str(settings.QUERY_LLM_MODEL_GPU_PATH)
        elif mode == "desktop":
            model_path = str(settings.QUERY_LLM_MODEL_DESKTOP_PATH)
        else:
            model_path = str(settings.QUERY_LLM_MODEL_CPU_PATH)

        # ---- GPU layers only when mode == gpu ----
        # RTX 2050 4GB: keep modest. Query model is small; start 8–20.
        n_gpu_layers = 0
        if mode == "gpu":
            n_gpu_layers = int(getattr(settings, "QUERY_LLM_N_GPU_LAYERS", 16))

        # Optional knobs (safe defaults)
        n_batch = int(getattr(settings, "QUERY_LLM_N_BATCH", 256))
        f16_kv = bool(getattr(settings, "QUERY_LLM_GPU_F16_KV", True))

        print(f"[LLM Subclient] Loading model from: {model_path}")
        print(f"[LLM Subclient] Context size: {settings.QUERY_LLM_CONTEXT_SIZE}")
        print(f"[LLM Subclient] LLM_MODE: {mode} | n_gpu_layers: {n_gpu_layers} | n_batch: {n_batch}")

        try:
            self.llm = Llama(
                model_path=model_path,
                n_ctx=settings.QUERY_LLM_CONTEXT_SIZE,
                n_threads=settings.QUERY_LLM_THREADS,
                n_batch=n_batch,
                n_gpu_layers=n_gpu_layers,  # 0 = CPU-only
                f16_kv=f16_kv,
                verbose=False,
            )
            print("[LLM Subclient] Model loaded successfully.")
        except Exception as e:
            # If GPU mode fails, fall back to CPU so the app still works
            if n_gpu_layers > 0:
                print(f"[LLM Subclient] GPU init failed. Falling back to CPU. Reason: {e}")

                self.llm = Llama(
                    model_path=str(settings.QUERY_LLM_MODEL_CPU_PATH),
                    n_ctx=settings.QUERY_LLM_CONTEXT_SIZE,
                    n_threads=settings.QUERY_LLM_THREADS,
                    n_batch=n_batch,
                    n_gpu_layers=0,
                    verbose=False,
                )
                print("[LLM Subclient] CPU fallback successful.")
            else:
                raise

    def generate_multi_queries(self, user_query: str, n: int = 5) -> List[str]:
        prompt = f"""
Rewrite the user query into {n} short alternative queries that keep the same meaning.
Return ONLY valid JSON in this format:
{{"queries":["...","..."]}}

User query:
"{user_query}"
"""
        text = self._generate(prompt, False)
        data = extract_first_json_object(text)

        queries = data.get("queries")
        if not isinstance(queries, list) or len(queries) != n:
            raise ValueError(f"Expected {n} queries, got: {queries}")

        return [str(q).strip() for q in queries if str(q).strip()]

    def _generate(self, prompt: str, use_chat_format: bool = False) -> str:
        """
        Generate text, optionally using chat format.
        For title generation, we want raw completion mode.
        """
        if not use_chat_format:
            # Raw completion mode - better for structured outputs
            result = self.llm(
                prompt,
                max_tokens=settings.QUERY_LLM_MAX_TOKENS,
                temperature=settings.QUERY_LLM_TEMPERATURE,
                top_p=settings.QUERY_LLM_TOP_P,
                stop=["}", "\n\n"],  # Stop after JSON closes
            )
            return (result["choices"][0]["text"] or "").strip()
        else:
            chat_format = (getattr(settings, "QUERY_LLM_MODEL_FAMILY", "") or "").lower()
            if chat_format in ("phi-3-mini", "phi-3", "phi"):
                self.llm.chat_format = "phi-3"
            else:
                self.llm.chat_format = "chatml"

            messages = [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ]

            out = self.llm.create_chat_completion(
                messages=messages,
                max_tokens=settings.QUERY_LLM_MAX_TOKENS,
                temperature=settings.QUERY_LLM_TEMPERATURE,
                top_p=settings.QUERY_LLM_TOP_P,
            )
            return (out["choices"][0]["message"]["content"] or "").strip()

    def generate(self, prompt: str, use_chat_format: bool = False) -> str:
        return self._generate(prompt, use_chat_format=use_chat_format)
