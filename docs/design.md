# Product Design

Last updated: 2026-05-13

For the one-line description and quickstart, see the
[README](../README.md). For runtime/agent layers, see
[architecture.md](architecture.md). This doc covers **product positioning,
surface area, and UX direction**.

## Positioning

CareerOS is a multi-agent job-mailbox pipeline for individual job seekers. The
public version's job is to make the pipeline **visible, inspectable, and
correctable** without a hosted account, Gmail OAuth, or cloud infrastructure.

The product is intentionally narrow:

- clean Gmail-first workspace and local import
- one local workspace user
- one agentic pipeline console
- application pipeline, review queue, resume intelligence, notifications,
  agent contracts, settings
- optional Gmail readonly sync through a local OAuth token file
- optional Ollama Cloud/Gemma analysis after explicit env setup
- provider-adapter registry surfaces for roadmap advanced/BYOK model paths
- one fixed light visual system for the public demo

The goal is to feel like a small but durable foundation, not a throwaway
prototype.

## Primary user

An individual job seeker actively applying and interviewing — someone who
receives meaningful recruiting traffic in email, files, or manual notes, and
who wants automation while keeping final control when the system is uncertain.

## Pain signals (from public job-search discussions)

CareerOS targets the operational mess that recurs in r/cscareerquestions and
similar communities:

- The inbox already contains the truth, but candidates manually rebuild it in
  spreadsheets.
- After 50–100 applications, rows lose context: JD link, resume version,
  source, recruiter, salary/location, and the *reason* for the next follow-up.
- Recruiter emails arrive without enough context for the candidate to remember
  which role they refer to.
- Stale follow-up reminders become noise after an OA, recruiter reply,
  interview, rejection, or offer.
- Privacy-first local tracking is a strong trust signal because job-search
  email is sensitive.

## Core promise

CareerOS turns unstructured recruiting evidence into:

- application records and stage changes
- pending actions and reminders
- in-app notifications
- resume feedback
- a readable timeline of what changed and why

The user trusts the system for routine updates and corrects it quickly when
needed.

## Product principles

- Keep the product small and operationally clear.
- Prefer **visible** automation over hidden automation.
- Keep manual correction close to the automated workflow.
- Preserve a clean boundary between **evidence** and **structured state**.
- Model-backed analysis is additive, not foundational.
- Never require Gmail, hosted auth, or a model download for first-run value.

## Surface area

### Pipeline console (`/`)

The operational home screen and first judge-facing impression. It should show
the mailbox-to-state loop immediately, not only summary metrics:

- the six agent layers: mailbox triage, workflow extraction,
  evidence/review, resume/context, reminders/notifications, and model router
- Gmail or sanitized judge/demo mailbox evidence moving into an extracted
  application update
- Gemma via Ollama Cloud as the primary optional model path
- deterministic fallback as a valid first-run state
- review gates before durable application-state mutation
- notifications and application records as derived operational outputs

### Judge demo (`/judge-demo`)

Interactive hackathon surface — not a marketing landing page. It must
communicate within seconds: *CareerOS is a private-workspace multi-agent mailbox
pipeline; Gemma via Ollama Cloud is the primary model path; review gates protect
durable state.*

Preferred composition:

- left/top: multi-agent pipeline stages
- center: fake mailbox thread → extracted application update
- right: model trace, review gate, notification output
- bottom: env setup and provider options

The extracted update should include the fields candidates lose in
spreadsheets: company, role, source, JD link, resume version, cover-letter
version, recruiter contact, location, salary range, deadline, next action,
notes, confidence.

### Applications (`/applications`)

Durable pipeline state with evidence near each application record. Supports
both durable detail and fast scanning:

- compact bucket views: applied, waiting, followed up, assessment, interview,
  rejected, offer, ghosted
- real application detail routes at `/applications/[id]` that show company,
  role, stage, next action, deadline/follow-up, spreadsheet-replacement fields,
  timeline, bounded evidence, mailbox thread relationships, review blockers,
  reminders, and notification context
- evidence-backed dossier strip summarizing bounded snippets, source message
  ids, matched mailbox threads, review-gate status, and operating queue context
- evidence cards keeping JD link, resume version, source, recruiter contact,
  salary/location, notes
- relationship hints between mailbox thread, recruiter, company, role, resume
- thread-level evidence inspection: mailbox message snippets, source message
  ids, extracted update, confidence, source label, and owning application
- board/lane scanning remains secondary to the pipeline and evidence surfaces

### Manual review queue (`/review`)

Email and model understanding are never perfect. The queue lets the user:

- accept a suggested update
- dismiss an update that should not mutate state
- correct key fields before applying
- filter and sort by status, company, source, confidence band, deterministic
  vs model-backed trace, newest/oldest, and confidence order

