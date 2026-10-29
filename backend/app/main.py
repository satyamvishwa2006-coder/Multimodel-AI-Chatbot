import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.db.session import init_db
from app.routers import (
    health,
    conversations,
    uploads,
    chat,
    documents,
    search,
    audio,
    images,
    translator,
    videos,
    preferences,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Full-stack Multimodal AI Assistant with RAG, Vision, Audio, Video, Coding, and Personalization",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploads (images, audio, docs, videos)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include Routers
app.include_router(health.router)
app.include_router(conversations.router)
app.include_router(uploads.router)
app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(search.router)
app.include_router(audio.router)
app.include_router(images.router)
app.include_router(translator.router)
app.include_router(videos.router)
app.include_router(preferences.router)


@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs": "/docs",
        "health": "/api/health",
        "version": "2.0.0",
    }
