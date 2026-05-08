# Architecture Summary

Last updated: 2026-05-08

CareerOS is a local-first job pipeline system. Other Candidate is the hosted
product built on CareerOS at `careeroc.com`.

The hosted Other Candidate demo is production-shaped and Gmail-first. This
public CareerOS base is dashboard-first, local-first, and usable before the user
connects Gmail or installs a local model.

## Runtime

```text
Browser
  -> Next.js dashboard
  -> Next.js route-handler API
  -> local SQLite state store
  -> optional Gmail API connector
  -> optional Ollama/Gemma model endpoint
```

The preferred local persistence adapter writes `.careeros-data/careeros.sqlite`
through the `StateRepository` interface and initializes its table on first
access. JSON remains available with `CAREEROS_PERSISTENCE=json`. No external DB
service is required, and the same repository boundary keeps future Postgres
replacement straightforward.

## Core Product Loop

1. The user opens the CareerOS dashboard locally.
2. Seeded data, local imports, or an optional Gmail connector provide recruiting
   evidence.
3. Deterministic filters remove obvious non-recruiting mail or low-signal input.
4. If Ollama is enabled, installed, and passes a bounded health prompt,
   Gemma-backed analysis can summarize import updates into typed suggestions.
5. High-confidence low-risk updates become application activity.
6. Risky, low-confidence, invalid, or model-backed updates enter a manual review
   queue before mutation.
7. The dashboard shows pipeline state, applications, reminders, notifications,
   recent changes, model trace metadata, and resume intelligence.

## Data Boundaries

- `Application` stores durable workflow state.
- `ApplicationEvent` stores append-only decisions and pipeline activity.
- `ImportJob` stores local import processing state, attempts, and errors.
- `EvidenceSnippet` stores bounded snippets, hashes, source labels, and
  confidence metadata.
- `ReviewItem` stores risky or low-confidence proposed mutations until the user
  accepts, dismisses, or corrects them.
- Notifications are derived from applications, reminders, review items, model
  status, and connector health.
- `ModelTrace` stores model/provider metadata and bounded diagnostics, not raw
  prompts or full source bodies.
- OAuth tokens are not part of the first local milestone. If the optional Gmail
  connector is added, tokens must live in dedicated encrypted storage.

## Load-Control Decisions

- Sync is active-user aware instead of polling every user globally.
- Per-user sync and processing have bounded concurrency.
- The database queue uses leases, max attempts, stale-lock recovery, and
  dead-letter metadata.
- Dashboard overview queries use projections and SQL aggregates where possible.
- Frontend polling uses self-scheduling timers and in-flight request dedupe.

## Implemented Local Services

- `lib/store.ts`: local state read/update/reset with first-run seed.
- `lib/persistence.ts`: repository interface plus SQLite, JSON-file, and
  in-memory adapters.
- `lib/connectors.ts`: optional Gmail connector status/actions without OAuth or
  credential storage.
- `lib/model-analysis.ts`: bounded Ollama import analysis with local schema
  validation and review-only output.
- `lib/pipeline.ts`: deterministic local import and resume processing.
- `lib/review.ts`: idempotent accept, dismiss, and correct review decisions.
- `lib/notifications.ts`: deterministic notification derivation with stable
  dedupe keys.
- `lib/model-status.ts`: explicit Ollama disabled/unavailable/model-missing
  status checks.
