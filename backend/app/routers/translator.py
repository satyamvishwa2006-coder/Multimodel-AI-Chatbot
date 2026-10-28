from fastapi import APIRouter, HTTPException
from app.schemas.translator import TranslateRequest, TranslateResponse
from app.services.translator_service import TranslatorService

router = APIRouter(prefix="/api/translate", tags=["Translator"])


@router.post("", response_model=TranslateResponse)
def translate_text(payload: TranslateRequest):
    """
    Translate text between languages with specialized Hindi (हिन्दी) & English support.
    """
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    result = TranslatorService.translate(
        text=payload.text,
        source_lang=payload.source_lang or "auto",
        target_lang=payload.target_lang or "hi",
        tone=payload.tone or "natural",
    )
    return TranslateResponse(**result)

