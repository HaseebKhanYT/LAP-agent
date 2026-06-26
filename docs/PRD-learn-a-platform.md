# PRD — LAP: Learn-A-Platform Multi-Agent System

| | |
|---|---|
| **Status** | Draft v1 (for review) |
| **Date** | 2026-06-26 |
| **Owner** | @HaseebKhanYT |
| **Repo** | LAP-agent |

---

## 1. Summary

LAP (Learn-A-Platform) is a multi-agent system that, given browser access to any web
platform, autonomously **explores** the platform, **maps** every screen, button, and
workflow, **verifies** that what it learned actually exists, and **publishes** that
knowledge as a queryable service. The end product is a grounded, machine-readable model
of "how to use platform X" that any downstream LLM agent can query: *"how do I do Y on
platform X?"* → a verified, executable, step-by-step recipe.

The defining constraint of the system is **grounding**: LAP must discover the complete
set of real workflows and paths itself, and must **never** publish a path, button
purpose, or workflow that it has not directly observed and independently replayed.
Hallucinated navigation is the primary failure mode this system is designed to eliminate.

**Delivery & packaging.** LAP is shipped as a **single specialist agent offered for
hire on the [GMI Cloud AgentBox](https://docs.gmicloud.ai/agentbox-marketplace/overview)
marketplace** — one Docker container, one listing, billed per-second of compute. A
buyer hires it with a platform URL + sandbox credentials; it runs the learning job
and then serves verified recipes from the same container. Although the system is
*architected* as a pipeline of specialized roles (§6), it is *delivered and billed*
as one agent: the marketplace and every caller see a single HTTP service. The role
decomposition is an internal implementation detail and a scaling lever — for v1 the
discovery roles collapse into a single reasoning loop, with only the **Verifier**
kept as an independent, fresh-context stage (the grounding seam). See
[ARCHITECTURE.md](./ARCHITECTURE.md) §7 for the container contract.

---

## 2. Problem & Motivation

LLM agents are increasingly asked to operate inside web platforms (CRMs, dashboards, SaaS
tools, internal apps). Today each agent rediscovers the same UI from scratch on every run.
That is slow, expensive, and unreliable — agents guess at where buttons lead, invent
selectors, and hallucinate workflows that don't exist, producing confident-but-wrong
actions in live systems.

There is no shared, trustworthy, reusable model of "how this platform works" that an agent
can consult before acting. LAP builds exactly that model — once, thoroughly, and with a
correctness guarantee — so that every other agent can act with grounded knowledge instead
of guesswork.

---

## 3. Goals & Non-Goals

### 3.1 Goals
- **G1 — Autonomous discovery.** Given a URL + sandbox credentials, LAP maps the reachable
  UI surface of a platform with no human-authored task list.
- **G2 — Complete capability catalog.** LAP self-discovers the full set of real workflows,
  paths, and actions the platform supports — not a sampled subset.
- **G3 — Grounding guarantee.** Every published element purpose, path, and workflow is
  empirically observed and independently replayed. Hallucination rate target: **0**.
- **G4 — Reusable, queryable output.** Knowledge is exposed as a generic MCP/API so *any*
  agent framework can consume it.
- **G5 — Generalization.** The same system works on any web platform with no
  platform-specific code.
- **G6 — Safe operation.** Mutating actions run only against sandbox/test accounts, with a
  human-in-the-loop gate for irreversible/destructive operations.

### 3.2 Non-Goals (v1)
- **NG1** — Not a general autonomous task-completion agent. LAP *learns* platforms; it does
  not perform end-user work on real production accounts.
- **NG2** — Not native mobile apps or desktop GUIs. Scope is web (browser-driven) platforms.
- **NG3** — Not bypassing auth, CAPTCHAs, bot defenses, or paywalls. LAP operates only on
  platforms it has authorized access to.
- **NG4** — Not maintaining pixel-perfect visual reproductions; the model is structural
  (states, elements, transitions), not a screenshot archive.
- **NG5** — Not real-time co-piloting inside a user's live session (v1 is offline learning;
  serving is read-only knowledge).

