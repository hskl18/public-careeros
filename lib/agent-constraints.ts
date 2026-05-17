import type { AgentName } from "./types";

export type AgentGuardrailKind =
  | "bounded_input"
  | "schema_output"
  | "review_gate"
  | "trace_redaction"
  | "provider_allowlist"
  | "deterministic_fallback";

export interface AgentRuntimeConstraint {
  agent: AgentName;
  handoffReceives: string[];
  handoffEmits: string[];
  guardrails: AgentGuardrailKind[];
  inputLimit: number;
  outputLimit: number;
  reviewRequiredFor: string[];
  tracePolicy: string;
}

export const agentHandoffOrder: AgentName[] = [
  "mailbox_triage",
  "workflow_extraction",
  "evidence_review",
  "resume_context",
  "reminder_notification",
  "model_router"
];

export const modelPromptConstraints = {
  workflowSnippetLimit: 420,
  workflowCompanyLimit: 64,
  workflowRoleLimit: 64,
  workflowSourceLimit: 64,
  workflowMaxTokens: 160,
  resumeTitleLimit: 80,
  resumeTextLimit: 900,
  resumeMaxTokens: 220,
  timeoutMs: {
    workflow: 3500,
    resume: 4500
  }
} as const;

export const agentRuntimeConstraints: AgentRuntimeConstraint[] = [
  {
    agent: "mailbox_triage",
    handoffReceives: ["sender label", "subject", "bounded snippet", "candidate role keywords"],
    handoffEmits: ["relevance", "urgency", "company hint", "role hint", "required action"],
    guardrails: ["bounded_input", "deterministic_fallback", "trace_redaction"],
    inputLimit: 1200,
    outputLimit: 480,
    reviewRequiredFor: ["unclear sender", "ambiguous company", "low recruiting confidence"],
    tracePolicy: "Record compact AgentRun metadata only; never full Gmail bodies."
  },
  {
    agent: "workflow_extraction",
    handoffReceives: ["triage output", "bounded mailbox evidence", "candidate context"],
    handoffEmits: ["typed proposed mutation", "confidence", "deadline/follow-up candidates"],
    guardrails: ["bounded_input", "schema_output", "deterministic_fallback", "trace_redaction"],
    inputLimit: 1600,
    outputLimit: 700,
    reviewRequiredFor: ["deadline", "assessment", "interview", "offer", "rejection", "model output"],
    tracePolicy: "Store proposal fields and bounded diagnostics; reject raw model responses."
  },
  {
    agent: "evidence_review",
    handoffReceives: ["proposed mutation", "source ids", "bounded evidence", "model trace metadata"],
    handoffEmits: ["review item", "safe evidence references", "block/accept/correct decision state"],
    guardrails: ["review_gate", "schema_output", "trace_redaction"],
    inputLimit: 1800,
    outputLimit: 700,
    reviewRequiredFor: ["low confidence", "risky mutation", "suspicious job", "invalid model output"],
    tracePolicy: "Keep evidence hashes, source ids, and bounded snippets; user decides risky mutations."
  },
  {
    agent: "resume_context",
    handoffReceives: ["local resume text", "target roles", "skills", "candidate preferences", "review correction facts"],
    handoffEmits: ["resume sections", "fit summary", "gaps", "context hints", "correction memory hints"],
    guardrails: ["bounded_input", "schema_output", "deterministic_fallback", "trace_redaction"],
    inputLimit: 2400,
    outputLimit: 900,
    reviewRequiredFor: ["model-backed resume claims", "low confidence", "new inferred user facts"],
    tracePolicy: "Compact resume text and correction memory stay local unless model analysis is explicitly enabled."
  },
  {
    agent: "reminder_notification",
    handoffReceives: ["reviewed applications", "reminders", "connector/model health", "resume results"],
    handoffEmits: ["derived notification", "dedupe key", "action href"],
    guardrails: ["deterministic_fallback", "trace_redaction"],
    inputLimit: 2000,
    outputLimit: 600,
    reviewRequiredFor: ["new canonical state", "new external side effect"],
    tracePolicy: "Notifications are derived read models and do not become canonical workflow state."
  },
  {
    agent: "model_router",
    handoffReceives: ["runtime settings", "provider readiness", "task-specific bounded prompt"],
    handoffEmits: ["provider status", "model trace", "fallback reason"],
    guardrails: ["provider_allowlist", "schema_output", "review_gate", "trace_redaction"],
    inputLimit: 1800,
    outputLimit: 800,
    reviewRequiredFor: ["all workflow mutations suggested by a model", "schema validation failure"],
    tracePolicy: "Trace provider/model/task/latency/confidence/fallback only; no keys, raw prompts, or raw responses."
  }
];

export const agentSdkAlignmentNotes = [
  "CareerOS models agent handoffs as typed payload boundaries instead of passing full conversation history.",
  "Input/output guardrails are represented as bounded snippets, strict validators, endpoint allowlists, and review gates.",
  "Traces stay compact: agent, status, confidence, reason, model path, latency, and fallback metadata only.",
  "The public demo does not import @openai/agents; it mirrors SDK concepts while keeping Gemma/Ollama Cloud as the hackathon model path."
] as const;

export function getAgentRuntimeConstraint(agent: AgentName) {
  return agentRuntimeConstraints.find((constraint) => constraint.agent === agent);
}

export function boundedAgentText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function strictJsonPromptPrefix(agentName: string, schemaHint: string) {
  return [
    `CareerOS ${agentName}. Return JSON only.`,
    `Schema: ${schemaHint}.`,
    "Do not repeat raw mailbox or resume text.",
    "If uncertain, lower confidence and explain the review reason.",
    "Every model-backed workflow mutation is review-gated before state changes."
  ].join("\n");
}

export function validateConstraintCoverage() {
  const constrained = agentRuntimeConstraints.map((constraint) => constraint.agent).sort();
  const ordered = [...agentHandoffOrder].sort();
  return constrained.join("|") === ordered.join("|");
}
