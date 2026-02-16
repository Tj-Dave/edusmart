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
        if self.mock_mode:
            return "[MOCK RESPONSE] LLM mock mode is enabled."

        if not self.llm:
            raise RuntimeError("LLM model not initialized.")

        response = self.llm(
            prompt,
            max_tokens=settings.FINAL_LLM_MAX_TOKENS,
            temperature=settings.FINAL_LLM_TEMPERATURE,
            top_p=settings.FINAL_LLM_TOP_P,
            stop=["</s>"],
        )
        return response["choices"][0]["text"].strip()
