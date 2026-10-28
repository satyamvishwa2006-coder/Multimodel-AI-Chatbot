import os
import re
from typing import Tuple
from fastapi import HTTPException, UploadFile
from app.core.config import settings

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}
ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".webm", ".ogg"}

ALLOWED_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_DOCUMENT_EXTENSIONS | ALLOWED_AUDIO_EXTENSIONS
MAX_FILE_SIZE_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def sanitize_filename(filename: str) -> str:
    """
    Sanitizes filename to prevent directory traversal and strip unwanted characters.
    """
    clean_name = os.path.basename(filename)
    clean_name = re.sub(r"[^\w\s\.-]", "", clean_name).strip()
    return clean_name or "uploaded_file"


def validate_file_upload(file: UploadFile) -> Tuple[str, str]:
    """
    Validates uploaded file against allowed extensions and returns (category, clean_filename).
    """
    filename = sanitize_filename(file.filename or "")
    _, ext = os.path.splitext(filename.lower())

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    if ext in ALLOWED_IMAGE_EXTENSIONS:
        category = "image"
    elif ext in ALLOWED_DOCUMENT_EXTENSIONS:
        category = "document"
    elif ext in ALLOWED_AUDIO_EXTENSIONS:
        category = "audio"
    else:
        category = "other"

    return category, filename
