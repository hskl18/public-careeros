import type {
  AgentName,
  AgentRunStatus,
  ApplicationStage,
  CareerOSState,
  CandidateContext,
  MailboxThread,
  ModelProviderStatus,
  Notification,
  ReviewItem
} from "./types";
import type { ModelStatusReport } from "./model-status";
import { deriveNotifications } from "./notifications";
import { listByokRoadmapAdapters, listLocalRoadmapAdapters } from "./providers";
import { createSeedCandidateContext, createSeedMailboxThreads } from "./seed";

export interface PipelineAgentDefinition {
  id: AgentName;
  label: string;
  purpose: string;
  firstRunMode: "deterministic" | "derived" | "optional_model";
}

export interface AgentStageSnapshot {
  id: AgentName;
  label: string;
  status: AgentRunStatus;
  confidence?: number;
  reason: string;
  output: Record<string, unknown>;
}

export interface AgentPipelineSnapshot {
  thesis: string;
  sampleThread: MailboxThread;
  candidateContext: CandidateContext;
  stages: AgentStageSnapshot[];
  extractedProposal: Record<string, unknown>;
  evidence: Array<{
    id: string;
    sourceLabel: string;
    sourceMessageIds: string[];
    snippet: string;
    confidence: number;
  }>;
  reviewGate: {
    openCount: number;
    items: ReviewItem[];
  };
  notifications: Notification[];
  modelRouter: {
    primary: "ollama_gemma";
    status: ModelProviderStatus;
    selectedModel: string;
    fallback: "deterministic";
    apiBaseUrl: string;
    roadmapAdapters: Array<{
      provider: "openai" | "anthropic" | "openrouter" | "mlx" | "llama.cpp" | "litert" | "vllm" | "sglang";
      status: "roadmap_byok";
      implemented: false;
    }>;
  };
}

export const pipelineAgentDefinitions: PipelineAgentDefinition[] = [
  {
    id: "mailbox_triage",
    label: "Mailbox triage agent",
    purpose: "Classify recruiting relevance, urgency, company, role, and required action from mailbox evidence.",
    firstRunMode: "deterministic"
  },
  {
    id: "workflow_extraction",
    label: "Workflow extraction agent",
    purpose: "Convert recruiting messages into typed application state proposals such as OA, interview, rejection, offer, or follow-up.",
    firstRunMode: "deterministic"
  },
  {
    id: "evidence_review",
    label: "Evidence/review agent",
    purpose: "Attach bounded evidence and require user review before model output mutates canonical application state.",
    firstRunMode: "derived"
  },
  {
    id: "resume_context",
    label: "Resume/context agent",
    purpose: "Use local resume keywords, target roles, skills, and preferences to improve next-action suggestions.",
    firstRunMode: "derived"
  },
  {
    id: "reminder_notification",
    label: "Reminder/notification agent",
    purpose: "Derive reminders and notifications from reviewed state instead of storing a second source of truth.",
    firstRunMode: "derived"
  },
  {
    id: "model_router",
    label: "Model router/provider layer",
    purpose: "Prefer Ollama Cloud API when ready and otherwise fall back to deterministic analysis.",
    firstRunMode: "optional_model"
  }
];

function threadText(thread: MailboxThread) {
  return [thread.subject, ...thread.messages.map((message) => message.snippet)].join(" ").toLowerCase();
}

function extractDate(text: string) {
  const match = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  return match ? `${match[0]}T16:00:00.000Z` : undefined;
}

function classifyStage(text: string): ApplicationStage {
  if (/offer/.test(text)) return "offer";
  if (/reject|not moving forward/.test(text)) return "rejected";
  if (/assessment|oa|online assessment|take-home/.test(text)) return "assessment";
  if (/interview|onsite|phone screen/.test(text)) return "interview";
  if (/reply|recruiter|availability/.test(text)) return "recruiter_reply";
  return "applied";
}

function requiredAction(stage: ApplicationStage, text: string) {
  if (stage === "assessment") return "Complete OA or confirm assessment deadline.";
  if (stage === "interview") return "Prepare for interview and confirm schedule.";
  if (stage === "recruiter_reply") return "Reply to recruiter.";
  if (/follow up/.test(text)) return "Follow up with recruiter.";
  if (stage === "offer") return "Review offer details.";
  if (stage === "rejected") return "Archive or request feedback.";
  return "Track application and wait for next signal.";
}

