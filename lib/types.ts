export type ApplicationStage =
  | "wishlist"
  | "applied"
  | "recruiter_reply"
  | "assessment"
  | "interview"
  | "offer"
  | "rejected";

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
  sourceLabel: string;
  snippet: string;
  hash: string;
  confidence: number;
  createdAt: string;
}

export interface ProposedMutation {
  applicationId?: string;
  company?: string;
  role?: string;
  stage?: ApplicationStage;
  contactName?: string;
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
  title: string;
  dueAt: string;
  status: "open" | "done";
  createdAt: string;
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

export interface CareerOSState {
  workspaceUser: WorkspaceUser;
  applications: Application[];
  events: ApplicationEvent[];
  evidenceSnippets: EvidenceSnippet[];
  reviewItems: ReviewItem[];
  reminders: Reminder[];
  notifications: Notification[];
  resumeDocuments: ResumeDocument[];
  resumeEvaluations: ResumeEvaluation[];
  modelTraces: ModelTrace[];
  importJobs: ImportJob[];
  connectorAccounts: ConnectorAccount[];
}

export interface LocalImportRecord {
  company: string;
  role: string;
  sourceLabel: string;
  text: string;
  receivedAt?: string;
}
