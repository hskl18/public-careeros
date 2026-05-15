import { isAllowedOllamaModelEndpoint } from "./api-security";
import { appendAuditEvent, createAuditEvent } from "./audit";
import { newId, nowIso } from "./id";
import { currentWorkspaceSchemaVersion } from "./store";
import type {
  AgentName,
  AgentRunStatus,
  ApplicationStage,
  CareerOSState,
  ConnectorStatus,
  ImportJobStatus,
  ModelProviderStatus,
  NotificationStatus,
  ReviewStatus,
  Severity
} from "./types";

export const workspaceImportConfirmation = "IMPORT LOCAL DATA";
export const maxWorkspaceImportBytes = 1_500_000;

type ValidationCode =
  | "malformed_json"
  | "invalid_shape"
  | "schema_version_unsupported"
  | "dangerous_content";

export type WorkspaceImportValidationResult =
  | { ok: true; state: CareerOSState }
  | { ok: false; code: ValidationCode; message: string };

const stateKeys = [
  "schemaVersion",
  "workspaceUser",
  "mailboxThreads",
  "candidateContext",
  "agentRuns",
  "applications",
  "events",
  "evidenceSnippets",
  "reviewItems",
  "reminders",
  "notifications",
  "resumeDocuments",
  "resumeEvaluations",
  "modelRuntime",
  "modelTraces",
  "importJobs",
  "connectorAccounts",
  "auditEvents"
] as const;

const applicationStages = ["wishlist", "applied", "recruiter_reply", "assessment", "interview", "offer", "rejected"] as const;
const applicationSources = ["seed", "manual", "import", "review"] as const;
const eventSources = ["seed", "manual", "import", "review", "system"] as const;
const reviewStatuses = ["open", "accepted", "dismissed", "corrected"] as const;
const notificationStatuses = ["unread", "read", "dismissed"] as const;
const severities = ["info", "warning", "critical"] as const;
const sourceTypes = ["application", "review", "reminder", "resume", "settings", "connector"] as const;
const importSources = ["seed", "json", "manual", "gmail"] as const;
const importStatuses = ["pending", "processed", "failed"] as const;
const connectorStatuses = ["disabled", "not_configured", "disconnected", "connected", "needs_attention"] as const;
const providerStatuses = ["disabled", "unavailable", "reachable", "model_missing", "health_check_failed", "ready"] as const;
const agentNames = [
  "mailbox_triage",
  "workflow_extraction",
  "evidence_review",
  "resume_context",
  "reminder_notification",
  "model_router"
] as const;
const agentStatuses = ["deterministic", "model_ready", "review_blocked", "fallback", "roadmap"] as const;
const auditStatuses = ["started", "succeeded", "failed", "blocked"] as const;
const auditSourceTypes = ["import", "review", "reminder", "resume", "settings", "connector", "model", "local_data"] as const;

const dangerousKeyPattern =
  /(access[_-]?token|refresh[_-]?token|oauth|client[_-]?secret|api[_-]?key|provider[_-]?key|password|raw[_-]?body|gmail[_-]?body|email[_-]?body|body[_-]?html|html[_-]?body|headers|payload|full[_-]?prompt|raw[_-]?response|raw[_-]?model[_-]?response|model[_-]?response|data[_-]?dump)/i;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function literalPattern(value: string) {
  return new RegExp(escapeRegex(value), "i");
}

const providerDashboardPatterns = [
  `console.${"neon"}.tech`,
  `${"railway"}.app/project`
]
  .map(literalPattern)
  .concat(new RegExp(`${escapeRegex(`${"vercel"}.com`)}\\/[^/\\s]+\\/[^/\\s]+`, "i"));

