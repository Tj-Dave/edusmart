"""
DocumentLoader for EduSmart ingestion pipeline.
"""
from pathlib import Path
from typing import Tuple, List
import structlog
from .exceptions import UnsupportedFileTypeError, FileCorruptedError
import fitz
import docx
import pptx

logger = structlog.get_logger()


class DocumentLoader:
    """Loads PDFs, DOCX, PPTX and extracts text + images."""

    def load(self, file_path: Path) -> Tuple[str, List[Path]]:
        """Extract text and images from document."""
        file_path = file_path.resolve()
        ext = file_path.suffix.lower()
        logger.info("Loading document", file=str(file_path), ext=ext)
        
        try:
            if ext == ".pdf":
                return self._load_pdf(file_path)
            elif ext == ".docx":
                return self._load_docx(file_path)
            elif ext == ".pptx":
                return self._load_pptx(file_path)
            else:
                raise UnsupportedFileTypeError(file_path)
        except UnsupportedFileTypeError:
            logger.error("Unsupported file type", file=str(file_path))
            raise
        except Exception as e:
            logger.error("Document loading failed", file=str(file_path), error=str(e))
            raise FileCorruptedError(file_path) from e

    def _load_pdf(self, file_path: Path) -> Tuple[str, List[Path]]:
        """Extract text and images from PDF."""
        doc = fitz.open(str(file_path))
        text = ""
        images = []
        
        for page_num in range(doc.page_count):
            page = doc.load_page(page_num)
            text += f"\n[Page {page_num+1}]\n{page.get_text()}"
            
            for img_index, img in enumerate(page.get_images(full=True)):
                pix = fitz.Pixmap(doc, img[0])
                img_path = file_path.parent / f"{file_path.stem}_p{page_num+1}_i{img_index}.png"
                pix.save(str(img_path))
                images.append(img_path)
        
        doc.close()
        logger.info("PDF loaded", file=str(file_path), pages=doc.page_count, images=len(images))
        return text, images

    def _load_docx(self, file_path: Path) -> Tuple[str, List[Path]]:
        """Extract text and images from DOCX."""
        doc = docx.Document(str(file_path))
        text = ""
        images = []
        
        for para in doc.paragraphs:
            if para.style and para.style.name.startswith("Heading"):
                text += f"\n[Heading] {para.text}\n"
            else:
                text += para.text + "\n"
        
        for rel in doc.part.rels.values():
            if "image" in rel.target_ref:
                img_path = file_path.parent / f"{file_path.stem}_img.png"
                with open(img_path, "wb") as f:
                    f.write(rel.target_part.blob)
                images.append(img_path)
        
        logger.info("DOCX loaded", file=str(file_path), images=len(images))
        return text, images

    def _load_pptx(self, file_path: Path) -> Tuple[str, List[Path]]:
        """Extract text and images from PPTX."""
        pres = pptx.Presentation(str(file_path))
        text = ""
        images = []
        
        for idx, slide in enumerate(pres.slides):
            title = slide.shapes.title.text if slide.shapes.title else f"Slide {idx+1}"
            text += f"\n[Slide {idx+1}] {title}\n"
            
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text:
                    text += shape.text + "\n"
        
        logger.info("PPTX loaded", file=str(file_path), slides=len(pres.slides))
        return text, images
