# CareerOS

CareerOS is the public Gemma hackathon demo of the CareerOS / Other Candidate
recruiting inbox pipeline. It is a judge-facing local demo/source repo, not the
full hosted Other Candidate codebase.

Run it with:

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000/judge-demo` for the credential-free judge
demo. No Gmail account, Ollama Cloud key, hosted database, Docker runtime, or
model download is required to inspect the full agentic workflow.

What judges should see immediately:

- sanitized mailbox evidence
- Gemma via Ollama Cloud as the optional model path
- deterministic fallback when no key is configured
- evidence -> extraction -> review gate -> application/reminder loop
- model traces and review gates instead of a generic chatbot transcript

CareerOS turns recruiting email into structured application state with a
multi-agent workflow. It is intentionally still the CareerOS pipeline, not a
plain job dashboard:

1. Mailbox triage
2. Workflow extraction
3. Evidence and review gate
4. Resume/context analysis
5. Reminder and notification generation
6. Model routing through Gemma via Ollama Cloud

The hosted product is **Other Candidate** at `careeroc.com`. This repo is the
open-source hackathon demo: one Next.js app, local JSON state, optional Gmail
readonly sync, optional Ollama Cloud/Gemma analysis, deterministic fallback,
and no separate backend stack.

## Agent Contract

The public demo keeps the original CareerOS operating model:

| Agent layer | Can do | Cannot do |
| --- | --- | --- |
| Mailbox triage | Classify recruiting relevance, urgency, company, role, and action from bounded mailbox snippets | Store full inbox bodies or mutate application state |
| Workflow extraction | Propose typed application updates such as OA, interview, rejection, offer, deadline, or follow-up | Apply model output directly |
| Evidence/review | Attach bounded evidence, confidence, source message ids, and block risky/model-backed changes | Hide low-confidence changes from the user |
| Resume/context | Use local target roles, skills, preferences, and resume keywords as candidate context | Upload resume text to hosted providers in this demo |
| Reminder/notification | Derive due dates, follow-ups, review blockers, connector health, and model status from reviewed state | Become a second source of truth |
| Model router/provider | Use deterministic fallback first, or Gemma through Ollama Cloud when `OLLAMA_API_KEY` is configured | Store provider keys in workspace state, auto-download models, or mark roadmap providers as shipped |

Prompt and memory boundaries:

- Gemma prompts use bounded snippets and ask for strict JSON.
- Model output is schema-validated and review-gated before mutation.
- Agent memory is local state: applications, bounded evidence, review items,
  candidate context, model traces, and notifications under `.careeros-data`.
- Model traces keep provider, model tag, task, latency, confidence, fallback,
  and bounded diagnostics. They do not store raw prompts, raw responses, full
  Gmail bodies, OAuth tokens, or provider keys.
- First run has zero model cost and starts as a clean workspace. Connect
  readonly Gmail to create real pipeline records; use `/judge-demo` for the
  sanitized sample story without touching local workspace state.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3000
```

First run opens a clean workspace. To process your real job pipeline, configure
Gmail OAuth, connect readonly Gmail, then sync recruiting mail. To see the
sanitized Kaggle story without credentials or local workspace writes, open
`/judge-demo`.

## Optional: Gemma Through Ollama Cloud

CareerOS calls the Ollama Cloud API from the Next.js server. Users do not set
up a desktop model runtime. Create an Ollama Cloud API key, then create
`.env.local`:

```bash
CAREEROS_OLLAMA_ENABLED=true
CAREEROS_OLLAMA_BASE_URL=https://ollama.com
CAREEROS_GEMMA_MODEL=gemma4:31b
OLLAMA_API_KEY=your-ollama-cloud-api-key
```

Restart `pnpm dev`, then open `/settings` and click **Save and verify Ollama Cloud API**.

This demo allows only the Ollama Cloud base URL `https://ollama.com`; server
code derives API calls under `https://ollama.com/api`.

For a real key-backed smoke test without starting the app:

```bash
pnpm smoke:ollama
```

`pnpm smoke:ollama` reads `.env.local` when present. Without an API key it
fails closed with a clear diagnostic; with a key it checks the configured Gemma
model through Ollama Cloud.

Mental model:

- `http://localhost:3000` is the CareerOS Next.js app.
- `https://ollama.com/api` is the remote Ollama Cloud API.
- The browser never sees `OLLAMA_API_KEY`; server routes read it from
  `.env.local`, call Ollama Cloud, validate JSON, and send proposals to review.

