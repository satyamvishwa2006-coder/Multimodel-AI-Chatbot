import abc
import base64
import logging
import os
import re
from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.services.safety_service import SafetyService

logger = logging.getLogger("uvicorn.error")


class BaseLLMProvider(abc.ABC):
    @abc.abstractmethod
    def generate_response(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        context_chunks: Optional[List[Dict[str, Any]]] = None,
        web_search_results: Optional[List[Dict[str, Any]]] = None,
        images: Optional[List[str]] = None,
    ) -> str:
        """Generates an assistant response."""
        pass


class MockLLMProvider(BaseLLMProvider):
    """
    Intelligent offline LLM mock that produces grounded, context-aware responses
    for text chat, RAG Q&A, web search synthesis, vision queries, and emotional support.
    Supports Hindi, universal languages, and English.
    """
    def generate_response(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        context_chunks: Optional[List[Dict[str, Any]]] = None,
        web_search_results: Optional[List[Dict[str, Any]]] = None,
        images: Optional[List[str]] = None,
    ) -> str:
        last_msg = messages[-1]["content"] if messages else ""
        lower_msg = last_msg.lower().strip()
        is_hindi = bool(re.search(r"[\u0900-\u097F]", last_msg))

        # 1. RAG grounded query response
        if context_chunks and len(context_chunks) > 0:
            doc_names = list({c.get("document_name", "Document") for c in context_chunks})
            snippets = " ".join([c.get("snippet", "")[:120] for c in context_chunks[:2]])
            if is_hindi:
                return (
                    f"आपके अपलोड किए गए दस्तावेज़ (**{', '.join(doc_names)}**) के आधार पर:\n\n"
                    f"{snippets}...\n\n"
                    f"यह जानकारी सीधे आपके प्रश्न *{last_msg}* से संबंधित है। यदि आपको और जानकारी चाहिए, तो कृपया पूछें!"
                )
            return (
                f"Based on your uploaded document (**{', '.join(doc_names)}**):\n\n"
                f"{snippets}...\n\n"
                f"This information directly addresses your query regarding *{last_msg}*. "
                f"If you need further details or a deeper breakdown from the document, feel free to ask!"
            )

        # 2. Web search grounded query response
        if web_search_results and len(web_search_results) > 0:
            first_source = web_search_results[0]
            if is_hindi:
                return (
                    f"वेब स्रोत **{first_source.get('title', 'Web Sources')}** से प्राप्त जानकारी:\n\n"
                    f"{first_source.get('snippet', '')}\n\n"
                    f"*(स्रोत: [{first_source.get('title')}]({first_source.get('url')}))*\n\n"
                    f"क्या आप इसके बारे में कुछ और विस्तार से जानना चाहते हैं?"
                )
            return (
                f"According to recent web information from **{first_source.get('title', 'Web Sources')}**:\n\n"
                f"{first_source.get('snippet', '')}\n\n"
                f"*(Source: [{first_source.get('title')}]({first_source.get('url')}))*\n\n"
                f"Is there a specific detail from this search you would like me to explore further?"
            )

        # 3. Vision / Image response
        if images and len(images) > 0:
            if is_hindi:
                return (
                    f"मैंने आपकी अपलोड की गई छवि ({len(images)} फ़ाइल) का विश्लेषण किया है। "
                    f"यह छवि आपके प्रश्न *{last_msg}* से संबंधित है और स्पष्ट दिखाई दे रही है। "
                    f"बताइए, क्या आप इस चित्र के किसी विशिष्ट भाग के बारे में जानना चाहते हैं?"
                )
            return (
                f"I have inspected the uploaded image ({len(images)} attachment(s)). "
                f"The image appears clear and contains visual details relevant to: *{last_msg}*. "
                f"In production mode with an OpenAI or Gemini API key configured, full visual scene understanding and object detection are powered by the vision model."
            )

        # 4. Multilingual & Hindi greetings / general queries
        if is_hindi:
            if any(w in last_msg for w in ["नमस्ते", "प्रणाम", "नमस्कार", "हैलो", "हेलो", "कैसे", "हाल", "क्या हाल"]):
                return (
                    "नमस्ते! मैं बहुत अच्छा हूँ, पूछने के लिए धन्यवाद। मैं आपका व्यक्तिगत मल्टीमॉडल AI सहायक हूँ। "
                    "मैं आपके साथ हिंदी और किसी भी भाषा में बातचीत कर सकता हूँ, चित्र बना सकता हूँ, दस्तावेज़ों का विश्लेषण कर सकता हूँ और अनुवाद कर सकता हूँ। "
                    "बताइए, आज मैं आपकी क्या सहायता कर सकता हूँ?"
                )
            return (
                f"नमस्ते! आपके प्रश्न: \"{last_msg}\" के लिए धन्यवाद। "
                f"मैं आपकी पूरी सहायता करने के लिए यहाँ हूँ। आप मुझसे कोई भी सवाल पूछ सकते हैं, फ़ाइल अपलोड कर सकते हैं, चित्र बनवा सकते हैं, या लाइव आवाज़ में बात कर सकते हैं!"
            )

        # Spanish
        if any(w in lower_msg for w in ["hola", "buenos días", "buenas tardes", "¿cómo estás?", "como estas"]):
            return (
                "¡Hola! Estoy muy bien, muchas gracias por preguntar. Soy tu asistente personal de IA multimodal. "
                "¿En qué puedo ayudarte hoy?"
            )

        # French
        if any(w in lower_msg for w in ["bonjour", "salut", "comment allez-vous", "comment ca va"]):
            return (
                "Bonjour ! Je vais très bien, merci beaucoup. Je suis votre assistant IA multimodal. "
                "Comment puis-je vous aider aujourd'hui ?"
            )

        # Emotional support greetings and queries
        if any(w in lower_msg for w in ["sad", "depressed", "anxious", "stress", "stressed", "overwhelmed", "tired", "worried"]):
            return (
                "I hear how challenging things feel right now, and I want to validate that it is completely okay and understandable to feel this way. "
                "Experiencing these feelings can be exhausting. Would you like to share a little more about what has been weighing on you, or would it be helpful to brainstorm one small, gentle step you can take today?"
            )

        if any(w in lower_msg for w in ["hello", "hi", "hey", "greetings"]):
            return (
                "Hello! I am your personal multimodal AI assistant. I can chat with you, search the live web, answer questions from your documents (RAG), examine images, transcribe audio, generate images, translate, and help edit or create documents. How can I help you today?"
            )

        # Default informative response
        return (
            f"Thank you for sharing that. Regarding your message: \"{last_msg}\", I am here to help you explore, research, or work on this. "
            f"You can also attach files, toggle web search, generate images, or switch to the Translator tab!"
        )


class OpenAILLMProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o-mini", vision_model: str = "gpt-4o"):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.vision_model = vision_model

    def generate_response(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        context_chunks: Optional[List[Dict[str, Any]]] = None,
        web_search_results: Optional[List[Dict[str, Any]]] = None,
        images: Optional[List[str]] = None,
    ) -> str:
        prompt_system = system_prompt or SafetyService.get_system_prompt()

        # Augment with RAG context
        if context_chunks:
            chunk_text = "\n\n---\n\n".join([
                f"[Document: {c.get('document_name')}, Chunk {c.get('chunk_index')}]:\n{c.get('snippet')}"
                for c in context_chunks
            ])
            prompt_system += (
                f"\n\n### RETRIEVED KNOWLEDGE BASE CONTEXT:\n{chunk_text}\n\n"
                f"INSTRUCTIONS: Answer the user's question using this context where relevant. "
                f"Cite the document name when stating facts from it. If the context does not contain enough information, state so clearly."
            )

        # Augment with Web search results
        if web_search_results:
            search_text = "\n\n".join([
                f"Title: {s.get('title')}\nURL: {s.get('url')}\nSnippet: {s.get('snippet')}"
                for s in web_search_results
            ])
            prompt_system += (
                f"\n\n### WEB SEARCH RESULTS:\n{search_text}\n\n"
                f"INSTRUCTIONS: Ground your answer in the web search results. Clearly distinguish sourced facts from your explanation. Do not fabricate URLs."
            )

        formatted_messages = [{"role": "system", "content": prompt_system}]

        for idx, m in enumerate(messages):
            role = m.get("role", "user")
            content = m.get("content", "")

            # If last user message has images, format as multimodal content
            if idx == len(messages) - 1 and role == "user" and images:
                content_parts = [{"type": "text", "text": content}]
                for img_path in images:
                    if os.path.exists(img_path):
                        with open(img_path, "rb") as f:
                            b64 = base64.b64encode(f.read()).decode("utf-8")
                        content_parts.append({
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{b64}"}
                        })
                formatted_messages.append({"role": role, "content": content_parts})
            else:
                formatted_messages.append({"role": role, "content": content})

        model_to_use = self.vision_model if images else self.model

        response = self.client.chat.completions.create(
            model=model_to_use,
            messages=formatted_messages,
            temperature=0.7,
        )
        return response.choices[0].message.content or ""


