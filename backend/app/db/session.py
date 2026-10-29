import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.db.models import Base

logger = logging.getLogger("uvicorn.error")

engine = None
SessionLocal = None
ACTIVE_DB_TYPE = "unknown"


def create_db_engine():
    global engine, SessionLocal, ACTIVE_DB_TYPE
    pg_url = settings.DATABASE_URL
    try:
        test_engine = create_engine(pg_url, pool_pre_ping=True, connect_args={"connect_timeout": 3})
        with test_engine.connect() as conn:
            try:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                conn.commit()
                logger.info("Connected to PostgreSQL with pgvector enabled.")
            except Exception as ext_err:
                conn.rollback()
                logger.warning(f"Connected to PostgreSQL, pgvector extension note: {ext_err}")
        engine = test_engine
        ACTIVE_DB_TYPE = "postgresql"
    except Exception as e:
        logger.warning(
            f"Could not connect to PostgreSQL at {pg_url}: {e}. "
            f"Using local development database at {settings.FALLBACK_SQLITE_URL}."
        )
        engine = create_engine(
            settings.FALLBACK_SQLITE_URL,
            connect_args={"check_same_thread": False}
        )
        ACTIVE_DB_TYPE = "sqlite"

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return engine


create_db_engine()


def init_db():
    """Initializes tables on startup and handles incremental SQLite column migrations."""
    Base.metadata.create_all(bind=engine)
    try:
        with engine.connect() as conn:
            # Check if feedback column exists on messages
            conn.execute(text("ALTER TABLE messages ADD COLUMN feedback VARCHAR;"))
            conn.commit()
    except Exception:
        pass
    logger.info(f"Database schema initialized using {ACTIVE_DB_TYPE}.")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