const dangerousValuePatterns = [
  /(^|[\s"'=])\/Users\/[^\s"']+/,
  /(^|[\s"'=])\/private\/[^\s"']+/,
  /(^|[\s"'=])\/var\/folders\/[^\s"']+/,
  /(^|[\s"'=])\/home\/[^\s"']+/,
  /\b[A-Za-z]:\\[^:*?"<>|\r\n]+/,
  /\.env(?:\.local)?\b/i,
  /\.(sqlite|db|dump|bak|backup)\b/i,
  ...providerDashboardPatterns,
  /sk-[A-Za-z0-9_-]{20,}/,
  /ghp_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{20,}/,
  /AIza[0-9A-Za-z_-]{20,}/,
  /ya29\.[0-9A-Za-z_-]{20,}/,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/
];

function fail(code: ValidationCode, message: string): WorkspaceImportValidationResult {
  return { ok: false, code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertAllowedKeys(value: Record<string, unknown>, keys: readonly string[], path: string) {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      throw new Error(`${path} contains unsupported field.`);
    }
  }
}

function rejectDangerousContent(value: unknown, path = "state") {
  if (Array.isArray(value)) {
    if (value.length > 20_000) throw new Error(`${path} is too large.`);
    value.forEach((item, index) => rejectDangerousContent(item, `${path}[${index}]`));
    return;
  }

  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (dangerousKeyPattern.test(key)) {
        throw new Error(`${path} contains a blocked private field.`);
      }
      rejectDangerousContent(item, `${path}.${key}`);
    }
    return;
  }

  if (typeof value === "string") {
    if (value.length > 12_000) throw new Error(`${path} is too large.`);
    if (dangerousValuePatterns.some((pattern) => pattern.test(value))) {
      throw new Error(`${path} contains private or secret-looking content.`);
    }
  }
}

function requiredString(record: Record<string, unknown>, key: string, path: string, max = 600) {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new Error(`${path}.${key} must be a bounded string.`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string, path: string, max = 600) {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > max) {
    throw new Error(`${path}.${key} must be a bounded string when present.`);
  }
  return value;
}

function requiredNumber(record: Record<string, unknown>, key: string, path: string, min = 0, max = 1) {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${path}.${key} must be a valid number.`);
  }
  return value;
}

function optionalNumber(record: Record<string, unknown>, key: string, path: string, min = 0, max = 1) {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${path}.${key} must be a valid number when present.`);
  }
  return value;
}

function requiredBoolean(record: Record<string, unknown>, key: string, path: string) {
  const value = record[key];
  if (typeof value !== "boolean") throw new Error(`${path}.${key} must be boolean.`);
  return value;
}

function enumValue<T extends string>(record: Record<string, unknown>, key: string, path: string, allowed: readonly T[]) {
  const value = record[key];
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${path}.${key} is unsupported.`);
  }
  return value as T;
}

function optionalEnumValue<T extends string>(
  record: Record<string, unknown>,
  key: string,
  path: string,
  allowed: readonly T[]
) {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${path}.${key} is unsupported.`);
  }
  return value as T;
}

function requiredStringArray(record: Record<string, unknown>, key: string, path: string, maxItems = 200, maxString = 600) {
  const value = record[key];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`${path}.${key} must be a bounded array.`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string" || item.length > maxString) {
      throw new Error(`${path}.${key}[${index}] must be a bounded string.`);
    }
    return item;
  });
}

function optionalStringArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
  maxItems = 200,
  maxString = 600
) {
  const value = record[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`${path}.${key} must be a bounded array when present.`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string" || item.length > maxString) {
      throw new Error(`${path}.${key}[${index}] must be a bounded string.`);
    }
    return item;
  });
}

function arrayOf<T>(
  record: Record<string, unknown>,
  key: string,
  path: string,
  maxItems: number,
  validator: (item: unknown, path: string) => T
) {
  const value = record[key];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`${path}.${key} must be a bounded array.`);
  }
  return value.map((item, index) => validator(item, `${path}.${key}[${index}]`));
}

function validateObject(value: unknown, keys: readonly string[], path: string) {
  if (!isRecord(value)) throw new Error(`${path} must be an object.`);
  assertAllowedKeys(value, keys, path);
  return value;
}

function validateWorkspaceUser(value: unknown, path: string) {
  const record = validateObject(value, ["id", "name", "createdAt"], path);
  return {
    id: requiredString(record, "id", path),
    name: requiredString(record, "name", path),
    createdAt: requiredString(record, "createdAt", path)
  };
}

