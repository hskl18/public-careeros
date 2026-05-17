# CareerOS Public Release Summary

This is the current public release summary for the lightweight CareerOS repo.
It records the judge-facing demo boundary, runtime contract, security
hardening, proof artifacts, and validation status for the Kaggle Gemma 4 Good
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
repo is the limited public hackathon demo/source package: one Next.js app,
local workspace state, optional Gmail readonly sync, optional Gemma via Ollama
Cloud, deterministic fallback, and no separate backend stack.

Current judge-demo completion score: **10/10 for the public Kaggle/Gemma
demo scope**. This does not claim hosted Other Candidate production parity.

## Ranking-Ready Submission Shape

The public package is now organized around the signals that matter for a
Kaggle/Gemma hackathon writeup:

| Signal               | Public artifact                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real-world utility   | `/judge-demo`, README opening section, and `docs/hackathon-writeup.md` explain the missed-OA/interview/follow-up problem.                                                             |
| Gemma-specific depth | `/agents`, `/api/pipeline`, `docs/architecture.md`, and `docs/hackathon-writeup.md` describe bounded triage, extraction, evidence review, resume/context, and notification reasoning. |
| Safety and trust     | `/review`, `SECURITY.md`, local data controls, endpoint allowlist, token/export boundaries, and review-gated state mutation.                                                          |
| Reproducibility      | `pnpm install && pnpm dev`, `/judge-demo`, `pnpm ci:public`, and `pnpm eval:pipeline`.                                                                                                |
| Proof media          | `docs/media/judge-demo.png`, `docs/media/submission-thumbnail-560x280.png`, `docs/media/architecture.png`, and `docs/media/eval-results.png`.                                         |

`docs/hackathon-writeup.md` contains the judge-facing title, subtitle, project
description, media order, project links, short description, evaluation proof,
and claims to avoid.

## Runtime Simplification

The repo was reduced to a simple Next.js product:

- Startup is `pnpm install && pnpm dev`.
- No Docker runtime.
- No `dev-up` / `dev-down` scripts.
- No C# source export.
- No desktop Ollama server requirement.
- No local model download.
- One fixed light theme.
- Public routes are canonical only; duplicate legacy app aliases were removed.

The app starts as a clean workspace. Real product use begins by connecting
readonly Gmail and syncing recruiting mail; the sanitized sample story stays in
`/judge-demo` and `/api/pipeline` without writing fake applications into local
workspace state.

For public Vercel review, no Gmail or model key is required. The deployment can
expose `/judge-demo` publicly and leave Gmail/Ollama env values unset. In that
case, CareerOS uses deterministic fallback and ephemeral `/tmp/.careeros-data`
state on Vercel unless `CAREEROS_DATA_DIR` is explicitly configured. This keeps
the judge route inspectable without private credentials or a writable repo
directory.

The Vercel Node runtime is pinned with:

```json
{
  "engines": {
    "node": "22.x"
  }
}
```

