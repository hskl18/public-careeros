# API Spec

Base URL: `http://localhost:3000` (or `http://127.0.0.1:3000`).

The public CareerOS API is implemented with Next.js route handlers — a
private-workspace API surface for the provider-free product, not the hosted
Other Candidate API.

| Method | Path                                                                | Purpose                                                                 |
| ------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| GET    | [`/api/pipeline`](#get-apipipeline)                                 | Judge-facing multi-agent pipeline snapshot                              |
| GET    | [`/api/providers`](#get-apiproviders)                               | Provider-adapter registry (implementation status + trust + unlock gate) |
| GET    | [`/api/local-data/export`](#get-apilocal-dataexport)                | Export normalized local state JSON                                      |
| POST   | [`/api/local-data/import`](#post-apilocal-dataimport)               | Strictly import a normalized CareerOS workspace export                  |
| POST   | [`/api/import`](#post-apiimport)                                    | Import recruiting records                                               |
| GET    | [`/api/review`](#get-apireview)                                     | Query review queue filters and sorting                                  |
| POST   | [`/api/review/{id}`](#post-apireviewid)                             | Apply a review decision                                                 |
| GET    | [`/api/reminders`](#get-apireminders)                               | Query open reminders, history, and application timeline                 |
| POST   | [`/api/reminders/{id}`](#post-apiremindersid)                       | Mark reminder done/dismissed                                            |
| GET    | [`/api/evidence`](#get-apievidence)                                 | Evidence relationship groups                                            |
| GET    | Local metrics endpoint                                              | Local effort metrics                                                    |
| POST   | [`/api/resume`](#post-apiresume)                                    | Save / analyze resume text                                              |
| GET    | [`/api/model-status`](#get-apimodel-status)                         | Ollama Cloud/Gemma runtime status                                       |
| POST   | [`/api/model-status`](#post-apimodel-status)                        | Save Ollama Cloud setup, optionally check                               |
| GET    | [`/api/connectors`](#get-apiconnectors)                             | Connector account status                                                |
| POST   | [`/api/connectors/gmail/{action}`](#post-apiconnectorsgmailaction)  | Gmail OAuth/sync action                                                 |
| GET    | [`/api/connectors/gmail/callback`](#get-apiconnectorsgmailcallback) | Gmail OAuth callback redirect                                           |
| POST   | [`/api/notifications/{id}`](#post-apinotificationsid)               | Mark notification read/dismissed                                        |
| POST   | [`/api/local-data/delete`](#post-apilocal-datadelete)               | Delete default local data after confirmation                            |
| GET    | [`/api/debug/state`](#get-apidebugstate)                            | Development-only full local state snapshot                              |

## `GET /api/debug/state`

Returns the full local CareerOS state snapshot for development debugging only.
The public `/api/state` route was removed so full workspace dumps are not
available by default.

### Behavior

- Returns `404` unless `NODE_ENV !== "production"` and
  `CAREEROS_DEBUG_STATE_ENABLED=true`.
- Reads from the configured state repository.
- Creates an empty workspace on first access when no local state exists.
- Uses JSON file persistence by default. Local development stores
  `.careeros-data/state.json`; Vercel stores ephemeral
  `/tmp/.careeros-data/state.json` unless `CAREEROS_DATA_DIR` is configured.
- Sends `cache-control: no-store` when enabled.

## `GET /api/pipeline`

Returns the judge-facing multi-agent mailbox pipeline snapshot.

### Behavior

- Exposes either the first synced mailbox thread or a sanitized sample thread
  for judge/demo inspection without writing fake data to workspace state.
- Shows the mailbox triage, workflow extraction, evidence/review,
  resume/context, reminder/notification, and model-router layers.
- Includes extracted proposal, bounded evidence snippets, source message ids,
  review gate state, notification output, and model/provider status.
- Includes `constraints` from `lib/agent-constraints.ts`: SDK-inspired handoff,
  guardrail, prompt, trace, and review-gate boundaries for each public agent.
- The judge-facing proposal should demonstrate the fields that make the product
  more useful than a spreadsheet: source, JD link, resume version, recruiter
  contact, deadline, next action, confidence, and evidence.
- Represents Ollama Cloud/Gemma as the primary implemented model path.
- Represents OpenAI, Anthropic, OpenRouter, other advanced LLM runtimes, and MLX
  only as BYOK/local roadmap adapter surfaces unless implemented and verified.
- Works with zero provider credentials and no model install.

## `GET /api/providers`

Returns the static provider-adapter registry — every model path CareerOS
knows about plus its implementation status, trust boundary, and unlock gate.

### Response shape

```json
{
  "adapters": [
    {
      "id": "ollama",
      "label": "Gemma via Ollama Cloud",
      "kind": "cloud-api",
      "implementation": "implemented",
      "trust": "byok-credentials",
      "summary": "...",
      "helpCommand": "OLLAMA_API_KEY=..."
    },
    {
      "id": "openai",
      "label": "OpenAI",
      "kind": "hosted-byok",
      "implementation": "roadmap",
      "trust": "byok-credentials",
      "summary": "...",
      "unlockGate": "Blocked on encrypted local credential storage + redaction rules."
    }
  ],
  "note": "Implementation status is metadata only. Roadmap adapters do not run model code from CareerOS."
}
```

### Behavior

- Returns the same adapter list as `lib/providers/index.ts`. The agent
  pipeline snapshot at `/api/pipeline` and the `/judge-demo` provider grid
  read from the same source, so the three surfaces never disagree on which
  paths are shipped.
- `implementation: "implemented"` only applies to `deterministic` and
  `ollama` in the public RC.
- `trust: "byok-credentials"` adapters are blocked until encrypted local
  credential storage exists; `trust: "local-credentials"` roadmap adapters
  are blocked on a stable local-process boundary + schema validation.
- See [`docs/roadmap.md`](roadmap.md) for the compact provider roadmap and
  promotion rules.

## `POST /api/import`

Imports one or more local recruiting records.

### JSON request

```json
{
  "records": [
    {
      "company": "Example Systems",
      "role": "Software Engineer",
      "sourceLabel": "local-json:record-1",
      "text": "Recruiter replied and asked for interview availability.",
      "receivedAt": "2026-05-08T12:00:00.000Z",
      "jobDescriptionUrl": "https://jobs.example.com/software-engineer",
      "resumeVersion": "resume-v3",
      "coverLetterVersion": "cover-letter-v2",
      "applicationSource": "LinkedIn",
      "recruiterContactName": "Jamie Chen",
      "recruiterContactEmail": "jamie@example.com",
      "location": "Remote US",
      "salaryRange": "$120,000-$150,000",
      "notes": "Use backend-focused resume."
    }
  ]
}
```

All enrichment fields are optional. CareerOS stores bounded evidence, source
message ids, and source relationships, not raw inbox bodies.

### Form fields

- `company`
- `role`
- `sourceLabel`
- `text`
- Optional enrichment: `jobDescriptionUrl`, `resumeVersion`,
  `coverLetterVersion`, `applicationSource`, `recruiterContactName`,
  `recruiterContactEmail`, `location`, `salaryRange`, and `notes`

### Behavior

- Rejects empty or incomplete records with `400`.
- Rejects request bodies over 250 KB, more than 20 records, source labels over
  160 characters, text snippets over 4,000 characters, and unbounded optional
  enrichment fields.
- Runs deterministic local import processing.
- If Ollama/Gemma is enabled and ready, asks the configured model for a bounded
  suggestion.
- Queues model-backed, risky, ambiguous, or invalid output for review instead of
  silently mutating application state.
- Uses ranked workflow transitions: non-terminal stages do not move an
  application backward, while offer and rejection signals are treated as
  high-impact review-gated terminal updates.
- Creates deduped local reminders for recruiter replies, assessments,
  interviews, deadlines, and follow-ups only after a mutation is accepted or
  safely applied.
- Suppresses stale follow-up reminders when a recruiter reply, OA, interview,
  rejection, offer, or other later-stage signal moves the pipeline forward.
- JSON requests return recent import job and review state.
- Form requests redirect to `/applications`.

## `GET /api/local-data/export`

Exports the current normalized local CareerOS state as JSON.

### Behavior

- Reads through the same state repository as the app.
- Returns `application/json` with `Content-Disposition:
attachment; filename="careeros-local-state.json"`.
- Does not include raw Gmail bodies, OAuth tokens, full prompts, or provider
  credentials. Gmail OAuth tokens live in `.careeros-data/gmail-oauth.json`,
  outside the exported workspace state.
- Includes `schemaVersion` for strict local round-trips and future migration
  checks.
- Intended for local inspection, backup, and strict local workspace import.

## `POST /api/local-data/import`

Replaces the local workspace with a validated CareerOS JSON export. This is a
workspace import, separate from `/api/import` recruiting-record ingestion.

### Request

JSON API clients can send:

```json
{
  "confirm": "IMPORT LOCAL DATA",
  "state": {
    "schemaVersion": 1
  }
}
```

The settings UI sends `multipart/form-data` with a JSON `file` and the same
confirmation phrase.

### Behavior

- Requires `IMPORT LOCAL DATA` before replacing the workspace.
- Accepts only the normalized CareerOS state/export shape.
- Validates the entire schema before writing anything.
- Rejects unknown future schema versions.
- Rejects raw inbox bodies, OAuth/token/provider-key fields, full prompts, raw
  model responses, secret-looking values, non-public provider hostnames, data
  dumps, and local absolute paths.
- Writes only through the configured local state repository; it cannot choose a
  path or write outside `.careeros-data`.
- Adds a local `json` import job after success.
- Returns generic validation errors so rejected non-public content is not echoed.

## `GET /api/review`

Returns a filtered review queue read model.

### Query parameters

- `status`: `open`, `accepted`, `dismissed`, `corrected`, or `all`
- `minConfidence` / `maxConfidence`: numeric confidence bounds
- `source`: source-label substring match
- `provider`: `model` or `deterministic`
- `modelBacked`: `true` or `false` alias for provider filtering
- `company`: company substring match
- `applicationId`: exact application id
- `sort`: `newest`, `oldest`, `confidence_high`, or `confidence_low`

### Behavior

- Defaults to open review items sorted newest first.
- Includes compact application context, evidence count, and whether the item is
  model-backed.
- Does not mutate state. Review decisions remain handled by
  `POST /api/review/{id}` and remain idempotent.

## `POST /api/review/{id}`

Applies a review decision.

### Form fields

- `intent`: one of `accept`, `dismiss`, or `correct`
- `deadlineAt`: optional ISO timestamp for `correct`
- `eventSummary`: optional corrected summary for `correct`

### Behavior

- `accept` applies the proposed mutation idempotently.
- `dismiss` records the decision without mutating application state.
- `correct` applies a user-corrected mutation with user confidence.
- Accepted and corrected mutations reuse the same workflow rules as import
  processing, including stage ranking, application creation when safe, event
  writing, and reminder derivation.
- Redirects to `/review`.

## `GET /api/reminders`

Returns open reminders, completed/dismissed reminder history, and an optional
application timeline.

### Query parameters

- `applicationId`: optional exact application id
- `status`: `done`, `dismissed`, or `all` for history filtering

### Behavior

- Keeps completed and dismissed reminders queryable instead of deleting them.
- History entries include compact application context and the local decision
  event when one exists.
- When `applicationId` is supplied, the response includes a timeline combining
  application events and reminders, including completed/dismissed reminders.

## `POST /api/reminders/{id}`

Marks a pending reminder as completed or dismissed.

### JSON request

```json
{
  "status": "done"
}
```

Supported values are `done`, `dismiss`, and `dismissed`.

### Behavior

- Ignores already-decided reminders idempotently.
- Writes a local workflow event for completed or dismissed reminders.
- Redirects to `/` for form requests and returns the updated reminder for JSON
  requests.

## `GET /api/evidence`

Returns bounded evidence relationship groups for thread-level and
application-level evidence views.

### Behavior

- Groups evidence snippets by mailbox thread, application, company, role,
  recruiter, source label, and resume version.
- Includes snippet ids, source message ids, application ids, labels, confidence,
  hashes, and bounded snippets.
- Does not expose raw Gmail bodies, full prompts, or full model responses.

## Local Metrics Endpoint

Returns local product metrics derived from applications and append-only events.

### Behavior

- Counts applications, unique companies, unique roles, reply rate, interview
  rate, offer rate, weekly application count, follow-up load,
  review-blocked count, waiting/ghosted counts, completed/dismissed reminder
  counts, and average time to first response.
- Derives company, role, and user-facing status bucket breakdowns from local
  state only.
- Includes weekly deterministic trend buckets for application volume, replies,
  interviews, offers, rates, review-blocked count, waiting/ghosted count, and
  average time to first response.
- Weekly replies count each application's first real response signal, including
  recruiter replies, OA/interview signals, rejection, or offer. Pure
  application-created/application-received events are not counted as replies.
- Includes a compact local audit summary (`audit.total` and recent audit
  events) for import/review/reminder/Gmail lifecycle observability. Audit
  events are bounded metadata, not raw mailbox/model/provider payloads.
- Bucket names are intended for scanning and analytics; they should not replace
  the canonical application-stage and review-gate logic.
- Does not require hosted analytics, external databases, or inbox providers.

## `POST /api/resume`

Saves or analyzes pasted resume text.

### Form fields

- `intent`: `save` or `analyze`
- `title`
- `text`

### Behavior

- Requires at least 20 characters of resume text.
- Rejects form bodies over 80 KB and resume text over 6,000 characters.
- `save` stores a local resume draft without analysis.
- `analyze` always stores a deterministic resume baseline first.
- When the saved Ollama Cloud/Gemma runtime is enabled and ready, `analyze`
  sends a bounded resume excerpt to Ollama Cloud from the server.
- Model-backed resume output must be strict JSON and pass schema validation.
  Valid high-confidence output is stored as a Gemma-backed resume evaluation.
- Invalid, risky, or low-confidence model output is stored as
  `blocked_by_review` while the deterministic baseline remains visible.
- Stores compact model trace metadata only: provider, model tag, status,
  latency, confidence, diagnostic, and fallback path. It does not store full
  prompts or raw model responses.
- Redirects to `/resume`.

## `GET /api/model-status`

Returns the configured Ollama Cloud/Gemma runtime status.

### Response statuses

- `disabled`
- `unavailable`
- `model_missing`
- `health_check_failed`
- `ready`

### Behavior

- Does not touch the network when Ollama Cloud is disabled.
- Checks `https://ollama.com/api` when enabled.
- Refuses non-Ollama Cloud model endpoints before any network call.
- Requires `OLLAMA_API_KEY` from server env when enabled.
- Verifies that the configured Gemma model tag is available to the account.
- Runs a small bounded health prompt before reporting `ready`.
- Every diagnostic includes a concrete next step and never triggers an automatic
  model download.

## `POST /api/model-status`

Saves Ollama Cloud/Gemma setup and optionally checks model status.

### Form fields

- `enabled`: `on` to enable Ollama Cloud checks, otherwise deterministic mode
  stays active.
- `endpoint`: Ollama Cloud base URL, defaults to `https://ollama.com`.
  Non-Ollama Cloud URLs are rejected.
- `modelTag`: Gemma model tag, defaults to `gemma4:31b`.
- `intent`: `save` or `check`.

### Behavior

- `save` stores the model setup without touching the network.
- `check` stores the model setup, checks Ollama Cloud, verifies the configured
  model tag, runs the bounded health prompt, and stores a model trace.
- Writes bounded diagnostics only when checking.
- Does not store full prompts, raw source bodies, or credentials.
- Redirects to `/settings`.

## `GET /api/connectors`

Returns optional connector account status.

### Behavior

- Gmail is disabled by default.
- Local console, import, resume, review, and notification workflows are
  unaffected when Gmail is disabled or not configured.
- Also returns `gmailOAuth`, a secret-free setup diagnostic with the exact
  callback URL to paste into Google OAuth Authorized redirect URIs, current app
  origin, callback origin, and whether those origins match.

## `POST /api/connectors/gmail/{action}`

Runs a Gmail connector action for the local readonly demo.

### Actions

- `connect`
- `disconnect`
- `sync`

### Behavior

- `connect` redirects to Google OAuth when local Gmail env values are present
  and the local callback origin matches the current app origin.
- `connect` returns `needs_attention` instead of redirecting to Google when the
  local callback URL is malformed or points at another local origin/port.
- `disconnect` removes the local `.careeros-data/gmail-oauth.json` token file.
- `sync` fetches recent Gmail readonly message metadata/snippets matching the
  recruiting query, stores bounded snippets, and sends them through the local
  import/model/review pipeline.
- `sync` paginates within a small local bound, de-duplicates already imported
  Gmail source labels, merges new messages into existing local threads, and
  records a local audit event plus a Gmail-sourced import job.
- `sync` does not request or persist full Gmail message bodies.
- Returns JSON when the request accepts `application/json`; otherwise redirects
  to `/settings`.

## `GET /api/connectors/gmail/callback`

Handles the local Gmail OAuth redirect for the optional readonly connector.

### Behavior

- Validates the local OAuth `state` value before exchanging the authorization
  code.
- Exchanges the code server-side only when Gmail env values are configured.
- Stores the resulting token as a local AES-GCM envelope at
  `.careeros-data/gmail-oauth.json`.
- Redirects to `/settings?section=gmail` with sanitized statuses:
  `connected`, `oauth_denied`, `oauth_state_invalid`, `missing_code`, or
  `exchange_failed`.
- Does not echo provider raw errors, OAuth tokens, or Google response bodies.

## `POST /api/notifications/{id}`

Marks a notification as read or dismissed.

### Form fields

- `intent`: `read` or `dismiss`

### Behavior

- Updates local notification status.
- Redirects to `/notifications`.

## `POST /api/local-data/delete`

Deletes the local workspace data directory after explicit confirmation.

### Request

Form or JSON must provide:

```json
{
  "confirm": "DELETE LOCAL DATA"
}
```

### Behavior

- Only runs when the configured data directory is named `.careeros-data`.
- Refuses custom non-workspace data paths with `409`.
- Deletes the local data directory, recreates the state repository, and creates
  an empty workspace on the next read.
- Does not touch files outside the `.careeros-data` directory.

## API Boundaries

- First-run endpoints do not require hosted auth.
- Gmail sync actions require local Google OAuth configuration and a local token
  file.
- Ollama Cloud model-backed actions require `OLLAMA_API_KEY` in server env when
  enabled.
- No endpoint downloads model weights.
- Model output is schema-validated and review-gated.
- State-changing endpoints reject cross-origin browser requests. CLI and test
  requests without an `Origin` header continue to work for local development.
- Local database files are user data and must remain outside git.
