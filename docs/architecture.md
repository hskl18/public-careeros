# Architecture

Last updated: 2026-05-12

For positioning and surface area, see [design.md](design.md). This doc is the
**runtime, agent layers, and data boundaries**.

## Runtime

```text
Browser
  ↓
Next.js agentic pipeline console (App Router)
  ↓
Next.js route-handler API  ←─── lib/store.ts (single mutation entry point)
  ↓                              │
local JSON state store           ├─ lib/pipeline.ts        (deterministic ingest)
   │                             ├─ lib/review.ts          (review-gated mutations)
   │                             ├─ lib/review-queries.ts  (review queue filters)
   │                             ├─ lib/notifications.ts   (derived read model)
   │                             ├─ lib/reminder-queries.ts (history/timeline)
   │                             ├─ lib/evidence-queries.ts (evidence groups)
   │                             ├─ lib/workspace-import.ts (strict JSON import)
   │                             ├─ lib/agent-pipeline.ts  (judge demo snapshot)
   ▼                             ├─ lib/model-analysis.ts  (optional Gemma import path)
                                 ├─ lib/resume-model-analysis.ts (optional Gemma resume path)
                                 └─ lib/providers/index.ts (provider registry)
.careeros-data/state.json
                                 ↑
                                 ├─ optional Gmail readonly connector
                                 └─ optional Ollama Cloud / Gemma endpoint
```

Persistence: the `StateRepository` interface in `lib/persistence.ts` uses
`JsonFileStateRepository` by default and `MemoryStateRepository` in tests. Data
lives under `CAREEROS_DATA_DIR` (default `.careeros-data/`). The same boundary
makes a future database adapter straightforward without using experimental
Node SQLite APIs in the public demo.

## Core product loop

1. User opens the local CareerOS pipeline console.
2. Readonly Gmail sync or strict local import provides recruiting evidence. The
   sanitized judge/demo sample is separate from workspace state.
3. **Mailbox triage agent** classifies relevance, urgency, company, role, and
   required action with deterministic local rules.
4. **Workflow extraction agent** converts mailbox events into typed
   application-update proposals.
5. **Evidence/review agent** attaches bounded evidence and blocks risky or
   model-backed mutations behind review.
6. **Resume/context agent** keeps local candidate context available.
7. **Reminder/notification agent** derives read models from reviewed state.
8. If Ollama Cloud is enabled with `OLLAMA_API_KEY` and passes a bounded
   health prompt, Gemma-backed analysis can summarize import updates into
   typed suggestions and enrich resume evaluation.
9. High-confidence, low-risk deterministic updates become application
   activity.
10. Risky, low-confidence, invalid, or model-backed updates enter the manual
    review queue before mutation.
11. The console shows pipeline state, agent handoffs, agent contracts, applications, reminders,
    notifications, recent changes, model traces, and resume intelligence.

## Agent layers

| Layer | Responsibility |
| --- | --- |
| Mailbox triage | Recruiting relevance, urgency, company, role, required action |
| Workflow extraction | Mailbox events → typed application-update proposals |
| Evidence / review | Bounded source snippets and confidence on every risky/model mutation |
| Resume / context | Local candidate context for triage and next-action suggestions |
| Reminder / notification | Due dates, follow-ups, recruiter replies, blocked-automation alerts |
| Model router / provider | Prefers Gemma via Ollama Cloud; falls back to deterministic |

## CareerOS alignment

The full private CareerOS / Other Candidate system has more specialist
"agent soul" documents. The public repo stays lightweight by folding those
specialists into six visible local layers instead of shipping a larger service
mesh.

| Full CareerOS family | Full agents | Public demo layer |
| --- | --- | --- |
| Mailbox agents | Inbox Triage, Workflow Extraction, Recruiter Identity, Scam Checker, Review Evidence, Follow-Up Task, Entity Hygiene | Mailbox triage, workflow extraction, evidence/review, reminder/notification |
| Resume agents | Resume Extraction, Resume Evaluation | Resume/context |
| Career orchestration agents | Career Orchestrator, User Memory Steward, Guidance Maintenance | Visible pipeline state, model router, local candidate context |

Deliberate public-demo choices:

- Recruiter identity is represented by contact fields and bounded source
  relationships, not a separate autonomous service.
- Scam checking is represented by review-blocked risky evidence. Suspicious
  messages must not create application updates or reminders automatically.
- Entity hygiene is represented by extraction guards, `Unknown Company` /
  `Unknown Role` behavior, and review-only correction.
- Follow-up task logic is deterministic notification/reminder derivation.
- User memory is local candidate context, not hidden autobiography. User note
  text is untrusted evidence and must not become executable instruction.
