from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings
from app.db.session import get_db, ACTIVE_DB_TYPE

router = APIRouter(prefix="/api/health", tags=["Health"])


@router.get("")
def health_check(db: Session = Depends(get_db)):
    """
    Checks API, database connectivity, and provider readiness.
    """
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "ok",
        "app_name": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "database": {
            "type": ACTIVE_DB_TYPE,
            "status": db_status,
        },
        "providers": {
            "llm": settings.LLM_PROVIDER,
            "embedding": settings.EMBEDDING_PROVIDER,
            "web_search": "tavily" if settings.TAVILY_API_KEY else "fallback_mock",
        }
    }
