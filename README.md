# CareerOS

A simple local Next.js demo of the CareerOC / Other Candidate job-mailbox
pipeline for the Kaggle Gemma 4 Good hackathon.

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
open-source demo: one Next.js app, local state, optional Gmail readonly sync,
optional Ollama Cloud/Gemma4 analysis, and no separate backend stack.

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
sanitized Kaggle story without credentials, open `/judge-demo`.

## Optional: Gemma4 Through Ollama Cloud

CareerOS calls the Ollama Cloud API from the Next.js server. Users do not set
up a desktop model runtime. Create an Ollama Cloud API key, then create
`.env.local`:

```bash
CAREEROS_OLLAMA_ENABLED=true
CAREEROS_OLLAMA_BASE_URL=https://ollama.com
CAREEROS_GEMMA_MODEL=gemma4:e4b
OLLAMA_API_KEY=your-ollama-cloud-api-key
```

Restart `pnpm dev`, then open `/settings` and click **Save and check**.

Ollama's current docs list `https://ollama.com/api` as the cloud API base URL
and `OLLAMA_API_KEY` as the authentication env var.

For a real key-backed smoke test without starting the app:

```bash
OLLAMA_API_KEY=your-ollama-cloud-api-key pnpm smoke:ollama
```

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

Restart `pnpm dev`, open `/settings?section=gmail`, click **Connect Gmail**,
finish Google OAuth, then click **Sync recruiting mail**.

Token boundary: the Gmail token is stored as an AES-GCM envelope at
`.careeros-data/gmail-oauth.json`, using `CAREEROS_TOKEN_SECRET`,
`CAREEROS_SECRET_KEY`, or the configured Gmail client secret as key material.
That directory is gitignored. Do not commit real `.env.local`, Gmail data,
screenshots with private email, or local state.

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

## Local Data

Default state is stored in:

```text
.careeros-data/state.json
```

Reset from the UI with `/settings`, or delete `.careeros-data` while the dev
server is stopped. The next app read recreates an empty workspace.

## Commands

```bash
pnpm dev       # run the local Next.js app
pnpm check     # TypeScript
pnpm test      # Vitest
pnpm build     # production build
pnpm run ci    # check + test + build
```

## Public Safety

Before publishing, verify:

- No real `.env*` files except `.env.example`
- No `.careeros-data`, local DBs, Gmail exports, OAuth tokens, or screenshots
  with private email
- No hosted provider dashboard URLs or local machine paths

## Docs

- [Architecture](docs/architecture.md)
- [API spec](docs/api-spec.md)
- [Design](docs/design.md)
- [Hackathon writeup](docs/hackathon-writeup.md)
- [Provider roadmap](docs/provider-research.md)
- [Roadmap](docs/roadmap.md)
- [Release summary](docs/release-summary.md)

## License

MIT — see [LICENSE](LICENSE).
