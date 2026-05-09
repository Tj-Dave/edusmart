from __future__ import annotations

import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from typing import AsyncGenerator, Generator, Any

from llama_cpp import Llama
from app.core.config import settings
import threading


class LLMClient:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(LLMClient, cls).__new__(cls)
                    cls._instance.llm = None
                    cls._instance.mock_mode = False
                    cls._instance._executor = ThreadPoolExecutor(max_workers=4)
                    cls._instance._initialize_model()
        return cls._instance

    def _select_model_path(self) -> str:
        """
        Select model path based on LLM_MODE in .env:
          - cpu     -> FINAL_LLM_MODEL_CPU_PATH
          - desktop -> FINAL_LLM_MODEL_DESKTOP_PATH
          - gpu     -> FINAL_LLM_MODEL_GPU_PATH
        """
        mode = (getattr(settings, "LLM_MODE", "cpu") or "cpu").strip().lower()

        if mode == "gpu":
            return str(settings.FINAL_LLM_MODEL_GPU_PATH)
        if mode == "desktop":
            return str(settings.FINAL_LLM_MODEL_DESKTOP_PATH)
        # default cpu
        return str(settings.FINAL_LLM_MODEL_CPU_PATH)

    def _gpu_layers_for_mode(self) -> int:
        """
        Enable GPU offload only when LLM_MODE=gpu.
        If you're using a CUDA wheel and want hybrid offload, set layers > 0.
        """
        mode = (getattr(settings, "LLM_MODE", "cpu") or "cpu").strip().lower()
        if mode != "gpu":
            return 0

        # Good RTX 2050 (4GB) starting point:
        # tune with env FINAL_LLM_N_GPU_LAYERS
        return int(getattr(settings, "FINAL_LLM_N_GPU_LAYERS", 16))

    def _initialize_model(self):
        if settings.ENABLE_MOCK_LLM:
            self.mock_mode = True
            self.llm = None
            print("[LLM] Mock LLM mode enabled.")
            return

        self.mock_mode = False

        model_path = self._select_model_path()
        n_gpu_layers = self._gpu_layers_for_mode()

        n_batch = int(getattr(settings, "FINAL_LLM_N_BATCH", 256))
        f16_kv = bool(getattr(settings, "FINAL_LLM_GPU_F16_KV", True))

        print(f"[LLM] Loading FINAL model from: {model_path}")
        print(f"[LLM] LLM_MODE: {getattr(settings, 'LLM_MODE', 'cpu')}")
        print(f"[LLM] n_ctx: {settings.FINAL_LLM_CONTEXT_SIZE} | n_threads: {settings.FINAL_LLM_THREADS}")
        print(f"[LLM] n_batch: {n_batch} | n_gpu_layers: {n_gpu_layers} | f16_kv: {f16_kv}")

        try:
            self.llm = Llama(
                model_path=model_path,
                n_ctx=settings.FINAL_LLM_CONTEXT_SIZE,
                n_threads=settings.FINAL_LLM_THREADS,
                n_batch=n_batch,
                n_gpu_layers=n_gpu_layers,  # 0 = CPU-only; >0 = GPU offload
                f16_kv=f16_kv,
                verbose=False,  # set True temporarily when debugging CUDA
            )
            print("[LLM] Model loaded successfully.")
        except Exception as e:
            # If GPU mode fails, fall back to CPU mode automatically
            if n_gpu_layers > 0:
                print(f"[LLM] GPU init failed, falling back to CPU. Reason: {e}")
                self.llm = Llama(
                    model_path=str(settings.FINAL_LLM_MODEL_CPU_PATH),
                    n_ctx=settings.FINAL_LLM_CONTEXT_SIZE,
                    n_threads=settings.FINAL_LLM_THREADS,
                    n_batch=n_batch,
                    n_gpu_layers=0,
                    verbose=False,
                )
                print("[LLM] CPU fallback successful.")
            else:
                raise  # CPU load failing is a real failure

    def generate(self, prompt: str) -> str:
        """Generate a complete response synchronously using chat completion."""
        if self.mock_mode:
            return "[MOCK RESPONSE] LLM mock mode is enabled."

        if not self.llm:
            raise RuntimeError("LLM model not initialized.")

        response = self.llm.create_chat_completion(
            messages=[
                {"role": "user", "content": prompt}
            ],
            max_tokens=settings.FINAL_LLM_MAX_TOKENS,
            temperature=settings.FINAL_LLM_TEMPERATURE,
            top_p=settings.FINAL_LLM_TOP_P,
        )
        return response["choices"][0]["message"]["content"].strip()

    def generate_stream(
        self,
        prompt: str,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        max_tokens: int | None = None,
    ) -> Generator[str, None, None]:
        """Generate response as a stream of tokens using raw completion.
        
        Args:
            prompt: Input prompt string
            temperature: Sampling temperature (default: from settings)
            top_p: Nucleus sampling parameter (default: from settings)
            top_k: Top-k sampling parameter (default: None)
            max_tokens: Maximum tokens to generate (default: from settings)
            
        Yields:
            Individual tokens as they are generated
        """
        if self.mock_mode:
            yield from self._mock_stream()
            return

        if not self.llm:
            raise RuntimeError("LLM model not initialized.")

        params: dict[str, Any] = {
            "prompt": prompt,
            "max_tokens": max_tokens or settings.FINAL_LLM_MAX_TOKENS,
            "temperature": temperature if temperature is not None else settings.FINAL_LLM_TEMPERATURE,
            "top_p": top_p if top_p is not None else settings.FINAL_LLM_TOP_P,
            "stream": True,
        }
        
        if top_k is not None:
            params["top_k"] = top_k

        for chunk in self.llm(**params):
            token = chunk.get("choices", [{}])[0].get("text", "")
            if token:
                yield token

    async def generate_stream_async(
        self,
        prompt: str,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[str, None]:
        """Async wrapper for generate_stream that runs in ThreadPoolExecutor.
        
        Args:
            prompt: Input prompt string
            temperature: Sampling temperature (default: from settings)
            top_p: Nucleus sampling parameter (default: from settings)
            top_k: Top-k sampling parameter (default: None)
            max_tokens: Maximum tokens to generate (default: from settings)
            
        Yields:
            Individual tokens as they are generated
        """
        loop = asyncio.get_event_loop()
        
        def _run_sync_generator():
            """Run the synchronous generator and collect results."""
            results = []
            for token in self.generate_stream(
                prompt=prompt,
                temperature=temperature,
                top_p=top_p,
                top_k=top_k,
                max_tokens=max_tokens,
            ):
                results.append(token)
            return results
        
        tokens = await loop.run_in_executor(self._executor, _run_sync_generator)
        
        for token in tokens:
            yield token
            await asyncio.sleep(0)

    def _mock_stream(self) -> Generator[str, None, None]:
        """Generate mock tokens for testing streaming functionality."""
        mock_response = "This is a mock streaming response from the LLM. "
        mock_response += "It demonstrates token-by-token generation. "
        mock_response += "Each word is yielded separately with a small delay."
        
        words = mock_response.split()
        for i, word in enumerate(words):
            time.sleep(0.05)
            if i < len(words) - 1:
                yield word + " "
            else:
                yield word
