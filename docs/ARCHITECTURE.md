# Architecture — LAP (Learn-A-Platform)

This document records the technical architecture chosen to implement the
[PRD](./PRD-learn-a-platform.md). It maps the PRD's multi-agent design onto a
concrete, scalable stack: **LangGraph** (agent orchestration), **FastAPI**
(API + serving), **Nebius Token Factory** (LLM inference), **Redis** (cache,
durable graph state, run event bus), and **Next.js** (operator console).

---

## 1. System at a glance

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Next.js operator console                          │
│   dashboard · start runs · live event stream · HITL approvals · browse KB  │
└───────────────────────────────┬──────────────────────────────────────────┘
                                 │ REST + SSE  (/api/v1)
┌───────────────────────────────▼──────────────────────────────────────────┐
│                               FastAPI                                       │
│  routes: health · runs · approvals · knowledge                             │
│  services: run_service · knowledge_service                                  │
└───────┬───────────────────────┬───────────────────────────┬──────────────┘
        │ invoke/stream          │ cache / pub-sub           │ read
┌───────▼─────────┐    ┌─────────▼──────────┐      ┌─────────▼───────────────┐
│  LangGraph      │    │      Redis         │      │  Knowledge Store         │
│  StateGraph     │◀──▶│  checkpointer      │      │  (repository abstraction)│
│  8 agent nodes  │    │  cache · pub/sub   │      │  states·elements·edges·  │
│  HITL interrupt │    │  HITL queue        │      │  workflows·recipes·prov. │
└───────┬─────────┘    └────────────────────┘      └──────────────────────────┘
        │ LLM calls (OpenAI-compatible)
┌───────▼──────────────────┐        ┌──────────────────────────────────────┐
│  Nebius Token Factory     │        │  Browser driver (Playwright/CDP)     │
│  open-model inference      │        │  perception + action on the platform │
└───────────────────────────┘        └──────────────────────────────────────┘
```

---

## 2. Why each technology

| Layer | Choice | Rationale |
|---|---|---|
| **Agent orchestration** | LangGraph `StateGraph` | The PRD needs a long-running, stateful, multi-agent loop with **durable execution** and **human-in-the-loop**. LangGraph gives first-class `interrupt()`/`Command(resume=...)` for the HITL gate and pluggable checkpointers for durability and resume. |
| **API / serving** | FastAPI | Async, typed (Pydantic) request/response, native SSE/streaming, OpenAPI out of the box — ideal for both the operator console and the knowledge-serving API. |
| **LLM** | Nebius Token Factory | OpenAI-compatible inference over open models. Consumed via `langchain-openai` `ChatOpenAI` pointed at `https://api.tokenfactory.nebius.com/v1/` (or the `langchain-nebius` package), so swapping models is a config change. |
| **Cache / state** | Redis | One backend serves three needs: LangGraph **checkpointer** (durable graph state, resume), **response/query cache** (LLM + knowledge reads), and a **pub/sub event bus** + HITL queue powering the live run stream. |
| **Frontend** | Next.js (App Router) | Server components for fast reads, client components for the live SSE event stream and HITL controls. |

---

## 3. The agent graph (LangGraph)

Nodes implement the eight PRD roles. The graph is built in
`backend/app/agents/graph.py`; shared state lives in `agents/state.py`; each
node is a module under `agents/nodes/`.

```
START
  → conductor ──┐ (decides next region / frontier item; or finish)
                ▼
            scout → prober → cartographer
                ▼
         [hitl_gate]  ←── interrupt() for risky actions (Command resume)
                ▼
           synthesizer → verifier ──(quarantine)──▶ back to synthesizer
                ▼ (verified)
           documenter → publisher → conductor (loop) → END
```

- **Durability:** the graph is compiled with `AsyncRedisSaver` so a run can pause
  (e.g. on an HITL interrupt) and resume exactly where it left off, keyed by
  `thread_id == run_id`.
- **Grounding gate:** `verifier` is the only edge to `documenter/publisher`.
  Candidates that fail clean-replay loop back to `synthesizer` (see PRD §9).
