from fastapi import APIRouter, HTTPException, Depends
from app.schemas.image import ImageGenerateRequest, ImageGenerateResponse
from app.services.image_service import ImageService
from app.utils.session_helper import get_session_id

router = APIRouter(prefix="/api/images", tags=["Images"])


@router.post("/generate", response_model=ImageGenerateResponse)
async def generate_image(
    payload: ImageGenerateRequest,
    session_id: str = Depends(get_session_id),
):
    """
    Generate an AI image from a text prompt.
    Returns the image URL and metadata.
    """
    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    result = await ImageService.generate_image(
        prompt=payload.prompt,
        width=payload.width or 768,
        height=payload.height or 768,
    )

    return ImageGenerateResponse(
        image_url=result["image_url"],
        prompt=result["prompt"],
        provider=result["provider"],
        filename=result["filename"],
        file_size=result["file_size"],
    )

