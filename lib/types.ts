export type ApplicationStage =
  | "wishlist"
  | "applied"
  | "recruiter_reply"
  | "assessment"
  | "interview"
  | "offer"
  | "rejected";
export type ApplicationBucket =
  | "applied"
  | "waiting"
  | "followed_up"
  | "assessment"
  | "interview"
  | "rejected"
  | "offer"
  | "ghosted";

export type Severity = "info" | "warning" | "critical";

export type ModelProviderStatus =
  | "disabled"
  | "unavailable"
  | "reachable"
  | "model_missing"
  | "health_check_failed"
  | "ready";

export type ReviewStatus = "open" | "accepted" | "dismissed" | "corrected";
export type NotificationStatus = "unread" | "read" | "dismissed";
export type ImportJobStatus = "pending" | "processed" | "failed";
export type ConnectorStatus = "disabled" | "not_configured" | "disconnected" | "connected" | "needs_attention";
export type AgentName =
  | "mailbox_triage"
  | "workflow_extraction"
  | "evidence_review"
  | "resume_context"
  | "reminder_notification"
  | "model_router";
export type AgentRunStatus = "deterministic" | "model_ready" | "review_blocked" | "fallback" | "roadmap";

export interface WorkspaceUser {
  id: string;
  name: string;
  createdAt: string;
}

export interface Application {
  id: string;
  workspaceUserId: string;
  company: string;
  role: string;
  stage: ApplicationStage;
  contactName?: string;
  jobDescriptionUrl?: string;
  resumeVersion?: string;
  coverLetterVersion?: string;
  applicationSource?: string;
  recruiterContactName?: string;
  recruiterContactEmail?: string;
  location?: string;
  salaryRange?: string;
  notes?: string;
  deadlineAt?: string;
  followUpAt?: string;
  updatedAt: string;
  source: "seed" | "manual" | "import" | "review";
}

export interface ApplicationEvent {
  id: string;
  applicationId: string;
  type: string;
  summary: string;
  source: "seed" | "manual" | "import" | "review" | "system";
  confidence: number;
  createdAt: string;
}

export interface EvidenceSnippet {
  id: string;
  applicationId?: string;
  reviewItemId?: string;
  sourceMessageIds: string[];
  sourceRelationships?: {
    mailboxMessageIds: string[];
    company?: string;
    role?: string;
    applicationId?: string;
    recruiterContactName?: string;
    recruiterContactEmail?: string;
    resumeVersion?: string;
  };
  sourceLabel: string;
  snippet: string;
  hash: string;
  confidence: number;
  reason: string;
  createdAt: string;
}

export interface ProposedMutation {
  applicationId?: string;
  company?: string;
  role?: string;
  stage?: ApplicationStage;
  contactName?: string;
  jobDescriptionUrl?: string;
  resumeVersion?: string;
  coverLetterVersion?: string;
  applicationSource?: string;
  recruiterContactName?: string;
  recruiterContactEmail?: string;
  location?: string;
  salaryRange?: string;
  notes?: string;
  deadlineAt?: string;
  followUpAt?: string;
  eventSummary: string;
}

export interface ReviewItem {
  id: string;
  status: ReviewStatus;
  reason: string;
  sourceLabel: string;
  confidence: number;
  proposedChange: ProposedMutation;
  evidenceSnippetIds: string[];
  traceSummary: string;
  createdAt: string;
  decidedAt?: string;
  decisionEventId?: string;
}

export interface Reminder {
  id: string;
  applicationId: string;
  type?: "follow_up" | "assessment_deadline" | "interview_preparation";
  title: string;
  dueAt: string;
  status: "open" | "done" | "dismissed";
  createdAt: string;
  decidedAt?: string;
}

export interface Notification {
  id: string;
  dedupeKey: string;
  title: string;
  body: string;
  severity: Severity;
  sourceType: "application" | "review" | "reminder" | "resume" | "settings" | "connector";
  sourceId?: string;
  href: string;
  status: NotificationStatus;
  createdAt: string;
}

export interface ResumeDocument {
  id: string;
  workspaceUserId: string;
  title: string;
  text: string;
  sections: string[];
  createdAt: string;
}

export interface ResumeEvaluation {
  id: string;
  resumeDocumentId: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  status: "completed" | "blocked_by_review";
  confidence: number;
  source?: "deterministic" | "ollama";
  modelTag?: string;
  diagnostic?: string;
  createdAt: string;
}

export interface ModelTrace {
  id: string;
  provider: "deterministic" | "ollama";
  modelTag?: string;
  status: ModelProviderStatus;
  task: string;
  latencyMs?: number;
  confidence?: number;
  fallbackPath?: string;
  diagnostic: string;
  createdAt: string;
}

export interface ModelRuntimeSettings {
  provider: "ollama";
  enabled: boolean;
  endpoint: string;
  modelTag: string;
  updatedAt: string;
}

export interface ImportJob {
  id: string;
  source: "seed" | "json" | "manual" | "gmail";
  status: ImportJobStatus;
  attempts: number;
  error?: string;
  createdAt: string;
  processedAt?: string;
}

export interface ConnectorAccount {
  id: string;
  provider: "gmail";
  status: ConnectorStatus;
  label: string;
  message?: string;
  updatedAt: string;
}

export interface MailboxMessage {
  id: string;
  threadId: string;
  fromLabel: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  sourceLabel: string;
}

export interface MailboxThread {
  id: string;
  source: "seed" | "json" | "gmail";
  subject: string;
  companyHint?: string;
  roleHint?: string;
  messages: MailboxMessage[];
  createdAt: string;
}

export interface CandidateContext {
  id: string;
  targetRoles: string[];
  skills: string[];
  preferences: string[];
  resumeKeywords: string[];
  updatedAt: string;
}

export interface AgentRun {
  id: string;
  agent: AgentName;
  status: AgentRunStatus;
  inputRef?: string;
  outputRef?: string;
  confidence?: number;
  reason: string;
  createdAt: string;
}

export interface CareerOSState {
  schemaVersion?: number;
  workspaceUser: WorkspaceUser;
  mailboxThreads: MailboxThread[];
  candidateContext: CandidateContext;
  agentRuns: AgentRun[];
  applications: Application[];
  events: ApplicationEvent[];
  evidenceSnippets: EvidenceSnippet[];
  reviewItems: ReviewItem[];
  reminders: Reminder[];
  notifications: Notification[];
  resumeDocuments: ResumeDocument[];
  resumeEvaluations: ResumeEvaluation[];
  modelRuntime: ModelRuntimeSettings;
  modelTraces: ModelTrace[];
  importJobs: ImportJob[];
  connectorAccounts: ConnectorAccount[];
}

export interface LocalImportRecord {
  applicationId?: string;
  company: string;
  role: string;
  sourceLabel: string;
  text: string;
  sourceMessageIds?: string[];
  receivedAt?: string;
  jobDescriptionUrl?: string;
  resumeVersion?: string;
  coverLetterVersion?: string;
  applicationSource?: string;
  recruiterContactName?: string;
  recruiterContactEmail?: string;
  location?: string;
  salaryRange?: string;
  notes?: string;
}