---

## 4. Users & Use Cases

| User | Use case |
|---|---|
| **Downstream agent developer** | Wants their agent to operate a platform reliably; queries LAP for verified recipes instead of hard-coding selectors. |
| **Autonomous agent (runtime)** | Mid-task, asks LAP `get_recipe(platform, "create invoice")` and executes the returned grounded steps. |
| **QA / ops engineer** | Uses LAP's UI map + capability catalog as living documentation of a platform's surface area. |
| **AgentBox buyer** | Discovers the listed LAP agent on the marketplace and **hires** it to learn a platform their own agents must operate; calls the async learn job, then queries verified recipes — paying per-second of compute. |
| **LAP operator** | Kicks off a learning run, approves HITL gates (when enabled), reviews coverage and verification reports. |

**Primary use case (end-to-end):**
1. A buyer hires the LAP listing on AgentBox: `POST /runs {url: app.example.com,
   creds: sandbox, budget}` → `202 {job_id}` (a CLI `lap learn …` is an equivalent
   local form).
2. LAP explores, maps, probes, synthesizes, and verifies the platform; the buyer
   polls `GET /runs/{job_id}` for live progress.
3. LAP publishes the verified knowledge into the same container's serve surface
   (HTTP routes, optionally MCP).
4. A separate agent later calls `get_recipe("example", "export report as CSV")` and receives
   a verified, parameterized, replayable step list — and succeeds on the first try.

---

## 5. Key Requirements

### 5.1 Functional
- **FR1** — Accept a platform target: base URL, auth method, sandbox credentials, optional
  domain allowlist and budget.
- **FR2** — Authenticate into the platform (login flows handled via provided credentials).
- **FR3** — Crawl the reachable application states starting from entry points.
- **FR4** — Enumerate every interactive element on each state (role, label, selectors).
- **FR5** — Determine each element's **purpose and effect** by controlled interaction and
  before/after state diffing — not by label inference alone.
- **FR6** — Build a single, deduplicated UI Graph (states + transitions).
- **FR7** — Synthesize candidate workflows from real graph edges only.
- **FR8** — Independently verify every candidate workflow by clean-session replay.
- **FR9** — Publish only verified knowledge, each artifact stamped with provenance,
  confidence, and last-verified timestamp.
- **FR10** — Serve knowledge via MCP query verbs (see §11).
- **FR11** — Detect platform drift and re-verify / re-learn stale knowledge.
- **FR12** — Enforce the HITL gate for actions classified as irreversible/destructive.

### 5.2 The Grounding Requirement (elevated)
- **GR1 — Observed, not assumed.** No element purpose, edge, or workflow enters the
  catalog unless directly observed.
- **GR2 — Edges before workflows.** A synthesized workflow may reference only transitions
  that already exist as verified edges in the UI Graph.
- **GR3 — Independent replay.** Before publishing, the Verifier replays each workflow from a
  fresh session/account; discovery-time success is insufficient.
- **GR4 — Provenance everywhere.** Every published fact links to the observation(s) that
  produced it (screenshot, DOM snapshot, action log, replay record).
- **GR5 — Quarantine, don't guess.** Candidates that fail verification are quarantined with
  failure reasons — never published, never silently dropped.

---

## 6. System Architecture

### 6.1 Chosen approach
**Hierarchical decomposition + per-region exploration pipeline + shared grounded
knowledge store + a dedicated verification gate.**

A **Conductor** decomposes the platform into regions and manages a global frontier of
unexplored states. Many **Scouts** and **Probers** work concurrently against the live
sandbox, all reading from and writing to one **Knowledge Store** (a blackboard). A
**Cartographer** continuously merges raw observations into the canonical UI Graph. A
**Workflow Synthesizer** proposes candidate workflows; a **Verifier** independently
replays them and is the *only* path to publication. A **Documenter** and **Publisher**
turn verified workflows into served recipes.

(Alternatives considered — linear pipeline, homogeneous blackboard swarm — are documented
in Appendix A.)

### 6.2 Diagram