Low-confidence, risky, invalid, or model-backed updates are review-visible
before they affect application state.

### Resume (`/resume`)

Connects candidate material back to the pipeline. First public version
supports pasted text and deterministic evaluation, so it works without a model
key. When Gemma through Ollama Cloud is explicitly enabled and passes readiness checks, the
resume surface labels Gemma-backed feedback separately from deterministic
fallback. Invalid, risky, or low-confidence model output is shown as blocked
instead of silently replacing the deterministic baseline.

The top of the dossier keeps the first-time path visible: paste resume text,
analyze, inspect deterministic or Gemma-backed output, then correct locally.

### Notifications (`/notifications`)

In-app operating surface, not a marketing feature. Surfaces recruiter replies,
due dates, follow-ups, review blocks, connector health, and model status with
stable dedupe keys. Reminder notifications close when a later-stage event
makes the old follow-up stale.

### Settings (`/settings`)

Makes runtime state explicit:

- data export/import/delete and persistence location
- optional connector state
- Ollama/Gemma status (disabled / unreachable / model-missing / ready)
- Ollama Cloud setup controls (endpoint, tag, save, verify API)
- env-key guidance — never an in-app secret field
- one fixed light theme so the public demo stays visually consistent for
  judges and screenshots
- sub-nav on `/settings` switches *view*, not anchor — `?section=` query
  param swaps which section renders. Defaults to `model`.

### Agents (`/agents`)

Product-facing operating contract for the pipeline. This page should make the
system legible as agents, not as a generic tracker:

- each agent's purpose
- alignment with the full CareerOS mailbox / resume / orchestration families
- prompt/input boundary
- local memory boundary
- can-do and cannot-do rules
- cost/runtime boundary
- latest compact trace, review gate count, and model trace context

## UX direction

The UX should feel like an **agentic pipeline console**, not a generic SaaS
CRUD app:

- strong hierarchy
- high-signal metrics
- obvious action surfaces
- minimal navigation depth
- dense but readable workflow panels
- visible confidence and review metadata
- direct action buttons rather than hidden menus
- never rely on color alone for status

## App shell and scroll model

One integrated app shell across pipeline, applications, agents, resume, review,
notifications, settings, and judge demo.

### Fixed-shell routes (desktop ≥768px)

These routes keep the document and shell from page-scrolling; long surfaces
scroll inside their own sections instead. They are checked through the current
TypeScript/build gate and should receive browser smoke coverage before any
major layout rewrite.

| Route | Fixed top region | Section-internal scroll |
| --- | --- | --- |
| `/` | hero card (`home-agent-console workspace-fixed-top`) — eyebrow + state-aware CTA + 6-agent strip + metric tiles + status row | activity log + needs-attention columns (each a `workspace-scroll-region`) |
| `/applications` | first stack row — hero + metric strip | `applications-scroll-region` wrapping stage board + table + thread-evidence; selected rail scrolls independently |
| `/resume` | dossier head | `resume-agent-rail` and `resume-dossier-content` each scroll inside the dossier body |

### Page-scrolling routes

`/review`, `/notifications`, `/settings`, and `/judge-demo`
allow normal vertical document scroll because their content is deep enough
that internal scrolling fights the user. They still use the same workspace
shell, just without the fixed-shell height constraints. `/settings` adds an
in-page sub-nav for fast jumping.

### Rules

**Desktop (≥768px)**

- Document and `<body>` don't page-scroll on fixed-shell routes.
- Each fixed-shell route keeps a `workspace-fixed-top` region visible at
  the top.
- Long surfaces declare their own overflow with `workspace-scroll-region`,
  `shell-scroll-region`, or a route-specific equivalent.
- Don't hard-code `min-height` on a panel that lives inside a fixed shell;
  scope tall minimums to mobile only.

**Mobile (<768px)**

- Normal vertical document scroll.
- Wide tables keep horizontal overflow.
- Controls wrap rather than overlap.

New routes start from `app-scroll-main` + `workspace-shell` and put
scrollable content inside `workspace-scroll-region`. If the route is
fixed-shell, add `fixed-workspace` to the shell and mark the top region
with `workspace-fixed-top`.

## Out of scope (for now)

- multi-user collaboration
- recruiter CRM
- calendar synchronization
- outbound automation
- hosted account management
- production Gmail OAuth and token storage
- advanced analytics and reporting

These are later layers, not requirements for the current private-workspace
foundation. See [roadmap.md](roadmap.md) for sequencing.

## Long-term constraint

As CareerOS grows, one rule must hold:

> Automation can suggest and update, but the user must always be able to
> inspect, correct, and override the workflow state.
