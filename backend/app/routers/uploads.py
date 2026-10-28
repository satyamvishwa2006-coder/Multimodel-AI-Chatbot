import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.core.config import settings
from app.core.security import validate_file_upload, MAX_FILE_SIZE_BYTES
from app.schemas.conversation import MessageAttachment
from app.utils.session_helper import get_session_id

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])


@router.post("", response_model=MessageAttachment)
async def upload_file(
    file: UploadFile = File(...),
    session_id: str = Depends(get_session_id),
):
    """
    Upload an attachment with MIME validation and size limits.
    """
    category, clean_filename = validate_file_upload(file)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    file_id = str(uuid.uuid4())
    _, ext = os.path.splitext(clean_filename)
    saved_filename = f"{file_id}{ext}"
    saved_path = os.path.join(settings.UPLOAD_DIR, saved_filename)

    content = await file.read()
    file_size = len(content)

    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
        )

    with open(saved_path, "wb") as f:
        f.write(content)

    return MessageAttachment(
        id=file_id,
        filename=clean_filename,
        file_type=ext.lstrip(".").lower(),
        file_path=saved_path,
        file_size=file_size,
        url=f"/uploads/{saved_filename}",
    )
