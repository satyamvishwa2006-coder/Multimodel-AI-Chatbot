# 🤖 Multimodal AI Chatbot — Beginner-Friendly MVP

A modern, responsive, and robust personal AI assistant built with **React**, **FastAPI**, **PostgreSQL (with pgvector)**, and **pluggable AI providers**.

---

## ✨ Features

1. **Multimodal Conversations**:
   - Text chat with Markdown rendering and syntax-highlighted code blocks with 1-click copy.
   - Image attachment and vision inspection.
   - Document upload (PDF, DOCX, TXT, MD) and mixed multi-modal prompts.
   - In-browser microphone audio recording with automatic speech-to-text transcription.
   - Text-to-speech audio synthesis with integrated playback controls.

2. **Grounded RAG Knowledge Base**:
   - Upload PDF, DOCX, TXT, or Markdown documents to your personal knowledge base.
   - Intelligent sliding window text chunking with configurable overlap.
   - 1536-dimensional vector embeddings stored and indexed in PostgreSQL using pgvector.
   - Semantic similarity search (`<=>` cosine distance) retrieving top-$K$ chunks.
   - Grounded responses with precise document citations and chunk references.

3. **Live Web Search with Verified Citations**:
   - Toggleable web search using Tavily API (with automatic DuckDuckGo fallback).
   - Real clickable source links and snippets displayed under assistant responses.
   - Strict grounding instruction preventing hallucinated facts and fabricated URLs.

4. **Document Workspace**:
   - Create new structured documents from a simple prompt.
   - AI-powered transformations: Summarize, Simplify, Fix Grammar, Translate to other languages, or execute Custom Prompts.
   - Side-by-side comparison: original content vs. revised preview.
   - Safe revision approval workflow without silently overwriting drafts.
   - Export approved documents to formatted Microsoft Word (`.docx`), Markdown (`.md`), or plain text (`.txt`).

5. **Empathetic Emotional Support & Crisis Safeguards**:
   - Compassionate, non-judgmental conversational demeanor that validates feelings before offering practical suggestions.
   - Built-in crisis detection for self-harm and acute distress.
   - Immediate safety intervention providing 24/7 hotline numbers (988 Lifeline, Crisis Text Line, international crisis contacts).
   - Clear professional boundaries (AI companion, not a licensed healthcare provider).

6. **Privacy-Preserving Anonymous Sessions**:
   - No complex logins or password setups required.
   - Generates an anonymous browser UUID (`X-Session-Id`) separating all conversations and documents.
   - Multi-tenant database queries ensure sessions remain completely isolated.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Vanilla CSS design tokens, Fetch API |
| **Backend** | Python 3.10+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic |
| **Database** | PostgreSQL 18+ with `pgvector` (with automatic resilient fallback) |
| **Document Processing** | `pypdf`, `python-docx` |
| **AI Providers** | OpenAI, Google Gemini, and a built-in offline **Mock Provider** |
| **Testing** | `pytest`, `pytest-asyncio`, FastAPI `TestClient` |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Python 3.10 or newer** (`python --version`)
- **Node.js v18 or newer** (`node --version`)
- **PostgreSQL 14+** (Optional: application automatically uses local fallback database if PostgreSQL is not yet configured)

---

### 2. Backend Setup

1. Open your terminal in the project directory:
   ```bash
   cd backend
   ```

2. (Optional but recommended) Create and activate a Python virtual environment:
   ```powershell
   # Windows PowerShell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
   ```bash
   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure your environment:
   - A default `.env` file is already created from `.env.example`.
   - By default, `LLM_PROVIDER="mock"` is active, meaning the entire system works **100% offline with zero cost**.
   - To use live OpenAI or Gemini models, simply add your API key in `.env`:
     ```env
     LLM_PROVIDER="openai"
     OPENAI_API_KEY="sk-..."
     ```

5. Run the backend server:
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```
   - API will be accessible at: `http://localhost:8000`
   - Interactive Swagger API docs: `http://localhost:8000/docs`
   - Health check: `http://localhost:8000/api/health`

---

### 3. Frontend Setup

1. In a new terminal window, navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   - Open your browser at: `http://localhost:5173`

---

## 🗄️ PostgreSQL & pgvector Setup

### Option A: Local PostgreSQL
1. Ensure PostgreSQL is running on port 5432.
2. Create a database named `mchatbot`:
   ```sql
   CREATE DATABASE mchatbot;
   ```
3. Install the pgvector extension into PostgreSQL:
   ```sql
   \c mchatbot
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. Update `DATABASE_URL` in `.env`:
   ```env
   DATABASE_URL="postgresql+psycopg2://postgres:your_password@localhost:5432/mchatbot"
   ```

### Option B: Docker (Recommended for quick setup)
Run a pre-configured PostgreSQL container with `pgvector`:
```bash
docker run -d --name mchatbot-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mchatbot -p 5432:5432 pgvector/pgvector:pg16
```

### Option C: Resilient Fallback Mode
If PostgreSQL or pgvector is not installed on your system, the application automatically activates **Resilient Vector Mode** using local SQLite. All embeddings, chunking, and cosine similarity calculations run seamlessly in Python with 0 manual database configuration needed!

---

## 🧪 Running Automated Tests

All tests run completely offline without requiring paid API keys or external services:

```bash
cd backend
python -m pytest -v
```

This verifies:
- Health check endpoints
- Chat and multi-turn conversation persistence
- Document upload, text extraction (PDF/DOCX/TXT/MD), and RAG vector retrieval
- Web search query handling and citation formatting
- Document workspace generation, AI transformation, and DOCX download
- Multi-tenant anonymous session isolation
- Crisis safety filter and emergency helpline triggers

---

## 📂 Project Structure

```
M-Chatbot/
├── backend/
│   ├── app/
│   │   ├── core/           # Config and upload security
│   │   ├── db/             # SQLAlchemy models, session, pgvector
│   │   ├── routers/        # Health, chat, conversations, uploads, documents, search, audio
│   │   ├── schemas/        # Pydantic request/response models
│   │   ├── services/       # LLM, Embedding, RAG, WebSearch, Document, Audio, Safety
│   │   └── utils/          # Session helper & text chunker
│   ├── tests/              # 12 automated unit & integration tests
│   ├── uploads/            # Local attachment storage
│   ├── requirements.txt    # Python dependencies
│   └── alembic.ini         # Database migration configuration
├── frontend/
│   ├── src/
│   │   ├── components/     # Sidebar, ChatArea, Composer, DocumentWorkspace
│   │   ├── services/       # api.js fetch client with session handling
│   │   ├── styles/         # Dark glassmorphism CSS design system
│   │   ├── App.jsx         # Main application layout & state
│   │   └── main.jsx        # React root
│   ├── package.json
│   └── vite.config.js      # Proxy to backend on port 8000
├── sample_data/            # Sample documents for RAG testing
├── .env.example            # Environment configuration template
├── .env                    # Local dev configuration
└── README.md
```

---

## 🔒 Security & Privacy Notes

- **API Keys**: Stored exclusively on the server in `.env`. Never exposed to the client.
- **Anonymous Sessions**: Sessions are identified by a random browser token (`x-session-id`). If you clear your browser cookies/localStorage, you will receive a new session. No personal passwords or tracking data are kept.
- **Content Safety**: Uploaded files and web search results are treated as untrusted data and strictly isolated from system prompts.

User Satyam
