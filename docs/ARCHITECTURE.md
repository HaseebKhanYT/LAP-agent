# Architecture — LAP (Learn-A-Platform)

This document records the technical architecture chosen to implement the
[PRD](./PRD-learn-a-platform.md). LAP ships as a **single specialist agent
offered for hire on the [GMI Cloud AgentBox](https://docs.gmicloud.ai/agentbox-marketplace/overview)
marketplace**: one Docker container, one listing, that a buyer hires to learn a
web platform and that then serves verified recipes. Internally it is built from
a pipeline of roles (decompose → explore → verify → publish), but the
marketplace and every caller see one hireable HTTP service — never the roles
inside.

The stack: **LangGraph** (in-container role orchestration + durable resume),
**FastAPI** (the container's HTTP surface — both the async *learn* job and the
*serve* reads), **GMI MaaS** (OpenAI-compatible inference, 200+ models, key
injected by AgentBox at runtime), **Redis** (cache, durable graph state, run
event bus) plus an **object store** for provenance blobs, and **Next.js** (an
optional operator/demo console — AgentBox itself provides monitoring & billing).

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
│  GMI MaaS (injected env)  │        │  Browser driver (Playwright/CDP)     │
│  OpenAI-compatible · 200+ │        │  bundled in the container image      │
│  models · tiered          │        │  perception + action on the platform │
└───────────────────────────┘        └──────────────────────────────────────┘
```

> The FastAPI service + LangGraph + Redis above run as a **single AgentBox
> container** (external HTTPS/443 → container port 8080); the browser is bundled
> into that image, and the Next.js console is optional. See §7 for the full
> container contract.

---

## 2. Why each technology

| Layer | Choice | Rationale |
|---|---|---|
| **Agent orchestration** | LangGraph `StateGraph` | The PRD needs a long-running, stateful, multi-agent loop with **durable execution** and **human-in-the-loop**. LangGraph gives first-class `interrupt()`/`Command(resume=...)` for the HITL gate and pluggable checkpointers for durability and resume. |
| **API / serving** | FastAPI | Async, typed (Pydantic) request/response, native SSE/streaming, OpenAPI out of the box — ideal for both the operator console and the knowledge-serving API. |
| **LLM** | GMI MaaS | OpenAI-compatible inference over 200+ models. `GMI_MAAS_BASE_URL` / `GMI_MAAS_API_KEY` / `GMI_MODELS` are **injected by AgentBox at runtime**; consumed via `langchain-openai` `ChatOpenAI` pointed at that base URL, so model choice — including cheap-for-scout / strong-for-verify tiering — is a config change. |
| **Cache / state** | Redis | One backend serves three needs: LangGraph **checkpointer** (durable graph state, resume), **response/query cache** (LLM + knowledge reads), and a **pub/sub event bus** + HITL queue powering the live run stream. |
| **Frontend** | Next.js (App Router) | **Optional** operator/demo console — AgentBox itself provides monitoring, usage and billing. Server components for fast reads, client components for the live SSE event stream and HITL controls. |

---

## 3. The agent graph (LangGraph)

Nodes implement the eight PRD roles. The graph is built in
`backend/app/agents/graph.py`; shared state lives in `agents/state.py`; each
node is a module under `agents/nodes/`.

**One agent, many roles.** LAP is *listed* as a single hireable agent — the
marketplace and every caller see one HTTP service, never the roles inside. For
v1 the discovery roles (conductor → scout → prober → cartographer → synthesizer
→ documenter) collapse into a single reasoning loop sharing one context, backed
by deterministic tooling (signature hashing, DOM diffing, dedup, replay
assertions — these are *not* LLM calls). The **verifier stays a separate,
fresh-context, clean-session replay**: that seam is the grounding guarantee
(PRD §9) and is the one boundary never collapsed. Parallel scouts/probers are a
P3 scale-out lever, not a v1 requirement, and remain invisible to callers.

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
  llm/         GMI MaaS client factory              (only place that knows the LLM)
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
- **Model flexibility.** GMI MaaS model choice is a config value; heavier reasoning
  models can be used for synthesis/verification and cheaper ones for scouting.
- **Next step for scale:** move graph execution to a dedicated worker pool (e.g.
  Celery/Arq/Ray) consuming a run queue; the API only enqueues and streams.

---

## 7. Deployment: the AgentBox container contract

LAP is delivered as **one Docker image** listed on GMI Cloud AgentBox and hired
per-second of compute. The image must satisfy AgentBox's contract:

- **HTTP service on port 8080.** AgentBox maps external HTTPS/443 → container
  `8080`. The FastAPI app *is* the agent; AgentBox prescribes no request schema,
  so the routes below are ours to design.
- **Two surfaces, one app.**
  - *Learn* (async job): `POST /api/v1/runs` accepts a target (URL + sandbox
    credentials + budget) and returns **HTTP 202 + a `job_id`**; the crawl runs
    in the background; callers poll `GET /runs/{id}` (status/coverage) and
    `GET /runs/{id}/result` (UI map + recipes). This is AgentBox's prescribed
    pattern for long-running work — a held-open connection is 504'd by the
    gateway.
  - *Serve* (fast reads): `GET /platforms`, `/recipe`, `/search`, `/ui_map`,
    `explain_element`, `report_failure` — the verified-knowledge queries from
    PRD §11, as plain HTTP routes in the same container.
- **Inference via injected MaaS env.** `GMI_MAAS_BASE_URL`, `GMI_MAAS_API_KEY`,
  and `GMI_MODELS` are injected by AgentBox at runtime (never hardcoded). The LLM
  client reads them lazily, so the container still **boots and serves `/health`
  with no secrets present**.
- **Stateless container, external durable state.** In-container memory and the
  30 GiB disk are lost on restart, so durable state goes to **Redis** (run
  checkpoints via `AsyncRedisSaver`, job records, hot-read cache) and
  **provenance blobs** (screenshots, DOM snapshots) go to an **S3-compatible
  object store** supplied as a Secret — only refs live in Redis. This is what
  lets a long crawl survive a container restart and resume.
- **Browser in the image.** Playwright + Chromium are bundled into the image; the
  compute tier is sized for the browser, not the LLM call.
- **HITL without an operator console.** With no console beside the agent on the
  marketplace, the default policy is **sandbox-only + auto-deny destructive**, so
  a hire runs end-to-end unattended. Buyers who want the gate opt in: the job
  reports `status: needs_approval` and resumes on
  `POST /runs/{id}/approvals/{aid}`.
- **Health.** `GET /health` reports `{redis: bool, llm_configured: bool}` so the
  operator/marketplace can see exactly what is wired.

Result: `docker build` → push → register via the AgentBox deploy wizard (Basics →
Infrastructure → Networking → Env → Review) brings the listing online. Beyond the
image, a real hire needs only the injected MaaS key (from AgentBox) and the
buyer's sandbox platform credentials.
