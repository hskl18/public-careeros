# Local-First Product Plan

Last updated: 2026-05-08

This document defines the target direction for turning this public package into
CareerOS: a runnable open-source product instead of a documentation-only release
kit.

Naming:

- CareerOS is the open-source, local-first job pipeline system.
- Other Candidate is the hosted product built on CareerOS.
- `careeroc.com` is the Other Candidate production site.

## Product Target

CareerOS should be a local-first career pipeline dashboard:

- one dashboard-first web app
- local database by default
- local sample/import data path without requiring Gmail OAuth
- optional Gmail connector for users who want live recruiting email sync
- optional Ollama setup for Gemma-backed analysis
- deterministic fallback when the model is not installed or unavailable
- no required Vercel, Railway, Neon, Gmail, or Google sign-in account

Other Candidate can keep the full hosted Gmail-connected workflow. The CareerOS
open-source base should be easier to run, inspect, and fork.

## Non-Goals For The Public Base

- hosted multi-tenant account system
- mandatory Google sign-in
- mandatory Gmail OAuth
- provider-specific deployment runbooks
- raw email ingestion from real inboxes as the default path
- admin operations surfaces for private production accounts

## Runtime Shape

Recommended local runtime:

```text
Browser
  -> local Next.js dashboard
  -> local API
  -> local Postgres or SQLite-compatible development store
  -> optional Gmail connector
  -> optional Ollama on localhost
  -> configured Gemma model tag
```

The first open-source product should prefer one command:

```bash
docker compose up
```

That command should bring up the app, API, database, and any required local
services except model weights. Model installation should remain explicit because
large downloads are not safe to trigger without user intent.

## Dashboard Scope

Keep the dashboard surface narrow:

- Dashboard: pipeline health, next actions, recent changes, and analysis state.
- Applications: imported or seeded application records with evidence cards.
- Review: uncertain model outputs waiting for user confirmation.
- Resume: local resume upload/text paste, extraction, evaluation, and correction.
- Notifications: recruiter replies, due dates, blocked automation, and model
  status events.
- Settings: local model status, import/reset controls, data export/delete.

Remove or hide by default:

- Gmail connection screens until the local product has a safe connector setup
- cloud sync diagnostics
- production admin pages
- public marketing pages that do not help local users run the product
- provider-specific legal or deletion pages unless they are rewritten for the
  local product

## Input Sources

The public base should support local inputs first:

1. Seeded demo data for first-run exploration.
2. JSON import for applications, events, and evidence snippets.
3. Manual application creation and correction.
4. Resume PDF/image/text upload.
5. Optional Gmail connector for live recruiting email sync.
6. Optional email export import later, only after a sanitized parser contract is
   defined.

Gmail should be a product accelerator, not a prerequisite. A user should be able
to understand and run CareerOS before connecting a real inbox.

## Ollama And Gemma

Gemma-backed behavior should stay optional and bounded:

- deterministic parsing and review fallback must work without Ollama
- model status should be visible in Settings
- setup should verify that Ollama is reachable before model-backed analysis runs
- model installation should be an explicit user action or documented command
- the model tag should be configurable instead of hard-coded into the product
- failed or invalid model output should create review items, not hidden writes

Suggested setup flow:

1. Detect whether `http://localhost:11434` is reachable.
2. Show installed local models.
3. Let the user choose a configured Gemma model tag.
4. Offer a copyable pull command for the selected model.
5. Run a small health prompt before enabling model-backed analysis.

## Notification Window

CareerOS should include an in-app notification window before adding operating
system notifications.

Initial notification types:

- recruiter reply detected
- interview or assessment deadline approaching
- follow-up reminder due
- model unavailable or disabled
- model output blocked by review
- Gmail connector needs attention

Notifications should link back to the application, review item, resume result,
or settings surface that owns the next action.

## Code Extraction Strategy

The private app already has useful boundaries that should be reused:

- typed application and resume services
- deterministic parsing fallback
- Ollama parser/evaluator implementations
- model trace metadata
- manual review queue semantics
- dashboard query-service projections

CareerOS should not copy private deployment assumptions wholesale.
Instead, extract a new runnable base around these boundaries:

1. Start from the dashboard, application detail, review, resume, and settings
   routes.
2. Replace authenticated user context with a local workspace user.
3. Replace Gmail sync with seeded data and local import services.
4. Keep the queue/review semantics, but make processing manually triggerable.
5. Keep model traces, but store bounded metadata and short evidence snippets.
6. Add a notification read model for deadlines, recruiter replies, and review
   blocks.
7. Add local setup checks for database, API, Gmail connector, and Ollama status.

## First Milestone

The first milestone is now a runnable local preview:

- [x] `README.md` explains local-first setup.
- [x] `docker-compose.yml` starts the app with persistent local state.
- [x] `.env.example` uses localhost defaults.
- [x] first-run demo data loads without provider secrets.
- [x] dashboard, applications, review, resume, notifications, and settings routes
  render.
- [x] Gmail can be disconnected or skipped without breaking the dashboard.
- [x] Ollama can be disabled without breaking the app.
- [x] model-enabled analysis can be triggered after the user configures a Gemma
  tag.
- [x] tests cover deterministic fallback and model-unavailable behavior.

The current preferred persistence adapter is local SQLite, initialized on first
access with no external DB service. JSON remains available as a fallback. The
`StateRepository` boundary now defines the replacement path for a later Postgres
adapter.

Model-backed local import analysis now runs only after the configured Ollama
endpoint is reachable, the selected Gemma model exists, and a bounded health
prompt succeeds. Valid model output is schema-checked and queued for review;
invalid output is blocked and made review-visible instead of crashing or
silently mutating application state.

The optional Gmail connector now exposes disabled/not-configured/disconnected
status plus connect, disconnect, and sync placeholders. It does not store OAuth
credentials or start auto-sync; local mode stays fully functional without any
Google configuration.

## Release Gate

Before publishing this as a runnable product:

- run the public safety scan
- verify no private paths, hostnames, emails, provider ids, or real secrets exist
- run app build and backend tests
- run a local browser smoke against the dashboard, review, resume,
  notifications, and settings
- verify the app starts with Ollama disabled
- verify the app reports model status clearly when Ollama is enabled but missing
