# LAP — Learn-A-Platform

A multi-agent system that, given browser access to any web platform, autonomously
**explores** it, **maps** every screen / button / workflow, **verifies** what it
learned actually exists, and **publishes** a queryable model so other agents can
ask *"how do I do X on platform Y?"* and get a grounded, executable recipe.

Its defining rule (the **grounding guarantee**): nothing is published unless it was
directly observed and independently replayed — the system never invents a path that
doesn't exist.

- 📋 Product requirements: [`docs/PRD-learn-a-platform.md`](docs/PRD-learn-a-platform.md)
- 🏗️ Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Stack

| Layer | Tech |
|---|---|
| Agent orchestration | **LangGraph** (`StateGraph`, durable execution, HITL `interrupt()`) |
| API & serving | **FastAPI** (async, typed, SSE) |
| LLM inference | **Nebius Token Factory** (OpenAI-compatible, via `langchain-openai`) |
| Cache / state / events | **Redis** (graph checkpointer · response cache · run event bus) |
| Operator console | **Next.js** 15 (App Router, TypeScript, Tailwind) |

## Repository layout

```
LAP-agent/
├── backend/      FastAPI + LangGraph + Nebius + Redis  (see backend/README.md)
├── frontend/     Next.js operator console               (see frontend/README.md)
├── docs/         PRD + architecture
├── docker-compose.yml
└── .env.example
```

## Quickstart

### Option A — Docker (whole stack)

```bash
cp .env.example .env          # optional: add NEBIUS_API_KEY for real runs
docker compose up --build
```

- Console → http://localhost:3000
- API docs → http://localhost:8000/docs

### Option B — Run services manually

```bash
# 1) Redis (optional; the backend falls back to in-memory if absent)
docker run -p 6379:6379 redis:7-alpine

# 2) Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload          # http://localhost:8000

# 3) Frontend
cd frontend
npm install
npm run dev                            # http://localhost:3000
```

## The API-key boundary

This is a **scaffold with real integration**: every layer is wired and runnable.
The entire stack starts and the console renders **with no secrets**. The only thing
required before an actual learning run can do work is a **Nebius API key** (and, for
real exploration, sandbox credentials for the target platform). `GET /api/v1/health`
reports exactly what's configured: `{ "redis": bool, "llm_configured": bool }`.

Agent node bodies are intentionally **stubs** — correct signatures and real
LLM/cache/HITL/streaming wiring, with the Playwright perception and replay-
verification logic marked as the next implementation milestone.
