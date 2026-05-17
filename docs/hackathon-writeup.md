# Gemma 4 Good Hackathon Writeup Draft

Use this as the public writeup working copy for the Kaggle Gemma 4 Good
submission. It is aligned to this repository's shipped scope: a lightweight
CareerOS open-source demo of the Other Candidate workflow, built as one Next.js
app with Gmail readonly sync, local workspace state, review gates, and optional
Gemma through Ollama Cloud.

Core judging line: **this is not a generic chatbot**. CareerOS is a recruiting
mailbox pipeline where bounded evidence becomes extracted application state
only after traceable model/rules output and review gates.

## Ranking Strategy

The writeup should make the scoring case in the first screen. Judges should
not need to infer why this is useful, why Gemma matters, or whether the demo is
real.

| Judge question                           | CareerOS answer                                                                                                            | Proof asset                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Is this a real problem?                  | Job seekers miss OA, interview, deadline, offer, and follow-up signals because recruiting state is scattered across email. | `/judge-demo`, demo video, problem paragraph               |
| Is Gemma central?                        | Gemma handles bounded triage, workflow extraction, evidence review, resume/context analysis, and notification summaries.   | `/agents`, `/api/pipeline`, model trace panel              |
| Is it more than a chatbot?               | The output is structured application state, reminders, review items, and notifications, not a chat transcript.             | `/judge-demo`, `/applications`, `/review`                  |
| Is it safe enough for career automation? | Risky or model-backed changes require review, and traces expose evidence, confidence, fallback, and model path.            | `/review`, `SECURITY.md`, `docs/architecture.md`           |
| Can judges reproduce it?                 | `pnpm install && pnpm dev` runs a credential-free demo; `pnpm eval:pipeline` regenerates the 15/15 proof graph.            | `README.md`, `docs/eval.md`, `docs/media/eval-results.png` |

The strongest submission angle is **agentic job-search infrastructure for a
high-volume real-world workflow**: Gemma reads bounded evidence, agents propose
state changes, and a human review gate protects high-stakes mutations.

For the actual Kaggle form, use this file as the working copy for title,
subtitle, project description, media order, links, evaluation proof, and claims
to avoid.

## Basic Details

### Title

**Other Candidate / CareerOS: Recruiting Email to Application Pipeline**

Shorter alternatives:

- Other Candidate
- CareerOS
- Recruiting Email to Job Pipeline
- Inbox-First Career AI

### Subtitle

Other Candidate turns recruiting email into an evidence-backed application
pipeline using Gemma-powered extraction, review gates, and resume context.
CareerOS is the open-source demo of that workflow.

### Best-Fit Tracks

Final track names must match the Kaggle selector exactly, but the strongest
fit is:

- Main Track
- Impact Track, with Safety & Trust as the strongest subcategory if Kaggle asks
  for one
- Special Technology Track, with Ollama only if the submission shows the
  Ollama Cloud/Gemma path through the video, screenshots, or `pnpm smoke:ollama`

Avoid claiming mobile, edge, fine-tuning, llama.cpp, LiteRT, MLX, or local
runtime tracks unless those adapters are actually implemented and tested.

### Card And Thumbnail Image

Use a 560 x 280 screenshot that shows the agentic loop, not a generic hero.

Best current options from this repo:

1. `docs/media/submission-thumbnail-560x280.png`, cropped from `/judge-demo`.
2. `docs/media/judge-demo.png`, the full public judge-demo screenshot showing
   mailbox thread, extracted proposal, trace/review gate, and notification
   output.
3. `docs/media/architecture.png`, a polished technical
   diagram of the Gemma/review-gated mailbox pipeline.
4. `/` with the clean mailbox pipeline console and six-agent handoff strip.
5. `/agents` with agent contracts, memory boundaries, and can/cannot-do rules.
6. `/review` with a review-gated update, if the local workspace has synced or
   imported evidence.

Avoid screenshots with real Gmail, OAuth state, local paths, `.env.local`, API
keys, provider dashboards, or private job-search data.

## One-Sentence Project Summary

Other Candidate is a Gmail-first career workflow assistant that reads
recruiting email, extracts application updates with Gemma, routes uncertain
changes through evidence review, and helps job seekers avoid missing
interviews, assessments, offers, deadlines, and follow-ups.

## Project Description

