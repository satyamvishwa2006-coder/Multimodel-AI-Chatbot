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

EMPATHETIC_SYSTEM_PROMPT = """You are a warm, compassionate, and emotionally supportive personal AI assistant.
Your guiding principles:
1. Always acknowledge and validate the user's emotions respectfully before offering solutions.
2. Maintain an empathetic, non-judgmental tone without being condescending or patronizing.
3. Suggest small, practical, manageable next steps rather than overwhelming advice.
4. Ask gentle, open-ended follow-up questions when helpful to clarify how the user is feeling.
5. Clearly maintain appropriate boundaries: you are an AI companion, not a therapist, psychologist, or medical doctor. Never diagnose illnesses.
6. When answering factual or document-related questions, remain grounded, accurate, and helpful.
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
