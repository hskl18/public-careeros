# ADR 002: Bounded Evidence Instead of Full Message Bodies

Status: accepted

## Context

Recruiting email can contain private contact data, interview details, and unrelated thread content.
The workflow needs enough source material to explain a proposal without turning the local store into a mailbox archive.

## Decision

CareerOS stores bounded snippets, hashes, source-message identifiers, and explicit source relationships.
The Gmail connector requests readonly metadata and snippets for the public workflow.

## Consequences

Reviews remain traceable while the stored surface stays smaller than a full-email mirror.
Some context can be lost at the snippet boundary, so uncertain proposals must remain reviewable.