- **Streaming:** `run_service` consumes `graph.astream(..., stream_mode="updates")`
  and republishes node updates onto a Redis channel `run:{id}:events`, which the
  FastAPI SSE endpoint relays to the frontend.

> The node bodies are **stubs** in this scaffold: they have correct signatures,
> update the shared state, emit events, and demonstrate the LLM/cache/HITL
> integration points — but the real perception/automation logic (Playwright,
> DOM diffing, replay assertions) is left as the implementation milestone. This
> is intentional: the scaffold proves the wiring; the agents are filled in next.

---

## 4. Request / data flows

**Start a learning run**
1. `POST /api/v1/runs` → `run_service.start_run()` persists a `Run`, then launches
   the graph as a background task with `thread_id=run_id`.
2. Node updates stream out of LangGraph → published to Redis `run:{id}:events`.
3. Frontend `GET /runs/{id}/events` (SSE) subscribes to that channel for live logs.

**Human-in-the-loop gate**
1. A node hits a risky action → calls `interrupt({...})`; the graph **pauses** and
   the checkpointer persists state.
2. `run_service` records a pending `Approval` (Redis) and emits an event.
3. Operator decides via `POST /approvals/{id}/decision`; `run_service` resumes the
   graph with `Command(resume=decision)`.

**Serve learned knowledge**
1. `GET /platforms/...` → `knowledge_service` reads the Knowledge Store via the
   repository interface, with Redis caching of hot reads.
2. Every payload carries `provenance`, `confidence`, `last_verified` (PRD contract).

---

## 5. Module boundaries (backend)

```
app/
  core/        config, logging, lifespan            (cross-cutting; no business logic)
  llm/         Nebius client factory                (only place that knows the LLM)
  cache/       Redis client, cache + pub/sub helpers (only place that knows Redis wire)
  agents/      LangGraph state + graph + node stubs  (orchestration; depends on llm/cache)
  repositories/ Knowledge Store abstraction + impl   (persistence seam; swappable backend)
  services/    run_service, knowledge_service        (use-cases; orchestrate the above)
  schemas/     Pydantic DTOs                         (API contract; no logic)
  api/v1/      routes                                (thin HTTP layer → services)
```

Each module has one purpose and a narrow interface, so it can be understood and
tested in isolation (PRD's "design for isolation"). The **repository** seam means
the Knowledge Store backend (in-scaffold: Redis/in-memory) can be swapped for a
graph or relational DB without touching services or agents.

---

## 6. Scalability

- **Stateless API workers.** FastAPI holds no run state in memory — everything is
  in Redis / the Knowledge Store — so the API tier scales horizontally.
- **Durable, resumable runs.** Redis checkpointing lets a run survive a worker
  restart and resume; long crawls aren't tied to one process's lifetime.
- **Decoupled streaming.** Redis pub/sub separates run execution from SSE fan-out,
  so any API replica can serve a client subscribed to any run.
- **Pluggable persistence.** The repository interface allows moving from Redis to a
  dedicated graph/relational store as platform maps grow.
- **Model flexibility.** Nebius model choice is a config value; heavier reasoning
  models can be used for synthesis/verification and cheaper ones for scouting.
- **Next step for scale:** move graph execution to a dedicated worker pool (e.g.
  Celery/Arq/Ray) consuming a run queue; the API only enqueues and streams.

---

## 7. Boot & the API-key boundary

The scaffold is designed to **boot and serve `/health` with no secrets**:

- `NEBIUS_API_KEY` is **optional at startup**; the LLM client is created lazily and
  raises a clear error only when an actual learning run needs inference.
- Redis connection is attempted at startup but **degrades gracefully** (logged
  warning) if unavailable, so the API and frontend still come up.
- `GET /health` reports `{redis: bool, llm_configured: bool}` so the operator can
  see exactly what's missing.

Result: `docker compose up` (or running each service locally) brings the whole
system online; the **only** thing required before a real learning run is the
Nebius API key (and sandbox platform credentials). That is the intended stopping
point for this scaffold.
