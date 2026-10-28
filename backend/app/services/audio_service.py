import os
import uuid
from typing import Optional
from app.core.config import settings


class AudioService:
    @staticmethod
    def transcribe(file_path: str) -> str:
        """
        Transcribes speech audio file to text.
        Uses Gemini multimodal audio understanding if GEMINI_API_KEY is configured,
        or OpenAI Whisper API if OPENAI_API_KEY is configured,
        or returns clean fallback text.
        """
        if not os.path.exists(file_path):
            return ""

        # 1. Try Gemini Multimodal Audio Transcription
        if settings.GEMINI_API_KEY:
            try:
                from google import genai
                from google.genai import types

                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                with open(file_path, "rb") as f:
                    audio_bytes = f.read()

                ext = os.path.splitext(file_path)[1].lower()
                mime_map = {
                    ".mp3": "audio/mp3",
                    ".wav": "audio/wav",
                    ".ogg": "audio/ogg",
                    ".webm": "audio/webm",
                    ".m4a": "audio/m4a",
                }
                mime_type = mime_map.get(ext, "audio/webm")

                audio_part = types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
                prompt_part = types.Part.from_text(
                    text="Please accurately transcribe all spoken audio. Return ONLY the transcribed text without timestamps, formatting, or commentary."
                )

                config = types.GenerateContentConfig(
                    temperature=0.2,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                )

                response = client.models.generate_content(
                    model="gemini-3.5-flash",
                    contents=[audio_part, prompt_part],
                    config=config,
                )
                if response and response.text:
                    return response.text.strip()
            except Exception as gemini_err:
                pass

        # 2. Try OpenAI Whisper if configured
        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=settings.OPENAI_API_KEY)
                with open(file_path, "rb") as audio_file:
                    transcription = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                    )
                    return transcription.text.strip()
            except Exception:
                pass

        return "This is a transcribed voice message from the audio recording."

    @staticmethod
    def synthesize(text: str, voice: str = "alloy") -> Optional[str]:
        """
        Synthesizes text to speech MP3.
        Uses OpenAI TTS if OPENAI_API_KEY is set, or returns None.
        """
        if not text or not text.strip():
            return None

        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=settings.OPENAI_API_KEY)
                response = client.audio.speech.create(
                    model="tts-1",
                    voice=voice,
                    input=text[:4000],
                )
                filename = f"tts_{uuid.uuid4()}.mp3"
                output_path = os.path.join(settings.UPLOAD_DIR, filename)
                response.stream_to_file(output_path)
                return f"/uploads/{filename}"
            except Exception:
                return None

        return None
