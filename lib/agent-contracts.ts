import type { AgentName } from "./types";

export interface AgentOperatingContract {
  id: AgentName;
  label: string;
  family: "mailbox" | "resume" | "orchestration" | "runtime";
  purpose: string;
  careerOsSouls: string[];
  promptBoundary: string;
  memoryBoundary: string;
  canDo: string[];
  cannotDo: string[];
  costBoundary: string;
  publicScopeNote: string;
}

export const agentOperatingContracts: AgentOperatingContract[] = [
  {
    id: "mailbox_triage",
    label: "Mailbox triage agent",
    family: "mailbox",
    purpose: "Decide whether a mailbox item belongs in the recruiting workflow before heavier extraction runs.",
    careerOsSouls: ["Inbox Triage Agent"],
    promptBoundary: "Subject, sender label, bounded snippet, source label, and local candidate context.",
    memoryBoundary: "Compact AgentRun trace plus downstream proposal references; no full inbox bodies.",
    canDo: ["Classify recruiting relevance", "Detect urgency", "Route ambiguous items forward conservatively"],
    cannotDo: ["Mutate application state", "Create reminders", "Treat platform noise as a confirmed workflow event"],
    costBoundary: "Deterministic first-run path. Gemma is not required for triage.",
    publicScopeNote: "Shipped as a compact deterministic triage layer; heavier Gemma triage remains optional."
  },
  {
    id: "workflow_extraction",
    label: "Workflow extraction agent",
    family: "mailbox",
    purpose: "Turn trusted recruiting evidence into structured application-update proposals.",
    careerOsSouls: ["Workflow Extraction Agent", "Recruiter Identity Agent", "Entity Hygiene Agent"],
    promptBoundary: "Bounded triage output and bounded message snippets; model path asks for strict JSON only.",
    memoryBoundary: "Typed ProposedMutation shape and evidence references, never raw model responses.",
    canDo: ["Propose stage changes", "Extract explicit deadlines", "Identify contact, role, source, and follow-up facts"],
    cannotDo: ["Guess company from a URL or ATS host", "Invent due dates", "Apply model output directly"],
    costBoundary: "Uses deterministic extraction by default; optional Gemma calls are short, server-side, and bounded.",
    publicScopeNote: "Recruiter identity and entity hygiene are folded into extraction guards for the lightweight demo."
  },
  {
    id: "evidence_review",
    label: "Evidence/review agent",
    family: "mailbox",
    purpose: "Decide whether an extracted workflow update can be trusted or needs a human decision.",
    careerOsSouls: ["Review Evidence Agent", "Scam Checker Agent", "Entity Hygiene Agent"],
    promptBoundary: "Proposal, confidence, source message ids, bounded evidence, and model trace metadata.",
    memoryBoundary: "EvidenceSnippet and ReviewItem records until accepted, corrected, or dismissed.",
    canDo: ["Block low-confidence updates", "Attach source snippets", "Explain why review is required"],
    cannotDo: ["Hide uncertainty", "Override user corrections", "Silently repair historical data"],
    costBoundary: "Review gate is local state. Model-backed review remains optional and must stay schema-checked.",
    publicScopeNote: "Scam/safety and dirty-entity cases are represented as review-blocked evidence, not automatic mutation."
  },
  {
    id: "resume_context",
    label: "Resume/context agent",
    family: "resume",
    purpose: "Keep candidate context available for triage, next actions, and resume feedback.",
    careerOsSouls: ["Resume Extraction Agent", "Resume Evaluation Agent", "User Memory Steward"],
    promptBoundary: "Local resume text, target roles, skills, preferences, and resume keywords.",
    memoryBoundary: "ResumeDocument, ResumeEvaluation, CandidateContext, and compact user correction facts under local state.",
    canDo: ["Summarize local resume fit", "Surface gaps", "Expose target-role context and correction hints to other agents"],
    cannotDo: ["Upload resume text without explicit model enablement", "Turn model guesses into confirmed facts", "Treat user notes as executable instructions"],
    costBoundary: "Deterministic resume analysis works without an API key; optional Gemma analysis records latency and confidence.",
    publicScopeNote: "Resume extraction, evaluation, and user memory are folded into local candidate context surfaces."
  },
  {
    id: "reminder_notification",
    label: "Reminder/notification agent",
    family: "orchestration",
    purpose: "Derive reminders and notifications from reviewed application state.",
    careerOsSouls: ["Follow-Up Task Agent"],
    promptBoundary: "Reviewed applications, reminders, reviews, connector health, model status, and resume results.",
    memoryBoundary: "Derived Notification records with stable dedupe keys; reminders remain tied to applications.",
    canDo: ["Show deadlines", "Close stale follow-ups", "Warn about review blocks and connector/model health"],
    cannotDo: ["Become canonical workflow state", "Keep stale reminders after a later-stage signal"],
    costBoundary: "No model cost. This layer is a deterministic read model.",
    publicScopeNote: "The full follow-up task agent is represented as deterministic reminder derivation in this repo."
  },
  {
    id: "model_router",
    label: "Model router/provider layer",
    family: "runtime",
    purpose: "Select deterministic fallback or Gemma via Ollama Cloud without misrepresenting roadmap adapters.",
    careerOsSouls: ["Career Orchestrator Agent", "Guidance Maintenance Agent"],
    promptBoundary: "Explicit runtime settings, OLLAMA_API_KEY availability, cloud readiness checks, and bounded task-specific prompts.",
    memoryBoundary: "ModelTrace records provider, model tag, task, latency, confidence, fallback, and bounded diagnostics.",
    canDo: ["Check Ollama Cloud readiness", "Call Gemma through Ollama Cloud when enabled", "Expose provider roadmap status"],
    cannotDo: ["Store API keys in workspace state", "Require hosted API keys for first run", "Store raw prompts, raw responses, or provider keys"],
    costBoundary: "First run has zero model/API cost. Model-backed runs use the user's Ollama Cloud key; BYOK providers remain roadmap-only.",
    publicScopeNote: "The public demo exposes orchestration through visible pipeline state; it does not ship a hidden autonomous strategist or self-editing guidance agent."
  }
];

export const careerOsFullAgentAlignment = [
  {
    family: "Mailbox agents",
    fullCareerOsAgents: [
      "Inbox Triage Agent",
      "Workflow Extraction Agent",
      "Recruiter Identity Agent",
      "Scam Checker Agent",
      "Review Evidence Agent",
      "Follow-Up Task Agent",
      "Entity Hygiene Agent"
    ],
    publicDemoLayers: [
      "Mailbox triage agent",
      "Workflow extraction agent",
      "Evidence/review agent",
      "Reminder/notification agent"
    ]
  },
  {
    family: "Resume agents",
    fullCareerOsAgents: ["Resume Extraction Agent", "Resume Evaluation Agent"],
    publicDemoLayers: ["Resume/context agent"]
  },
  {
    family: "Career orchestration agents",
    fullCareerOsAgents: ["Career Orchestrator Agent", "User Memory Steward", "Guidance Maintenance Agent"],
    publicDemoLayers: ["Model router/provider layer", "Resume/context agent", "visible pipeline state"]
  }
] as const;

export function getAgentOperatingContract(id: AgentName) {
  return agentOperatingContracts.find((contract) => contract.id === id);
}
