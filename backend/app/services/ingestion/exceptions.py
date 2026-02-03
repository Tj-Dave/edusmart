"""
Custom exceptions for EduSmart ingestion pipeline.
"""
from pathlib import Path

class UnsupportedFileTypeError(Exception):
    """Raised when an unsupported file type is provided to DocumentLoader."""
    def __init__(self, file_path: Path):
        super().__init__(f"Unsupported file type: {file_path}")
        self.file_path = file_path

class FileCorruptedError(Exception):
    """Raised when a file is corrupted or unreadable."""
    def __init__(self, file_path: Path):
        super().__init__(f"File corrupted or unreadable: {file_path}")
        self.file_path = file_path

class ExtractionFailedError(Exception):
    """Raised when extraction of text or images fails."""
    def __init__(self, file_path: Path, reason: str):
        super().__init__(f"Extraction failed for {file_path}: {reason}")
        self.file_path = file_path
        self.reason = reason