- The Career Orchestrator is visible as pipeline state and ranked action
  surfaces. This public repo does not ship a hidden general agent that can
  mutate applications, resume facts, memory, or guidance.
- Guidance maintenance remains out of scope for the public demo because
  self-editing agent guidance requires an evaluation gate.

## Agent operating contract

The public repo should preserve CareerOS as a multi-agent mailbox pipeline. A
new route or feature is allowed only if it keeps these contracts intact.

| Agent | Prompting/input boundary | Memory/state boundary | Can do | Cannot do |
| --- | --- | --- | --- | --- |
| Mailbox triage | Reads subject, bounded snippets, source labels, and local candidate context | Writes compact `AgentRun` traces and downstream proposals only | Detect recruiting relevance, urgency, company, role, and required action | Store full mailbox bodies, call hosted providers, or mutate applications |
| Workflow extraction | Reads bounded triage output and bounded snippets | Emits typed `ProposedMutation` shape through deterministic import or model suggestion | Propose stage, deadline, follow-up, contact, and event summary | Apply model-backed proposals directly or invent unsupported fields |
| Evidence/review | Reads proposal, confidence, source message ids, and bounded evidence snippets | Writes `EvidenceSnippet` and `ReviewItem`; accepted/corrected reviews mutate through `lib/review.ts` | Block low-confidence, risky, invalid, or model-backed changes | Hide blocked changes or bypass the manual review gate |
| Resume/context | Reads local resume text, target roles, skills, preferences, and resume keywords | Writes local `ResumeDocument` and `ResumeEvaluation` records | Provide candidate context and Gemma-backed resume feedback when enabled | Send resume text to hosted providers in this public demo |
| Reminder/notification | Reads reviewed applications, reminders, reviews, connector health, model status, and resume results | Derives `Notification` records with stable dedupe keys | Surface due dates, follow-ups, review blocks, connector/model health | Become canonical workflow state or keep stale reminders after later-stage signals |
| Model router/provider | Reads explicit runtime settings, env key availability, and cloud readiness before model calls | Writes `ModelTrace` with provider, model tag, task, latency, confidence, fallback, and bounded diagnostic | Route to deterministic fallback or Gemma via Ollama Cloud | Store API keys in workspace state, require API keys for first run, store raw prompts/responses, or claim roadmap adapters are implemented |

Prompt rules:

- Gemma prompts must use bounded text and ask for strict JSON output.
- The public import-analysis prompt is limited to career workflow fields:
  confidence, summary, reason, stage, deadline, follow-up, and contact.
- Temperature stays deterministic for extraction-style tasks.
- Model output must pass schema validation before it becomes a review item.
- Model output never directly mutates `Application`, `Reminder`, or
  `CandidateContext`.

Memory rules:

- Local agent memory is the normalized CareerOS state under `.careeros-data`.
- Long-term state is applications, mailbox thread metadata, bounded evidence,
  review items, candidate context, reminders, resume evaluations, model traces,
  connector account state, and agent runs.
- Raw Gmail bodies, OAuth tokens, provider keys, raw model responses, full
  prompts, private paths, and local exports are not agent memory.
- Workspace import/export must keep the same boundary and reject token-like or
  raw-body fields before writing state.

Cost and runtime rules:

- First run has zero model/API cost and starts clean. Users connect Gmail to
  process real recruiting mail; `/judge-demo` carries the credential-free sample
  story.
- Ollama/Gemma is optional and user-managed through `OLLAMA_API_KEY`; CareerOS
  only connects to `https://ollama.com/api` from server-side route handlers.
- Model requests use short timeouts and bounded output. Latency is recorded in
  `ModelTrace`; raw prompts, raw responses, and API keys are never stored.
- OpenAI, Anthropic, OpenRouter, MLX, llama.cpp, LiteRT, vLLM, SGLang, and MTP
  drafters remain roadmap adapters until they have real code, credential or
  runtime boundaries, tests, and smoke evidence.

## Model provider boundary

Gemma via Ollama Cloud is the **only implemented** model path. Provider claims
must stay accurate — don't list adapters as shipped until they have code and tests.
The static registry in [`lib/providers/index.ts`](../lib/providers/index.ts)
is the single source of truth; it drives `/api/providers`,
`/judge-demo`, and the agent-pipeline `model_router` snapshot.

| Status | Provider |
| --- | --- |
| Implemented | Deterministic processing; status-gated Ollama Cloud/Gemma |
| Planned (BYOK adapter surface) | OpenAI, Anthropic, OpenRouter |
| Planned (local adapter surface) | MLX (Apple Silicon), llama.cpp, LiteRT, vLLM, SGLang |
| Planned (performance) | Gemma 4 MTP drafters for lower-latency local inference |

