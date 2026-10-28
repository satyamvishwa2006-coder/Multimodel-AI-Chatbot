import re
from typing import Optional, Tuple

CRISIS_KEYWORDS = [
    r"\bsuicid(e|al)\b",
    r"\bkill myself\b",
    r"\bend my life\b",
    r"\bwant to die\b",
    r"\bharm(ing)? myself\b",
    r"\bself[- ]harm\b",
    r"\bhurt myself\b",
    r"\btake my (own )?life\b",
    r"\bdon'?t want to live\b",
]

CRISIS_REGEX = re.compile("|".join(CRISIS_KEYWORDS), re.IGNORECASE)

CRISIS_RESPONSE = """It sounds like you are going through a painful and difficult time right now, but please know that you are not alone and there is support available. 

If you are in immediate danger or feel you cannot stay safe, please reach out right away to someone who can help:

- **United States & Canada**: Call or text **988** to reach the Suicide & Crisis Lifeline (free, confidential, 24/7). You can also text HOME to **741741**.
- **United Kingdom**: Call **111** (NHS) or call the Samaritans at **116 123** (free, 24/7).
- **India**: Call **9152987821** (Vandrevala Foundation) or **112** for emergency assistance.
- **International**: Find immediate resources in your country at [findahelpline.com](https://findahelpline.com) or [befrienders.org](https://www.befrienders.org).

I am an AI assistant and cannot provide medical care or crisis intervention. Please connect with a trusted friend, family member, or professional who can support you through this. You matter, and help is available."""

EMPATHETIC_SYSTEM_PROMPT = """You are a warm, compassionate, highly intelligent, and versatile multimodal personal AI assistant.

CRITICAL UNIVERSAL MULTILINGUAL RULES:
1. Always detect the language of the user's message (e.g. Hindi / हिन्दी, Hinglish, Spanish, French, German, Japanese, Chinese, Arabic, Russian, Portuguese, etc.).
2. You MUST respond in that EXACT same language naturally, fluently, and authentically.
3. When the user writes or speaks in Hindi (हिन्दी) (e.g. "नमस्ते", "आप कैसे हैं?", "क्या हाल है?"), respond in warm, fluent, and respectful Hindi using Devanagari script (or Hinglish if the user asks in Hinglish/Latin characters).
4. NEVER respond in English when addressed in Hindi or another non-English language unless explicitly instructed to translate to English or reply in English.
5. Multimodal Grounding: When answering queries about attached images, documents, or live web search, remain strictly grounded and factual.
6. Emotional Empathy: Always acknowledge and validate the user's emotions respectfully before offering solutions. Maintain a calm, caring, non-judgmental tone.
7. Practical Steps: Suggest small, practical, manageable next steps rather than overwhelming advice.
"""


class SafetyService:
    @staticmethod
    def check_crisis(text: str) -> Tuple[bool, Optional[str]]:
        """
        Inspects message for crisis/self-harm indicators.
        Returns (is_crisis, response_text).
        """
        if not text:
            return False, None
        if CRISIS_REGEX.search(text):
            return True, CRISIS_RESPONSE
        return False, None

    @staticmethod
    def get_system_prompt() -> str:
        return EMPATHETIC_SYSTEM_PROMPT