```
                         ┌────────────────────────────┐
            target ─────▶│         CONDUCTOR          │  budgets, frontier,
        (URL+creds)      │  decompose · schedule · HITL│  stop conditions
                         └─────┬───────────────┬──────┘
                               │ assigns        │ approves/denies
                ┌──────────────▼───┐      ┌─────▼─────────┐
                │  SCOUT (xN)      │      │  HITL GATE    │◀── human
                │  crawl states,   │      └───────────────┘
                │  enumerate els   │
                └────────┬─────────┘
                         │ observations
                ┌────────▼─────────┐         ┌──────────────────┐
                │  PROBER (xN)     │────────▶│  KNOWLEDGE STORE  │ (blackboard:
                │  interact, diff  │  read/  │  states · elements│  single source
                │  effects         │  write  │  edges · candidates│  of truth)
                └──────────────────┘         │  verified · prov. │
                ┌──────────────────┐  ◀──────┤                   │
                │  CARTOGRAPHER    │  merge  └─────────┬─────────┘
                │  dedup → UI Graph│                    │
                └──────────────────┘          ┌─────────▼─────────┐
                ┌──────────────────┐           │ WORKFLOW SYNTH.   │ candidates
                │  VERIFIER        │◀──────────┤ compose from real │ (graph edges
                │  clean replay →  │  candidate│ edges only        │  only)
                │  publish/quarant.│           └───────────────────┘
                └────────┬─────────┘
                         │ verified
                ┌────────▼─────────┐         ┌──────────────────┐
                │  DOCUMENTER      │────────▶│  PUBLISHER /MCP   │──▶ downstream
                │  recipes + docs  │         │  serve · freshness│    agents
                └──────────────────┘         └──────────────────┘
```

### 6.3 Agent roles

| Agent | Responsibility | Key inputs | Key outputs |
|---|---|---|---|
| **Conductor** | Owns the run. Decomposes platform into regions, manages the state frontier (BFS, prioritized by novelty/landmarks), enforces budgets and stop conditions, routes HITL requests. | Target config, Knowledge Store coverage | Work assignments, run lifecycle, stop decision |
| **Scout** | Navigates to assigned states, captures the accessibility tree + DOM snapshot, computes the **state signature**, enumerates interactive elements, proposes candidate transitions. Safe probes only. | State to visit | New states, elements, candidate edges |
| **Prober** | Performs controlled interactions to learn each element's **effect** via before/after state diffs. Honors risk classifier + HITL gate. | Element + current state | Observed effect, confirmed edge |
| **Cartographer** | Merges Scout/Prober observations into the canonical, deduplicated **UI Graph**; resolves when two paths reach the same state via signature matching. | Raw observations | Canonical UI Graph |
| **Workflow Synthesizer** | Composes candidate end-to-end workflows (e.g. "create invoice") as ordered paths over **existing verified edges**. Extracts parameters (form fields), preconditions, expected outcomes. | UI Graph, observed effects | Candidate workflows |
| **Verifier** | The grounding gate. Replays each candidate from a **fresh session/account**. Pass → mark verified; fail → quarantine with reason + feedback to Synthesizer. | Candidate workflow | Verified workflow OR quarantine record |
| **Documenter** | Converts verified workflows into the published recipe schema + human-readable docs. | Verified workflows | Recipes, docs |
| **Publisher / Curator** | Maintains Knowledge Store versioning, exposes the MCP interface, runs freshness/drift re-verification. | Verified knowledge | Served MCP responses |

All agents are stateless workers coordinating **only** through the Knowledge Store — no
hidden side channels. This keeps the system auditable and lets any agent's work be
independently re-derived from stored observations.

> **Packaging note.** These are *roles*, not separately-deployed services. They
> ship inside **one AgentBox container** and are billed as one hireable agent. For
> v1 the discovery roles run as a single reasoning loop plus deterministic tooling,
> with only the **Verifier** kept as an independent, fresh-context stage — the
> grounding seam (§9). Parallel Scouts/Probers are a P3 scale-out, invisible to
> callers. See [ARCHITECTURE.md](./ARCHITECTURE.md) §3 and §7.

