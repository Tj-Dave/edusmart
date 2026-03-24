import os
import sys
import json
import traceback

os.environ["LLM_MODE"] = "gpu"
os.environ["FINAL_LLM_MAX_TOKENS"] = "3072"
os.environ["FINAL_LLM_CONTEXT_SIZE"] = "8192"

from app.services.llm.llama_cpp_client import LLMClient

def test_llm():
    print("Initializing LLM client...")
    try:
        client = LLMClient()
        print("LLM client initialized.")
        
        prompt = "You are a helpful assistant. Please return a JSON object with the key 'status' set to 'success'."
        print("Generating simple response...")
        resp = client.generate(prompt)
        print("Raw response:", repr(resp))
        
        # Test with the actual extract prompt size (roughly)
        print("\nTesting large prompt...")
        large_prompt = "You are a helpful assistant. " * 500 + " Please return a JSON object with the key 'status' set to 'success'."
        resp2 = client.generate(large_prompt)
        print("Large prompt generated.")
    except Exception as e:
        print(f"Exception caught in test script: {type(e).__name__}: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    test_llm()
