# Product Completion Plan

Last updated: 2026-05-15

This repo should be evaluated as a **Kaggle/Gemma hackathon judge-facing demo
product**, not as the full hosted Other Candidate backend. The goal is for a
reviewer to clone it, run it, and quickly verify that CareerOS is a
Gemma-aware recruiting inbox pipeline rather than a generic chatbot.

## Current Demo Score

| Area | Score | Current truth |
| --- | ---: | --- |
| Judge-facing product loop | 10/10 | `/judge-demo`, `/`, `/agents`, `/applications`, `/review`, `/resume`, `/settings`, and `/notifications` show the evidence -> extraction -> review gate -> application/reminder loop without Gmail or user data. |
| Core product logic | 10/10 | Deterministic pipeline, review gates, local JSON persistence, optional Gmail, optional Ollama Cloud/Gemma, resume context, notifications, provider registry, and strict import/export boundaries are implemented for the public demo scope. |
| Release packaging | 10/10 | `pnpm release:check` runs public-safety scan, TypeScript, Vitest, build, seeded/empty browser smoke, Ollama Cloud smoke, and whitespace checks. The app and judge demo still run without provider credentials. |
| Submission proof | 10/10 | Browser smoke generates desktop/mobile screenshots under `test-results/browser-smoke/`; docs call these out as judge proof artifacts. |

## Shipped For Judge Demo Release

- [x] Clean first-run workspace. No fake application records are written into a
  user's workspace just to make the app look populated.
- [x] Canonical `/judge-demo` route with sanitized sample recruiting evidence.
- [x] Full visible loop: mailbox evidence -> agent extraction -> Gemma or
  deterministic trace -> review gate -> application/reminder result.
- [x] Browser smoke coverage for seeded and clean workspaces on desktop and
  mobile for `/`, `/judge-demo`,
  `/applications`, `/applications/app_atlas`, `/review`, `/resume`,
  `/agents`, `/settings`, and `/notifications`.
- [x] Request-size and field caps on `app/api/import/route.ts` and
  `app/api/resume/route.ts`.
- [x] Sanitized Gmail OAuth callback failure handling; provider raw errors are
  not echoed to the user.
- [x] Strict local workspace export/import boundaries: no OAuth token,
  provider key, raw prompt, raw response, raw Gmail body, private path, or
  oversized dump is accepted as workspace state.
- [x] `pnpm smoke:ollama` reads `.env.local`, reaches Ollama Cloud when a key
  exists, and fails closed without a key.
- [x] `pnpm release:check` exists for full maintainer release validation,
  including live Ollama Cloud smoke when `.env.local` has `OLLAMA_API_KEY`.
- [x] Public assets under `public/agents` and `public/mascots` are used by the
  app.

## Judge Proof Artifacts

`pnpm smoke:browser` writes sanitized screenshots to:

```text
test-results/browser-smoke/
```

Generated proof set:

- `seeded-desktop-judge-demo.png` and `seeded-mobile-judge-demo.png` — agentic judge demo
  with sanitized mailbox evidence, model path, trace, and review gate.
- `empty-desktop-home.png` and `empty-mobile-home.png` — clean local pipeline console.
- `seeded-desktop-applications.png` and `seeded-desktop-applications-app_atlas.png` —
  evidence-backed application state from the seeded smoke fixture.
- `seeded-desktop-review.png` — review-gated automation surface.
- `empty-desktop-settings-section-gmail.png` — Gmail/Gemma/local-data setup surface.
- `seeded-desktop-agents.png` — agent contracts, memory boundaries, and can/cannot-do
  rules.

These files are intentionally ignored by git. Use them for Kaggle media,
README screenshots, or video planning only after confirming they contain no
private Gmail, `.env.local`, OAuth tokens, API keys, or local paths.

## Release Check

Run:

```bash
pnpm release:check
```

This runs:

1. `bash scripts/public-safety-check.sh`
2. `pnpm check`
3. `pnpm test`
4. `pnpm build`
5. `pnpm smoke:browser`
6. `pnpm smoke:ollama`
7. `git diff --check`

`pnpm smoke:ollama` requires a valid local `OLLAMA_API_KEY` in `.env.local` to
return `ready`; without a key, it exits non-zero with a bounded diagnostic by
design. This is correct for the maintainer release gate. The app, browser
smoke, and judge demo still run without model credentials.

## Post-Release Follow-Up

- Run one sanitized real Gmail OAuth sync before recording the final video if a
  disposable demo mailbox is available.
- Curate a small Kaggle media folder from `test-results/browser-smoke/` and
  generated thumbnails. Keep generated media out of git unless intentionally
  publishing sanitized assets.
- Add more fake mailbox eval fixtures for duplicate recruiter threads,
  deadline changes, offer details, and stale follow-up suppression.
- Add accessibility smoke after the browser smoke harness stabilizes.
- Keep OpenAI, Anthropic, OpenRouter, MLX, llama.cpp, LiteRT, vLLM, SGLang,
  and MTP drafters as roadmap/provider-registry labels only until real adapter
  code, credential boundaries, tests, and smoke evidence exist.

## Completion Framing

For the hackathon public demo, the current target is not hosted-product parity.
The target is judge confidence:

- clone and run quickly
- no Gmail or real data required
- Gemma/Ollama Cloud path visible
- deterministic fallback visible
- review gate visible
- state mutation boundaries visible
- docs/writeup/screenshots prove this is a recruiting pipeline, not a chatbot

By that standard, this package is release-complete.