---

## 7. Knowledge Representation (Data Model)

Three layers, persisted in the Knowledge Store.

### 7.1 UI Graph (the map)
- **State (node)** — a distinct application screen/condition.
  - `state_id`, `state_signature` (URL pattern + normalized DOM/a11y fingerprint + visible
    landmarks), `screenshot_ref`, `snapshot_ref`, `first_seen`, `last_verified`.
- **Element** — an interactive control within a state.
  - `element_id`, `role` (button/link/input/…), `label`/`accessible_name`,
    `selectors[]` (ranked: role+name → data-testid → stable CSS/XPath), `inferred_purpose`,
    `observed_effect`, `risk_class`, `provenance[]`.
- **Transition (edge)** — `from_state` → `action(element, params?)` → `to_state`,
  with `observation_count` and `last_verified`.

### 7.2 Capability Catalog
- **Atomic action** — a single observed action with its effect.
- **Workflow** — an ordered sequence of actions across states accomplishing a goal:
  `workflow_id`, `name`, `goal`, `preconditions`, `parameters[]` (form fields with
  type/required), `steps[]` (each = state + element + action + expected outcome),
  `outcome`, `status` (`candidate` | `verified` | `quarantined`), `confidence`.

### 7.3 Recipes (served artifact)
- A verified workflow rendered as a **parameterized, executable** procedure:
  ```
  recipe: "create_invoice"
  platform: "example"
  parameters: [customer:string(req), amount:number(req), due_date:date(opt)]
  steps:
    1. ensure_state "dashboard"
    2. click element{role:link,name:"Invoices"} -> state "invoices_list"
    3. click element{role:button,name:"New invoice"} -> state "invoice_form"
    4. fill {field:"Customer"} = {{customer}}
    5. fill {field:"Amount"} = {{amount}}
    6. click {role:button,name:"Save"} -> expect state "invoice_detail" w/ toast "Saved"
  provenance: [obs_ids...]   confidence: 0.98   last_verified: 2026-06-26T...
  ```

Every served artifact carries **provenance**, **confidence**, and **last_verified**.

---

## 8. Exploration & Learning Strategy

- **Frontier-based systematic crawl.** BFS over states from entry points; the Conductor
  prioritizes the frontier by novelty (unseen landmarks/element clusters) and importance
  (primary nav, prominent CTAs). This is what makes discovery *complete* rather than
  sampled (G2).
- **State deduplication.** The Cartographer collapses revisits via `state_signature`,
  preventing infinite loops and over-counting (e.g. paginated lists, modals).
- **Effect-driven element understanding.** Purpose is established by *interaction +
  before/after diff*, not by reading the label. A button labeled "Save" is only documented
  as saving once a save effect is observed.
- **Coverage tracking.** % of discovered elements probed; % of states with known outgoing
  transitions; dead-end / cycle detection; region coverage map.
- **Stop conditions.** Coverage threshold met, **novelty decay** (N consecutive states yield
  nothing new), budget exhausted (time/steps/tokens), or operator stop.
- **Grounding in the loop.** Discovery only *proposes*; nothing is trusted until the
  Verifier replays it (§9).

---

## 9. Anti-Hallucination / Verification Mechanism

This is the system's core differentiator and directly answers the requirement that LAP
"should definitely not get confused and create paths or task lists that don't exist."

1. **Two-phase separation.** *Discovery* (Scouts/Probers/Synthesizer) is allowed to be
   speculative and propose candidates. *Verification* is strict and independent.
2. **Independent clean-session replay.** The Verifier starts from a fresh browser
   session/sandbox account and executes the candidate workflow step by step. It does not
   reuse the discovery session's state.
3. **Outcome assertion.** Each step asserts the expected resulting state signature and
   outcome markers (toast, URL, new element). Any mismatch fails the workflow.
4. **Publish gate.** Only `verified` workflows reach the Documenter/Publisher. `candidate`
   and `quarantined` items are never served.
5. **Provenance + confidence.** Confidence is a function of replay successes / attempts and
   observation count. Published confidence floor is configurable (default: only ≥0.9).
