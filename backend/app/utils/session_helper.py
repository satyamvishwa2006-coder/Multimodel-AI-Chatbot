import uuid
from typing import Optional
from fastapi import Header, HTTPException


def get_session_id(x_session_id: Optional[str] = Header(None, alias="x-session-id")) -> str:
    """
    Extracts and validates anonymous session ID from the x-session-id HTTP header.
    """
    if not x_session_id or not x_session_id.strip():
        return str(uuid.uuid4())
    clean_id = x_session_id.strip()
    if len(clean_id) > 64:
        raise HTTPException(status_code=400, detail="Invalid session ID: maximum 64 characters allowed.")
    return clean_id
