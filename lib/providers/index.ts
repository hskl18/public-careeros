// Static provider-adapter registry for the CareerOS model-router layer.
//
// Goals:
//   - One source of truth for what model paths CareerOS knows about.
//   - The agent-pipeline snapshot, /judge-demo, and /api/providers all read
//     from this list so we never disagree about "what's shipped".
//   - Adapters here are *metadata* — they do not run model code. Status
//     checking for the implemented path (Ollama) still lives in
//     `lib/model-status.ts`. Roadmap adapters never touch the network.
//
// A provider only flips from `implementation: "roadmap"` to
// `implementation: "implemented"` when:
//   1. A real adapter module exists in this directory and is wired into the
//      router.
//   2. The required `trust` boundary is built (e.g. encrypted local
//      credential storage for BYOK hosted adapters).
//   3. Tests cover the adapter's success and failure paths.

export type ProviderKind = "cloud-api" | "local-runtime" | "hosted-byok" | "deterministic";

export type ProviderImplementation = "implemented" | "roadmap";

export type ProviderTrust =
  | "first-run" // works without keys, accounts, or downloads
  | "local-credentials" // research-only local runtime boundary, not used by the public demo
  | "byok-credentials"; // needs the user to bring their own API key

export interface ProviderAdapter {
  id: string;
  label: string;
  kind: ProviderKind;
  implementation: ProviderImplementation;
  trust: ProviderTrust;
  /** One-line summary that can appear in UI as the strongest description. */
  summary: string;
  /** What blocks this adapter from shipping. Empty when implemented. */
  unlockGate?: string;
  /** Optional setup hint. */
  helpCommand?: string;
  /** Free-form roadmap note; surfaced in the UI and kept aligned with `docs/roadmap.md`. */
  researchNote?: string;
}

const providerAdapters: ReadonlyArray<ProviderAdapter> = [
  {
    id: "deterministic",
    label: "Deterministic fallback",
    kind: "deterministic",
    implementation: "implemented",
    trust: "first-run",
    summary:
      "Rules-based parsing. No model, no key, no downloads. Always available and always the fallback path when a model-backed run fails."
  },
  {
    id: "ollama",
    label: "Gemma via Ollama Cloud",
    kind: "cloud-api",
    implementation: "implemented",
    trust: "byok-credentials",
    summary:
      "Primary model path. CareerOS calls Ollama Cloud directly at https://ollama.com/api with OLLAMA_API_KEY. Output is schema-validated and review-gated.",
    helpCommand: "OLLAMA_API_KEY=..."
  },
  {
    id: "mlx",
    label: "MLX (Apple Silicon)",
    kind: "local-runtime",
    implementation: "roadmap",
    trust: "local-credentials",
    summary:
      "Native Apple Silicon runtime candidate. Would integrate as a `local-runtime` adapter once a stable JSON/CLI bridge to the user's local MLX models is designed.",
    unlockGate:
      "Need a bounded local-process boundary (subprocess or local HTTP) plus schema-validated output before CareerOS opens a second local runtime.",
    researchNote:
      "See docs/roadmap.md for the promotion rules and why this stays roadmap-only."
  },
  {
    id: "llama-cpp",
    label: "llama.cpp",
    kind: "local-runtime",
    implementation: "roadmap",
    trust: "local-credentials",
    summary:
      "Portable C++ runtime that can host Gemma 4 quantizations. Research-only until CareerOS has a separate advanced-runtime boundary.",
    unlockGate: "Same boundary as MLX: stable local endpoint + schema validation + tests.",
    researchNote: "See docs/roadmap.md."
  },
  {
    id: "litert",
    label: "LiteRT",
    kind: "local-runtime",
    implementation: "roadmap",
    trust: "local-credentials",
    summary:
      "Google's on-device runtime (LiteRT, formerly TFLite). Best fit for the mobile-wearable hackathon track; unlikely to be the primary path for a desktop console.",
    unlockGate:
      "Needs a mobile/edge surface story before CareerOS embeds a LiteRT pipeline; out of scope for the laptop-first public RC.",
    researchNote: "See docs/roadmap.md."
  },
  {
    id: "vllm",
    label: "vLLM",
    kind: "local-runtime",
    implementation: "roadmap",
    trust: "local-credentials",
    summary:
      "High-throughput GPU serving runtime. Useful for self-hosted Other-Candidate scenarios, not part of the public demo runtime.",
    unlockGate:
      "Needs a deployment surface other than the laptop dev script. Belongs to Other Candidate hosted, not the public RC.",
    researchNote: "See docs/roadmap.md."
  },
  {
    id: "sglang",
    label: "SGLang",
    kind: "local-runtime",
    implementation: "roadmap",
    trust: "local-credentials",
    summary:
      "Structured-generation-friendly serving runtime. Compelling for the JSON-only output shape CareerOS already uses, but heavier than Ollama for first-run users.",
    unlockGate: "Same deployment-surface constraint as vLLM.",
    researchNote: "See docs/roadmap.md."
  },
  {
    id: "mtp-drafters",
    label: "Gemma 4 MTP drafters",
    kind: "local-runtime",
    implementation: "roadmap",
    trust: "local-credentials",
    summary:
      "Multi-token speculative drafters for lower-latency Gemma inference. Research-only until a stable upstream runtime API exists.",
    unlockGate:
      "Wait for the upstream runtime to publish a stable drafter API and benchmarks before exposing it as any runtime option.",
    researchNote: "See docs/roadmap.md."
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "hosted-byok",
    implementation: "roadmap",
    trust: "byok-credentials",
    summary:
      "BYOK hosted adapter. User would provide their own key; CareerOS would only read structured JSON output and still route it through the review gate.",
    unlockGate:
      "Blocked on encrypted local credential storage + redaction rules. Will not ship before that boundary is reviewed."
  },
  {
    id: "anthropic",
    label: "Anthropic",
    kind: "hosted-byok",
    implementation: "roadmap",
    trust: "byok-credentials",
    summary:
      "Same BYOK shape as OpenAI; same model-router interface; same review-gate boundary.",
    unlockGate:
      "Blocked on encrypted local credential storage + redaction rules."
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    kind: "hosted-byok",
    implementation: "roadmap",
    trust: "byok-credentials",
    summary:
      "Aggregator BYOK route. Lets the user pick a hosted model without CareerOS bundling provider-specific code; same credential boundary as above.",
    unlockGate:
      "Blocked on encrypted local credential storage + redaction rules."
  }
];

export function listProviderAdapters(): ReadonlyArray<ProviderAdapter> {
  return providerAdapters;
}

export function getProviderAdapter(id: string): ProviderAdapter | undefined {
  return providerAdapters.find((adapter) => adapter.id === id);
}

export function listImplementedAdapters(): ReadonlyArray<ProviderAdapter> {
  return providerAdapters.filter((adapter) => adapter.implementation === "implemented");
}

export function listRoadmapAdapters(): ReadonlyArray<ProviderAdapter> {
  return providerAdapters.filter((adapter) => adapter.implementation === "roadmap");
}

export function listLocalRoadmapAdapters(): ReadonlyArray<ProviderAdapter> {
  return providerAdapters.filter(
    (adapter) => adapter.implementation === "roadmap" && adapter.kind === "local-runtime"
  );
}

export function listByokRoadmapAdapters(): ReadonlyArray<ProviderAdapter> {
  return providerAdapters.filter(
    (adapter) => adapter.implementation === "roadmap" && adapter.kind === "hosted-byok"
  );
}