6. **Feedback loop.** Quarantine reasons feed back to the Synthesizer (e.g. "missing
   precondition", "element not present in clean session") to refine candidates.
7. **No fabrication of names.** Capability/workflow names are derived from observed UI text
   and observed effects, not invented; if a goal can't be named from evidence, it's labeled
   by its concrete action sequence.

**Measured by:** published-recipe replay success rate (target ~100% at publish) and
hallucination rate (target 0) — see §13.

---

## 10. Safety & Guardrails

- **Sandbox-only mutations.** Write/mutating actions execute only against
  sandbox/test/disposable accounts supplied by the operator.
- **Action risk classifier:**
  - *Read* (navigate, hover, snapshot, open menu) → auto.
  - *Low-risk write* (search, filter, sort, open form without submit) → auto in sandbox.
  - *Irreversible / destructive* (delete, pay, send, publish, bulk ops, account changes)
    → **HITL gate**: queued for human approve / deny / skip.
- **Domain allowlist.** Agents may not navigate off the target platform's domain(s).
- **Rate limiting & politeness.** Configurable concurrency and request pacing to avoid
  hammering the target.
- **No real PII / secrets vaulting.** Test data only; credentials stored in a vault, never
  logged.
- **Full audit log.** Every action (and its risk decision) is recorded and replayable.
- **Respect boundaries.** No CAPTCHA solving, auth bypass, or evasion of bot defenses.

---

## 11. Output Interface (MCP / API)

A **knowledge query interface** — the *serve* surface of the AgentBox container,
exposed as HTTP routes (and optionally an MCP server for agent runtimes that prefer
it). Verbs / routes:

| Verb | Purpose |
|---|---|
| `list_platforms()` | All learned platforms + freshness summary. |
| `describe_platform(platform)` | High-level map: regions, key states, top capabilities. |
| `list_capabilities(platform)` | Full verified capability catalog. |
| `search_capabilities(platform, query)` | Semantic search → matching verified workflows. |
| `get_recipe(platform, capability)` | Parameterized, verified, executable step list. |
| `get_ui_map(platform, region?)` | UI Graph (states + transitions), optionally scoped. |
| `explain_element(platform, state, element)` | Purpose, effect, risk, provenance. |
| `report_failure(platform, recipe, details)` | Downstream agent reports a recipe that no longer works → triggers re-verification. |

**Response contract:** every response includes `provenance`, `confidence`, and
`last_verified`. Recipes are returned framework-agnostic (selectors + semantic element
descriptors), so any agent runtime can execute them.

---

## 12. Technical Substrate

- **Browser automation:** Playwright / CDP (Playwright MCP available in this environment).
- **Primary observation channel:** the **accessibility tree** (stable, semantic), with DOM
  snapshot + screenshot as secondary evidence. Reduces brittleness vs pixel-only.
- **Selector synthesis:** prefer role + accessible name, then `data-testid`, then a robust
  CSS/XPath fallback; store ranked alternatives for resilience.
- **Knowledge Store:** a persistent store for the graph + catalog + provenance + artifacts
  (concrete DB choice deferred to the implementation plan).
- **Agent runtime:** LLM agents for perception/decision; deterministic tooling for
  crawl bookkeeping, signature hashing, diffing, and replay assertions.
- **Inference:** GMI MaaS (OpenAI-compatible, 200+ models; `GMI_MAAS_BASE_URL` /
  `GMI_MAAS_API_KEY` / `GMI_MODELS` injected by AgentBox). Model tiering — cheaper for
  scouting, stronger for synthesis/verification — is a config choice.
- **Packaging / deployment:** one Docker image listed on GMI Cloud AgentBox (HTTP on
  port 8080; Playwright + Chromium bundled; Redis + an S3-compatible store hold durable
  state and provenance, since the container is stateless). See ARCHITECTURE.md §7.

---

## 13. Non-Functional Requirements & Success Metrics

| Dimension | Target |
|---|---|
| **Grounding fidelity** | Published-recipe clean-replay success ≈ 100% at publish time. |
| **Hallucination rate** | 0 published workflows/paths that don't actually exist. |
| **Coverage** | ≥ X% of reachable states and interactive elements mapped (per-platform target). |
| **Downstream usefulness** | Agent task-success rate using LAP recipes ≫ unaided baseline. |
| **Efficiency** | Bounded steps/tokens/time per verified workflow; reported per run. |
| **Generalization** | Runs on N diverse platforms with zero platform-specific code. |
| **Freshness** | Stale recipes detected and re-verified within a configurable window. |
| **Auditability** | 100% of published facts trace to stored observations. |

---

## 14. Milestones / Phasing

Even with "any web platform" as the end target, the loop is validated progressively.

- **P0 — Map (read-only).** Single pilot platform. Scout + Cartographer + Knowledge Store →
  UI Graph + element catalog, no mutations. Validates state dedup, signatures, selectors.
- **P1 — Learn (grounded loop).** Add Prober + Workflow Synthesizer + **Verifier** + HITL +
  sandbox actions on the pilot. Validates the anti-hallucination guarantee end-to-end.
- **P2 — Serve & ship.** Documenter + Publisher + the AgentBox listing's serve routes
  (+ optional MCP) + provenance/confidence/freshness, packaged as the single container.
  A downstream agent successfully executes a served recipe pulled from the listing.
- **P3 — Generalize & scale.** Hierarchical decomposition + parallel Scouts, robustness
  across diverse platforms, drift detection, and re-learning. Reach the "any platform" goal.

---

## 15. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **State explosion** on large platforms | Signature-based dedup, frontier prioritization, novelty-decay stop, region budgets. |
| **Brittle selectors / drift** | Accessibility-first observation, ranked selector alternatives, freshness re-verification, `report_failure` feedback. |
| **Destructive side effects** | Sandbox-only mutations, risk classifier, HITL gate, audit log. |
| **Hallucinated workflows** | Independent clean-replay verification gate; quarantine-don't-guess (§9). |
| **Dynamic/SPA & async UIs** | Wait-for-stable heuristics, network-idle + a11y-settle before snapshotting. |
| **Auth / session expiry mid-run** | Re-auth handling, session health checks, resumable frontier. |
| **Cost / runtime blowup** | Token/time/step budgets, parallelism caps, incremental persistence + resume. |

---

## 16. Open Questions

- **OQ1** — Knowledge Store backend (graph DB vs relational + JSON) — defer to impl plan.
- **OQ2** — Concrete coverage threshold per platform class; how to know "done enough".
- **OQ3** — Confidence scoring formula and the published confidence floor.
- **OQ4** — Re-verification cadence / drift-detection trigger policy.
- **OQ5** — Pilot platform selection for P0/P1.
- **OQ6** — How much cross-platform pattern transfer (e.g. shared "data table" priors) to
  allow without violating per-platform grounding.

---

## Appendix A — Approaches Considered

- **A. Linear pipeline** (explore → map → document, fixed stages). Simple and easy to
  reason about, but doesn't parallelize and scales poorly to large/"any" platforms.
- **B. Homogeneous blackboard swarm** (many identical explorers on a shared store). Excellent
  coverage and parallelism, but lacks a disciplined verification stage — weak on the
  grounding guarantee.
- **C. Hierarchical decompose + per-region pipeline + shared store + dedicated verifier**
  (**chosen**). Combines B's scale and parallelism with A's staged discipline, and adds an
  explicit verification gate that structurally enforces grounding. See §6.

## Appendix B — Glossary

- **State** — a distinct application screen/condition (UI Graph node).
- **State signature** — a stable fingerprint used to recognize/dedup states.
- **Transition / edge** — an observed action that moves between states.
- **Capability / workflow** — a goal-accomplishing sequence of actions.
- **Recipe** — a verified, parameterized, executable rendering of a workflow.
- **Grounding** — the guarantee that every published fact was observed and replayed.
- **HITL gate** — human-in-the-loop approval checkpoint for risky actions.
- **Provenance** — links from a published fact to the observations that produced it.
