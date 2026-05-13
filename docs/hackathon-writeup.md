# Hackathon Writeup

Last updated: 2026-05-12

Kaggle Gemma 4 Good submission narrative for CareerOS. For the product itself
see the [README](../README.md), [design.md](design.md), and
[architecture.md](architecture.md).

## Title

**CareerOS: Multi-Agent Job-Mailbox Pipeline With Gemma**

## Summary

CareerOS is a private-workspace multi-agent job-mailbox pipeline. It reads Gmail
or user-provided recruiting-style mailbox evidence, triages relevance and urgency,
extracts application-update proposals, routes every model-backed mutation
through evidence review, and helps job seekers stop missing interviews,
assessments, offers, deadlines, and follow-ups.

## Competition spec snapshot

Last checked 2026-05-10. Canonical page:
`https://www.kaggle.com/competitions/gemma-4-good-hackathon`.

| Field | Value |
| --- | --- |
| Organizer | Google DeepMind + Kaggle |
| Format | Online hackathon; solo or up to 5 |
| Start | 2026-04-02 |
| Deadline | 2026-05-18 23:59 UTC |
| Prize pool | $200,000 |
| Submission package | Public video, public code, working demo, technical analysis |
| Judging | Impact & Vision, Video Pitch & Storytelling, Technical Depth & Execution |
| Impact tracks | Health & Sciences, Global Resilience, Future of Education, Digital Equity, Safety & Trust |
| Special-tech tracks | Cactus/mobile-wearable, LiteRT, llama.cpp, Ollama/local ops, Unsloth/fine-tuning |

Best-fit prize story for CareerOS: **main track + Safety & Trust + Gemma via
Ollama Cloud** — privacy-preserving workspace state, evidence-backed updates,
and review-gated automation.

## Why it matters

Students and early-career candidates run high-volume job searches from Gmail
and spreadsheets. Important updates get buried; the inbox already contains
the truth (confirmations, recruiter replies, OA deadlines, interview
logistics, rejections, offers), but candidates rebuild that state manually in
spreadsheets that lose JD link, resume version, source, recruiter contact,
salary/location, and the *reason* for the next follow-up.

CareerOS treats that as the wedge: **the mailbox becomes the job pipeline.**
The system extracts the useful state, keeps evidence attached, suppresses
stale follow-ups when the process moves forward, and routes uncertain changes
through a manual review gate before anything durable changes.

## How Gemma is used

Gemma via Ollama Cloud is the hero path:

- mailbox triage over Gmail recruiting threads or sanitized judge/demo fixtures
- workflow extraction into typed application proposals
- evidence review before risky or model-backed state changes
- resume/context grounding from candidate data
- reminder and notification derivation
- notification summaries for deadlines, recruiter replies, review blocks,
  model status

Model story stays current with Gemma 4:

- Family: E2B, E4B, 26B MoE, 31B Dense.
- Capabilities used: structured JSON output, native system instructions, and
  long-context evidence handling.
- Implementation target: Gemma via Ollama Cloud through `https://ollama.com/api`
  with server-side `OLLAMA_API_KEY`.
- Future surfaces (not shipped): MLX (Apple Silicon), llama.cpp, LiteRT,
  vLLM, SGLang, hosted BYOK adapters; Gemma 4 MTP drafters for lower-latency
  inference. These are visible through the provider registry as roadmap
  entries, not executable adapters.

The public runtime keeps deterministic fallback available so judges can run
the app without a provider key or Gmail account. CareerOS does **not** require
a desktop model runtime; when enabled, model-backed proposals call Ollama Cloud
from server-side route handlers and still go through review.

## Agentic pipeline layers

- Mailbox triage agent
- Workflow extraction agent
- Evidence/review agent
- Resume/context agent
- Reminder/notification agent
- Model router/provider layer

Demo moment: a recruiter email arrives, the candidate no longer remembers
which role it maps to, and CareerOS extracts company, role, JD link, resume
version, recruiter contact, deadline, next action, confidence, and evidence.

## Demo path

| Surface | Where |
| --- | --- |
| Public overview | `https://www.careeroc.com` |
| Judge-safe demo | `https://www.careeroc.com/judge-demo` |
| Architecture page | `https://www.careeroc.com/tech` |
| Public code | `https://github.com/hskl18/public-careeros` |
| Local judge API | `/api/pipeline` |
| Provider registry API | `/api/providers` |

The judge-safe demo uses fake data and never asks for Gmail. The judge page
shows the pipeline, not just a dashboard: stages on the left/top, fake
mailbox thread + extracted update in the middle, model trace + review gate +
notification output on the right, env setup + provider options below.

## Submission checklist

- **Video** — under 3 minutes, shows problem → pipeline → review gate →
  candidate outcome.
- **Repo** — simple setup with `pnpm install && pnpm dev`, no secrets, no
  private data, no mandatory provider accounts.
- **Live demo** — `/judge-demo` works without Gmail, API keys, or model
  downloads.
- **Technical analysis** — six agent layers, local JSON state,
  deterministic fallback, Ollama/Gemma status gating, review-gated mutation,
  provider adapter boundary, and `/api/providers` registry.
- **Evidence trail** — fake recruiting email → extracted proposal → evidence
  snippets → review decision → notification/application state.
- **Product proof** — show stale follow-ups suppressed when an OA, interview,
  rejection, or offer signal arrives.
- **Accuracy** — don't claim OpenAI, Anthropic, OpenRouter, MLX, llama.cpp,
  LiteRT, vLLM, SGLang, or MTP support as implemented until code and tests
  exist.
