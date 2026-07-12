# ADR 003: Local Workspace Memory

Status: accepted

## Context

Applications, review decisions, resume context, and correction facts contain sensitive career data.
The public demo also needs a credential-free path that reviewers can run without provisioning a database.

## Decision

CareerOS keeps workspace state in a local repository abstraction backed by `.careeros-data` for the demo.
Exports use explicit public-field validation, and token or provider-key fields are rejected.

## Consequences

The demo remains inspectable and portable without a hosted database.
The Vercel fallback is ephemeral, and the repository does not claim multi-user durability or production backup guarantees.
