# LAP Console (frontend)

Operator console for **LAP (Learn-A-Platform)** — a multi-agent system that
explores web platforms, maps their UI, and publishes verified navigation
"recipes" for other agents.

This frontend lets an operator:

- Start learning runs and watch live progress.
- Approve / deny / skip human-in-the-loop (HITL) action gates.
- Browse learned knowledge: platforms → capabilities → recipes → UI map.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript (strict)
- Tailwind CSS
- No external state library — React Server Components + small client components + `fetch`

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

The app expects the LAP backend to be reachable at the URL configured in
`NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`). Copy the example
env file if you want to override it:

```bash
cp .env.example .env.local
```

> The UI runs and renders **without** the backend running and **without** any
> API keys. When the backend is unreachable, pages show empty states or a
> "backend unavailable" notice instead of crashing.

## Backend API contract

All endpoints are served under the `/api/v1` prefix on `NEXT_PUBLIC_API_BASE_URL`:

| Method | Path                                                  | Purpose                          |
| ------ | ----------------------------------------------------- | -------------------------------- |
| GET    | `/health`                                             | Backend / redis / LLM status     |
| GET    | `/runs`                                               | List runs                        |
| POST   | `/runs`                                               | Create a run                     |
| GET    | `/runs/{id}`                                          | Run detail                       |
| GET    | `/runs/{id}/events`                                   | SSE event stream                 |
| GET    | `/runs/{id}/approvals`                                | List approvals for a run         |
| POST   | `/approvals/{id}/decision`                            | Approve / deny / skip a gate     |
| GET    | `/platforms`                                          | List learned platforms          |
| GET    | `/platforms/{platform}/capabilities?query=`           | Capability catalog (searchable) |
| GET    | `/platforms/{platform}/recipes/{capability}`          | Recipe for a capability         |
| GET    | `/platforms/{platform}/ui-map?region=`                | UI map for a platform           |

The single typed API client lives in [`lib/api.ts`](./lib/api.ts); shared types
in [`lib/types.ts`](./lib/types.ts).

## Pages

| Route              | Description                                                            |
| ------------------ | --------------------------------------------------------------------- |
| `/`                | Dashboard: health badge, summary cards, recent runs, "Start a run".   |
| `/runs`            | All runs (status chips) + "New run" form.                             |
| `/runs/[id]`       | Run detail: status/phase/coverage, live SSE event log, approvals.     |
| `/platforms`       | Learned platforms (cards).                                            |
| `/platforms/[name]`| Capability catalog (searchable) + recipe view + UI map.              |

## Scripts

```bash
npm run dev     # start dev server
npm run build   # production build
npm run start   # serve the production build
npm run lint    # lint
```

## Docker

A multi-stage `Dockerfile` builds a production image using Next.js standalone
output:

```bash
docker build -t lap-frontend \
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 .
docker run -p 3000:3000 lap-frontend
```

Note: `NEXT_PUBLIC_*` values are inlined at build time, so set the API base URL
via `--build-arg` when building the image.
