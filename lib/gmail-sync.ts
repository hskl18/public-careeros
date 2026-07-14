import { createAuditEvent } from "./audit";
import { nowIso } from "./id";
import type { AuditEvent, GmailSyncProgress, GmailSyncState, GmailSyncStatus } from "./types";

const allowedTransitions: Record<GmailSyncStatus, readonly GmailSyncStatus[]> = {
  disconnected: ["authorizing", "catching_up", "idle"],
  authorizing: ["disconnected", "idle", "reconnect_required"],
  catching_up: ["catching_up", "idle", "degraded", "reconnect_required", "paused", "disconnected"],
  idle: ["authorizing", "catching_up", "reconnect_required", "disconnected"],
  degraded: ["authorizing", "catching_up", "paused", "reconnect_required", "disconnected"],
  reconnect_required: ["authorizing", "disconnected"],
  paused: ["catching_up", "disconnected"]
};

export function createDisconnectedGmailSyncState(updatedAt = nowIso()): GmailSyncState {
  return { status: "disconnected", updatedAt };
}

export function createGmailSyncProgress(previous?: GmailSyncProgress): GmailSyncProgress {
  if (previous) return previous;
  return {
    windowStartedAt: nowIso(),
    pagesCompleted: 0,
    messagesListed: 0,
    messagesFetched: 0,
    importedRecords: 0,
    duplicateRecords: 0,
    hasMore: false
  };
}

export function canTransitionGmailSync(from: GmailSyncStatus, to: GmailSyncStatus) {
  return from === to || allowedTransitions[from].includes(to);
}

export function transitionGmailSync(
  current: GmailSyncState,
  status: GmailSyncStatus,
  options: {
    diagnosticCode?: GmailSyncState["diagnosticCode"];
    progress?: GmailSyncProgress;
    lastSuccessfulAt?: string;
    summary: string;
    auditStatus?: AuditEvent["status"];
  }
): { sync: GmailSyncState; audit: AuditEvent } {
  if (!canTransitionGmailSync(current.status, status)) {
    throw new Error(`Unsupported Gmail sync transition: ${current.status} to ${status}.`);
  }

  const updatedAt = nowIso();
  const sync: GmailSyncState = {
    status,
    progress: options.progress,
    diagnosticCode: options.diagnosticCode,
    lastSuccessfulAt: options.lastSuccessfulAt ?? current.lastSuccessfulAt,
    updatedAt
  };
  const audit = createAuditEvent({
    action: `gmail.sync_state.${status}`,
    status: options.auditStatus ?? (status === "degraded" || status === "reconnect_required" ? "failed" : "succeeded"),
    summary: options.summary,
    actor: "system",
    sourceType: "connector",
    sourceId: "connector_gmail",
    metadata: {
      from: current.status,
      to: status,
      diagnosticCode: options.diagnosticCode ?? "none",
      pagesCompleted: options.progress?.pagesCompleted ?? 0,
      messagesFetched: options.progress?.messagesFetched ?? 0,
      importedRecords: options.progress?.importedRecords ?? 0,
      duplicateRecords: options.progress?.duplicateRecords ?? 0,
      hasMore: options.progress?.hasMore ?? false
    }
  });
  return { sync, audit };
}
