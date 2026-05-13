import type { CareerOSState, EvidenceSnippet } from "./types";

export type EvidenceGroupType =
  | "thread"
  | "application"
  | "company"
  | "role"
  | "recruiter"
  | "source_label"
  | "resume_version";

export interface EvidenceRelationshipGroup {
  type: EvidenceGroupType;
  key: string;
  label: string;
  evidenceCount: number;
  evidenceIds: string[];
  sourceMessageIds: string[];
  applicationIds: string[];
  companies: string[];
  roles: string[];
  recruiterContacts: string[];
  sourceLabels: string[];
  resumeVersions: string[];
  snippets: Array<Pick<EvidenceSnippet, "id" | "sourceLabel" | "snippet" | "confidence" | "hash" | "createdAt">>;
}

export interface EvidenceRelationshipViews {
  byThread: EvidenceRelationshipGroup[];
  byApplication: EvidenceRelationshipGroup[];
  byCompany: EvidenceRelationshipGroup[];
  byRole: EvidenceRelationshipGroup[];
  byRecruiter: EvidenceRelationshipGroup[];
  bySourceLabel: EvidenceRelationshipGroup[];
  byResumeVersion: EvidenceRelationshipGroup[];
}

function uniq(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].sort((left, right) => left.localeCompare(right));
}

function keyFor(value: string | undefined) {
  return value?.trim().toLowerCase() || undefined;
}

function messageThreadLookup(state: CareerOSState) {
  const lookup = new Map<string, { threadId: string; label: string }>();
  for (const thread of state.mailboxThreads) {
    for (const message of thread.messages) {
      lookup.set(message.id, { threadId: thread.id, label: thread.subject });
    }
  }
  return lookup;
}

function applicationLabel(state: CareerOSState, applicationId: string) {
  const application = state.applications.find((item) => item.id === applicationId);
  return application ? `${application.company} · ${application.role}` : applicationId;
}

function recruiterLabel(snippet: EvidenceSnippet) {
  const name = snippet.sourceRelationships?.recruiterContactName;
  const email = snippet.sourceRelationships?.recruiterContactEmail;
  if (name && email) return `${name} <${email}>`;
  return name ?? email;
}

function buildGroup(type: EvidenceGroupType, key: string, label: string, snippets: EvidenceSnippet[]): EvidenceRelationshipGroup {
  return {
    type,
    key,
    label,
    evidenceCount: snippets.length,
    evidenceIds: uniq(snippets.map((snippet) => snippet.id)),
    sourceMessageIds: uniq(snippets.flatMap((snippet) => snippet.sourceMessageIds)),
    applicationIds: uniq(snippets.map((snippet) => snippet.applicationId ?? snippet.sourceRelationships?.applicationId)),
    companies: uniq(snippets.map((snippet) => snippet.sourceRelationships?.company)),
    roles: uniq(snippets.map((snippet) => snippet.sourceRelationships?.role)),
    recruiterContacts: uniq(snippets.map(recruiterLabel)),
    sourceLabels: uniq(snippets.map((snippet) => snippet.sourceLabel)),
    resumeVersions: uniq(snippets.map((snippet) => snippet.sourceRelationships?.resumeVersion)),
    snippets: snippets
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 5)
      .map((snippet) => ({
        id: snippet.id,
        sourceLabel: snippet.sourceLabel,
        snippet: snippet.snippet,
        confidence: snippet.confidence,
        hash: snippet.hash,
        createdAt: snippet.createdAt
      }))
  };
}

function groupBy(
  state: CareerOSState,
  type: EvidenceGroupType,
  entries: (snippet: EvidenceSnippet) => Array<{ key: string; label: string }>
) {
  const groups = new Map<string, { label: string; snippets: EvidenceSnippet[] }>();
  for (const snippet of state.evidenceSnippets) {
    for (const entry of entries(snippet)) {
      const existing = groups.get(entry.key);
      groups.set(entry.key, {
        label: existing?.label ?? entry.label,
        snippets: [...(existing?.snippets ?? []), snippet]
      });
    }
  }

  return [...groups.entries()]
    .map(([key, value]) => buildGroup(type, key, value.label, value.snippets))
    .sort((left, right) => right.evidenceCount - left.evidenceCount || left.label.localeCompare(right.label));
}

export function deriveEvidenceRelationshipViews(state: CareerOSState): EvidenceRelationshipViews {
  const threadLookup = messageThreadLookup(state);

  return {
    byThread: groupBy(state, "thread", (snippet) => {
      const entries = snippet.sourceMessageIds
        .map((messageId) => threadLookup.get(messageId))
        .filter((value): value is { threadId: string; label: string } => Boolean(value))
        .map((value) => ({ key: value.threadId, label: value.label }));
      return entries.length ? entries : [{ key: "unknown_thread", label: "Unknown mailbox thread" }];
    }),
    byApplication: groupBy(state, "application", (snippet) => {
      const applicationId = snippet.applicationId ?? snippet.sourceRelationships?.applicationId;
      return applicationId ? [{ key: applicationId, label: applicationLabel(state, applicationId) }] : [];
    }),
    byCompany: groupBy(state, "company", (snippet) => {
      const value = snippet.sourceRelationships?.company;
      const key = keyFor(value);
      return key ? [{ key, label: value as string }] : [];
    }),
    byRole: groupBy(state, "role", (snippet) => {
      const value = snippet.sourceRelationships?.role;
      const key = keyFor(value);
      return key ? [{ key, label: value as string }] : [];
    }),
    byRecruiter: groupBy(state, "recruiter", (snippet) => {
      const name = snippet.sourceRelationships?.recruiterContactName;
      const email = snippet.sourceRelationships?.recruiterContactEmail;
      const label = recruiterLabel(snippet);
      const key = keyFor(email ?? name);
      return key && label ? [{ key, label }] : [];
    }),
    bySourceLabel: groupBy(state, "source_label", (snippet) => [{ key: snippet.sourceLabel, label: snippet.sourceLabel }]),
    byResumeVersion: groupBy(state, "resume_version", (snippet) => {
      const value = snippet.sourceRelationships?.resumeVersion;
      const key = keyFor(value);
      return key ? [{ key, label: value as string }] : [];
    })
  };
}