function validateApplication(value: unknown, path: string) {
  const record = validateObject(
    value,
    [
      "id",
      "workspaceUserId",
      "company",
      "role",
      "stage",
      "contactName",
      "jobDescriptionUrl",
      "resumeVersion",
      "coverLetterVersion",
      "applicationSource",
      "recruiterContactName",
      "recruiterContactEmail",
      "location",
      "salaryRange",
      "notes",
      "deadlineAt",
      "followUpAt",
      "updatedAt",
      "source"
    ],
    path
  );
  return {
    id: requiredString(record, "id", path),
    workspaceUserId: requiredString(record, "workspaceUserId", path),
    company: requiredString(record, "company", path),
    role: requiredString(record, "role", path),
    stage: enumValue(record, "stage", path, applicationStages) as ApplicationStage,
    contactName: optionalString(record, "contactName", path),
    jobDescriptionUrl: optionalString(record, "jobDescriptionUrl", path, 1000),
    resumeVersion: optionalString(record, "resumeVersion", path),
    coverLetterVersion: optionalString(record, "coverLetterVersion", path),
    applicationSource: optionalString(record, "applicationSource", path),
    recruiterContactName: optionalString(record, "recruiterContactName", path),
    recruiterContactEmail: optionalString(record, "recruiterContactEmail", path),
    location: optionalString(record, "location", path),
    salaryRange: optionalString(record, "salaryRange", path),
    notes: optionalString(record, "notes", path, 1200),
    deadlineAt: optionalString(record, "deadlineAt", path),
    followUpAt: optionalString(record, "followUpAt", path),
    updatedAt: requiredString(record, "updatedAt", path),
    source: enumValue(record, "source", path, applicationSources)
  };
}

function validateApplicationEvent(value: unknown, path: string) {
  const record = validateObject(value, ["id", "applicationId", "type", "summary", "source", "confidence", "createdAt"], path);
  return {
    id: requiredString(record, "id", path),
    applicationId: requiredString(record, "applicationId", path),
    type: requiredString(record, "type", path),
    summary: requiredString(record, "summary", path, 1000),
    source: enumValue(record, "source", path, eventSources),
    confidence: requiredNumber(record, "confidence", path),
    createdAt: requiredString(record, "createdAt", path)
  };
}

function validateEvidenceRelationships(value: unknown, path: string) {
  const record = validateObject(
    value,
    [
      "mailboxMessageIds",
      "company",
      "role",
      "applicationId",
      "recruiterContactName",
      "recruiterContactEmail",
      "resumeVersion"
    ],
    path
  );
  return {
    mailboxMessageIds: requiredStringArray(record, "mailboxMessageIds", path),
    company: optionalString(record, "company", path),
    role: optionalString(record, "role", path),
    applicationId: optionalString(record, "applicationId", path),
    recruiterContactName: optionalString(record, "recruiterContactName", path),
    recruiterContactEmail: optionalString(record, "recruiterContactEmail", path),
    resumeVersion: optionalString(record, "resumeVersion", path)
  };
}

function validateEvidenceSnippet(value: unknown, path: string) {
  const record = validateObject(
    value,
    [
      "id",
      "applicationId",
      "reviewItemId",
      "sourceMessageIds",
      "sourceRelationships",
      "sourceLabel",
      "snippet",
      "hash",
      "confidence",
      "reason",
      "createdAt"
    ],
    path
  );
  return {
    id: requiredString(record, "id", path),
    applicationId: optionalString(record, "applicationId", path),
    reviewItemId: optionalString(record, "reviewItemId", path),
    sourceMessageIds: requiredStringArray(record, "sourceMessageIds", path),
    sourceRelationships:
      record.sourceRelationships === undefined
        ? undefined
        : validateEvidenceRelationships(record.sourceRelationships, `${path}.sourceRelationships`),
    sourceLabel: requiredString(record, "sourceLabel", path),
    snippet: requiredString(record, "snippet", path, 700),
    hash: requiredString(record, "hash", path),
    confidence: requiredNumber(record, "confidence", path),
    reason: requiredString(record, "reason", path, 800),
    createdAt: requiredString(record, "createdAt", path)
  };
}