Other Candidate turns the inbox into a career operating system for job seekers.
Recruiting workflows are often scattered across Gmail threads: application
confirmations, recruiter replies, interview invites, online assessments,
rejections, offers, and next-step requests. Missing one email can mean missing
an opportunity. The core product idea is simple: a candidate should not need to
manually maintain another spreadsheet when the source of truth already exists
inside their mailbox.

CareerOS is the open-source demonstration of that workflow. It starts as a
clean local workspace, lets a user configure readonly Gmail OAuth, syncs bounded
recruiting message snippets, and converts those signals into application
records, reminders, review items, notifications, resume context, and traceable
activity. The first run works without Gmail or model keys through the
judge-safe `/judge-demo`, while real local use begins by connecting Gmail and
syncing recruiting mail.

For the hosted judge link, the same boundary applies: the Vercel deployment can
be public and credential-free. Judges should not need to log into Gmail or
provide API keys. `/judge-demo` uses sanitized sample evidence; optional Gmail
OAuth and optional `OLLAMA_API_KEY` are only for real workspace use or live
Gemma verification.

Gemma is used where deterministic rules are too brittle: classifying ambiguous
recruiting mail, extracting workflow state, checking evidence before risky
updates, and supporting resume/context analysis. Deterministic parsing and
safety gates run first; Gemma is optional and model-backed output still goes
through review before it can mutate durable application state.

A key design choice is that CareerOS does not blindly update high-stakes career
state. Uncertain or model-backed extraction results become review items with
source evidence, confidence, model traces, and correction controls. The user
can accept, correct, or dismiss the proposed update. Corrections become compact
local feedback memory used by later import/model prompts, while still going
through schema validation and review gates. That makes the automation useful
without hiding why a change happened.

This public repo is intentionally lightweight: one Next.js app, local JSON
state under `.careeros-data`, Gmail readonly OAuth/token storage, Gemma through
Ollama Cloud when `OLLAMA_API_KEY` is configured, deterministic fallback, and
tests for pipeline, review, providers, import safety, Gmail connector behavior,
and local data controls. The hosted product built on top is Other Candidate at
`careeroc.com`.

## How Gemma Is Used

- **Mailbox triage** — decide whether a message is recruiting-related and worth
  deeper analysis.
- **Workflow extraction** — infer company, role, status, deadline, task, and
  action-required state from recruiting email.
- **Evidence review** — reason over bounded snippets before risky or
  model-backed workflow changes are applied.
- **Resume/context analysis** — turn pasted resume text and candidate context
  into structured local feedback.
- **Notification summaries** — explain why a deadline, recruiter reply, review
  blocker, or model status needs attention.
- **Model router/provider layer** — prefer deterministic processing for first
  run, use Gemma through Ollama Cloud when the server-side API key is configured
  and readiness checks pass.

Current routing philosophy:

1. Run deterministic parsing and safety checks first.
2. Stop early for obvious non-recruiting mail.
3. Accept high-confidence low-risk deterministic updates.
4. Send ambiguous recruiting evidence to Gemma when Ollama Cloud is enabled.
5. Send risky, low-confidence, or model-backed mutations to review instead of
   silently updating the pipeline.
6. Record compact model/runtime metadata so the product can show what produced
   a decision without storing raw prompts, raw responses, Gmail bodies, OAuth
   tokens, or provider keys.

Current public implementation:

- Implemented model path: Gemma via Ollama Cloud with server-side
  `OLLAMA_API_KEY`.
- Default model tag: `gemma4:31b`, configurable through
  `CAREEROS_GEMMA_MODEL`.
- Endpoint: `https://ollama.com/api`, derived from
  `CAREEROS_OLLAMA_BASE_URL=https://ollama.com`.
- No desktop Ollama server, local model download, Docker runtime, or separate
  backend is required for this public demo.
- OpenAI, Anthropic, OpenRouter, MLX, llama.cpp, LiteRT, vLLM, SGLang, and
  MTP drafters remain roadmap/provider-registry concepts unless separately
  implemented and tested.

## Why It Matters

Job seekers already use Gmail as the source of truth, but Gmail is not designed
as a recruiting workflow tool. Students and early-career candidates often juggle
dozens or hundreds of applications while also managing classes, work, and life.
The people who most need organization are often least able to spend time
maintaining a tracker by hand.

Other Candidate focuses on a practical social-good problem: reducing missed
opportunities caused by inbox overload. It makes the hidden workflow inside
email visible, correctable, and easier to act on.

## What I Built In This Public Demo

