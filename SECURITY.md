# Security Policy

CareerOS is an open-source, local-workspace product. The public repo is
sanitized by default and should not contain real user data, Gmail content,
OAuth tokens, deployment secrets, database exports, or local workspace artifacts.

## Boundaries

- The default workspace must work without hosted provider credentials.
- Gmail is optional and disabled by default. The local demo supports readonly
  Gmail OAuth only after the user configures local Google credentials.
- Gmail OAuth tokens must stay in the local `.careeros-data/gmail-oauth.json`
  file as an AES-GCM envelope. They must never be included in workspace
  export/import, fixtures, screenshots, docs, commits, or generated release
  artifacts.
- Model traces should store provider, model tag, purpose, confidence, latency,
  bounded errors, and redacted evidence snippets. They should not store full
  source bodies, full prompts, raw model responses, or OAuth tokens.
- Low-confidence career state changes must go through a review gate instead of
  silently mutating applications or reminders.
- State-changing local API routes reject cross-origin browser requests. Direct
  local CLI calls without an `Origin` header are still allowed for development.
- Workspace JSON import accepts only the normalized CareerOS export shape and
  rejects private paths, OAuth/token/provider-key fields, raw inbox bodies, full
  prompts, raw model responses, secret-looking values, and oversized dumps
  before writing local state.
- Ollama/Gemma status checks only connect to Ollama Cloud at
  `https://ollama.com/api`. User-entered model endpoints are blocked to avoid
  turning model setup into a generic outbound fetch surface.
- Local database files under `.careeros-data/` are user data and must stay out
  of git.

## Supported Versions

The public repository is pre-1.0. Security fixes should target `main`.

## Reporting

Open a GitHub security advisory or private issue with enough reproduction detail
to verify the problem. Do not include real Gmail content, OAuth tokens, API keys,
or private database files in reports.

## Public Release Checklist

- Run a secret scan before publishing.
- Confirm `.env*` files are excluded except `.env.example`.
- Confirm screenshots and fixtures use fake or explicitly sanitized data.
- Confirm no database dumps, SQLite files, Gmail exports, OAuth tokens, or local
  logs are present.
- Confirm public docs do not expose private admin accounts, API keys, or
  provider dashboard URLs.
