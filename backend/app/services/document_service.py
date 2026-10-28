import os
import io
from typing import Dict, Any, Optional, Tuple
from pypdf import PdfReader
from docx import Document as DocxDocument
from app.services.llm_service import get_llm_provider


class DocumentService:
    @staticmethod
    def extract_text(file_path: str, file_type: str) -> str:
        """
        Extracts plain text from PDF, DOCX, TXT, or Markdown files.
        """
        ext = file_type.lower().lstrip(".")
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        if ext == "pdf":
            reader = PdfReader(file_path)
            extracted = []
            for idx, page in enumerate(reader.pages):
                text = page.extract_text()
                if text:
                    extracted.append(text)
            return "\n\n".join(extracted).strip()

        elif ext == "docx":
            doc = DocxDocument(file_path)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n\n".join(paragraphs).strip()

        elif ext in ["txt", "md"]:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read().strip()

        else:
            raise ValueError(f"Unsupported document format: {ext}")

    @staticmethod
    def edit_content(
        content: str,
        action: str,
        instruction: Optional[str] = None,
        target_language: Optional[str] = "Spanish",
    ) -> str:
        """
        Performs AI document transformation: summarize, simplify, fix_grammar, translate, custom.
        """
        llm = get_llm_provider()

        prompts = {
            "summarize": "Please provide a concise, well-structured summary of the following document while retaining all essential facts and takeaways.",
            "simplify": "Please rewrite the following document into clear, plain, and easy-to-understand language while preserving its core message.",
            "fix_grammar": "Please review and correct all spelling, grammar, punctuation, and flow errors in the following document without changing its underlying facts.",
            "translate": f"Please translate the following text accurately and naturally into {target_language}.",
            "custom": instruction or "Please revise and improve the following text according to best practices.",
        }

        task_prompt = prompts.get(action, prompts["custom"])
        system_instruction = (
            "You are an expert document editor. Modify the user's document according to the requested action. "
            "Return ONLY the revised document text without introductory chatter."
        )

        messages = [
            {"role": "user", "content": f"{task_prompt}\n\n### ORIGINAL DOCUMENT:\n{content}"}
        ]

        revised = llm.generate_response(messages=messages, system_prompt=system_instruction)
        return revised.strip()

    @staticmethod
    def create_content(title: str, prompt: str, file_type: str = "docx") -> str:
        """
        Generates a new structured document from a prompt.
        """
        llm = get_llm_provider()
        system_instruction = (
            "You are a professional document writer. Create a well-organized, comprehensive document "
            "with appropriate section headings and structured paragraphs based on the user's prompt."
        )
        messages = [
            {"role": "user", "content": f"Title: {title}\nPrompt: {prompt}"}
        ]
        return llm.generate_response(messages=messages, system_prompt=system_instruction).strip()

    @staticmethod
    def export_document_bytes(content: str, title: str, format_type: str) -> Tuple[bytes, str, str]:
        """
        Exports content into bytes, returning (bytes_data, media_type, filename).
        Supported formats: 'docx', 'md', 'txt'.
        """
        fmt = format_type.lower().lstrip(".")
        clean_title = "".join(c for c in title if c.isalnum() or c in (" ", "_", "-")).strip() or "document"

        if fmt == "docx":
            doc = DocxDocument()
            doc.add_heading(title, level=1)
            for line in content.split("\n\n"):
                clean_line = line.strip()
                if not clean_line:
                    continue
                if clean_line.startswith("# "):
                    doc.add_heading(clean_line[2:], level=1)
                elif clean_line.startswith("## "):
                    doc.add_heading(clean_line[3:], level=2)
                elif clean_line.startswith("### "):
                    doc.add_heading(clean_line[4:], level=3)
                else:
                    doc.add_paragraph(clean_line)
            
            buffer = io.BytesIO()
            doc.save(buffer)
            buffer.seek(0)
            return (
                buffer.getvalue(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                f"{clean_title}.docx",
            )

        elif fmt == "md":
            data = f"# {title}\n\n{content}".encode("utf-8")
            return (
                data,
                "text/markdown; charset=utf-8",
                f"{clean_title}.md",
            )

        else:  # 'txt'
            data = f"{title}\n{'=' * len(title)}\n\n{content}".encode("utf-8")
            return (
                data,
                "text/plain; charset=utf-8",
                f"{clean_title}.txt",
            )
