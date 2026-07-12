# Case Study: Assessment Deadline from Evidence to Reviewed State

This case study follows one sanitized fixture through the public CareerOS pipeline.
All names, addresses, dates, and URLs are synthetic.

## Requirement

A candidate receives an assessment reminder after applying to many roles.
The system must connect the message to the correct company and role, preserve the deadline evidence, and avoid changing canonical application state until the candidate reviews the proposal.

## Input evidence

```text
From: mira.chen@heliosdata.example
Subject: Helios Data online assessment reminder

Your OA for the Machine Learning Platform Intern role is due Friday at 5:00 PM PT.
You applied with resume-ml-v4.pdf through Handshake.
```

The import path stores a bounded snippet and source-message identifiers.
It does not persist a full Gmail body in the public demo state.

## Agent handoff

| Layer | Output |
| --- | --- |
| Mailbox triage | Recruiting evidence with an assessment and deadline signal |
| Workflow extraction | Company, role, stage, resume version, source, and proposed deadline |
| Evidence review | Bounded snippet, source relationship, confidence, and review reason |
| Model router | Deterministic parser for the credential-free path; optional Gemma output follows the same review boundary |

## Proposed mutation

```json
{
  "company": "Helios Data",
  "role": "Machine Learning Platform Intern",
  "stage": "assessment",
  "resumeVersion": "resume-ml-v4.pdf",
  "applicationSource": "Handshake",
  "deadlineAt": "2026-05-15T16:00:00.000Z"
}
```

The assessment stage and deadline make this a risky mutation.
CareerOS creates an open review item and leaves the newly proposed application out of canonical tracker state.

## Human review

The candidate can accept, correct, or dismiss the proposal.
A correction remains visible as a compact local feedback fact, but it cannot bypass validation or later review gates.

## State change after acceptance

Acceptance applies the typed mutation, appends a source-linked event, and refreshes reminders.
The reminder and notification layers read reviewed state instead of acting as another source of truth.

## Failure behavior

- An invalid or uncertain model response creates a review item instead of a write.
- A missing provider key keeps the deterministic path available.
- Non-recruiting noise stops before extraction.
- An unfamiliar company-role match can produce a false review route, which the versioned error analysis records.

## Reproduce

Run `pnpm eval:generate && pnpm eval:pipeline`, then inspect the `assessment_*` cases in `eval/results.json`.
Open `/judge-demo` for the visual version of the same evidence-to-review sequence.
