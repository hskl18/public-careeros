# Public Repo TODO

Last updated: 2026-05-08

## Public Repo Packaging

- [x] Decide final public repository name and license.
  - Public repository slug: `public-careeros`; product name: `CareerOS`;
    license: MIT.
- [x] Copy only reviewed source files into this folder.
  - Reviewed excerpts live under `source/`; they are inspectable slices, not a
    standalone copy of the private monorepo.
- [x] Replace private monorepo paths with public repo-relative paths.
- [x] Adapt core private product docs for the public local-first package.
  - Public docs now include product design, API spec, and roadmap pages without
    private account, hosted provider, or personal inbox details.
- [x] Keep `.env.example`; exclude all real `.env*` files.
- [x] Run secret scan before publishing the public Git repository.
  - Local command passed: `bash scripts/public-safety-check.sh`.
- [x] Confirm every fixture, screenshot, and media file is sanitized.
  - Public package currently contains no binary screenshots, PDFs, DB dumps, or
    Gmail exports.
- [x] Add CI that can run without private provider secrets.
  - `.github/workflows/public-ci.yml` runs the public safety scan and provider
    hostname/path checks without secrets.

## Hackathon Demo

- [x] Keep `/judge-demo` public, static, API-free, DB-free, Gmail-free, and
  anonymized.
- [x] Keep model narration aligned with `gemma4:31b-cloud` for the deployed demo.
- [x] Include model path, confidence, evidence source, review gate, and fallback
  on judge-facing trace cards.

## Neon And Dashboard Cost Optimization

- [x] Run `EXPLAIN ANALYZE` on dashboard overview queries against a realistic
  demo inbox size.
- [x] Run `EXPLAIN ANALYZE` on application detail queries that load linked email
  graph data.
- [x] Convert remaining dashboard application/email graph loading into
  query-service projections instead of materializing full entities.
- [x] Add pagination or explicit row limits for application detail evidence,
  linked messages, and activity history.
  - Current backend guardrail: application detail caps linked emails, events,
    open reminders, and artifact evidence before shaping the DTO.
- [x] Add or adjust indexes only after query-plan evidence shows the need.
  - 2026-05-05 query-plan pass did not justify a new index; the measured paths
    used existing inbox-email, job-application-event, and artifact-evidence
    indexes where row volume warranted them. Dashboard linked-email metadata is
    capped before DTO shaping.
- [x] Re-check Neon network transfer after the projection/pagination pass.
  - Backend payload guardrails are now in code via dashboard projections,
    dashboard linked-email caps, and application detail row caps. Provider-level
    transfer should still be watched after deployment from Neon/Vercel metrics.

## Local-First Open-Source Product

- [x] Convert this repository from a source-excerpt package into a runnable
  local-first product.
- [x] Add a provider-free local setup path with app, API, and local persistence
  defaults.
- [x] Keep dashboard, applications, review, resume, notifications, and settings
  as the first public product routes.
- [x] Add an in-app notification window for recruiter replies, deadlines, review
  blocks, and model status.
- [x] Replace mandatory Gmail/OAuth flows with seeded demo data and local import
  services.
- [x] Start Gmail as an optional connector after the provider-free local path
  works.
  - Status and placeholder actions exist; real OAuth/sync remains intentionally
    blocked until encrypted credential storage is designed.
- [x] Add an explicit Ollama status/setup surface before enabling model-backed
  analysis.
- [x] Keep Gemma model tags configurable and document model pull commands instead
  of triggering large downloads automatically.
- [x] Ensure deterministic fallback works when Ollama is disabled, missing, or
  returns invalid output.
- [x] Add browser smoke coverage for dashboard, review, resume, notifications,
  settings, and model-unavailable states.
- [x] Add separate implementation prompts for product logic and frontend work.
- [x] Add `scripts/dev-up.sh` and `scripts/dev-down.sh` one-command local stack
  helpers.
- [x] Abstract the first-milestone JSON persistence adapter behind a repository
  interface so a database-backed adapter can replace it later.
- [x] Add model-backed bounded analysis calls after status checks can prove the
  configured Gemma tag is ready.
- [x] Add a SQLite adapter while preserving one-command local setup.
- [ ] Implement safe Gmail OAuth and encrypted credential storage.
- [ ] Implement real Gmail sync adapter behind the optional connector interface.
