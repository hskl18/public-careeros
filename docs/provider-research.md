# Provider Roadmap

Last updated: 2026-05-12

This short note is the public source of truth for model paths that are **not**
implemented yet. The shipped paths are:

- deterministic fallback, always available
- Gemma via Ollama Cloud, enabled only with server-side `OLLAMA_API_KEY`

## Promotion Rules

A roadmap adapter becomes implemented only after it has:

- real adapter code wired into the model router
- bounded prompt/output schema validation
- review-gated mutation behavior
- tests for success, timeout, invalid JSON, and fallback
- a credential/runtime boundary that does not leak keys or raw mail

## Roadmap Adapters

| Adapter | Why It Exists | Public Status |
| --- | --- | --- |
| OpenAI | BYOK hosted fallback for users who prefer frontier models | Roadmap; blocked on encrypted credential storage |
| Anthropic | BYOK hosted fallback for long-context reasoning | Roadmap; blocked on encrypted credential storage |
| OpenRouter | BYOK hosted model switchboard | Roadmap; blocked on encrypted credential storage |
| MLX | Advanced Apple Silicon local runtime | Research-only; not for the first public demo |
| llama.cpp | Advanced portable local runtime | Research-only; not for ordinary users |
| LiteRT | Mobile/edge Gemma path | Research-only until there is a mobile surface |
| vLLM | High-throughput self-hosted serving | Hosted-product/self-hosting option, not public RC |
| SGLang | Structured-generation serving | Research-only |
| Gemma 4 MTP drafters | Future latency optimization | Wait for stable upstream runtime support |

## Boundary

CareerOS should stay small for the public release. Roadmap adapters may appear
in UI metadata, but they must not execute code, store secrets, or imply shipped
support until the promotion rules above are met.
