# ADR 004: Deterministic Fallback

Status: accepted

## Context

Provider credentials, model availability, latency, and output validity can fail independently of the recruiting workflow.
A judge or contributor should still be able to inspect evidence routing and review behavior without a paid key.

## Decision

CareerOS keeps a deterministic parser as the credential-free baseline.
Optional Gemma output must satisfy the schema and enter the same review boundary.
Evaluation artifacts keep deterministic fixture results separate from provider smoke tests and future live-model runs.

## Consequences

The core product loop remains reproducible at zero provider cost.
Deterministic rules have limited language coverage, and the current 130-case run exposes false review routes that a future model comparison can target.