function judgeSampleThread(): MailboxThread {
  const thread = createSeedMailboxThreads()[0];
  return {
    ...thread,
    source: "json",
    messages: thread.messages.map((message) => ({
      ...message,
      sourceLabel: message.sourceLabel.replace("seed-mailbox:", "judge-sample:")
    }))
  };
}

export function runMailboxTriageAgent(thread: MailboxThread, context: CandidateContext): AgentStageSnapshot {
  const text = threadText(thread);
  const stage = classifyStage(text);
  const relevant =
    /recruiter|application|interview|assessment|oa|offer|reject|follow up/.test(text) ||
    context.targetRoles.some((role) => text.includes(role.toLowerCase()));
  const urgency = /tomorrow|due|deadline|assessment|interview/.test(text) ? "high" : "normal";
  return {
    id: "mailbox_triage",
    label: "Mailbox triage agent",
    status: "deterministic",
    confidence: relevant ? 0.88 : 0.42,
    reason: "Deterministic keyword and candidate-context triage; no provider required.",
    output: {
      relevant,
      urgency,
      company: thread.companyHint ?? "Unknown Company",
      role: thread.roleHint ?? "Unknown Role",
      requiredAction: requiredAction(stage, text)
    }
  };
}

export function runWorkflowExtractionAgent(thread: MailboxThread, triage: AgentStageSnapshot): AgentStageSnapshot {
  const text = threadText(thread);
  const stage = classifyStage(text);
  const date = extractDate(text);
  return {
    id: "workflow_extraction",
    label: "Workflow extraction agent",
    status: "deterministic",
    confidence: typeof triage.confidence === "number" ? Math.min(0.9, triage.confidence) : 0.75,
    reason: "Extracted a typed application update proposal from bounded mailbox snippets.",
    output: {
      company: triage.output.company,
      role: triage.output.role,
      stage,
      eventType: stage === "assessment" ? "oa_invitation" : stage === "interview" ? "interview_invitation" : stage,
      deadlineAt: /deadline|due|assessment|interview/.test(text) ? date : undefined,
      followUpAt: /follow up/.test(text) ? date : undefined,
      eventSummary: `${String(triage.output.company)} ${stage.replace("_", " ")} signal from mailbox evidence.`
    }
  };
}

export function runEvidenceReviewAgent(
  state: CareerOSState,
  thread: MailboxThread,
  extraction: AgentStageSnapshot
): AgentStageSnapshot {
  const sourceMessageIds = thread.messages.map((message) => message.id);
  const relatedEvidence = state.evidenceSnippets.filter((snippet) =>
    thread.messages.some((message) => snippet.sourceLabel === message.sourceLabel)
  );
  const openReviews = state.reviewItems.filter((review) => review.status === "open");
  const modelBacked = state.modelTraces.some((trace) => trace.provider === "ollama" && trace.task === "local-import-analysis");
  return {
    id: "evidence_review",
    label: "Evidence/review agent",
    status: openReviews.length > 0 || modelBacked ? "review_blocked" : "deterministic",
    confidence: typeof extraction.confidence === "number" ? extraction.confidence : 0.75,
    reason: modelBacked
      ? "Model-generated output is never applied directly; it is represented as a review proposal first."
      : "Evidence snippets and review state are inspectable before high-impact mutation.",
    output: {
      sourceMessageIds,
      evidenceSnippetCount: relatedEvidence.length,
      openReviewCount: openReviews.length,
      mutationPolicy: "model_output_review_gated"
    }
  };
}

export function runResumeContextAgent(state: CareerOSState): AgentStageSnapshot {
  return {
    id: "resume_context",
    label: "Resume/context agent",
    status: "deterministic",
    confidence: 0.82,
    reason: "Candidate context is local, editable, and derived from workspace/resume state.",
    output: {
      targetRoles: state.candidateContext.targetRoles,
      skills: state.candidateContext.skills,
      resumeKeywords: state.candidateContext.resumeKeywords,
      latestResumeSections: state.resumeDocuments[0]?.sections ?? []
    }
  };
}