function validateProposedMutation(value: unknown, path: string) {
  const record = validateObject(
    value,
    [
      "applicationId",
      "company",
      "role",
      "stage",
      "contactName",
      "jobDescriptionUrl",
      "resumeVersion",
      "coverLetterVersion",
      "applicationSource",
      "recruiterContactName",
      "recruiterContactEmail",
      "location",
      "salaryRange",
      "notes",
      "deadlineAt",
      "followUpAt",
      "eventSummary"
    ],
    path
  );
  return {
    applicationId: optionalString(record, "applicationId", path),
    company: optionalString(record, "company", path),
    role: optionalString(record, "role", path),
    stage: optionalEnumValue(record, "stage", path, applicationStages) as ApplicationStage | undefined,
    contactName: optionalString(record, "contactName", path),
    jobDescriptionUrl: optionalString(record, "jobDescriptionUrl", path, 1000),
    resumeVersion: optionalString(record, "resumeVersion", path),
    coverLetterVersion: optionalString(record, "coverLetterVersion", path),
    applicationSource: optionalString(record, "applicationSource", path),
    recruiterContactName: optionalString(record, "recruiterContactName", path),
    recruiterContactEmail: optionalString(record, "recruiterContactEmail", path),
    location: optionalString(record, "location", path),
    salaryRange: optionalString(record, "salaryRange", path),
    notes: optionalString(record, "notes", path, 1200),
    deadlineAt: optionalString(record, "deadlineAt", path),
    followUpAt: optionalString(record, "followUpAt", path),
    eventSummary: requiredString(record, "eventSummary", path, 1000)
  };
}

function validateReviewItem(value: unknown, path: string) {
  const record = validateObject(
    value,
    [
      "id",
      "status",
      "reason",
      "sourceLabel",
      "confidence",
      "proposedChange",
      "evidenceSnippetIds",
      "traceSummary",
      "createdAt",
      "decidedAt",
      "decisionEventId"
    ],
    path
  );
  return {
    id: requiredString(record, "id", path),
    status: enumValue(record, "status", path, reviewStatuses) as ReviewStatus,
    reason: requiredString(record, "reason", path, 1000),
    sourceLabel: requiredString(record, "sourceLabel", path),
    confidence: requiredNumber(record, "confidence", path),
    proposedChange: validateProposedMutation(record.proposedChange, `${path}.proposedChange`),
    evidenceSnippetIds: requiredStringArray(record, "evidenceSnippetIds", path),
    traceSummary: requiredString(record, "traceSummary", path, 1000),
    createdAt: requiredString(record, "createdAt", path),
    decidedAt: optionalString(record, "decidedAt", path),
    decisionEventId: optionalString(record, "decisionEventId", path)
  };
}

function validateReminder(value: unknown, path: string) {
  const record = validateObject(value, ["id", "applicationId", "type", "title", "dueAt", "status", "createdAt", "decidedAt"], path);
  return {
    id: requiredString(record, "id", path),
    applicationId: requiredString(record, "applicationId", path),
    type: optionalEnumValue(record, "type", path, ["follow_up", "assessment_deadline", "interview_preparation"] as const),
    title: requiredString(record, "title", path),
    dueAt: requiredString(record, "dueAt", path),
    status: enumValue(record, "status", path, ["open", "done", "dismissed"] as const),
    createdAt: requiredString(record, "createdAt", path),
    decidedAt: optionalString(record, "decidedAt", path)
  };
}

function validateNotification(value: unknown, path: string) {
  const record = validateObject(
    value,
    ["id", "dedupeKey", "title", "body", "severity", "sourceType", "sourceId", "href", "status", "createdAt"],
    path
  );
  return {
    id: requiredString(record, "id", path),
    dedupeKey: requiredString(record, "dedupeKey", path),
    title: requiredString(record, "title", path),
    body: requiredString(record, "body", path, 1000),
    severity: enumValue(record, "severity", path, severities) as Severity,
    sourceType: enumValue(record, "sourceType", path, sourceTypes),
    sourceId: optionalString(record, "sourceId", path),
    href: requiredString(record, "href", path, 1000),
    status: enumValue(record, "status", path, notificationStatuses) as NotificationStatus,
    createdAt: requiredString(record, "createdAt", path)
  };
}

