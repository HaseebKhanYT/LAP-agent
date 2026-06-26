# LAP Backend

FastAPI + LangGraph multi-agent backend for **Learn-A-Platform**. Orchestrates the
agent graph that explores a platform, verifies what it learns, and serves the
grounded knowledge. LLM inference is provided by **Nebius Token Factory**; **Redis**
backs the graph checkpointer, response cache, and run event bus.

See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for the full design.

## Layout

```
app/
  core/         config · logging · lifespan (wires everything onto app.state)
  llm/          Nebius Token Factory provider (lazy; key required only for runs)
  cache/        Redis client: JSON cache + pub/sub event bus (graceful fallback)
  agents/       LangGraph: state · graph · nodes/ (8 agent roles)
  repositories/ Knowledge Store interface + in-memory impl (swappable seam)
  services/     run_service (run lifecycle, SSE, HITL) · knowledge_service
  schemas/      Pydantic DTOs = the HTTP API contract
  api/v1/       routes: health · runs · approvals · knowledge
tests/          boot/smoke tests
```

## Run locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env            # optional; the app boots without it

uvicorn app.main:app --reload   # http://localhost:8000  (docs at /docs)
```

The API **boots with no secrets**. `GET /api/v1/health` reports
`{redis, llm_configured}`. Starting a learning run only does real work once
`NEBIUS_API_KEY` is set — without it, a run starts and then fails fast with a clear
"NEBIUS_API_KEY is not set" event (the intended scaffold boundary).

```bash
pytest          # boot + smoke tests (no Redis or API key required)
ruff check .    # lint
```

## Key endpoints (prefix `/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness + `{redis, llm_configured}` |
| POST | `/runs` | start a learning run |
| GET | `/runs` · `/runs/{id}` | list / get runs |
| GET | `/runs/{id}/events` | **SSE** live run event stream |
| GET | `/runs/{id}/approvals` | pending HITL gates |
| POST | `/approvals/{id}/decision` | approve / deny / skip (resumes the graph) |
| GET | `/platforms` | learned platforms |
| GET | `/platforms/{p}/capabilities?query=` | capability catalog / search |
| GET | `/platforms/{p}/recipes/{cap}` | verified, parameterized recipe |
| GET | `/platforms/{p}/ui-map?region=` | UI graph |

## Notes

- Agent **node bodies are stubs**: correct signatures, real LLM/cache/HITL wiring,
  but the Playwright perception/automation and replay-verification logic are the
  next implementation milestone (clearly marked in each node).
- Run snapshots are in-process (scaffold). The event bus uses Redis pub/sub, so
  streaming already works across workers; move run/approval state to Redis/DB to
  scale the API tier horizontally.