Per-adapter integration notes, unlock gates, and the contract for promoting
an adapter from `roadmap` to `implemented` live in
[provider-research.md](provider-research.md).

Required invariants:

- No provider key, Gmail account, or model download is required for first-run
  value.
- Model output is schema-validated and review-gated before mutation.
- Roadmap adapters do not run model code from CareerOS.

## Data boundaries

| Type | Stores |
| --- | --- |
| `Application` | Durable workflow state + JD link, resume version, cover-letter version, source, recruiter, salary/location, notes |
| `MailboxThread`, `MailboxMessage` | Gmail/local bounded mailbox evidence |
| `CandidateContext` | Local target roles, skills, preferences, resume keywords |
| `AgentRun` | Compact agent-layer trace metadata |
| `ApplicationEvent` | Append-only decisions and pipeline activity |
| `ImportJob` | Local import processing state, attempts, errors |
| `EvidenceSnippet` | Bounded snippets, hashes, source labels, confidence, source-message ids, source relationships |
| `ReviewItem` | Risky/low-confidence proposed mutations until accepted, dismissed, or corrected |
| `ResumeEvaluation` | Deterministic or Gemma-backed resume feedback, with blocked status for invalid / low-confidence model output |
| `ModelTrace` | Provider/model metadata + bounded diagnostics — **never** raw prompts or full source bodies |

Workspace export/import uses `schemaVersion: 1`. Import validates the full
normalized state before writing through the repository, rejects unknown future
versions, private paths, OAuth/token/provider-key fields, raw model output,
raw inbox bodies, and secret-looking values, and does not echo rejected
non-public content back to the UI.

Notifications are **derived** from applications, reminders, review items,
model status, and connector health — they're rebuilt every write. Stale
follow-up reminders are suppressed when an application receives a later-stage
reply / OA / interview / rejection / offer signal.

Completed and dismissed reminders remain in local state with `decidedAt`
metadata and decision events. Query helpers expose reminder history and
application timelines without turning reminders into a second source of truth.

Evidence remains bounded and relationship-oriented: helper queries group
snippets by mailbox thread, application, company, role, recruiter, source
label, and resume version for frontend thread-level evidence views.

Readonly Gmail OAuth is part of the local demo path. Tokens live outside the
workspace export under `.careeros-data/gmail-oauth.json`; encrypted credential
storage is still required before expanding scopes, adding hosted BYOK providers,
or treating the connector as production credential infrastructure.

## Future Load-Control Decisions

The current public base is single-workspace and private-workspace first, so it does not
ship the hosted queue runtime. These are the constraints to preserve when real
Gmail sync, provider adapters, or hosted deployments are added:

- Sync should be active-user-aware, not a global poll.
- Per-user sync and processing need bounded concurrency.
- Any queue runtime should use leases, max attempts, stale-lock recovery, and
  dead-letter metadata.
- Pipeline-console queries should use projections and SQL aggregates where
  possible.
- Frontend polling should use self-scheduling timers and in-flight request
  dedupe.

## Implemented local services

| File | Purpose |
| --- | --- |
| `lib/store.ts` | Local state read/update/reset with clean first-run state; the only mutation entry point |
| `lib/persistence.ts` | Repository interface + JSON-file and in-memory adapters |
| `lib/pipeline.ts` | Deterministic local import and resume processing |
| `lib/review.ts` | Idempotent accept / dismiss / correct review decisions |
| `lib/review-queries.ts` | Review queue filters by status, confidence, source, provider, company/application, and sort order |
| `lib/reminder-queries.ts` | Open reminder queries, completed/dismissed history, and application timelines |
| `lib/evidence-queries.ts` | Evidence relationship read models grouped by thread, application, company, role, recruiter, source label, and resume version |
| `lib/workspace-import.ts` | Strict normalized workspace JSON import validation and success import-job metadata |
| `lib/notifications.ts` | Deterministic notification derivation with stable dedupe keys |
| `lib/agent-pipeline.ts` | Judge-facing multi-agent mailbox pipeline snapshot |
| `lib/agent-contracts.ts` | Product-facing agent prompting, memory, cost, can/cannot-do contracts |
| `lib/connectors.ts` | Optional Gmail connector state and local action orchestration |
| `lib/gmail-local.ts` | Local readonly Gmail OAuth, token-file boundary, bounded sync-to-import conversion |
| `lib/model-analysis.ts` | Bounded Ollama import analysis with schema validation and review-only output |
| `lib/resume-model-analysis.ts` | Bounded Ollama resume analysis with strict JSON validation and blocked fallback |
| `lib/model-status.ts` | Explicit Ollama disabled / unavailable / model-missing / ready status checks |