- A clean local CareerOS workspace that starts with no fake application records.
- A judge-safe `/judge-demo` showing the full mailbox-to-pipeline agent flow
  without credentials.
- Readonly Gmail OAuth setup and local token storage under `.careeros-data`.
- Gmail sync that fetches readonly metadata/snippets and sends bounded
  recruiting evidence through the same pipeline as imports without persisting
  full message bodies.
- Multi-agent pipeline layers:
  - Mailbox triage agent
  - Workflow extraction agent
  - Evidence/review agent
  - Resume/context agent
  - Reminder/notification agent
  - Model router/provider layer
- Application records with stage, JD link, resume version, recruiter contact,
  evidence snippets, timeline, review blockers, reminders, and notifications.
- Manual review queue for uncertain or model-backed updates.
- Local feedback loop: corrected reviews become compact correction memory used
  by later deterministic/Gemma-backed imports without bypassing review gates.
- Resume context surface with deterministic fallback and optional Gemma-backed
  analysis.
- Local notification/action queue derived from review blockers, deadlines,
  connector health, and model status.
- Agent contracts page showing prompting boundaries, memory boundaries,
  can/cannot-do rules, cost/runtime rules, and machine-readable runtime
  constraints in `lib/agent-constraints.ts`.
- Strict local JSON import/export and confirmed local data delete.
- Public safety boundaries: no raw Gmail bodies in exports, no provider keys in
  workspace state, no raw prompts/responses in traces.
- CI-ready commands: `pnpm check`, `pnpm test`, `pnpm eval:pipeline`,
  `pnpm build`, `pnpm smoke:browser`, `pnpm ci:public`, and
  `pnpm release:check`.

## Technical Stack

- Frontend/runtime: Next.js App Router, React, TypeScript.
- State: local JSON workspace under `.careeros-data`.
- Email: Gmail readonly OAuth and Gmail API sync.
- AI: Gemma through Ollama Cloud, with deterministic fallback and review gates.
- Safety: schema validation, endpoint allowlist, import redaction checks,
  review-gated model output, local OAuth token envelope, public safety scanning
  guidance.
- Quality: TypeScript check, Vitest pipeline tests, production build.

Do not claim the public repo ships .NET, Neon PostgreSQL, Railway, Docker,
SQS/background workers, OpenAPI drift checks, production admin diagnostics, or
other hosted production infrastructure unless the submitted artifact links to
the full hosted product and separately proves those layers.

## Demo Flow

Recommended 3-minute video:

Open with the first 20 seconds showing the core loop, then expand:

1. Open the public Vercel `/judge-demo` and say: "This public judge route
   needs no Gmail login and no private API key. It is not a chatbot; CareerOS
   turns recruiting mailbox evidence into reviewed application state."
2. Show the sanitized recruiter/OA thread becoming an extracted application
   update with company, role, source, JD link, resume version, deadline, and
   next action.
3. Show the trace/review gate: Gemma via server-side Ollama Cloud when
   configured, deterministic fallback when not, and no risky mutation without
   review.
4. Then explain the problem: recruiting workflow is hidden in Gmail and candidates miss
   OA/interview/follow-up signals.
5. Use the end-to-end fake mailbox thread:
   email -> triage -> extraction -> evidence -> review gate -> notification.
6. Open `/` and show the clean local pipeline console.
7. Open `/settings?section=gmail` and explain that real use starts with
   readonly Gmail OAuth.
8. Open `/settings` and show optional Ollama Cloud/Gemma setup: server-side
   `OLLAMA_API_KEY`, no desktop model runtime, and no requirement for judges to
   provide a key.
9. Open `/applications` or an application detail page and show evidence-backed
   application state.
10. Open `/review` and show accept/correct/dismiss as the safety layer.
11. Open `/resume` and explain candidate context/resume feedback.
12. Open `/agents` briefly to show that this is an agentic mailbox pipeline,
    not a generic job tracker.
13. Close with the impact: fewer missed recruiter updates, visible evidence,
    and correctable automation for high-volume job searches.

## Media Gallery

Recommended assets:

- Demo video hosted on YouTube.
- Curated repo image: `docs/media/judge-demo.png`.
- Curated Kaggle thumbnail: `docs/media/submission-thumbnail-560x280.png`.
- Polished architecture PNG:
  `docs/media/architecture.png`.
- Eval graph: `docs/media/eval-results.png`, generated by
  `pnpm eval:pipeline`.
