"""
Ingestion API endpoints for EduSmart.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
from typing import Dict, Any
from app.core.config import settings
from app.services.ingestion.ingestion_pipeline import IngestionPipeline

router = APIRouter(prefix="/api/v1/ingest", tags=["ingestion"])

# Global pipeline instance
_pipeline: IngestionPipeline | None = None

def get_pipeline() -> IngestionPipeline:
    """Get or create the ingestion pipeline singleton."""
    global _pipeline
    if _pipeline is None:
        _pipeline = IngestionPipeline()
    return _pipeline


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Upload and process an educational document.

    Args:
        file: Uploaded document file (PDF, DOCX, or PPTX)

    Returns:
        Ingestion result with document_id, status, and statistics
    """
    if file.filename.split('.')[-1].lower() not in ['pdf', 'docx', 'pptx']:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, PPTX are allowed")
    
    try:
        # Save uploaded file temporarily
        uploads_dir = Path(settings.BASE_DIR) / "data" / "uploads"
        uploads_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = uploads_dir / file.filename
        with open(file_path, "wb") as f:
            f.write(await file.read())
        
        # Process
        pipeline = get_pipeline()
        result = pipeline.ingest(file_path)
        
        # Cleanup
        file_path.unlink(missing_ok=True)
        
        return {
            "document_id": result.document_id,
            "status": result.status,
            "total_chunks": result.total_chunks,
            "processed_images": result.processed_images,
            "filename": file.filename
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