function validateResumeDocument(value: unknown, path: string) {
  const record = validateObject(value, ["id", "workspaceUserId", "title", "text", "sections", "createdAt"], path);
  return {
    id: requiredString(record, "id", path),
    workspaceUserId: requiredString(record, "workspaceUserId", path),
    title: requiredString(record, "title", path),
    text: requiredString(record, "text", path, 8_000),
    sections: requiredStringArray(record, "sections", path, 100, 2_000),
    createdAt: requiredString(record, "createdAt", path)
  };
}

function validateResumeEvaluation(value: unknown, path: string) {
  const record = validateObject(
    value,
    ["id", "resumeDocumentId", "summary", "strengths", "gaps", "status", "confidence", "source", "modelTag", "diagnostic", "createdAt"],
    path
  );
  return {
    id: requiredString(record, "id", path),
    resumeDocumentId: requiredString(record, "resumeDocumentId", path),
    summary: requiredString(record, "summary", path, 1000),
    strengths: requiredStringArray(record, "strengths", path, 100, 1000),
    gaps: requiredStringArray(record, "gaps", path, 100, 1000),
    status: enumValue(record, "status", path, ["completed", "blocked_by_review"] as const),
    confidence: requiredNumber(record, "confidence", path),
    source: optionalEnumValue(record, "source", path, ["deterministic", "ollama"] as const),
    modelTag: optionalString(record, "modelTag", path),
    diagnostic: optionalString(record, "diagnostic", path, 1000),
    createdAt: requiredString(record, "createdAt", path)
  };
}

function validateModelTrace(value: unknown, path: string) {
  const record = validateObject(
    value,
    ["id", "provider", "modelTag", "status", "task", "latencyMs", "confidence", "fallbackPath", "diagnostic", "createdAt"],
    path
  );
  return {
    id: requiredString(record, "id", path),
    provider: enumValue(record, "provider", path, ["deterministic", "ollama"] as const),
    modelTag: optionalString(record, "modelTag", path),
    status: enumValue(record, "status", path, providerStatuses) as ModelProviderStatus,
    task: requiredString(record, "task", path),
    latencyMs: optionalNumber(record, "latencyMs", path, 0, 120_000),
    confidence: optionalNumber(record, "confidence", path),
    fallbackPath: optionalString(record, "fallbackPath", path, 1000),
    diagnostic: requiredString(record, "diagnostic", path, 1000),
    createdAt: requiredString(record, "createdAt", path)
  };
}

function validateModelRuntime(value: unknown, path: string) {
  const record = validateObject(value, ["provider", "enabled", "endpoint", "modelTag", "updatedAt"], path);
  const endpoint = requiredString(record, "endpoint", path, 1000);
  if (!isAllowedOllamaModelEndpoint(endpoint)) {
    throw new Error(`${path}.endpoint must be the Ollama Cloud endpoint.`);
  }
  return {
    provider: enumValue(record, "provider", path, ["ollama"] as const),
    enabled: requiredBoolean(record, "enabled", path),
    endpoint,
    modelTag: requiredString(record, "modelTag", path),
    updatedAt: requiredString(record, "updatedAt", path)
  };
}

function validateImportJob(value: unknown, path: string) {
  const record = validateObject(value, ["id", "source", "status", "attempts", "error", "createdAt", "processedAt"], path);
  return {
    id: requiredString(record, "id", path),
    source: enumValue(record, "source", path, importSources),
    status: enumValue(record, "status", path, importStatuses) as ImportJobStatus,
    attempts: requiredNumber(record, "attempts", path, 0, 100),
    error: optionalString(record, "error", path, 1000),
    createdAt: requiredString(record, "createdAt", path),
    processedAt: optionalString(record, "processedAt", path)
  };
}

function validateConnectorAccount(value: unknown, path: string) {
  const record = validateObject(value, ["id", "provider", "status", "label", "message", "updatedAt"], path);
  return {
    id: requiredString(record, "id", path),
    provider: enumValue(record, "provider", path, ["gmail"] as const),
    status: enumValue(record, "status", path, connectorStatuses) as ConnectorStatus,
    label: requiredString(record, "label", path),
    message: optionalString(record, "message", path, 1000),
    updatedAt: requiredString(record, "updatedAt", path)
  };
}

