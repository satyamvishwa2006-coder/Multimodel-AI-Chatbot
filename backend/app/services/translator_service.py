import logging
from typing import Dict, Any, Optional
from app.core.config import settings
from app.services.llm_service import get_llm_provider

logger = logging.getLogger("uvicorn.error")

LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi (हिन्दी)",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "zh": "Chinese",
    "ar": "Arabic",
    "ru": "Russian",
    "ja": "Japanese",
    "ko": "Korean",
    "bn": "Bengali",
    "pa": "Punjabi",
    "mr": "Marathi",
    "gu": "Gujarati",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "ur": "Urdu",
}


class TranslatorService:
    @staticmethod
    def translate(
        text: str,
        source_lang: str = "auto",
        target_lang: str = "hi",
        tone: str = "natural",
    ) -> Dict[str, Any]:
        """
        Translates text between languages with specialized high-fidelity support for Hindi (हिन्दी) and English.
        """
        clean_text = text.strip()
        if not clean_text:
            return {
                "original_text": "",
                "translated_text": "",
                "source_lang": source_lang,
                "target_lang": target_lang,
                "pronunciation": None,
            }

        target_name = LANGUAGE_NAMES.get(target_lang, target_lang)
        source_name = LANGUAGE_NAMES.get(source_lang, "the source language") if source_lang != "auto" else "automatically detected language"

        system_instruction = (
            f"You are a professional multilingual translator specialized in high-accuracy translations between Hindi (हिन्दी), English, and world languages.\n"
            f"Translate the following text from {source_name} to {target_name}.\n"
            f"Maintain a {tone} tone. Ensure idioms, nuances, and cultural expressions translate accurately.\n"
            f"Return ONLY the direct translation. Do not include quotes, notes, or explanations."
        )

        llm = get_llm_provider()
        translated = llm.generate_response(
            messages=[{"role": "user", "content": clean_text}],
            system_prompt=system_instruction,
        )

        return {
            "original_text": clean_text,
            "translated_text": translated.strip(),
            "source_lang": source_lang,
            "target_lang": target_lang,
            "pronunciation": None,
        }