- Browser-smoke screenshot: `test-results/browser-smoke/seeded-desktop-judge-demo.png`
  showing the three-panel agent flow.
- Browser-smoke screenshot: `test-results/browser-smoke/seeded-mobile-judge-demo.png`
  showing the judge demo on a narrow viewport.
- Browser-smoke screenshot: `test-results/browser-smoke/empty-desktop-home.png`
  showing the clean pipeline console.
- Browser-smoke screenshot:
  `test-results/browser-smoke/seeded-desktop-applications-app_atlas.png` showing
  evidence-backed application detail from sanitized smoke data.
- Browser-smoke screenshot: `test-results/browser-smoke/seeded-desktop-review.png`
  showing an evidence-backed review decision.
- Browser-smoke screenshot: `test-results/browser-smoke/seeded-desktop-agents.png`
  showing agent contracts and boundaries.
- Browser-smoke screenshot: `test-results/browser-smoke/empty-desktop-settings-section-gmail.png`
  showing Gmail + Ollama Cloud setup, with no keys visible.

Keep generated media out of commits unless intentionally publishing sanitized
assets. Do not upload screenshots containing real Gmail, OAuth tokens, API keys,
private company contacts, local `.env.local`, or `.careeros-data`.

## Project Links

- Hosted product: `https://www.careeroc.com`
- Judge-safe public demo: use the final Vercel `/judge-demo` URL.
- Public code repo: `https://github.com/hskl18/public-careeros`
- Local judge-safe route: `/judge-demo`
- Local agent pipeline API: `/api/pipeline`
- Local provider registry API: `/api/providers`
- Local eval proof: `docs/eval.md`, `eval/results.json`, and
  `docs/media/eval-results.png`
- Polished architecture PNG:
  `docs/media/architecture.png`
- Paste-ready Kaggle description:
  `docs/hackathon-writeup.md`

If the Kaggle submission uses the hosted production app, keep a separate
production-status note for the full CareerOS/Other Candidate stack. This public
repo should only claim what this repo actually ships.

## Short Version For Kaggle Description

| Judge question | CareerOS answer | Proof asset |
| --- | --- | --- |
| Is this a real problem? | Job seekers miss OA, interview, deadline, offer, and follow-up signals because recruiting state is scattered across email. | `/judge-demo`, demo video, problem paragraph |
| Is Gemma central? | Gemma handles bounded triage, workflow extraction, evidence review, resume/context analysis, and notification summaries. | `/agents`, `/api/pipeline`, model trace panel |
| Is it more than a chatbot? | The output is structured application state, reminders, review items, and notifications, not a chat transcript. | `/judge-demo`, `/applications`, `/review` |
| Is it safe enough for career automation? | Risky or model-backed changes require review, and traces expose evidence, confidence, fallback, and model path. | `/review`, `SECURITY.md`, `docs/architecture.md` |
| Can judges reproduce it? | `pnpm install && pnpm dev` runs a credential-free demo; `pnpm eval:pipeline` regenerates the 15/15 proof graph. | `README.md`, `docs/eval.md`, `docs/media/eval-results.png` |

Other Candidate is a Gmail-first career workflow assistant for job seekers. It
connects to Gmail, finds recruiting emails, and turns scattered messages into a
structured pipeline of applications, interviews, assessments, rejections,
follow-ups, reminders, and review items. I built it because job-search state is
usually trapped in email threads and spreadsheets; missing one recruiter update
can mean missing an opportunity.

Gemma is used as the reasoning layer for the parts that simple rules cannot
reliably handle: classifying ambiguous recruiting emails, extracting workflow
state, checking evidence before risky updates, and powering resume/context
analysis. CareerOS intentionally combines Gemma with deterministic parsers,
safety checks, model traces, and a manual review queue. When the model is
uncertain, the product shows the source evidence and asks for correction instead
of silently changing a user's career pipeline. Those corrections are retained as
compact local feedback facts for later runs.

The public demo is a lightweight Next.js app with local workspace state,
readonly Gmail sync, optional Gemma through Ollama Cloud, deterministic
fallback, application tracking, review queue, resume context, notifications,
agent contracts, and safe local data controls. The hosted product built on top
is Other Candidate at careeroc.com.

The goal is practical social impact: help students and job seekers manage
high-volume recruiting workflows without manually maintaining another tracker,
while keeping sensitive career automation visible, correctable, and
evidence-backed.