function validateAuditMetadata(value: unknown, path: string) {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`${path} must be an object.`);
  const record = validateObject(value, Object.keys(value), path);
  const entries = Object.entries(record);
  if (entries.length > 12) throw new Error(`${path} must be bounded.`);
  const metadata: Record<string, string | number | boolean> = {};
  for (const [key, item] of entries) {
    if (key.length > 48) throw new Error(`${path}.${key} key is too long.`);
    if (typeof item === "string") {
      if (item.length > 160) throw new Error(`${path}.${key} must be bounded.`);
      metadata[key] = item;
    } else if (typeof item === "number" && Number.isFinite(item)) {
      metadata[key] = item;
    } else if (typeof item === "boolean") {
      metadata[key] = item;
    } else {
      throw new Error(`${path}.${key} is unsupported.`);
    }
  }
  return metadata;
}

function validateAuditEvent(value: unknown, path: string) {
  const record = validateObject(
    value,
    ["id", "action", "status", "summary", "actor", "sourceType", "sourceId", "metadata", "createdAt"],
    path
  );
  return {
    id: requiredString(record, "id", path),
    action: requiredString(record, "action", path, 120),
    status: enumValue(record, "status", path, auditStatuses),
    summary: requiredString(record, "summary", path, 400),
    actor: enumValue(record, "actor", path, ["local_user", "system"] as const),
    sourceType: optionalEnumValue(record, "sourceType", path, auditSourceTypes),
    sourceId: optionalString(record, "sourceId", path),
    metadata: validateAuditMetadata(record.metadata, `${path}.metadata`),
    createdAt: requiredString(record, "createdAt", path)
  };
}

function validateMailboxMessage(value: unknown, path: string) {
  const record = validateObject(value, ["id", "threadId", "fromLabel", "subject", "snippet", "receivedAt", "sourceLabel"], path);
  return {
    id: requiredString(record, "id", path),
    threadId: requiredString(record, "threadId", path),
    fromLabel: requiredString(record, "fromLabel", path),
    subject: requiredString(record, "subject", path, 1000),
    snippet: requiredString(record, "snippet", path, 1000),
    receivedAt: requiredString(record, "receivedAt", path),
    sourceLabel: requiredString(record, "sourceLabel", path)
  };
}

function validateMailboxThread(value: unknown, path: string) {
  const record = validateObject(value, ["id", "source", "subject", "companyHint", "roleHint", "messages", "createdAt"], path);
  return {
    id: requiredString(record, "id", path),
    source: enumValue(record, "source", path, ["seed", "json", "gmail"] as const),
    subject: requiredString(record, "subject", path, 1000),
    companyHint: optionalString(record, "companyHint", path),
    roleHint: optionalString(record, "roleHint", path),
    messages: arrayOf(record, "messages", path, 500, validateMailboxMessage),
    createdAt: requiredString(record, "createdAt", path)
  };
}

function validateCandidateContext(value: unknown, path: string) {
  const record = validateObject(value, ["id", "targetRoles", "skills", "preferences", "resumeKeywords", "updatedAt"], path);
  return {
    id: requiredString(record, "id", path),
    targetRoles: requiredStringArray(record, "targetRoles", path),
    skills: requiredStringArray(record, "skills", path),
    preferences: requiredStringArray(record, "preferences", path),
    resumeKeywords: requiredStringArray(record, "resumeKeywords", path),
    updatedAt: requiredString(record, "updatedAt", path)
  };
}

function validateAgentRun(value: unknown, path: string) {
  const record = validateObject(
    value,
    ["id", "agent", "status", "inputRef", "outputRef", "confidence", "reason", "createdAt"],
    path
  );
  return {
    id: requiredString(record, "id", path),
    agent: enumValue(record, "agent", path, agentNames) as AgentName,
    status: enumValue(record, "status", path, agentStatuses) as AgentRunStatus,
    inputRef: optionalString(record, "inputRef", path),
    outputRef: optionalString(record, "outputRef", path),
    confidence: optionalNumber(record, "confidence", path),
    reason: requiredString(record, "reason", path, 1000),
    createdAt: requiredString(record, "createdAt", path)
  };
}