## Optional: Gmail Readonly Sync

Create a Google OAuth Web Application client:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI:
  `http://localhost:3000/api/connectors/gmail/callback`
- Scope used by this demo: `https://www.googleapis.com/auth/gmail.readonly`

Add the local env values:

```bash
CAREEROS_GMAIL_CONNECTOR_ENABLED=true
CAREEROS_GMAIL_CLIENT_ID=your-google-oauth-client-id
CAREEROS_GMAIL_CLIENT_SECRET=your-google-oauth-client-secret
CAREEROS_GMAIL_REDIRECT_URI=http://localhost:3000/api/connectors/gmail/callback
CAREEROS_GMAIL_QUERY='newer_than:90d (recruiter OR application OR assessment OR interview OR "next steps" OR offer OR OA)'
CAREEROS_GMAIL_MAX_RESULTS=10
```

Restart `pnpm dev`, open `/settings?section=gmail`, and confirm the **Google
callback URL** shown in the app exactly matches the Google OAuth **Authorized
redirect URI**. `localhost`, `127.0.0.1`, port, and path must be identical.
Then click **Connect Gmail**, finish Google OAuth, and click **Sync recruiting
mail**.

Token boundary: the Gmail token is stored as an AES-GCM envelope at
`.careeros-data/gmail-oauth.json`, using `CAREEROS_TOKEN_SECRET`,
`CAREEROS_SECRET_KEY`, or the configured Gmail client secret as key material.
Sync requests readonly Gmail metadata/snippets and converts those bounded
snippets into import records; full Gmail bodies are not persisted. Sync uses
small bounded pagination, suppresses already imported message source labels,
merges new messages into local threads, and writes compact local audit events.
That directory is gitignored. The OAuth callback validates local state and only
returns sanitized settings-page statuses; provider raw errors are not shown. Do
not commit real `.env.local`, Gmail data, screenshots with private email, or
local state.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Local pipeline console |
| `/judge-demo` | Kaggle judge story and agent handoff demo |
| `/agents` | Agent contracts, local memory, prompting, and runtime boundaries |
| `/applications` | Application state and mailbox evidence |
| `/applications/[id]` | Application detail, timeline, evidence, review blockers |
| `/review` | Accept, dismiss, or correct review-gated updates |
| `/resume` | Deterministic + optional Gemma resume analysis |
| `/notifications` | Local notification queue |
| `/settings` | Ollama Cloud/Gemma, Gmail, local data, imports |
| `/api/pipeline` | Inspectable multi-agent pipeline JSON |
| `/api/providers` | Implemented/roadmap model provider metadata |
| Metrics API | Local effort metrics for future reporting surfaces |

## Local Data

Default state is stored in:

```text
.careeros-data/state.json
```

Use `/settings?section=local-data` to export, import, or delete local data.
Delete requires the exact confirmation phrase. You can also delete
`.careeros-data` while the dev server is stopped; the next app read recreates
an empty workspace.

## Commands

```bash
pnpm dev       # run the local Next.js app
pnpm check     # TypeScript
pnpm test      # Vitest
pnpm build     # production build
pnpm smoke:browser # headless Chrome route/layout smoke
pnpm smoke:ollama  # optional live Ollama Cloud smoke when .env.local has OLLAMA_API_KEY
pnpm ci:public # public CI gate without requiring provider secrets
pnpm release:check # public safety + check + test + build + browser + Ollama + diff check
pnpm run ci    # check + test + build
```

## Public Safety

Before publishing, verify:

- No real `.env*` files except `.env.example`
- No `.careeros-data`, local DBs, Gmail exports, OAuth tokens, or screenshots
  with private email
- No hosted provider dashboard URLs or local machine paths

## Docs

- [Security](SECURITY.md)
- [Architecture](docs/architecture.md)
- [API spec](docs/api-spec.md)
- [Browser smoke and screenshot proof](docs/browser-smoke.md)
- [Design](docs/design.md)
- [Product completion plan](docs/product-completion-plan.md)
- [Hackathon writeup](docs/hackathon-writeup.md)
- [Roadmap](docs/roadmap.md)
- [Release summary](docs/release-summary.md)

## License

MIT — see [LICENSE](LICENSE).
