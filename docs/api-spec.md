# API Spec

Last updated: 2026-05-08

Base URL for the local public app is `http://localhost:3000` or
`http://127.0.0.1:3000`.

The public CareerOS API is implemented with Next.js route handlers. It is a
local-first API surface for the provider-free product, not the hosted Other
Candidate API.

## `GET /api/state`

Returns the full local CareerOS state snapshot used by the dashboard and route
pages.

### Behavior

- Reads from the configured state repository.
- Seeds demo data on first access when no local state exists.
- Uses SQLite by default at `.careeros-data/careeros.sqlite`.
- Uses JSON fallback when `CAREEROS_PERSISTENCE=json`.

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
      "receivedAt": "2026-05-08T12:00:00.000Z"
    }
  ]
}
```

`receivedAt` is optional.

### Form fields

- `company`
- `role`
- `sourceLabel`
- `text`

### Behavior

- Rejects empty or incomplete records with `400`.
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
- JSON requests return recent import job and review state.
- Form requests redirect to `/applications`.

## `POST /api/process`

Runs a seeded local processing demo.

### Behavior

- Adds deterministic sample import records.
- Exercises recruiter-reply and unclear-deadline paths.
- Redirects to `/`.

This endpoint exists for local demo and smoke testing.

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

## `GET /api/analytics`

Returns local product metrics derived from applications and append-only events.

### Behavior

- Counts applications, unique companies, unique roles, reply rate, interview
  rate, offer rate, and average time to first response.
- Derives company and role breakdowns from local state only.
- Does not require hosted analytics, external databases, or inbox providers.

## `POST /api/resume`

Saves or analyzes pasted resume text.

### Form fields

- `intent`: `save` or `analyze`
- `title`
- `text`

### Behavior

- Requires at least 20 characters of resume text.
- `save` stores a local resume draft without analysis.
- `analyze` runs deterministic resume evaluation and writes local resume
  results.
- Redirects to `/resume`.

## `GET /api/model-status`

Returns the configured Ollama/Gemma runtime status.

### Response statuses

- `disabled`
- `unavailable`
- `model_missing`
- `health_check_failed`
- `ready`

### Behavior

- Does not touch the network when Ollama is disabled.
- Checks the configured Ollama base URL when enabled.
- Verifies that the configured Gemma model tag is installed.
- Runs a small bounded health prompt before reporting `ready`.

## `POST /api/model-status`

Checks model status and stores a model trace in local state.

### Behavior

- Writes bounded diagnostics only.
- Does not store full prompts, raw source bodies, or credentials.
- Redirects to `/settings`.

## `GET /api/connectors`

Returns optional connector account status.

### Behavior

- Gmail is disabled by default.
- Local dashboard, import, resume, review, and notification workflows are
  unaffected when Gmail is disabled or not configured.

## `POST /api/connectors/gmail/{action}`

Runs a Gmail connector placeholder action.

### Actions

- `connect`
- `disconnect`
- `sync`

### Behavior

- Does not start OAuth.
- Does not store OAuth tokens.
- Returns clear disabled, not-configured, disconnected, or needs-attention
  status.
- `sync` records a failed import job explaining that real Gmail sync requires
  safe OAuth and encrypted credential storage.
- Returns JSON when the request accepts `application/json`; otherwise redirects
  to `/settings`.

## `POST /api/notifications/{id}`

Marks a notification as read or dismissed.

### Form fields

- `intent`: `read` or `dismiss`

### Behavior

- Updates local notification status.
- Redirects to `/notifications`.

## `POST /api/reset`

Resets the local workspace to seeded demo data.

### Behavior

- Replaces local state with the seed state.
- Redirects to `/`.

## API Boundaries

- No endpoint requires hosted auth in the public local-first milestone.
- No endpoint requires Gmail credentials.
- No endpoint downloads model weights.
- Model output is schema-validated and review-gated.
- Local database files are user data and must remain outside git.
