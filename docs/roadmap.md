# Roadmap

Last updated: 2026-05-17

For surface area see [design.md](design.md). This doc is the **phased plan**
and public follow-up tracker.

## Phase 1: Public Private-Workspace Foundation — shipped

Implemented in the current public repository:

- Single local workspace.
- Clean first-run workspace with Gmail connect/sync as the real product entry.
- Local JSON persistence through the repository boundary.
- Agentic pipeline console for pipeline state, agent handoffs, pending actions,
  evidence, review blocks, model status, connector health, and recent activity.
- Applications surface with local import, events, evidence snippets, reminders,
  and review-gated updates.
- Application records carry spreadsheet-replacement context: JD link, resume
  version, cover-letter version, source, recruiter contact, location, salary
  range, and notes.
- Stale follow-up reminders are suppressed when a later-stage signal moves the
  pipeline forward.
- User-facing buckets include applied, waiting, followed up, assessment,
  interview, rejected, offer, and ghosted.
- Manual review queue for uncertain, risky, invalid, or model-backed changes.
- Resume text save/analyze flow with deterministic fallback.
- In-app notification window for deadlines, follow-ups, review blocks, model
  status, and connector health.
- Optional Ollama Cloud/Gemma status checks and bounded import analysis through
  server-side `OLLAMA_API_KEY`.
- Judge-facing `/judge-demo` and `/api/pipeline` surfaces that show the
  multi-agent mailbox pipeline.
- Static provider-adapter registry through `lib/providers/index.ts` and
  `/api/providers`; deterministic + Ollama Cloud/Gemma are implemented, all other
  adapters are explicitly roadmap metadata.
- Gmail readonly OAuth sync that imports bounded recruiting snippets into the
  local pipeline while keeping tokens under `.careeros-data`; sync has bounded
  pagination, duplicate suppression, local thread merge, Gmail import jobs, and
  compact audit events.
- Simple `pnpm install && pnpm dev` startup path.
- CI typecheck/test/build for the local Next.js demo.
- Safe local JSON export, strict workspace JSON import, and confirmed
  `.careeros-data` delete controls.
- Review queue filters and sorting for status, confidence, source,
  provider/model-backed items, company/application, and time/confidence order.
- Reminder completion/dismissal history with queryable application timelines.
- Analytics trends for application volume, replies, interviews, offers,
  review-blocked counts, waiting/ghosted counts, reminder history counts, and
  first response time.
- Thread-level evidence relationship groups for mailbox thread, application,
  company, role, recruiter, source label, and resume version.
- Board/lane scanning polish on `/applications` with due/follow-up pills,
  review-blocked indicators, and overflow links.
- Real application detail routes at `/applications/[id]`.
- Model-backed resume analysis behind the same Ollama Cloud/Gemma status and
  review boundaries as import analysis.
- Desktop fixed-shell refinements for `/`, `/applications`, and `/resume`.
- Fixed light visual system for the public demo and judge screenshots.
- Persisted `<details>` state wrapper for deliberate collapsible settings
  sections.

## Phase 2: Local Product Depth — shipped / continuing polish

Shipped in the extended local-product pass:

- Board-view polish as a scanning layer over the pipeline, not as the primary
  product metaphor.
- Richer frontend views on top of the shipped review, reminder, analytics, and
  evidence query APIs.
- Public demo copy that makes the Reddit-derived pain clear: "the inbox already
  contains the tracker."
- Fixed-shell layout pass and one fixed light theme so the judge console remains
  inspectable on desktop and mobile.

Continuing polish:

- Add public screenshots only after they are generated from sanitized judge/demo
  data and intentionally included.
- Keep mobile and accessibility fixes tied to browser smoke evidence rather
  than speculative redesign.

## Phase 3: Safe Inbox Integration Hardening — planned

- Harden the local Gmail AES-GCM token envelope with rotation, recovery, and
  clearer failure-state UX.
- Extend Gmail sync beyond the shipped bounded pagination with reconnect,
  backfill cursor controls, and user-visible sync windows.
- Preserve provider-free startup even when Gmail support exists.
- Add deeper connector-specific health and backfill lifecycle states.
- Add tests around token-file failure states and credential redaction.

## Phase 4: Model And Evidence Expansion — planned

- Add stronger deadline detection and thread-to-application matching.
- Add stronger JD-link, resume-version, recruiter-contact, salary/location, and
  application-source extraction from mailbox text.
- Add configurable model profiles while keeping deterministic fallback available.
- Keep MLX and other local runtimes research-only unless a bounded local-process
  boundary is solved and clearly useful for advanced users.
- Add Gemma 4 MTP drafters as a runtime configuration only after upstream
  support is stable and benchmarked.
- Promote llama.cpp, LiteRT, vLLM, and SGLang from roadmap metadata only when
  they have real adapter code, tests, and smoke coverage.
- Add BYOK provider adapters for OpenAI, Anthropic, and OpenRouter only after
  explicit credential storage and review-gate boundaries are in place.
- Add richer model trace evidence without storing full prompts or raw source
  bodies.

## Phase 5: Hosted Product Parity Options — out of scope for the public base

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

- Treat the current release as a 10/10 judge-demo package for the public
  Kaggle/Gemma scope. Hosted-product parity remains explicitly out of scope for
  this repo.
- Keep follow-up work grounded in [release-summary.md](release-summary.md) and
  [eval.md](eval.md): proof curation, sanitized Gmail recording, broader fake
  mailbox eval depth, and focused accessibility/mobile polish.
- Keep workflow work aligned with the LangGraph-style discipline in
  [architecture.md](architecture.md): explicit nodes, checkpointable local
  state, review interrupts, and replayable tests.
- Keep public safety scanning strict around env files, data exports, personal
  emails, provider dashboards, and secrets.
- Keep `StateRepository` as the persistence boundary for future database swaps.
- Keep connector implementations optional and explicit.
- Add integration coverage around pipeline transitions, review decisions,
  notifications, and local persistence.
- Add stronger normalization rules for company and role matching.
- Add a clearer first-run setup wizard inside `/settings`.
- Improve Gmail thread grouping across multi-message recruiter threads.
- Add more Gemma-specific judge examples for OA, interview, rejection, and
  offer mail.