`.node-version` also pins local and CI tooling to Node 22. This avoids the
Vercel warning caused by open-ended ranges such as `>=22.5.0`, which can roll
forward to a future major Node release.

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
CAREEROS_GEMMA_MODEL=gemma4:31b
OLLAMA_API_KEY=your-ollama-cloud-api-key
```

The browser never receives `OLLAMA_API_KEY`. Server routes read it from env,
call Ollama Cloud, validate model output, and send model-backed proposals to
review before state changes.

Added smoke command:

```bash
pnpm smoke:ollama
```

The smoke command reads `.env.local` when present. Without a key this fails
closed with a clear diagnostic. With a real key it is the direct live smoke
test for Ollama Cloud readiness.

## Agent Safety

The agent system is deliberately review-gated:

- Deterministic first-run path works without any provider.
- Model output must be strict JSON.
- Model responses are schema-validated.
- Model-backed workflow updates never mutate application state directly.
- Risky updates such as offers, rejections, deadlines, ambiguous matches, and
  invalid model output enter the manual review queue.
- `lib/agent-constraints.ts` keeps handoff payloads, guardrail types, prompt
  size limits, trace redaction, and review-required cases explicit in code.
- Accepted or corrected review items are the only path from model proposal to
  durable application mutation.
- Corrected review items now write compact local feedback facts into
  `candidateContext.feedbackFacts`; later imports and Gemma prompts can use
  those hints, while still passing schema validation and review gates.
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
- Workspace export writes connector state through an explicit public-field
  whitelist before serializing JSON.
- Synced Gmail messages are fetched as readonly metadata/snippets and converted
  to bounded recruiting import records. Full Gmail message bodies are not
  requested or persisted.

Tests open the token file and verify it does not contain plaintext
`access-token` or `refresh-token`.

## Eval Coverage Added

`pnpm eval:pipeline` now runs a dataset-mapped product-loop eval and generates:

```text
eval/results.json
docs/media/eval-results.png
```

Current result: **15/15 passed** across action routing, stage extraction,
review-gate behavior, and mutation safety.

The eval uses public dataset components plus sanitized local recruiting
fixtures:

- Enron email: mailbox/thread style.
- SpamAssassin email classification: non-recruiting noise.
- LinkedIn job postings: company, role, location, salary, application/JD URL,
  and skill fields.
- Resume dataset: resume/context text.
- Fake vs Real Job Postings: suspicious-job evidence.
- Synthetic recruiting fixtures: OA deadlines, phone screens, technical
  interviews, offers, rejections, ambiguous recruiter replies, and resume
  context.

Each case must remain stage-aware and review-gated. This addresses the concern
that real mailbox noise needs concrete eval coverage, not just conceptual agent
claims.

## Public Docs Shape

Current public docs:

- `README.md` — first-run onboarding and public product summary
- `SECURITY.md` — local data, OAuth, model-key, and public-release boundaries
- `docs/architecture.md` — runtime, data, and agent boundaries
- `docs/api-spec.md` — route handler API surface
- `docs/browser-smoke.md` — browser smoke coverage and screenshot proof set
- `docs/eval.md` — dataset-mapped pipeline eval proof and graph
- `docs/design.md` — product surface and UX direction
- `docs/hackathon-writeup.md` — Kaggle Gemma 4 Good narrative
- `docs/roadmap.md` — shipped phases and future work
- `docs/release-summary.md` — this summary

Removed or folded:

- root coding-agent guidance doc
- implementation prompt docs
- broad local-first planning docs
- stale TODO docs
- product completion plan; completion status now lives in this release summary
  and proof docs
- long provider research note; the compact provider roadmap now lives in
  `docs/roadmap.md`

## Judge Proof Artifacts

`pnpm smoke:browser` generates sanitized desktop/mobile screenshots under:

```text
test-results/browser-smoke/
```

Important proof screenshots:

- `docs/media/judge-demo.png`
- `docs/media/submission-thumbnail-560x280.png`
- `docs/media/architecture.png`
- `docs/media/eval-results.png`
- `seeded-desktop-judge-demo.png` / `seeded-mobile-judge-demo.png`
- `empty-desktop-home.png` / `empty-mobile-home.png`
- `seeded-desktop-applications.png`
- `seeded-desktop-applications-app_atlas.png`
- `seeded-desktop-review.png`
- `empty-desktop-settings-section-gmail.png`
- `seeded-desktop-agents.png`

These files are ignored by git and should be curated into the Kaggle media
package only after a final privacy check.

## Current Validation

Latest local validation:

```bash
bash scripts/public-safety-check.sh
pnpm check
pnpm test
pnpm eval:pipeline
pnpm build
pnpm smoke:browser
pnpm smoke:ollama
git diff --check
```

Current unit coverage after route-handler hardening and feedback-memory work:
`85/85` tests passing.
Current pipeline eval: `15/15` fixtures passing.

`pnpm smoke:browser` passes and covers seeded plus clean workspace
desktop/mobile render, required judge/demo copy, no horizontal overflow, no
legacy links, and screenshot generation for the main judge routes.

`pnpm smoke:ollama` exists as a real key-backed Cloud smoke test, reads
`.env.local` when present, and passes the public no-key gate with a
`skipped_no_key` diagnostic when `OLLAMA_API_KEY` is absent. With a local
`OLLAMA_API_KEY` and available `gemma4:31b` model, it should return
`status=ready` and exercise the server-side model path.

One-command release gate:

```bash
pnpm release:check
```

This chains public-safety scan, TypeScript, unit tests, pipeline eval,
production build, browser smoke, Ollama Cloud smoke, and whitespace checks.
`pnpm smoke:ollama` is part of the maintainer release gate; without a valid
local `OLLAMA_API_KEY`, it verifies the no-key public path and exits cleanly
while the app and `/judge-demo` still run without credentials.

GitHub Actions runs the no-key public gate with:

```bash
pnpm ci:public
```

That covers public-safety scan, TypeScript, unit tests, pipeline eval,
production build, browser smoke, and whitespace checks without requiring
repository secrets. The workflow runs `pnpm smoke:ollama` only when the
`OLLAMA_API_KEY` secret is configured.

## Post-Release Follow-Up

These are not needed for the public hackathon demo, but are the next real
hardening steps for hosted product parity:

- Run a real Gmail OAuth sync against a sanitized disposable mailbox before
  recording the final video, if available.
- Add a larger mailbox eval fixture set from fake but realistic recruiter
  threads, duplicate updates, stale follow-ups, and attachment evidence.
- Add background job scheduling only if the hosted product needs continuous
  sync.
- Add BYOK OpenAI / Anthropic / OpenRouter only after explicit credential
  storage and redaction review.
