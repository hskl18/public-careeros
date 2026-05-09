# Roadmap

Last updated: 2026-05-08

## Phase 1: Public Local-First Foundation

Implemented in the current public repository:

- Single local workspace.
- Provider-free startup with seeded demo data.
- Local SQLite persistence with JSON fallback.
- Dashboard for pipeline state, pending actions, review blocks, model status,
  connector health, and recent activity.
- Applications surface with local import, events, evidence snippets, reminders,
  and review-gated updates.
- Manual review queue for uncertain, risky, invalid, or model-backed changes.
- Resume text save/analyze flow with deterministic fallback.
- In-app notification window for deadlines, follow-ups, review blocks, model
  status, and connector health.
- Optional Ollama/Gemma status checks and bounded import analysis.
- Gmail connector status and placeholder actions that remain token-free.
- Public safety scan, CI typecheck/test/build, and browser smoke documentation.

## Phase 2: Local Product Depth

- Add a first-class PowerShell dev-up/dev-down path for Windows users.
- Add automated route smoke checks to CI.
- Verify Docker Compose startup in release validation.
- Add local data export and delete controls.
- Add richer review queue filters and sorting.
- Add reminder completion history.
- Add analytics trends for application volume, reply rate, interview rate, offer
  rate, and time to first response.
- Add thread-level evidence views and summaries for imported records.

## Phase 3: Safe Inbox Integration

- Design encrypted local credential storage.
- Implement Gmail OAuth only after credential storage is reviewed.
- Implement real Gmail sync behind the existing optional connector interface.
- Preserve provider-free startup even when Gmail support exists.
- Add connector-specific health, backfill, and sync lifecycle states.
- Add tests around token-free failure states and credential redaction.

## Phase 4: Model And Evidence Expansion

- Add model-backed resume analysis behind the same status and review boundaries.
- Add optional email export import after a sanitized parser contract exists.
- Add stronger deadline detection and thread-to-application matching.
- Add configurable model profiles while keeping deterministic fallback available.
- Add richer model trace evidence without storing full prompts or raw source
  bodies.

## Phase 5: Hosted Product Parity Options

These remain optional for the open-source base and are better suited to hosted
Other Candidate or advanced self-hosting:

- Multi-user authorization boundaries.
- Production account management.
- Calendar synchronization.
- Attachment storage and long-term raw payload archival.
- Custom-domain inbound email.
- SQS-backed queue runtime.
- Advanced analytics and reporting.
- Offer comparison, networking, referral, and recruiter CRM workflows.

## Engineering Follow-Up

- Keep public safety scanning strict around env files, data exports, personal
  emails, provider dashboards, and secrets.
- Keep `StateRepository` as the persistence boundary for future database swaps.
- Keep connector implementations optional and explicit.
- Add integration coverage around pipeline transitions, review decisions,
  notifications, and local persistence.
- Add stronger normalization rules for company and role matching.