## Evaluation Evidence

CareerOS includes an executable pipeline eval so the submission is not just a
UI story. `pnpm eval:pipeline` runs 15 judge-safe fixtures mapped to public
dataset components:

- Enron Email Dataset for mailbox/thread-style text.
- SpamAssassin Email Classification for email noise.
- LinkedIn Job Postings 2023-2024 for company, role, location, salary,
  source URL, and application URL fields.
- Resume dataset for candidate-context text.
- Fake vs Real Job Postings for suspicious-job evidence.
- Synthetic recruiting fixtures for OA deadlines, phone screens, technical
  interviews, offers, rejections, ambiguous recruiter replies, and resume
  context, because public datasets do not directly label the full recruiting
  workflow state.

Current result: **15/15 passed** across action routing, stage extraction,
review-gate behavior, and mutation safety. The generated graph is
`docs/media/eval-results.png`; the machine-readable output is
`eval/results.json`.

![CareerOS pipeline eval results](media/eval-results.png)

This eval is scoped honestly: it proves the hackathon product loop, not broad
production parity. The claim is that bounded recruiting evidence can become
structured application state through deterministic/Gemma-compatible extraction
and review gates, without silently mutating high-stakes career state.

## Submission Preparation

- [x] Title prepared: `Other Candidate / CareerOS: Recruiting Email to
Application Pipeline`.
- [x] Subtitle prepared for a Gmail-first Gemma workflow assistant.
- [x] Paste-ready Kaggle field copy prepared in
      `docs/hackathon-writeup.md`.
- [x] Public repo prepared as a runnable lightweight Next.js app.
- [x] README explains `pnpm install`, `pnpm dev`, Gmail setup, and Ollama Cloud
      setup.
- [x] Public repo has MIT license and no committed `.env.local`,
      `.careeros-data`, Gmail exports, screenshots, provider keys, or local dumps.
- [x] Judge-safe demo route exists at `/judge-demo`.
- [x] Agent/runtime story exists in `/agents`, `/api/pipeline`, and
      `/api/providers`.
- [x] Validation commands pass locally: `pnpm check`, `pnpm test`,
      `pnpm eval:pipeline`, `pnpm build`, `pnpm smoke:browser`, and
      `pnpm smoke:ollama` in no-key public mode. With a local
      `OLLAMA_API_KEY`, the same command performs live Ollama Cloud smoke.
- [x] `pnpm release:check` exists for public safety, TypeScript, unit tests,
      pipeline eval, production build, seeded/empty browser smoke, Ollama Cloud
      no-key/live smoke, and whitespace validation.
- [x] Browser-smoke screenshots are generated under
      `test-results/browser-smoke/` as local judge proof artifacts.
- [x] Pipeline eval proof is generated under `eval/results.json` and
      `docs/media/eval-results.png`.

Owner-only Kaggle actions still required:

- Upload a 560 x 280 thumbnail.
- Add a YouTube demo video.
- Select the final submission tracks from Kaggle's exact selector names.
- Add the final public GitHub repository link.
- Add a live demo link if using `careeroc.com` or another deployed judge-safe
  URL.
- Save the draft and submit before the published Kaggle deadline.

## What From The Older Full-Product Draft Is Still Useful

Keep:

- The title direction: "Other Candidate: Recruiting Email to Application
  Pipeline".
- The one-sentence summary and social-good framing.
- The Gmail-first workflow pain.
- The review-gated automation story.
- The Gemma use cases: triage, extraction, evidence review, resume context,
  orchestrator-style next actions.
- The 3-minute video flow, adapted to `/judge-demo`, `/`, `/settings`,
  `/applications`, `/review`, `/resume`, and `/agents`.
- The media checklist and privacy warnings.

Do not reuse in this public repo writeup unless separately proving the hosted
production stack:

- Claims that this public repo ships a .NET API, EF Core migrations, Neon
  PostgreSQL, Railway deployment, admin diagnostics, audit logging, SQS/queue
  workers, or OpenAPI drift checks.
- Legacy private inbox, updates, application, or technical-marketing routes.
- `gemma4:31b-cloud` as the current public demo path.
- BYOK OpenAI/Anthropic/OpenRouter, MLX, llama.cpp, LiteRT, vLLM, SGLang, and
  MTP drafters must remain roadmap labels only.
- Screenshots from private Gmail or signed-in production accounts unless fully
  sanitized.
