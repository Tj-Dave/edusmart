from llama_cpp import Llama
from app.core.config import settings
import threading


class LLMClient:
    """
    Unified interface for local LLM inference using llama.cpp.
    Supports dynamic model switching based on LLM_MODE setting.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        """
        Singleton pattern to ensure only one model is loaded in memory.
        """
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(LLMClient, cls).__new__(cls)
                    cls._instance.llm = None 
                    cls._instance._initialize_model()
        return cls._instance

    def _initialize_model(self):
        """
        Load the correct model based on configuration.
        """
        if settings.ENABLE_MOCK_LLM:
            self.mock_mode = True
            self.llm = None
            print("[LLM] Mock LLM mode enabled — no model loaded.")
            return

        self.mock_mode = False

        model_path = str(settings.llm_model_path)

        print(f"[LLM] Loading model from: {model_path}")
        print(f"[LLM] Context size: {settings.LLM_CONTEXT_SIZE}")

        self.llm = Llama(
            model_path=model_path,
            n_ctx=settings.LLM_CONTEXT_SIZE,
            n_threads=settings.LLM_THREADS,              # Adjust based on CPU cores
            n_batch=512,
            verbose=False
        )

        print("[LLM] Model loaded successfully.")

    def generate(self, prompt: str) -> str:
        """
        Generate response from the LLM given a prompt.
        """

        if self.mock_mode:
            return "[MOCK RESPONSE] LLM mock mode is enabled."

        if not self.llm:
            raise RuntimeError("LLM model not initialized.")

        response = self.llm(
            prompt,
            max_tokens=settings.LLM_MAX_TOKENS,
            temperature=settings.LLM_TEMPERATURE,
            top_p=settings.LLM_TOP_P,
            stop=["</s>"]
        )

        return response["choices"][0]["text"].strip()
