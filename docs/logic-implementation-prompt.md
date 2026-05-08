# Logic Implementation Prompt

Use this prompt when asking a backend/product-logic engineering agent to
implement the CareerOS open-source local-first runtime.

```text
You are implementing the backend and product logic for CareerOS, an open-source
local-first job pipeline system. CareerOS is the reusable product. Other
Candidate is the hosted product built on CareerOS and published at careeroc.com.

Goal:
Turn the current public repo from a sanitized source-excerpt package into a
runnable local-first product. The first product should be a simple operational
dashboard backed by real local state: applications, deadlines, recruiter
updates, resume context, review items, notifications, import jobs, local model
status, and optional connector status.

This is backend/product logic work. Do not make a marketing site. Do not make
Gmail, Google sign-in, Vercel, Railway, Neon, or Ollama mandatory for first run.
The product must start, seed demo data, process deterministic local inputs, and
render useful dashboard state before any hosted provider or model is configured.

Read these docs first:
- README.md
- docs/local-first-product-plan.md
- docs/architecture.md
- docs/public-repo-scope.md
- docs/todo.md
- source/README.md

Product boundaries:
- CareerOS is open-source and local-first by default.
- Other Candidate is the hosted Gmail-connected product built on CareerOS.
- Keep private deployment assumptions out of the public base.
- Keep real Gmail data, real personal emails, provider dashboard URLs, secrets,
  database dumps, private account ids, and local machine paths out of code,
  fixtures, logs, docs, tests, and screenshots.
- Do not require cloud auth or provider accounts to use the local dashboard.
- Gmail is an optional connector, not the product foundation.
- Ollama/Gemma is optional, bounded, and never the only path.

Local-first runtime:
- Provide one clear local setup path, ideally docker compose, that starts the
  app, local API, and local database.
- Use a single local workspace user until a real public auth story exists.
- Prefer localhost defaults in `.env.example`.
- The app must run with all external integrations disabled.
- Seed demo data on first run or through an explicit local seed command.
- Support reset/export/delete controls for local development data.
- Model weights must not be downloaded automatically. Document copyable pull
  commands instead.
- Local processing should be manually triggerable and safe to re-run.

Core domain model:
- WorkspaceUser: local owner of all records.
- Application: durable job pipeline state.
- ApplicationEvent: append-only timeline events derived from imports, manual
  edits, connector sync, review decisions, and safe automation.
- EvidenceSnippet: bounded source evidence shown to the user.
- ReviewItem: uncertain or risky proposed mutation waiting for user decision.
- Reminder: deadline, follow-up, interview, assessment, and user-created action.
- Notification: derived in-app notification read model.
- ResumeDocument: local resume text/file metadata and extracted sections.
- ResumeEvaluation: deterministic and/or Gemma-backed resume analysis result.
- ModelProviderStatus: disabled, unavailable, reachable, model_missing,
  health_check_failed, ready.
- ModelTrace: bounded metadata about analysis decisions.
- ImportJob: local JSON/import/Gmail processing state, attempts, and errors.
- ConnectorAccount: optional connector configuration without making connector
  state required for local operation.

Data boundaries:
- Store source evidence separately from durable workflow state.
- Store only bounded snippets, hashes, source labels, confidence, timestamps,
  and trace metadata needed to explain a decision.
- Do not store full prompts, full model responses, raw Gmail bodies, or raw
  uploaded files unless the public product explicitly designs a safe local-only
  storage path for them.
- OAuth tokens may exist only after the optional Gmail connector is implemented,
  only in dedicated encrypted token storage, and never in general inbox/import
  tables.
- Notifications are derived from application state, reminders, review items,
  resume results, connector health, and model status. They are not a second
  source of truth.
- Low-confidence, invalid, contradictory, or risky automation creates a review
  item instead of mutating durable application state.

Pipeline to implement:
1. Ingest local seed data, local JSON imports, manual user entries, resume
   text/files, and optional connector batches into ImportJob records.
2. Normalize source records into bounded evidence snippets and draft events.
3. Run deterministic classification and extraction first.
4. If Ollama/Gemma is disabled or unavailable, keep deterministic results and
   create review items for ambiguity.
5. If model-backed processing is enabled and healthy, call the configured Gemma
   model only for bounded analysis tasks:
   - ambiguous recruiting intent
   - application update extraction
   - deadline/follow-up inference
   - recruiter reply detection
   - resume section extraction/evaluation
   - evidence summary for review
6. Validate model output against typed schemas and confidence thresholds.
7. Apply only high-confidence, low-risk mutations automatically.
8. Route risky or uncertain changes through ReviewItem before mutation.
9. Derive reminders and notifications from accepted pipeline state.
10. Record compact ModelTrace and ImportJob status for observability.

Review gate invariants:
- A model suggestion cannot silently overwrite company, role, stage, deadline,
  contact identity, interview status, offer/rejection status, or resume
  evaluation conclusions when confidence is low or evidence is weak.
- Review items must include the proposed change, evidence snippets, source
  label, confidence, reason, trace summary, and accept/dismiss/correct outcomes.
- Accepting a review item should create an application event and update durable
  state in one transaction.
- Dismissing a review item should preserve an audit/event trail without applying
  the proposed mutation.
- Correcting a review item should apply the user-corrected mutation and record
  that user correction as the trusted source.
- Review decisions must be idempotent.

Ollama/Gemma contract:
- Support an explicit disabled mode.
- Check whether `http://localhost:11434` or the configured Ollama base URL is
  reachable before any model-backed analysis.
