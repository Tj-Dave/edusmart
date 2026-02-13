"""
DocumentLoader for EduSmart ingestion pipeline.
Loads PDFs, DOCX, PPTX and extracts text + images.
"""
from __future__ import annotations

from pathlib import Path
from typing import Tuple, List
import structlog

import fitz  # PyMuPDF
import docx
from docx.opc.constants import RELATIONSHIP_TYPE as RT
import pptx

from app.services.ingestion.exceptions import UnsupportedFileTypeError, FileCorruptedError

logger = structlog.get_logger()


class DocumentLoader:
    """Loads PDFs, DOCX, PPTX and extracts text + images."""

    def load(self, file_path: Path) -> Tuple[str, List[Path]]:
        file_path = file_path.resolve()
        ext = file_path.suffix.lower()
        logger.info("loading_document", file=str(file_path), ext=ext)

        try:
            if ext == ".pdf":
                return self._load_pdf(file_path)
            if ext == ".docx":
                return self._load_docx(file_path)
            if ext == ".pptx":
                return self._load_pptx(file_path)

            raise UnsupportedFileTypeError(file_path)

        except UnsupportedFileTypeError:
            logger.error("unsupported_file_type", file=str(file_path))
            raise
        except Exception as e:
            logger.error("document_loading_failed", file=str(file_path), error=str(e))
            raise FileCorruptedError(file_path) from e

    # -----------------------------
    # Internal helpers
    # -----------------------------
    def _extract_dir(self, file_path: Path) -> Path:
        """
        Keeps extracted artifacts separate and avoids collisions.
        data sits next to the file by default (you can change base later).
        """
        out_dir = file_path.parent / "extracted" / file_path.stem
        out_dir.mkdir(parents=True, exist_ok=True)
        return out_dir

    # -----------------------------
    # PDF
    # -----------------------------
    def _load_pdf(self, file_path: Path) -> Tuple[str, List[Path]]:
        out_dir = self._extract_dir(file_path)
        text_parts: list[str] = []
        images: list[Path] = []

        doc = fitz.open(str(file_path))
        page_count = doc.page_count

        for page_num in range(page_count):
            page = doc.load_page(page_num)

            page_text = page.get_text("text") or ""
            text_parts.append(f"\n[Page {page_num + 1}]\n{page_text}")

            # Extract images (can be many; you may later filter tiny ones)
            img_list = page.get_images(full=True)
            for img_index, img in enumerate(img_list):
                xref = img[0]
                try:
                    pix = fitz.Pixmap(doc, xref)

                    # Handle alpha / CMYK etc.
                    if pix.alpha:
                        pix_no_alpha = fitz.Pixmap(pix, 0)  # drop alpha
                        pix = pix_no_alpha

                    if pix.n > 4:  # CMYK or other
                        pix_rgb = fitz.Pixmap(fitz.csRGB, pix)
                        pix = pix_rgb

                    img_path = out_dir / f"{file_path.stem}_p{page_num + 1}_i{img_index}_xref{xref}.png"
                    pix.save(str(img_path))
                    images.append(img_path)

                except Exception as e:
                    logger.debug(
                        "pdf_image_extract_failed",
                        file=str(file_path),
                        page=page_num + 1,
                        img_index=img_index,
                        xref=xref,
                        error=str(e),
                    )

        doc.close()

        text = "".join(text_parts)
        logger.info("pdf_loaded", file=str(file_path), pages=page_count, images=len(images))
        return text, images

    # -----------------------------
    # DOCX
    # -----------------------------
    def _load_docx(self, file_path: Path) -> Tuple[str, List[Path]]:
        out_dir = self._extract_dir(file_path)
        doc = docx.Document(str(file_path))

        # Text
        text_parts: list[str] = []
        for para in doc.paragraphs:
            if para.style and para.style.name and para.style.name.startswith("Heading"):
                t = para.text.strip()
                if t:
                    text_parts.append(f"\n[Heading] {t}\n")
            else:
                t = para.text.strip()
                if t:
                    text_parts.append(t + "\n")

        # Images (via relationships)
        images: list[Path] = []
        img_counter = 0

        # The most reliable way is to walk rels and look for image rel type
        for rel in doc.part.rels.values():
            try:
                if rel.reltype == RT.IMAGE:
                    img_counter += 1
                    blob = rel.target_part.blob
                    # Try to preserve extension if possible
                    ext = getattr(rel.target_part, "content_type", "")  # like "image/png"
                    suffix = ".bin"
                    if "png" in ext:
                        suffix = ".png"
                    elif "jpeg" in ext or "jpg" in ext:
                        suffix = ".jpg"
                    elif "gif" in ext:
                        suffix = ".gif"
                    elif "bmp" in ext:
                        suffix = ".bmp"

                    img_path = out_dir / f"{file_path.stem}_img{img_counter}{suffix}"
                    with open(img_path, "wb") as f:
                        f.write(blob)
                    images.append(img_path)
            except Exception as e:
                logger.debug("docx_image_extract_failed", file=str(file_path), error=str(e))

        text = "".join(text_parts)
        logger.info("docx_loaded", file=str(file_path), images=len(images))
        return text, images

    # -----------------------------
    # PPTX
    # -----------------------------
    def _load_pptx(self, file_path: Path) -> Tuple[str, List[Path]]:
        out_dir = self._extract_dir(file_path)
        pres = pptx.Presentation(str(file_path))

        text_parts: list[str] = []
        images: list[Path] = []
        img_counter = 0

        for idx, slide in enumerate(pres.slides):
            slide_no = idx + 1
            title = ""
            if getattr(slide.shapes, "title", None) is not None and slide.shapes.title is not None:
                title = slide.shapes.title.text or ""
            if not title.strip():
                title = f"Slide {slide_no}"

            text_parts.append(f"\n[Slide {slide_no}] {title}\n")

            for shape in slide.shapes:
                # Text
                if hasattr(shape, "text") and shape.text:
                    t = shape.text.strip()
                    if t:
                        text_parts.append(t + "\n")

                # Images
                # python-pptx marks pictures with shape.shape_type == MSO_SHAPE_TYPE.PICTURE,
                # but to avoid importing enums, just check for image attribute.
                if hasattr(shape, "image"):
                    try:
                        img_counter += 1
                        image = shape.image
                        blob = image.blob
                        suffix = Path(image.filename).suffix if getattr(image, "filename", None) else ".img"
                        if not suffix:
                            suffix = ".img"
                        img_path = out_dir / f"{file_path.stem}_s{slide_no}_img{img_counter}{suffix}"
                        with open(img_path, "wb") as f:
                            f.write(blob)
                        images.append(img_path)
                    except Exception as e:
                        logger.debug(
                            "pptx_image_extract_failed",
                            file=str(file_path),
                            slide=slide_no,
                            error=str(e),
                        )

        text = "".join(text_parts)
        logger.info("pptx_loaded", file=str(file_path), slides=len(pres.slides), images=len(images))
        return text, images
