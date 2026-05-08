# Public Repo Scope

Last updated: 2026-05-08

This repository is the sanitized public CareerOS package. CareerOS is the
open-source, local-first job pipeline system. Other Candidate is the hosted
product built on CareerOS and published at `careeroc.com`.

The private implementation remains the source of truth for hosted Other
Candidate behavior. This repo now exposes a runnable local CareerOS base plus
reviewed source excerpts for judges and technical reviewers.

## Intended Shape

The public repo should be useful to judges and technical reviewers:

- explain what the product does
- explain the CareerOS versus Other Candidate naming boundary
- show how Gemma is used
- document the architecture and trust boundaries
- include enough source or source excerpts to prove the implementation is real
- include safe setup instructions and a provider-free local runtime
- avoid private deployment and user data

## First Public Release Candidate

Recommended first cut:

- root README
- public architecture docs
- hackathon writeup
- security notes
- `.env.example`
- selected frontend judge-demo route and static demo data
- selected backend DTO/service snippets for trace summaries, review gates, and
  artifact evidence
- CI config after replacing private-only environment references

Current public package:

- public repository slug: `public-careeros`
- product name: `CareerOS`
- license: MIT
- runnable Next.js local dashboard with route-handler APIs
- local SQLite state adapter with seeded demo data and JSON fallback
- deterministic import, review, resume, notification, and model-status logic
- selected source excerpts copied under `source/`
- public safety scan available at `scripts/public-safety-check.sh`
- secret/data scan passed locally on 2026-05-08

## Keep Private

- real Gmail messages or thread ids
- real user profiles and student email addresses
- Neon/Railway/Vercel project ids, tokens, and dashboard screenshots that expose
  account metadata
- `.env.deploy` and other private environment files
- private admin diagnostics data
- local `.artifacts/` unless intentionally sanitized for Kaggle media

## Promotion Process

1. Copy reviewed files into `public-careeros/`.
2. Delete or rewrite private-root references.
3. Run secret scanning and `rg` checks for tokens, emails, and provider secrets.
4. Run the private repo validation suite.
5. Initialize/publish the public CareerOS repository with a clean initial
   commit.
6. Push only after the public folder is independently reviewed and local checks
   pass.
