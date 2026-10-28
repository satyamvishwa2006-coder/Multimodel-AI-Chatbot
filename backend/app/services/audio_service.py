import os
import uuid
from typing import Optional
from app.core.config import settings


class AudioService:
    @staticmethod
    def transcribe(file_path: str) -> str:
        """
        Transcribes speech audio file to text.
        Uses OpenAI Whisper API if OPENAI_API_KEY is configured,
        or returns clean fallback text.
        """
        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=settings.OPENAI_API_KEY)
                with open(file_path, "rb") as audio_file:
                    transcription = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                    )
                    return transcription.text
            except Exception as e:
                return f"[Audio transcription error: {str(e)}]"

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