- List installed models if Ollama exposes them.
- Make the Gemma model tag configurable.
- Show/report selected model missing clearly.
- Run a small health prompt before enabling model-backed processing.
- Enforce request timeouts and bounded retries.
- Validate model output with typed schemas. Invalid JSON/schema mismatch becomes
  a review item or deterministic fallback, not a crash.
- Store model provider, model tag, latency, status, confidence, fallback path,
  and short diagnostic labels. Do not store full prompts or raw responses.

Optional Gmail connector contract:
- The local product must work before this connector exists.
- Gmail setup must be explicit and user-controlled.
- Gmail sync must be skippable, disconnectable, and visibly optional.
- Connector import should write ImportJob state first, then bounded source
  evidence, then pipeline outputs.
- Sync should be idempotent across existing rows and duplicate records inside
  the same batch.
- Token storage, if implemented, must be encrypted and separated from general
  message metadata.
- Connector errors should create connector-health notifications and not block
  local dashboard use.

Notification logic:
- Implement in-app notifications before operating-system notifications.
- Derive notifications for:
  - recruiter reply detected
  - interview or assessment deadline approaching
  - follow-up reminder due
  - review item blocking automation
  - model disabled/unavailable/model missing/health failed
  - Gmail connector needs attention
  - resume analysis completed or blocked by review
- Each notification must link to the owning surface: application, review item,
  reminder, resume result, or settings.
- Notifications need stable identity/dedupe keys, severity/status, timestamp,
  read/dismiss state, and source type.
- Recomputing notifications should be deterministic and should not create
  duplicates.

API/service expectations:
- Add service boundaries for local imports, pipeline processing, review
  decisions, notification derivation, model provider status, resume processing,
  and optional connector sync.
- Keep application queries projection-based enough for dashboard use.
- Keep processing jobs retryable with attempt counts and clear failure reasons.
- Avoid provider-specific names in core interfaces. Keep Gmail behind a
  connector adapter.
- Keep deterministic logic testable without network, Ollama, Gmail, or a cloud
  database.

First implementation milestone:
1. Make the repo runnable locally with one setup path.
2. Add local persistence for a single local workspace user.
3. Add seeded demo data for first-run exploration.
4. Add local import primitives for applications, events, evidence snippets, and
   resume text/files.
5. Implement application, event, evidence, reminder, review, notification,
   model-status, model-trace, resume, and import-job records.
6. Implement deterministic processing that works with Ollama disabled.
7. Add Ollama/Gemma provider status and health checks without requiring model
   setup for first run.
8. Add manual run/re-run processing controls.
9. Keep risky automation behind review gates.
10. Update README/docs whenever setup, routes, env, data, or behavior changes.

Testing requirements:
- Deterministic parser/evaluator works with model disabled.
- App starts and dashboard data loads with Ollama disabled.
- Ollama unavailable reports a clear status and does not crash processing.
- Selected Gemma model missing reports a clear status.
- Invalid model output falls back or creates ReviewItem.
- Review-gated mutation does not change durable application state before accept.
- Accept/dismiss/correct review decisions are transactional and idempotent.
- Notifications derive from reminders, review blocks, recruiter replies, resume
  results, connector health, and model status without duplicates.
- Seeded demo data loads predictably.
- Local JSON/import paths create ImportJob state and evidence snippets.
- Gmail connector, if implemented, is optional, idempotent, disconnectable, and
  does not block local-only operation.
- Resume upload/paste works with deterministic fallback and model-unavailable
  states.
- Public safety scan passes.

Validation commands:
- Run the public safety scan.
- Run available backend/unit tests.
- Run available build/type/lint checks.
- Start the local app and verify dashboard, applications, review, resume,
  notifications, and settings render with Ollama disabled.
- Verify Ollama-enabled mode reports missing server/model clearly instead of
  crashing.

Deliverables:
- runnable local setup instructions
- implementation code
- focused tests for the requirements above
- updated README/docs when behavior changes
- no commit, push, or PR unless explicitly requested
```
