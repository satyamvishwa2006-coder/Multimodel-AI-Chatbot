import os
import re
import uuid
import urllib.parse
import logging
from typing import Dict, Any, Tuple, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("uvicorn.error")


class ImageService:
    @staticmethod
    def is_image_generation_request(message: str) -> Tuple[bool, str]:
        """
        Detects if a user message is explicitly asking to generate or draw an image.
        Returns (is_request, extracted_prompt).
        """
        msg = message.strip()
        lower = msg.lower()

        patterns = [
            r"^(?:generate|create|make|draw|paint|render)\s+(?:an?\s+)?image\s+(?:of\s+|about\s+|showing\s+)?(.+)",
            r"^(?:generate|create|make|draw|paint|render)\s+(?:a\s+)?picture\s+(?:of\s+|about\s+|showing\s+)?(.+)",
            r"^(?:generate|create|make|draw|paint|render)\s+(?:a\s+)?photo\s+(?:of\s+|about\s+|showing\s+)?(.+)",
            r"^(?:draw|paint|sketch)\s+(?:me\s+)?(?:a\s+|an\s+)?(.+)",
            r"^/image\s+(.+)",
            r"^/draw\s+(.+)",
        ]

        for pat in patterns:
            match = re.match(pat, lower, re.IGNORECASE)
            if match:
                raw_prompt = match.group(1).strip()
                # Clean up ending punctuation
                cleaned = re.sub(r"[.?!]+$", "", raw_prompt).strip()
                if len(cleaned) >= 3:
                    return True, cleaned

        return False, msg

    @staticmethod
    async def generate_image(
        prompt: str,
        width: int = 768,
        height: int = 768,
    ) -> Dict[str, Any]:
        """
        Generates an image from a prompt.
        Attempts OpenAI DALL-E if configured, otherwise uses high-quality
        free neural generation via Pollinations AI. Saves output locally in UPLOAD_DIR.
        """
        clean_prompt = prompt.strip()
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        file_id = str(uuid.uuid4())
        filename = f"gen_{file_id}.jpg"
        file_path = os.path.join(settings.UPLOAD_DIR, filename)

        # 1. Try OpenAI DALL-E 3 if API key is provided
        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=settings.OPENAI_API_KEY)
                dalle_resp = client.images.generate(
                    model="dall-e-3",
                    prompt=clean_prompt,
                    size="1024x1024",
                    quality="standard",
                    n=1,
                )
                image_url = dalle_resp.data[0].url
                async with httpx.AsyncClient(timeout=30.0) as http_client:
                    img_data = await http_client.get(image_url)
                    if img_data.status_code == 200:
                        with open(file_path, "wb") as f:
                            f.write(img_data.content)
                        return {
                            "image_url": f"/uploads/{filename}",
                            "filename": filename,
                            "file_path": file_path,
                            "file_size": len(img_data.content),
                            "prompt": clean_prompt,
                            "provider": "openai-dalle3",
                        }
            except Exception as dalle_err:
                logger.warning(f"DALL-E 3 generation failed or quota exceeded: {dalle_err}")

        # 2. High-performance FLUX/SD image synthesis (open, zero-key, reliable)
        try:
            encoded_prompt = urllib.parse.quote(clean_prompt)
            api_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&nologo=true&enhance=true"
            async with httpx.AsyncClient(timeout=35.0, follow_redirects=True) as http_client:
                resp = await http_client.get(api_url)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    with open(file_path, "wb") as f:
                        f.write(resp.content)
                    return {
                        "image_url": f"/uploads/{filename}",
                        "filename": filename,
                        "file_path": file_path,
                        "file_size": len(resp.content),
                        "prompt": clean_prompt,
                        "provider": "neural-flux",
                    }
        except Exception as poll_err:
            logger.error(f"Image generation error: {poll_err}")

        # 3. Fallback: Generate an artistic SVG placeholder image if network is unreachable
        svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="50%" stop-color="#7c3aed" />
      <stop offset="100%" stop-color="#ec4899" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad)" />
  <circle cx="{width//2}" cy="{height//2 - 40}" r="80" fill="rgba(255,255,255,0.15)" />
  <text x="50%" y="{height//2}" font-family="sans-serif" font-size="24" fill="#ffffff" font-weight="bold" text-anchor="middle">🎨 AI Generated Concept</text>
  <text x="50%" y="{height//2 + 35}" font-family="sans-serif" font-size="14" fill="#f1f5f9" text-anchor="middle">{clean_prompt[:60]}...</text>
</svg>'''
        svg_filename = f"gen_{file_id}.svg"
        svg_path = os.path.join(settings.UPLOAD_DIR, svg_filename)
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(svg_content)

        return {
            "image_url": f"/uploads/{svg_filename}",
            "filename": svg_filename,
            "file_path": svg_path,
            "file_size": len(svg_content.encode("utf-8")),
            "prompt": clean_prompt,
            "provider": "vector-concept",
        }

