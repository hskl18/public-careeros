# CareerOS Public Release Summary

Last updated: 2026-05-12

This is the current public release summary for the lightweight CareerOS repo.
It records the product direction, runtime boundary, security hardening, and
validation status after the repo was cleaned up for the Kaggle Gemma 4 Good
hackathon.

## Product Positioning

CareerOS is a multi-agent job-mailbox pipeline. It turns recruiting emails into
structured application state with a review-gated workflow:

1. Mailbox triage agent
2. Workflow extraction agent
3. Evidence/review agent
4. Resume/context agent
5. Reminder/notification agent
6. Model router/provider layer

The hosted product built on top is **Other Candidate** at `careeroc.com`. This
repo is the open-source demo: one Next.js app, local workspace state, optional
Gmail readonly sync, optional Gemma via Ollama Cloud, and no separate backend
stack.

## Runtime Simplification

The repo was reduced to a simple Next.js product:

- Startup is `pnpm install && pnpm dev`.
- No Docker runtime.
- No `dev-up` / `dev-down` scripts.
- No C# source export.
- No local Ollama server requirement.
- No local model download.
- One fixed light theme.
- Public routes are canonical only; duplicate `/app/*` aliases were removed.

The app starts as a clean workspace. Real product use begins by connecting
readonly Gmail and syncing recruiting mail; the sanitized sample story stays in
`/judge-demo` and `/api/pipeline` without writing fake applications into local
workspace state.

## Ollama Cloud / Gemma Boundary

The model path is now Cloud API only:

```text
CareerOS localhost:3000
  -> Next.js server route
  -> https://ollama.com/api
  -> Gemma
```

Required env for model-backed runs:

```bash
CAREEROS_OLLAMA_ENABLED=true
CAREEROS_OLLAMA_BASE_URL=https://ollama.com
CAREEROS_GEMMA_MODEL=gemma4:e4b
OLLAMA_API_KEY=your-ollama-cloud-api-key
```

The browser never receives `OLLAMA_API_KEY`. Server routes read it from env,
call Ollama Cloud, validate model output, and send model-backed proposals to
review before state changes.

Added smoke command:

```bash
OLLAMA_API_KEY=your-ollama-cloud-api-key pnpm smoke:ollama
```

Without a key this fails closed with a clear diagnostic. With a real key it is
the direct live smoke test for Ollama Cloud readiness.

## Agent Safety

The agent system is deliberately review-gated:

- Deterministic first-run path works without any provider.
- Model output must be strict JSON.
- Model responses are schema-validated.
- Model-backed workflow updates never mutate application state directly.
- Risky updates such as offers, rejections, deadlines, ambiguous matches, and
  invalid model output enter the manual review queue.
- Accepted or corrected review items are the only path from model proposal to
  durable application mutation.
- Model traces store provider, model tag, task, latency, confidence, fallback,
  and bounded diagnostics, not raw prompts or raw responses.

Gemma prompts were also shortened for smaller model reliability:

- Import analysis snippet reduced to 420 chars.
- Import model output reduced to `num_predict: 160`.
- Resume analysis excerpt reduced to 900 chars.
- Resume model output reduced to `num_predict: 220`.

## Gmail Boundary

Gmail is optional and readonly:

- Scope: `https://www.googleapis.com/auth/gmail.readonly`
- OAuth token lives under `.careeros-data/gmail-oauth.json`.
- Token file is now an AES-256-GCM envelope.
- Key material comes from `CAREEROS_TOKEN_SECRET`,
  `CAREEROS_SECRET_KEY`, or `CAREEROS_GMAIL_CLIENT_SECRET`.
- Workspace export/import rejects OAuth/token/provider-key fields.
- Synced Gmail messages are converted to bounded recruiting import records.

Tests open the token file and verify it does not contain plaintext
`access-token` or `refresh-token`.

## Eval Coverage Added

The deterministic pipeline now has noisy recruiting eval cases for:

- OA deadline
- Interview invite
- Offer signal
- Rejection
- Ambiguous recruiter / unknown company signal

Each case must remain stage-aware and review-gated. This addresses the concern
that real mailbox noise needs concrete eval coverage, not just conceptual agent
claims.

## Public Docs Shape

Current public docs:

- `README.md` — first-run onboarding and public product summary
- `docs/architecture.md` — runtime, data, and agent boundaries
- `docs/api-spec.md` — route handler API surface
- `docs/design.md` — product surface and UX direction
- `docs/hackathon-writeup.md` — Kaggle Gemma 4 Good narrative
- `docs/provider-research.md` — short provider roadmap
- `docs/roadmap.md` — shipped phases and future work
- `docs/release-summary.md` — this summary

Removed or folded:

- scattered implementation prompt docs
- broad local-first planning docs
- TODO doc
- browser-smoke doc
- long provider research note

## Current Validation

Latest local validation:

```bash
pnpm check
pnpm test
pnpm build
git diff --check
```

Current unit coverage: `70/70` tests passing.

`pnpm smoke:ollama` exists as a real key-backed Cloud smoke test and correctly
fails without `OLLAMA_API_KEY`.

## Remaining Non-Blocking Follow-Up

These are not needed for the public hackathon demo, but are the next real
hardening steps for hosted product parity:

- Run `pnpm smoke:ollama` with a real Ollama Cloud key and record the result.
- Run a real Gmail OAuth sync against a sanitized test mailbox.
- Add a larger mailbox eval fixture set from fake but realistic recruiter
  threads.
- Add background job scheduling only if the hosted product needs continuous
  sync.
- Add BYOK OpenAI / Anthropic / OpenRouter only after explicit credential
  storage and redaction review.