function validateStateShape(value: unknown): CareerOSState {
  const record = validateObject(value, stateKeys, "state");
  const version = record.schemaVersion === undefined ? currentWorkspaceSchemaVersion : record.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new Error("state.schemaVersion must be an integer.");
  }
  if (version > currentWorkspaceSchemaVersion) {
    throw new Error("state.schemaVersion is newer than this CareerOS build supports.");
  }
  if (version < 1) {
    throw new Error("state.schemaVersion is unsupported.");
  }

  return {
    schemaVersion: currentWorkspaceSchemaVersion,
    workspaceUser: validateWorkspaceUser(record.workspaceUser, "state.workspaceUser"),
    mailboxThreads: arrayOf(record, "mailboxThreads", "state", 2_000, validateMailboxThread),
    candidateContext: validateCandidateContext(record.candidateContext, "state.candidateContext"),
    agentRuns: arrayOf(record, "agentRuns", "state", 10_000, validateAgentRun),
    applications: arrayOf(record, "applications", "state", 5_000, validateApplication),
    events: arrayOf(record, "events", "state", 20_000, validateApplicationEvent),
    evidenceSnippets: arrayOf(record, "evidenceSnippets", "state", 20_000, validateEvidenceSnippet),
    reviewItems: arrayOf(record, "reviewItems", "state", 20_000, validateReviewItem),
    reminders: arrayOf(record, "reminders", "state", 20_000, validateReminder),
    notifications: arrayOf(record, "notifications", "state", 20_000, validateNotification),
    resumeDocuments: arrayOf(record, "resumeDocuments", "state", 1_000, validateResumeDocument),
    resumeEvaluations: arrayOf(record, "resumeEvaluations", "state", 5_000, validateResumeEvaluation),
    modelRuntime: validateModelRuntime(record.modelRuntime, "state.modelRuntime"),
    modelTraces: arrayOf(record, "modelTraces", "state", 20_000, validateModelTrace),
    importJobs: arrayOf(record, "importJobs", "state", 10_000, validateImportJob),
    connectorAccounts: arrayOf(record, "connectorAccounts", "state", 100, validateConnectorAccount),
    auditEvents:
      record.auditEvents === undefined ? [] : arrayOf(record, "auditEvents", "state", 5_000, validateAuditEvent)
  };
}

export function validateWorkspaceImport(value: unknown): WorkspaceImportValidationResult {
  try {
    rejectDangerousContent(value);
  } catch {
    return fail("dangerous_content", "Import rejected because it contains private fields, local paths, secrets, or data dumps.");
  }

  try {
    return { ok: true, state: validateStateShape(value) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import shape is invalid.";
    if (message.includes("schemaVersion")) {
      return fail("schema_version_unsupported", "Import schema version is not supported by this CareerOS build.");
    }
    return fail("invalid_shape", "Import must be a normalized CareerOS workspace export.");
  }
}

export function parseWorkspaceJson(raw: string): WorkspaceImportValidationResult {
  if (raw.length > maxWorkspaceImportBytes) {
    return fail("dangerous_content", "Import rejected because the JSON file is too large.");
  }

  try {
    return validateWorkspaceImport(JSON.parse(raw));
  } catch {
    return fail("malformed_json", "Import must be valid JSON.");
  }
}

export function withWorkspaceImportJob(state: CareerOSState): CareerOSState {
  const createdAt = nowIso();
  return appendAuditEvent(
    {
    ...state,
    importJobs: [
      {
        id: newId("import_job"),
        source: "json",
        status: "processed",
        attempts: 1,
        createdAt,
        processedAt: createdAt
      },
      ...state.importJobs
    ]
    },
    createAuditEvent({
      action: "workspace.imported",
      status: "succeeded",
      summary: "Validated CareerOS workspace JSON import replaced local state.",
      actor: "local_user",
      sourceType: "local_data",
      metadata: {
        applications: state.applications.length,
        reviewItems: state.reviewItems.length,
        auditEvents: state.auditEvents.length
      }
    })
  );
}
