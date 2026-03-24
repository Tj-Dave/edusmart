import os
import json
import traceback

from app.services.llm.llama_cpp_client import LLMClient
from app.services.document_text_extractor import extract_text_from_bytes
from app.services.course_spec_service import _PROMPT_DOC_CHARS, _SPEC_SCHEMA_DESCRIPTION

def test_full_extract():
    print("Loading document...")
    pdf_path = '../docs/CS102/ee952738-be22-4c33-92a1-353de8212489/CBC_draft_Mobile App 2026.pdf'
    with open(pdf_path, 'rb') as f:
        data = f.read()
    
    doc_text = extract_text_from_bytes(data, 'CBC.pdf')
    doc_excerpt = doc_text[:_PROMPT_DOC_CHARS]
    
    prompt = f"""You are an academic curriculum analyst. Analyze the following course blueprint document and extract a structured course specification.

COURSE DOCUMENT (filename: CBC.pdf, course_id: CS102):
===BEGIN DOCUMENT===
{doc_excerpt}
===END DOCUMENT===

{_SPEC_SCHEMA_DESCRIPTION}"""

    print("Initializing LLM client...")
    client = LLMClient()
    
    print("\nStarting generation...")
    try:
        resp = client.generate(prompt)
        print("\n=== GENERATED RESPONSE (first 1000 chars) ===")
        print(resp[:1000] + "\n...\n")
        print("\n=== GENERATED RESPONSE (last 1000 chars) ===")
        print("...\n" + resp[-1000:] if len(resp) > 1000 else "")
        print("\nSUCCESS!")
    except Exception as e:
        print(f"\nFAILED during generation: {type(e).__name__}: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    test_full_extract()
