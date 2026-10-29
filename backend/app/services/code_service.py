import re
import os
import uuid
from typing import Dict, Any, Optional, List
from app.core.config import settings
from app.services.llm_service import get_llm_provider


class CodeService:
    @staticmethod
    def is_coding_request(message: str) -> bool:
        """Detects whether a prompt specifically targets coding assistance."""
        coding_keywords = [
            r"\bcode\b", r"\bpython\b", r"\bjavascript\b", r"\btypescript\b",
            r"\bhtml\b", r"\bcss\b", r"\bjava\b", r"\bc\+\+\b", r"\brust\b",
            r"\bdebug\b", r"\brefactor\b", r"\berror\b", r"\bfunction\b",
            r"\bclass\b", r"\balgorithm\b", r"\bsyntax\b", r"\bline by line\b",
            r"\bscript\b", r"\bapi\b", r"\bsql\b"
        ]
        text = message.lower()
        return any(re.search(kw, text) for kw in coding_keywords) or "```" in message

    @classmethod
    def assist_code(
        cls,
        prompt: str,
        code_snippet: Optional[str] = None,
        action: str = "assist",  # assist, explain, debug, refactor, structure
        language: str = "python",
    ) -> Dict[str, Any]:
        """
        Executes an AI coding task:
        - explain: line-by-line explanation of code
        - debug: diagnose errors, syntax bugs, logical issues, and provide verified fix
        - refactor: improve readability, modularity, and time/space complexity
        - structure: generate a complete production project layout
        - assist: general code generation with formatting
        """
        instruction_map = {
            "explain": (
                "You are an expert software engineer. Provide a crystal-clear, line-by-line or section-by-section "
                "explanation of the provided code. Highlight key patterns, inputs, outputs, and edge cases."
            ),
            "debug": (
                "You are a master software debugger. Analyze the code and any provided error messages.\n"
                "1. Identify the root cause of the error or bug.\n"
                "2. Clearly distinguish syntax errors from logical errors.\n"
                "3. Provide the exact, corrected code block.\n"
                "4. Explain why the fix solves the issue and how to prevent it."
            ),
            "refactor": (
                "You are a principal software architect. Refactor the code for maximum clean code principles, "
                "readability, type safety, modularity, and optimal performance. Provide the refactored code and summary of improvements."
            ),
            "structure": (
                "You are a tech lead. Generate a complete, clean directory and file architecture for this project. "
                "Include all necessary files (entry points, tests, config, readme, env) and explain each component."
            ),
            "assist": (
                "You are an elite coding assistant. Write production-quality, secure, fully commented, and robust code. "
                "Always use markdown code blocks with language tags (e.g. ```python, ```javascript)."
            ),
        }

        system_prompt = instruction_map.get(action, instruction_map["assist"])
        full_user_content = prompt
        if code_snippet:
            full_user_content += f"\n\n```{language}\n{code_snippet}\n```"

        llm = get_llm_provider()
        response_text = llm.generate_response(
            messages=[{"role": "user", "content": full_user_content}],
            system_prompt=system_prompt,
        )

        # Extract code blocks if present for direct download
        extracted_codes = cls.extract_code_blocks(response_text)

        return {
            "action": action,
            "language": language,
            "response": response_text,
            "code_blocks": extracted_codes,
        }

    @staticmethod
    def extract_code_blocks(markdown_text: str) -> List[Dict[str, str]]:
        """Extracts code blocks with language and content from markdown text."""
        pattern = r"```([a-zA-Z0-9_\-\+]*)\n([\s\S]*?)```"
        matches = re.findall(pattern, markdown_text)
        results = []
        for idx, (lang, code) in enumerate(matches):
            results.append({
                "index": idx,
                "language": lang or "txt",
                "code": code.strip(),
            })
        return results

    @staticmethod
    def save_code_file(code: str, filename: str) -> str:
        """Saves a generated code file to the uploads directory for user download."""
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        safe_name = os.path.basename(filename)
        out_name = f"code_{uuid.uuid4()}_{safe_name}"
        out_path = os.path.join(settings.UPLOAD_DIR, out_name)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(code)
        return f"/uploads/{out_name}"

