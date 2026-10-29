from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import UserPreference
from app.schemas.preference import UserPreferenceUpdate, UserPreferenceResponse
from app.utils.session_helper import get_session_id

router = APIRouter(prefix="/api/preferences", tags=["Preferences"])


@router.get("", response_model=UserPreferenceResponse)
def get_user_preferences(
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Retrieves user personalization and memory settings for the current session."""
    pref = db.query(UserPreference).filter(UserPreference.session_id == session_id).first()
    if not pref:
        pref = UserPreference(
            session_id=session_id,
            custom_instructions="",
            preferred_tone="empathetic",
            preferred_language="auto",
            memory_notes="",
        )
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref


@router.put("", response_model=UserPreferenceResponse)
def update_user_preferences(
    payload: UserPreferenceUpdate,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Updates user custom instructions, tone, and memory notes."""
    pref = db.query(UserPreference).filter(UserPreference.session_id == session_id).first()
    if not pref:
        pref = UserPreference(session_id=session_id)
        db.add(pref)

    if payload.custom_instructions is not None:
        pref.custom_instructions = payload.custom_instructions.strip()
    if payload.preferred_tone is not None:
        pref.preferred_tone = payload.preferred_tone.strip()
    if payload.preferred_language is not None:
        pref.preferred_language = payload.preferred_language.strip()
    if payload.memory_notes is not None:
        pref.memory_notes = payload.memory_notes.strip()

    db.commit()
    db.refresh(pref)
    return pref


@router.delete("", status_code=204)
def clear_user_preferences(
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Clears all personalization and memory notes for the current session."""
    pref = db.query(UserPreference).filter(UserPreference.session_id == session_id).first()
    if pref:
        pref.custom_instructions = ""
        pref.memory_notes = ""
        pref.preferred_tone = "empathetic"
        pref.preferred_language = "auto"
        db.commit()
    return None

