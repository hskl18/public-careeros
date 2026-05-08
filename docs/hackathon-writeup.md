# Hackathon Writeup

Last updated: 2026-05-08

## Title

CareerOS: Local-First Job Pipeline With Gemma

## Summary

CareerOS is an open-source, local-first job pipeline dashboard. It reads
recruiting evidence from local data or an optional Gmail connector, extracts
application updates with Gemma through Ollama, routes uncertain changes through
evidence review, and helps job seekers avoid missing interviews, assessments,
offers, deadlines, and follow-ups.

Other Candidate is the hosted product built on CareerOS and available at
`careeroc.com`.

## Why It Matters

Students and early-career candidates often manage high-volume job searches from
Gmail and spreadsheets. Important updates can be buried in long threads or
mixed with unrelated mail. CareerOS turns that evidence into a visible,
correctable pipeline so candidates can act on the right updates at the right
time.

## How Gemma Is Used

- inbox triage
- workflow extraction
- evidence review before risky state changes
- resume extraction
- resume evaluation grounded in application history
- multimodal artifact evidence for screenshots or PDFs
- notification summaries for deadlines, recruiter replies, review blocks, and
  model status

The demo environment routes fast, primary, and fallback model settings to
`gemma4:31b-cloud`. Smaller-model routing is a future cost/performance follow-up
and should not be narrated as the current live path.

## Demo Path

- Public overview: `https://www.careeroc.com`
- Judge-safe demo: `https://www.careeroc.com/judge-demo`
- Architecture page: `https://www.careeroc.com/tech`
- API readiness: `https://api.example.com/health/ready`

The judge-safe demo uses fake data and does not require Gmail access.
