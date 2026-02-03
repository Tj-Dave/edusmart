"""
File utilities for safe file handling in EduSmart.

SECURITY NOTE: 
These functions prevent directory traversal attacks (e.g., "../../../etc/passwd")
and ensure uploaded files stay within designated directories.
"""
from pathlib import Path
from typing import Optional
import shutil
import uuid
from fastapi import UploadFile
import structlog

logger = structlog.get_logger()

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx"}

def is_safe_path(base_dir: Path, file_path: Path) -> bool:
    """
    Check if file_path is within base_dir (prevents directory traversal attacks).
    
    EXAMPLE:
    base_dir = /home/app/uploads
    safe: /home/app/uploads/file.pdf ✅
    unsafe: /home/app/uploads/../../../etc/passwd ❌
    """
    try:
        resolved_path = file_path.resolve()
        resolved_base = base_dir.resolve()
        return resolved_path.is_relative_to(resolved_base)
    except (ValueError, RuntimeError):
        return False

def is_allowed_file(filename: str) -> bool:
    """
    Check if file extension is allowed.
    
    WHY: Prevents users from uploading executable files or scripts.
    """
    suffix = Path(filename).suffix.lower()
    return suffix in ALLOWED_EXTENSIONS

async def save_upload_file(upload_file: UploadFile, destination_dir: Path) -> Path:
    """
    Safely save an uploaded file to disk.
    
    HOW IT WORKS:
    1. Generate unique filename to avoid conflicts
    2. Validate file extension
    3. Check path safety
    4. Stream file to disk in chunks (memory-efficient)
    5. Return the saved file path
    
    Args:
        upload_file: FastAPI UploadFile object
        destination_dir: Directory to save to
    
    Returns:
        Path to saved file
    
    Raises:
        ValueError: If file type not allowed or path unsafe
    """
    if not is_allowed_file(upload_file.filename):
        raise ValueError(f"File type not allowed: {upload_file.filename}")
    
    # Create uploads directory if it doesn't exist
    destination_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename: original_name_uuid.ext
    original_stem = Path(upload_file.filename).stem
    original_suffix = Path(upload_file.filename).suffix
    unique_filename = f"{original_stem}_{uuid.uuid4().hex[:8]}{original_suffix}"
    
    file_path = destination_dir / unique_filename
    
    # Security check: ensure path is within destination_dir
    if not is_safe_path(destination_dir, file_path):
        raise ValueError("Invalid file path detected")
    
    # Save file in chunks (memory-efficient for large files)
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
        
        logger.info("File saved", filename=unique_filename, size=file_path.stat().st_size)
        return file_path
    
    except Exception as e:
        # Clean up partial file if save failed
        if file_path.exists():
            file_path.unlink()
        logger.error("File save failed", filename=upload_file.filename, error=str(e))
        raise

def cleanup_temp_file(file_path: Path) -> None:
    """
    Delete a temporary file after processing.
    
    WHY: Prevents disk space from filling up with uploaded files.
    """
    try:
        if file_path.exists():
            file_path.unlink()
            logger.info("Temp file cleaned up", file=str(file_path))
    except Exception as e:
        logger.warning("Cleanup failed", file=str(file_path), error=str(e))
