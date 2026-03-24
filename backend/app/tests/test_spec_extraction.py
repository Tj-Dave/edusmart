import os
import sys
import json
import time
from pathlib import Path

# Important: ensure tests can import from app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.services.llm.llama_cpp_client import LLMClient
from app.services.document_text_extractor import extract_text_from_bytes
from app.services.course_spec_service import _PROMPT_DOC_CHARS, _SPEC_SCHEMA_DESCRIPTION, _validate_spec_json

def test_course_spec_extraction():
    print("=== TEST LOG: Spec Extraction Pipeline ===")
    
    # 1. Load the document
    pdf_path = Path(__file__).resolve().parent.parent.parent.parent / "docs" / "CS102" / "ee952738-be22-4c33-92a1-353de8212489" / "CBC_draft_Mobile App 2026.pdf"
    print(f"\n[1] Loading PDF from: {pdf_path}")
    if not pdf_path.exists():
        print(f"ERROR: PDF file not found at {pdf_path}")
        return
        
    with open(pdf_path, "rb") as f:
        data = f.read()
    print(f"    Loaded {len(data)} bytes.")

    # 2. Extract Document Text
    print("\n[2] Extracting text representation...")
    start_time = time.time()
    doc_text = extract_text_from_bytes(data, "CBC_draft_Mobile App 2026.pdf")
    print(f"    Extracted {len(doc_text)} characters in {time.time() - start_time:.2f} seconds.")
    
    doc_excerpt = doc_text[:_PROMPT_DOC_CHARS]
    print(f"    Trimmed for prompt to {_PROMPT_DOC_CHARS} chars.")

    # 3. Build Prompt
    print("\n[3] Building LLM Prompt...")
    prompt = f"""You are an academic curriculum analyst. Analyze the following course blueprint document and extract a structured course specification.

COURSE DOCUMENT (filename: CBC_draft_Mobile_App_2026.pdf, course_id: CS102):
===BEGIN DOCUMENT===
{doc_excerpt}
===END DOCUMENT===

{_SPEC_SCHEMA_DESCRIPTION}"""
    
    prompt_len = len(prompt)
    print(f"    Prompt length: {prompt_len} characters (~{prompt_len // 3} tokens).")

    # 4. Initialize LLM Client
    print("\n[4] Initializing LLM Backend (This loads Gemma-3 to VRAM)...")
    try:
        start_time = time.time()
        client = LLMClient()
        print(f"    LLM backend ready in {time.time() - start_time:.2f} seconds.")
    except Exception as e:
        print(f"CRITICAL ERROR loading LLM: {type(e).__name__}: {e}")
        return

    # 5. Generate Response
    print("\n[5] Triggering LLM Generation (PLEASE WAIT, this may take 2-5 minutes on an RTX 2050)...")
    # Tell user exactly when it starts
    start_time = time.time()
    try:
        raw_response = client.generate(prompt)
        gen_time = time.time() - start_time
        print(f"\n    [!] Generation finished successfully in {gen_time:.1f} seconds! (~{len(raw_response)//3/max(1, gen_time):.1f} tokens/sec)")
    except Exception as e:
        print(f"\n    [X] LLM GENERATION FAILED/CRASHED after {time.time() - start_time:.1f}s: {type(e).__name__}: {e}")
        return

    # 6. Log raw output to file so it's not swallowed by terminal scroll
    out_file = Path(__file__).resolve().parent / "raw_llm_output.log"
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(raw_response)
    print(f"\n[6] Raw Output saved to: {out_file}")
    print("\n=== RAW OUTPUT PREVIEW (First 500 chars) ===")
    print(raw_response[:500])
    print("\n=== RAW OUTPUT PREVIEW (Last 500 chars) ===")
    print(raw_response[-500:] if len(raw_response) > 500 else "")
    print("============================================\n")

    # 7. Parse JSON
    print("[7] Testing JSON conformity...")
    text = raw_response.strip()
    import re
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text.strip())

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        print("    [X] FAILED: No JSON object boundaries '{...}' found in response.")
        return

    try:
        obj = json.loads(text[start: end + 1])
        print("    [+] JSON Syntax: VALID")
    except Exception as e:
        print(f"    [X] JSON Syntax FAILED: {e}")
        return

    # 8. Schema Validation
    print("\n[8] Running Schema Validation...")
    validated = _validate_spec_json(obj)
    
    if "roadmap_items" in obj and len(obj["roadmap_items"]) > 0:
        print(f"    [+] Successfully validated structure. Found {len(obj['roadmap_items'])} weekly roadmap items!")
        print("\n=== TEST COMPLETED SUCCESSFULLY ===")
    else:
        print("    [!] Validated, but found NO roadmap items. Fallback will trigger.")

if __name__ == "__main__":
    test_course_spec_extraction()
