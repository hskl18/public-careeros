import { newId, nowIso } from "./id";
import type { AuditEvent, CareerOSState } from "./types";

const maxAuditEvents = 250;

function boundedText(value: string, max = 220) {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function cleanMetadata(metadata: AuditEvent["metadata"]) {
  if (!metadata) return undefined;
  const clean: NonNullable<AuditEvent["metadata"]> = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 12)) {
    const safeKey = boundedText(key, 48);
    if (!safeKey) continue;
    if (typeof value === "string") clean[safeKey] = boundedText(value, 160);
    if (typeof value === "number" && Number.isFinite(value)) clean[safeKey] = value;
    if (typeof value === "boolean") clean[safeKey] = value;
  }
  return Object.keys(clean).length ? clean : undefined;
}

export function createAuditEvent(input: Omit<AuditEvent, "id" | "createdAt" | "summary" | "action"> & {
  action: string;
  summary: string;
}): AuditEvent {
  return {
    id: newId("audit"),
    action: boundedText(input.action, 96),
    status: input.status,
    summary: boundedText(input.summary),
    actor: input.actor,
    sourceType: input.sourceType,
    sourceId: input.sourceId ? boundedText(input.sourceId, 120) : undefined,
    metadata: cleanMetadata(input.metadata),
    createdAt: nowIso()
  };
}

export function appendAuditEvent(state: CareerOSState, event: AuditEvent): CareerOSState {
  return {
    ...state,
    auditEvents: [event, ...(state.auditEvents ?? [])].slice(0, maxAuditEvents)
  };
}