export function runReminderNotificationAgent(state: CareerOSState): AgentStageSnapshot {
  const notifications = deriveNotifications(state);
  return {
    id: "reminder_notification",
    label: "Reminder/notification agent",
    status: "deterministic",
    confidence: 0.9,
    reason: "Notifications are derived read models from reminders, reviews, model status, connector health, and resume results.",
    output: {
      openReminders: state.reminders.filter((reminder) => reminder.status === "open").length,
      activeNotifications: notifications.filter((notification) => notification.status !== "dismissed").length,
      examples: notifications.slice(0, 3).map((notification) => notification.title)
    }
  };
}

export function runModelRouterAgent(status: ModelStatusReport): AgentStageSnapshot {
  const localRoadmap = listLocalRoadmapAdapters().map((adapter) => adapter.id);
  const byokRoadmap = listByokRoadmapAdapters().map((adapter) => adapter.id);
  return {
    id: "model_router",
    label: "Model router/provider layer",
    status: status.status === "ready" ? "model_ready" : "fallback",
    reason:
      status.status === "ready"
        ? "Ollama Cloud is ready for richer bounded analysis."
        : "First run remains deterministic because no model/API is required.",
    output: {
      primary: "ollama_gemma",
      providerStatus: status.status,
      selectedModel: status.modelTag,
      fallback: "deterministic",
      apiBaseUrl: "https://ollama.com/api",
      localRoadmapAdapters: localRoadmap,
      byokRoadmapAdapters: byokRoadmap
    }
  };
}

export function deriveAgentPipelineSnapshot(state: CareerOSState, modelStatus: ModelStatusReport): AgentPipelineSnapshot {
  const sampleThread = state.mailboxThreads[0] ?? judgeSampleThread();
  const candidateContext =
    state.candidateContext.targetRoles.length || state.candidateContext.skills.length
      ? state.candidateContext
      : createSeedCandidateContext();
  const triage = runMailboxTriageAgent(sampleThread, candidateContext);
  const extraction = runWorkflowExtractionAgent(sampleThread, triage);
  const evidenceReview = runEvidenceReviewAgent(state, sampleThread, extraction);
  const resumeContext = runResumeContextAgent(state);
  const reminderNotification = runReminderNotificationAgent(state);
  const modelRouter = runModelRouterAgent(modelStatus);
  const sourceMessageIds = sampleThread.messages.map((message) => message.id);
  const notifications = deriveNotifications(state).filter((notification) => notification.status !== "dismissed");

  return {
    thesis:
      "CareerOS is a private-workspace multi-agent job mailbox pipeline that turns recruiting emails into evidence-backed, review-gated application state.",
    sampleThread,
    candidateContext,
    stages: [triage, extraction, evidenceReview, resumeContext, reminderNotification, modelRouter],
    extractedProposal: extraction.output,
    evidence: sampleThread.messages.map((message) => ({
      id: message.id,
      sourceLabel: message.sourceLabel,
      sourceMessageIds,
      snippet: message.snippet,
      confidence: typeof triage.confidence === "number" ? triage.confidence : 0.75
    })),
    reviewGate: {
      openCount: state.reviewItems.filter((review) => review.status === "open").length,
      items: state.reviewItems.filter((review) => review.status === "open").slice(0, 5)
    },
    notifications: notifications.slice(0, 8),
    modelRouter: {
      primary: "ollama_gemma",
      status: modelStatus.status,
      selectedModel: modelStatus.modelTag,
      fallback: "deterministic",
      apiBaseUrl: "https://ollama.com/api",
      roadmapAdapters: [
        { provider: "openai", status: "roadmap_byok", implemented: false },
        { provider: "anthropic", status: "roadmap_byok", implemented: false },
        { provider: "openrouter", status: "roadmap_byok", implemented: false },
        { provider: "mlx", status: "roadmap_byok", implemented: false },
        { provider: "llama.cpp", status: "roadmap_byok", implemented: false },
        { provider: "litert", status: "roadmap_byok", implemented: false },
        { provider: "vllm", status: "roadmap_byok", implemented: false },
        { provider: "sglang", status: "roadmap_byok", implemented: false }
      ]
    }
  };
}