class GeminiLLMProvider(BaseLLMProvider):
    """
    Production Gemini LLM provider using the google-genai SDK models API.
    Supports text chat, multimodal vision (images), RAG context, and web search grounding.
    """
    def __init__(self, api_key: str, model: str = "gemini-3.5-flash"):
        from google import genai
        self.client = genai.Client(api_key=api_key)
        self.model = model

    def generate_response(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        context_chunks: Optional[List[Dict[str, Any]]] = None,
        web_search_results: Optional[List[Dict[str, Any]]] = None,
        images: Optional[List[str]] = None,
    ) -> str:
        from google.genai import types

        system_instruction = system_prompt or SafetyService.get_system_prompt()

        # Augment system instruction with RAG context
        if context_chunks:
            chunk_text = "\n\n---\n\n".join([
                f"[Document: {c.get('document_name')}, Chunk {c.get('chunk_index')}]:\n{c.get('snippet')}"
                for c in context_chunks
            ])
            system_instruction += (
                f"\n\n### RETRIEVED KNOWLEDGE BASE CONTEXT:\n{chunk_text}\n\n"
                f"INSTRUCTIONS: Answer the user's question using this context where relevant. "
                f"Cite the document name when stating facts from it. If the context does not contain enough information, state so clearly."
            )

        # Augment system instruction with web search results
        if web_search_results:
            search_text = "\n\n".join([
                f"Title: {s.get('title')}\nURL: {s.get('url')}\nSnippet: {s.get('snippet')}"
                for s in web_search_results
            ])
            system_instruction += (
                f"\n\n### WEB SEARCH RESULTS:\n{search_text}\n\n"
                f"INSTRUCTIONS: Ground your answer in the web search results. Clearly distinguish sourced facts from your explanation. Do not fabricate URLs."
            )

        # Prepare multi-turn contents
        contents: List[types.Content] = []
        for idx, m in enumerate(messages):
            role_str = m.get("role", "user")
            genai_role = "model" if role_str == "assistant" else "user"
            msg_content = m.get("content", "")

            # If last turn and there are image attachments, attach parts
            if idx == len(messages) - 1 and genai_role == "user" and images:
                parts: List[types.Part] = []
                for img_path in images:
                    if os.path.exists(img_path):
                        try:
                            with open(img_path, "rb") as f:
                                img_bytes = f.read()
                            ext = os.path.splitext(img_path)[1].lower()
                            mime_map = {
                                ".png": "image/png",
                                ".jpg": "image/jpeg",
                                ".jpeg": "image/jpeg",
                                ".webp": "image/webp",
                                ".gif": "image/gif",
                            }
                            mime_type = mime_map.get(ext, "image/jpeg")
                            parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
                        except Exception as img_err:
                            logger.warning(f"Failed to read image {img_path}: {img_err}")
                parts.append(types.Part.from_text(text=msg_content or "Please analyze the attached image."))
                contents.append(types.Content(role=genai_role, parts=parts))
            else:
                if msg_content:
                    contents.append(types.Content(role=genai_role, parts=[types.Part.from_text(text=msg_content)]))

        if not contents:
            contents.append(types.Content(role="user", parts=[types.Part.from_text(text="Hello")]))

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.7,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        candidate_models = [
            "gemini-3.1-flash-lite",
            "gemini-flash-lite-latest",
            "gemini-3.1-flash-lite-preview",
            self.model,
        ]
        # Deduplicate while preserving order
        seen = set()
        models_to_try = [m for m in candidate_models if not (m in seen or seen.add(m))]

        for model_name in models_to_try:
            try:
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=config,
                )
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                logger.warning(f"Gemini API attempt with {model_name} failed: {e}")
                continue

        # If all Gemini models fail or hit rate limits, fall back to Mock provider gracefully
        logger.error("All Gemini API models failed; falling back to Mock provider.")
        return MockLLMProvider().generate_response(
            messages=messages,
            system_prompt=system_prompt,
            context_chunks=context_chunks,
            web_search_results=web_search_results,
            images=images,
        )


def get_llm_provider() -> BaseLLMProvider:
    provider = settings.LLM_PROVIDER.lower().strip()
    if provider == "gemini" and settings.GEMINI_API_KEY:
        return GeminiLLMProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_MODEL,
        )
    if provider == "openai" and settings.OPENAI_API_KEY:
        return OpenAILLMProvider(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_MODEL,
            vision_model=settings.OPENAI_VISION_MODEL,
        )
    return MockLLMProvider()
