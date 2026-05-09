# Product Design

Last updated: 2026-05-08

## Positioning

CareerOS is a local-first career workflow product for individual job seekers.
The public version starts with one clear job: make recruiting evidence visible,
structured, and correctable without requiring a hosted account, Gmail OAuth, or
cloud infrastructure.

The hosted Other Candidate product can remain Gmail-first. The open-source
CareerOS base should preserve the same product principles while making the first
run provider-free.

The product is intentionally narrow:

- seeded demo data and local import
- one local workspace user
- one operational dashboard
- application pipeline, review queue, resume intelligence, notifications, and
  settings
- optional Gmail connector status without OAuth credential storage
- optional Ollama/Gemma analysis after explicit local setup

The goal is not to look like a throwaway prototype. It should feel like a small
but durable product foundation that can keep growing.

## Primary User

- An individual job seeker.
- Someone actively applying and interviewing.
- Someone who receives meaningful recruiting traffic in email, files, or manual
  notes.
- Someone who wants automation but still wants final control when the system is
  uncertain.

## Core Product Promise

CareerOS should turn unstructured recruiting evidence into:

- application records
- stage changes
- pending actions
- reminders
- notifications
- resume feedback
- a readable timeline of what changed and why

The user should be able to trust the system for routine updates and still
correct it quickly when needed.

## Product Principles

- Keep the product small and operationally clear.
- Prefer visible automation over hidden automation.
- Keep manual correction close to the automated workflow.
- Preserve a clean boundary between evidence and structured application state.
- Make model-backed analysis additive, not foundational.
- Never require Gmail, hosted auth, or a model download for first-run value.

## Current Surface Area

### Dashboard

The dashboard is the operational home screen. It should answer:

- what is in the pipeline
- what needs action now
- what changed recently
- whether local data, connectors, and model status are healthy
- which review items are blocking automation

Current sections include pipeline state, seeded/local import activity, reminders,
recent events, review blocks, model traces, and local runtime status.

### Applications

The applications page shows the durable pipeline state. It should keep evidence
near the application record so the user can inspect why a stage, reminder, or
notification exists.

Current workflows include seeded applications, manual/local import, application
events, evidence snippets, reminders, and review-gated updates.

### Manual Review Queue

The review page exists because email and model understanding are never perfect.

It should let the user:

- accept a suggested update
- dismiss an update that should not mutate the pipeline
- correct key fields before applying a change
- see confidence, source, and model trace metadata before deciding

Low-confidence, risky, invalid, or model-backed updates should be review-visible
before they affect application state.

### Resume

The resume page exists to connect the candidate's material back to the pipeline.
The first public version supports pasted text and deterministic evaluation so it
works without a local model.

Future model-backed resume analysis should keep the same reviewable evidence
boundary used by import analysis.

### Notifications

The notification window is an in-app operating surface, not a marketing feature.
It should surface recruiter replies, due dates, follow-ups, review blocks,
connector health, and model status with stable dedupe keys.

### Settings

Settings should make local runtime state explicit:

- data reset and persistence location
- optional connector state
- Ollama/Gemma status
- disabled, unreachable, missing-model, and ready model outcomes

## UX Direction

The UX should feel like an operational console rather than a generic SaaS CRUD
app.

Design intent:

- strong hierarchy
- high-signal metrics
- obvious action surfaces
- minimal navigation depth
- dense but readable workflow panels
- visible confidence and review metadata
- direct action buttons instead of hidden menus

## What The Product Does Not Try To Solve Yet

- multi-user collaboration
- recruiter CRM
- calendar synchronization
- outbound automation
- hosted account management
- production Gmail OAuth and token storage
- advanced analytics and reporting workflows

Those are later layers, not requirements for the current local-first foundation.

## Near-Term Design Expansion

The most natural next product steps are:

- a real safe Gmail connector with encrypted credential storage
- richer review queue filtering and prioritization
- thread-level evidence views and summaries
- reminder completion history
- analytics trends over time
- local export/delete controls for user-owned data

## Long-Term Design Constraint

As CareerOS grows, the product should still preserve one rule:

automation can suggest and update, but the user must always be able to inspect,
correct, and override the workflow state.
