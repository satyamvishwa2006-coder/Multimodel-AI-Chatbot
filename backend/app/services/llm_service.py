import abc
import base64
import os
from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.services.safety_service import SafetyService


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
        lower_msg = last_msg.lower()

        # 1. RAG grounded query response
        if context_chunks and len(context_chunks) > 0:
            doc_names = list({c.get("document_name", "Document") for c in context_chunks})
            snippets = " ".join([c.get("snippet", "")[:120] for c in context_chunks[:2]])
            return (
                f"Based on your uploaded document (**{', '.join(doc_names)}**):\n\n"
                f"{snippets}...\n\n"
                f"This information directly addresses your query regarding *{last_msg}*. "
                f"If you need further details or a deeper breakdown from the document, feel free to ask!"
            )

        # 2. Web search grounded query response
        if web_search_results and len(web_search_results) > 0:
            first_source = web_search_results[0]
            return (
                f"According to recent web information from **{first_source.get('title', 'Web Sources')}**:\n\n"
                f"{first_source.get('snippet', '')}\n\n"
                f"*(Source: [{first_source.get('title')}]({first_source.get('url')}))*\n\n"
                f"Is there a specific detail from this search you would like me to explore further?"
            )

        # 3. Vision / Image response
        if images and len(images) > 0:
            return (
                f"I have inspected the uploaded image ({len(images)} attachment(s)). "
                f"The image appears clear and contains visual details relevant to: *{last_msg}*. "
                f"In production mode with an OpenAI or Gemini API key configured, full visual scene understanding and object detection are powered by the vision model."
            )

        # 4. Emotional support greetings and queries
        if any(w in lower_msg for w in ["sad", "depressed", "anxious", "stress", "stressed", "overwhelmed", "tired", "worried"]):
            return (
                "I hear how challenging things feel right now, and I want to validate that it is completely okay and understandable to feel this way. "
                "Experiencing these feelings can be exhausting. Would you like to share a little more about what has been weighing on you, or would it be helpful to brainstorm one small, gentle step you can take today?"
            )

        if any(w in lower_msg for w in ["hello", "hi", "hey", "greetings"]):
            return (
                "Hello! I am your personal multimodal AI assistant. I can chat with you, search the live web, answer questions from your documents (RAG), examine images, transcribe audio, and help edit or create documents in the workspace. How can I help you today?"
            )

        # 5. Default informative response
        return (
            f"Thank you for sharing that. Regarding your message: \"{last_msg}\", I am here to help you explore, research, or work on this. "
            f"You can also attach files, toggle web search, or switch to the Document Workspace to create and edit documents!"
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


def get_llm_provider() -> BaseLLMProvider:
    provider = settings.LLM_PROVIDER.lower().strip()
    if provider == "openai" and settings.OPENAI_API_KEY:
        return OpenAILLMProvider(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_MODEL,
            vision_model=settings.OPENAI_VISION_MODEL,
        )
    return MockLLMProvider()
