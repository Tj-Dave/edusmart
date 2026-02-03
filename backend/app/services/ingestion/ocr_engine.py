"""
OCREngine for extracting text from images in documents.
Future integration with Tesseract or PaddleOCR.
"""
from pathlib import Path
from pydantic import BaseModel
import structlog

logger = structlog.get_logger()


class OCRResult(BaseModel):
    status: str
    message: str
    extracted_text: str = ""


class OCREngine:
    """Handles OCR processing for document images."""

    def process_image(self, image_path: Path) -> OCRResult:
        """
        Process an image and extract text using OCR.

        Args:
            image_path: Path to the image file.

        Returns:
            OCRResult: Status and extracted text (if available).
        """
        logger.info("ocr_processing", image_path=str(image_path))
        # Placeholder: OCR not yet implemented
        return OCRResult(
            status="pending",
            message="OCR not implemented - scheduled for v2.0"
        )
