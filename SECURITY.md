# Security Policy

CareerOS is a local-first open-source product. The public repo is sanitized by
default and should not contain real user data, Gmail content, OAuth tokens,
deployment secrets, database exports, or local runtime artifacts.

## Boundaries

- The default local runtime must work without hosted provider credentials.
- Gmail is optional and disabled by default. The public milestone exposes
  connector status and placeholder actions only.
- OAuth tokens must not be stored until encrypted credential storage is designed
  and reviewed.
- Model traces should store provider, model tag, purpose, confidence, latency,
  bounded errors, and redacted evidence snippets. They should not store full
  source bodies, full prompts, raw model responses, or OAuth tokens.
- Low-confidence career state changes must go through a review gate instead of
  silently mutating applications or reminders.
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
