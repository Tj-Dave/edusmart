"""
document_text_extractor.py
--------------------------
Extracts raw text from uploaded course blueprint documents (PDF, DOCX).
Returns the full text to be fed into the LLM spec extraction prompt.
"""
from __future__ import annotations

from pathlib import Path

from app.services.domain_errors import ServiceValidationError

_MAX_CHARS = 12_000  # Generous but safe for an 8K-context LLM


def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    """
    Extract readable text from a PDF or DOCX file given as raw bytes.
    Returns plain text (may include whitespace/newlines).
    Raises ServiceValidationError if the file cannot be parsed or yields no text.
    """
    suffix = Path(filename).suffix.lower()

    if suffix == ".pdf":
        return _extract_pdf(file_bytes)
    elif suffix in {".docx", ".doc"}:
        return _extract_docx(file_bytes)
    else:
        raise ServiceValidationError(
            f"Unsupported file type '{suffix}'. Only PDF and DOCX are supported for spec extraction."
        )


def _extract_pdf(file_bytes: bytes) -> str:
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise ServiceValidationError(
            "PyMuPDF is not installed. Cannot extract text from PDF."
        )

    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ServiceValidationError(f"Could not open PDF: {exc}") from exc

    pages_text: list[str] = []
    for page in doc:
        text = page.get_text("text") or ""
        if text.strip():
            pages_text.append(text.strip())

    doc.close()
    full_text = "\n\n".join(pages_text)

    if not full_text.strip():
        raise ServiceValidationError(
            "PDF appears to contain no extractable text (may be image-only/scanned). "
            "Please provide a text-based PDF or a DOCX version."
        )

    return full_text[:_MAX_CHARS]


def _extract_docx(file_bytes: bytes) -> str:
    try:
        import docx as python_docx
        from io import BytesIO
    except ImportError:
        raise ServiceValidationError(
            "python-docx is not installed. Cannot extract text from DOCX."
        )

    try:
        document = python_docx.Document(BytesIO(file_bytes))
    except Exception as exc:
        raise ServiceValidationError(f"Could not open DOCX: {exc}") from exc

    paragraphs: list[str] = []
    for para in document.paragraphs:
        text = para.text.strip()
        if text:
            paragraphs.append(text)

    # Also pull table cells (weekly content tables are typically in a DOCX table)
    for table in document.tables:
        for row in table.rows:
            row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if row_cells:
                paragraphs.append(" | ".join(row_cells))

    full_text = "\n".join(paragraphs)

    if not full_text.strip():
        raise ServiceValidationError(
            "DOCX appears to contain no extractable text."
        )

    return full_text[:_MAX_CHARS]
