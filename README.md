# CareerOS Public Repo Kit

CareerOS is the open-source, local-first job pipeline system behind Other
Candidate. It turns recruiting email, resume context, and Gemma/Ollama analysis
into an evidence-backed dashboard for applications, deadlines, review items, and
notifications.

Other Candidate is the hosted product built on CareerOS and published at
`careeroc.com`.

This repository is now the first runnable local-first CareerOS base. It still
keeps selected source excerpts under `source/`, but the root app can run without
Gmail, Google sign-in, Vercel, Railway, Neon, or Ollama.

## Public Scope

Release candidate:

- Repository slug: `public-careeros`
- Product name: `CareerOS`
- License: MIT, see `LICENSE`
- Package type: runnable local-first product plus sanitized source excerpts

Include:

- product README and setup notes
- architecture and runtime diagrams in markdown
- product design, API surface, and roadmap docs
- Gemma usage explanation and judge demo flow
- safe `.env.example` with variable names only
- security and privacy notes
- implementation TODOs that are safe to show publicly
- reviewed source excerpts under `source/`

Exclude:

- real `.env`, `.env.deploy`, `.env.local`, or Railway/Vercel/Neon secret values
- Gmail message bodies, OAuth tokens, database dumps, and user emails
- local screenshots under `.artifacts/` unless they are sanitized and intended
  for the submission
- private admin runbooks with account-specific hostnames or credentials
- generated dependency directories such as `node_modules`, `.next`, `bin`, and
  `obj`

## Local Setup

Install dependencies and start the local dashboard:

```bash
./scripts/dev-up.sh
```

Then open `http://localhost:3000`.

Stop the local stack from another shell:

```bash
./scripts/dev-down.sh
```

The script installs dependencies when needed, seeds local demo data, starts
Next.js, and records the running process in `.dev/`.

Optional overrides:

```bash
PORT=3001 ./scripts/dev-up.sh
CAREEROS_DEV_HOST=127.0.0.1 ./scripts/dev-up.sh
```

On Windows without Git Bash or WSL Bash, use the equivalent PowerShell path:

```powershell
pnpm dev:up:ps
```

Then open `http://127.0.0.1:3000`. Stop it with:

```powershell
pnpm dev:down:ps
```

The first request seeds local demo data into `.careeros-data/careeros.sqlite`. You
can also reset it explicitly:

```bash
pnpm seed
```

Docker is available for the same provider-free path:

```bash
USE_DOCKER=1 ./scripts/dev-up.sh
```

Ollama/Gemma is disabled by default. To enable local model status checks and
bounded model-backed import analysis, copy `.env.example` to `.env.local`, set
`CAREEROS_OLLAMA_ENABLED=true`, start Ollama, and pull the configured model
yourself:

```bash
ollama pull gemma3:4b
```

CareerOS never downloads model weights automatically.

Model-backed analysis only runs after:

1. Ollama responds on the configured base URL.
2. The configured Gemma tag is installed.
3. A small bounded health prompt returns the expected JSON.

Any accepted model output is schema-validated and queued as a review item before
it can mutate application state. Invalid model output is also review-visible and
falls back to deterministic behavior.

## Product Summary

CareerOS turns recruiting email into an evidence-backed application pipeline. A
job seeker connects Gmail, the system syncs recruiting messages, Gemma helps
classify and extract workflow updates through local or configured Ollama, and
uncertain changes go through a review gate before they affect the dashboard.

The product surface is intentionally simple: dashboard, applications, review
queue, resume intelligence, model trace evidence, notifications, and settings.
Manual/JSON import and deterministic processing work with Ollama disabled. The
preferred persistence adapter is a local SQLite file behind a repository
interface. JSON remains available with `CAREEROS_PERSISTENCE=json` for simple
development fallback.

## Current Hosted Demo Stack

Other Candidate, the hosted product at `careeroc.com`, currently uses:

- Web: Next.js on Vercel
- API: .NET 8 on Railway
- Database: Neon PostgreSQL
- Email: Gmail OAuth and Gmail API
- Model runtime: Gemma through Ollama, with the demo environment routed to
  `gemma4:31b-cloud`
- CI: GitHub Actions for backend tests, frontend lint/build, API contract drift,
  bundle budget, and production smoke

## Local-First Product Direction

The open-source CareerOS product should be smaller than the hosted Other
Candidate app:

- dashboard, applications, review, resume, notifications, and local settings
- Gmail connector as an optional user-controlled source
- seeded demo data and local import before hosted provider setup
- optional local Ollama/Gemma analysis with deterministic fallback
- localhost-first setup and provider-free defaults
- clear model status before any model-backed pipeline step runs

See [Local-first product plan](docs/local-first-product-plan.md).

## Runnable Routes

- `/`: operational dashboard and manual processing control
- `/applications`: application state, events, evidence, and local import form
- `/review`: accept, dismiss, or correct review-gated proposed mutations
- `/resume`: paste resume text and run deterministic fallback evaluation
- `/notifications`: derived in-app notification window with dedupe keys
- `/settings`: local data reset, optional connector status, and Ollama status
- `/judge-demo`: provider-free judge entry point

## Local Data

By default, local data is stored at:

```text
.careeros-data/careeros.sqlite
```

The SQLite adapter initializes its table on first access and stores the current
inspectable CareerOS state snapshot. Reset local seed data with:

```bash
pnpm seed
```

For JSON fallback:

```bash
CAREEROS_PERSISTENCE=json pnpm dev
```

That writes `.careeros-data/state.json`.

## Optional Gmail Connector

Gmail is visibly optional and disabled by default:

```text
CAREEROS_GMAIL_CONNECTOR_ENABLED=false
```

The current connector exposes status, connect/disconnect placeholders, and a
sync placeholder that returns a clear not-implemented result. It does not start
OAuth, auto-sync, store credentials, or require Google setup for local use.

## Public Demo Path

Judges should not need to connect their own Gmail account just to understand the
core product loop. The public app includes a judge-safe fake workspace at
`/judge-demo` with anonymized recruiting threads, Gemma trace metadata, review
gates, and one multimodal artifact evidence card.

The real authenticated product remains available for the owner-controlled demo
account and shows Gmail sync, application state, review queue, resume
intelligence, and admin diagnostics.

## Public Release Checklist

1. Run `bash scripts/public-safety-check.sh`.
2. Run `pnpm check`, `pnpm test`, and `pnpm build`.
3. Start `./scripts/dev-up.sh`, or use the PowerShell commands above on Windows,
   and smoke `/`, `/applications`, `/review`, `/resume`, `/notifications`, and
   `/settings` with Ollama disabled.
4. Confirm every screenshot and fixture is sanitized.
5. Keep hosted Other Candidate deployment details out of the public base.

## Documentation

- [Public repo scope](docs/public-repo-scope.md)
- [Architecture summary](docs/architecture.md)
- [Product design](docs/design.md)
- [API spec](docs/api-spec.md)
- [Roadmap](docs/roadmap.md)
- [Local-first product plan](docs/local-first-product-plan.md)
- [Logic implementation prompt](docs/logic-implementation-prompt.md)
- [Frontend implementation prompt](docs/frontend-implementation-prompt.md)
- [Hackathon writeup](docs/hackathon-writeup.md)
- [Public TODO](docs/todo.md)
