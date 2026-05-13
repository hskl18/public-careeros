import { hashText, newId, nowIso, stableId } from "./id";
import { analyzeImportRecordWithModel } from "./model-analysis";
import { checkOllamaStatus, modelRuntimeOptions, modelStatusTrace, type ModelRuntimeOptions } from "./model-status";
import { analyzeResumeWithModel } from "./resume-model-analysis";
import type {
  AgentRun,
  ApplicationEvent,
  CareerOSState,
  EvidenceSnippet,
  ImportJob,
  LocalImportRecord,
  ProposedMutation,
  ResumeDocument,
  ResumeEvaluation,
  ReviewItem
} from "./types";
import {
  applyProposedMutation,
  buildReviewDecision,
  canCreateApplication,
  matchOrCreateApplication,
  refreshRemindersForMutation,
  resolveEventType
} from "./workflow";

function toStage(text: string): ProposedMutation["stage"] | undefined {
  const normalized = text.toLowerCase();
  if (normalized.includes("offer")) return "offer";
  if (normalized.includes("reject") || normalized.includes("not moving forward")) return "rejected";
  if (normalized.includes("assessment") || normalized.includes("take-home")) return "assessment";
  if (normalized.includes("interview")) return "interview";
  if (normalized.includes("reply") || normalized.includes("recruiter")) return "recruiter_reply";
  if (normalized.includes("applied") || normalized.includes("submitted")) return "applied";
  return undefined;
}

function confidenceFor(text: string) {
  const normalized = text.toLowerCase();
  let confidence = 0.45;
  if (/interview|assessment|offer|reject|deadline|follow[- ]?up|recruiter/.test(normalized)) confidence += 0.22;
  if (/application|applied|submitted|receipt/.test(normalized)) confidence += 0.18;
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(normalized)) confidence += 0.12;
  if (/\b(?:maybe|possibly|unclear|either|or)\b/.test(normalized)) confidence -= 0.2;
  return Math.max(0.1, Math.min(0.98, Number(confidence.toFixed(2))));
}

function extractIsoDate(text: string) {
  const match = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (!match) return undefined;
  const date = new Date(`${match[0]}T16:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function firstMatch(text: string, pattern: RegExp) {
  return text.match(pattern)?.[1]?.trim();
}

function cleanMetadataValue(value: string | undefined) {
  return value?.trim() || undefined;
}

function extractMetadata(record: LocalImportRecord) {
  const text = record.text;
  const recruiterEmail = firstMatch(text, /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i);
  return {
    jobDescriptionUrl:
      cleanMetadataValue(record.jobDescriptionUrl) ??
      firstMatch(text, /\b(?:jd|job description|job post|posting)\s*(?:url|link)?\s*:\s*(https?:\/\/\S+)/i),
    resumeVersion:
      cleanMetadataValue(record.resumeVersion) ??
      firstMatch(text, /\bresume\s*(?:version|ver\.?)?\s*:\s*([^\n.;]+)/i),
    coverLetterVersion:
      cleanMetadataValue(record.coverLetterVersion) ??
      firstMatch(text, /\bcover\s*letter\s*(?:version|ver\.?)?\s*:\s*([^\n.;]+)/i),
    applicationSource:
      cleanMetadataValue(record.applicationSource) ?? firstMatch(text, /\bsource\s*:\s*([^\n.;]+)/i),
    recruiterContactName:
      cleanMetadataValue(record.recruiterContactName) ??
      firstMatch(text, /\brecruiter\s*:\s*([^<\n.;]+)/i) ??
      firstMatch(text, /\bcontact\s*:\s*([^<\n.;]+)/i),
    recruiterContactEmail: cleanMetadataValue(record.recruiterContactEmail) ?? recruiterEmail,
    location: cleanMetadataValue(record.location) ?? firstMatch(text, /\blocation\s*:\s*([^\n.;]+)/i),
    salaryRange:
      cleanMetadataValue(record.salaryRange) ??
      firstMatch(text, /\bsalary\s*(?:range)?\s*:\s*([^\n.;]+)/i) ??
      firstMatch(text, /(\$[0-9][0-9,]*(?:\s*[-–]\s*\$?[0-9][0-9,]*)?(?:\s*(?:\/?\s*year|\/?\s*yr|annually))?)/i),
    notes: cleanMetadataValue(record.notes)
  };
}

function isRiskyMutation(change: ProposedMutation) {
  return Boolean(change.deadlineAt || change.stage === "offer" || change.stage === "rejected");
}

function createEvidence(record: LocalImportRecord, applicationId?: string, reviewItemId?: string): EvidenceSnippet {
  const clipped = record.text.trim().slice(0, 360);
  const hash = hashText(record.text);
  const sourceMessageIds = record.sourceMessageIds ?? [stableId("message", [record.sourceLabel, hash])];
  const metadata = extractMetadata(record);
  return {
    id: stableId("evidence", [record.sourceLabel, hash]),
    applicationId,
    reviewItemId,
    sourceMessageIds,
    sourceRelationships: {
      mailboxMessageIds: sourceMessageIds,
      company: record.company,
      role: record.role,
      applicationId,
      recruiterContactName: metadata.recruiterContactName,
      recruiterContactEmail: metadata.recruiterContactEmail,
      resumeVersion: metadata.resumeVersion
    },
    sourceLabel: record.sourceLabel,
    snippet: clipped,
    hash,
    confidence: confidenceFor(record.text),
    reason: "Bounded mailbox evidence used by the evidence/review agent.",
    createdAt: nowIso()
  };
}

function buildDeterministicAgentRuns(input: {
  record: LocalImportRecord;
  confidence: number;
  eventType: string;
  needsReview: boolean;
  reviewId?: string;
}): AgentRun[] {
  const now = nowIso();
  return [
    {
      id: stableId("agent_run", [input.record.sourceLabel, "mailbox_triage"]),
      agent: "mailbox_triage",
      status: "deterministic",
      inputRef: input.record.sourceLabel,
      confidence: input.confidence,
      reason: "Classified recruiting relevance and urgency with local deterministic rules.",
      createdAt: now
    },
    {
      id: stableId("agent_run", [input.record.sourceLabel, "workflow_extraction"]),
      agent: "workflow_extraction",
      status: "deterministic",
      inputRef: input.record.sourceLabel,
      confidence: input.confidence,
      reason: `Extracted ${input.eventType} proposal from bounded mailbox text.`,
      createdAt: now
    },
    {
      id: stableId("agent_run", [input.record.sourceLabel, "evidence_review"]),
      agent: "evidence_review",
      status: input.needsReview ? "review_blocked" : "deterministic",
      inputRef: input.record.sourceLabel,
      outputRef: input.reviewId,
      confidence: input.confidence,
      reason: input.needsReview
        ? "Mutation was routed through review before canonical state changes."
        : "Low-risk deterministic mutation was applied with bounded evidence.",
      createdAt: now
    }
  ];
}

function mergeAgentRuns(existing: AgentRun[], nextRuns: AgentRun[]) {
  const existingIds = new Set(existing.map((run) => run.id));
  return [...nextRuns.filter((run) => !existingIds.has(run.id)), ...existing];
}

export function processLocalImport(state: CareerOSState, records: LocalImportRecord[]): CareerOSState {
  const now = nowIso();
  const importJob: ImportJob = {
    id: newId("job"),
    source: "json",
    status: "processed",
    attempts: 1,
    createdAt: now,
    processedAt: now
  };

  let next = {
    ...state,
    importJobs: [importJob, ...state.importJobs]
  };

  for (const record of records) {
    const confidence = confidenceFor(record.text);
    const stage = toStage(record.text);
    const eventType = resolveEventType(stage);
    const date = extractIsoDate(record.text);
    const metadata = extractMetadata(record);
    const normalizedText = record.text.toLowerCase();
    const match = matchOrCreateApplication(
      next,
      record,
      stage,
      canCreateApplication(record.company) && eventType !== "generic_update"
    );
    const application = match.application;
    const proposedChange: ProposedMutation = {
      applicationId: application?.id,
      company: application?.company ?? record.company,
      role: application?.role ?? record.role,
      stage,
      contactName: metadata.recruiterContactName,
      jobDescriptionUrl: metadata.jobDescriptionUrl,
      resumeVersion: metadata.resumeVersion,
      coverLetterVersion: metadata.coverLetterVersion,
      applicationSource: metadata.applicationSource,
      recruiterContactName: metadata.recruiterContactName,
      recruiterContactEmail: metadata.recruiterContactEmail,
      location: metadata.location,
      salaryRange: metadata.salaryRange,
      notes: metadata.notes,
      deadlineAt: /deadline|assessment|interview/.test(normalizedText) ? date : undefined,
      followUpAt: normalizedText.includes("follow") ? date : undefined,
      eventSummary: `Imported ${record.sourceLabel}: ${record.text.trim().slice(0, 140)}`
    };
    const reviewDecision = buildReviewDecision({
      classificationConfidence: confidence,
      matchingConfidence: match.matchingConfidence,
      eventType,
      company: record.company,
      role: record.role,
      matchReviewReason: match.reviewReason,
      risky: isRiskyMutation(proposedChange)
    });
    const needsReview = reviewDecision.requiresReview;
    if (needsReview && match.created) {
      proposedChange.applicationId = undefined;
    }
    const reviewId = stableId("review", [record.sourceLabel, record.text]);
    const evidence = createEvidence(record, proposedChange.applicationId, needsReview ? reviewId : undefined);
    const applications = needsReview && match.created ? next.applications : match.applications;
    const agentRuns = buildDeterministicAgentRuns({ record, confidence, eventType, needsReview, reviewId });

    if (needsReview) {
      const alreadyQueued = next.reviewItems.some((item) => item.id === reviewId);
      const review: ReviewItem = {
        id: reviewId,
        status: "open",
        reason: reviewDecision.reason ?? "Review required before mutating application state.",
        sourceLabel: record.sourceLabel,
        confidence,
        proposedChange,
        evidenceSnippetIds: [evidence.id],
        traceSummary: `deterministic parser; ${eventType}; match=${match.matchingConfidence.toFixed(2)}; review gate required`,
        createdAt: now
      };

      next = {
        ...next,
        applications,
        agentRuns: mergeAgentRuns(next.agentRuns, agentRuns),
        evidenceSnippets: [evidence, ...next.evidenceSnippets.filter((item) => item.id !== evidence.id)],
        reviewItems: alreadyQueued ? next.reviewItems : [review, ...next.reviewItems],
        modelTraces: [
          {
            id: stableId("trace", [reviewId, "deterministic"]),
            provider: "deterministic",
            status: "disabled",
            task: "local-import",
            confidence,
            fallbackPath: "review-gate",
            diagnostic: "Deterministic import created a review item instead of mutating durable state.",
            createdAt: now
          },
          ...next.modelTraces
        ]
      };
      continue;
    }

    if (!application) {
      continue;
    }

    const updated = applyProposedMutation(application, proposedChange, "import");
    const event: ApplicationEvent = {
      id: stableId("event", [record.sourceLabel, record.text]),
      applicationId: updated.id,
      type: eventType,
      summary: proposedChange.eventSummary,
      source: "import",
      confidence,
      createdAt: now
    };
    next = {
      ...next,
      applications: applications.map((item) => (item.id === updated.id ? updated : item)),
      agentRuns: mergeAgentRuns(next.agentRuns, agentRuns),
      events: next.events.some((item) => item.id === event.id) ? next.events : [event, ...next.events],
      evidenceSnippets: [evidence, ...next.evidenceSnippets.filter((item) => item.id !== evidence.id)],
      reminders: refreshRemindersForMutation(next.reminders, updated, proposedChange)
    };
  }

  return next;
}

export async function processLocalImportWithModel(
  state: CareerOSState,
  records: LocalImportRecord[],
  options: ModelRuntimeOptions = {}
): Promise<CareerOSState> {
  let next = processLocalImport(state, records);
  const statusReport = await checkOllamaStatus(options);
  next = {
    ...next,
    modelTraces: [modelStatusTrace(statusReport), ...next.modelTraces]
  };

  if (statusReport.status !== "ready") {
    return next;
  }

  for (const record of records) {
    const analysis = await analyzeImportRecordWithModel(record, statusReport, options);
    const match = matchOrCreateApplication(next, record, analysis.suggestion?.stage, canCreateApplication(record.company));
    const application = match.application;
    const reviewId = stableId("review", [
      analysis.suggestion ? "model-suggestion" : "model-invalid",
      record.sourceLabel,
      record.text
    ]);
    const proposedChange: ProposedMutation = analysis.suggestion
      ? {
          applicationId: match.created ? undefined : application?.id,
          company: application?.company ?? record.company,
          role: application?.role ?? record.role,
          stage: analysis.suggestion.stage,
          contactName: analysis.suggestion.contactName,
          deadlineAt: analysis.suggestion.deadlineAt,
          followUpAt: analysis.suggestion.followUpAt,
          ...extractMetadata(record),
          eventSummary: `Model suggested: ${analysis.suggestion.summary}`
        }
      : {
          applicationId: match.created ? undefined : application?.id,
          company: application?.company ?? record.company,
          role: application?.role ?? record.role,
          ...extractMetadata(record),
          eventSummary: "Invalid model output was blocked before mutation."
        };
    const evidence = createEvidence(record, proposedChange.applicationId, reviewId);
    const alreadyQueued = next.reviewItems.some((item) => item.id === reviewId);
    const reviewDecision = buildReviewDecision({
      classificationConfidence: analysis.suggestion?.confidence ?? 0,
      matchingConfidence: match.matchingConfidence,
      eventType: resolveEventType(analysis.suggestion?.stage),
      company: record.company,
      role: record.role,
      matchReviewReason: match.reviewReason,
      risky: true,
      modelBacked: Boolean(analysis.suggestion),
      invalidModelOutput: !analysis.suggestion
    });
    const review: ReviewItem = {
      id: reviewId,
      status: "open",
      reason: reviewDecision.reason ?? "Model output was queued for review before mutation.",
      sourceLabel: `model:${record.sourceLabel}`,
      confidence: analysis.suggestion?.confidence ?? 0,
      proposedChange,
      evidenceSnippetIds: [evidence.id],
      traceSummary: `ollama ${analysis.statusReport.modelTag}; ${analysis.diagnostic}`,
      createdAt: nowIso()
    };

    next = {
      ...next,
      applications: match.created ? next.applications : match.applications,
      agentRuns: mergeAgentRuns(next.agentRuns, [
        {
          id: stableId("agent_run", [record.sourceLabel, "model_router"]),
          agent: "model_router",
          status: analysis.statusReport.status === "ready" ? "model_ready" : "fallback",
          inputRef: record.sourceLabel,
          outputRef: reviewId,
          confidence: analysis.suggestion?.confidence,
          reason: analysis.diagnostic,
          createdAt: nowIso()
        },
        {
          id: stableId("agent_run", [record.sourceLabel, "evidence_review", "model"]),
          agent: "evidence_review",
          status: "review_blocked",
          inputRef: record.sourceLabel,
          outputRef: reviewId,
          confidence: analysis.suggestion?.confidence ?? 0,
          reason: "Model-generated mutation is review-gated before canonical application state changes.",
          createdAt: nowIso()
        }
      ]),
      evidenceSnippets: [evidence, ...next.evidenceSnippets.filter((item) => item.id !== evidence.id)],
      reviewItems: alreadyQueued ? next.reviewItems : [review, ...next.reviewItems],
      modelTraces: [
        {
          id: stableId("trace", [reviewId, analysis.diagnostic]),
          provider: "ollama",
          modelTag: analysis.statusReport.modelTag,
          status: analysis.statusReport.status,
          task: "local-import-analysis",
          latencyMs: analysis.latencyMs,
          confidence: analysis.suggestion?.confidence,
          fallbackPath: analysis.suggestion ? "review-gate" : "deterministic",
          diagnostic: analysis.diagnostic,
          createdAt: nowIso()
        },
        ...next.modelTraces
      ]
    };
  }

  return next;
}

function buildResumeDocument(state: CareerOSState, title: string, text: string, now: string): ResumeDocument {
  const sections = ["experience", "project", "education", "skill"].filter((section) =>
    text.toLowerCase().includes(section)
  );
  return {
    id: newId("resume"),
    workspaceUserId: state.workspaceUser.id,
    title: title.trim() || "Pasted resume",
    text: text.trim().slice(0, 6000),
    sections: sections.length ? sections.map((section) => section[0].toUpperCase() + section.slice(1)) : ["General"],
    createdAt: now
  };
}

function deterministicResumeEvaluation(resume: ResumeDocument, text: string, now: string): ResumeEvaluation {
  const hasEvidence = text.length > 120;
  return {
    id: stableId("resume_eval", [resume.id, "deterministic"]),
    resumeDocumentId: resume.id,
    summary: hasEvidence
      ? "Deterministic resume pass completed. Review bullets against the target role before applying changes."
      : "Resume text is short; add more evidence before trusting automated conclusions.",
    strengths: resume.sections.length ? resume.sections.map((section) => `${section} section detected`) : ["Readable resume text"],
    gaps: hasEvidence ? ["Add role-specific metrics", "Connect projects to business impact"] : ["More resume context needed"],
    status: hasEvidence ? "completed" : "blocked_by_review",
    confidence: hasEvidence ? 0.74 : 0.42,
    source: "deterministic",
    diagnostic: "Deterministic local resume evaluation.",
    createdAt: now
  };
}

export function evaluateResumeText(state: CareerOSState, title: string, text: string): CareerOSState {
  const now = nowIso();
  const resume = buildResumeDocument(state, title, text, now);
  const evaluation = deterministicResumeEvaluation(resume, text, now);

  return {
    ...state,
    resumeDocuments: [resume, ...state.resumeDocuments],
    resumeEvaluations: [evaluation, ...state.resumeEvaluations],
    modelTraces: [
      {
        id: stableId("trace", [evaluation.id, "resume"]),
        provider: "deterministic",
        status: "disabled",
        task: "resume-evaluation",
        confidence: evaluation.confidence,
        fallbackPath: "ollama-disabled",
        diagnostic: "Resume evaluation used deterministic fallback only.",
        createdAt: now
      },
      ...state.modelTraces
    ]
  };
}

export async function evaluateResumeTextWithModel(
  state: CareerOSState,
  title: string,
  text: string,
  options: ModelRuntimeOptions = {}
): Promise<CareerOSState> {
  const now = nowIso();
  const resume = buildResumeDocument(state, title, text, now);
  const deterministicEvaluation = deterministicResumeEvaluation(resume, text, now);
  const runtimeOptions = Object.keys(options).length ? options : modelRuntimeOptions(state.modelRuntime);
  const statusReport = await checkOllamaStatus(runtimeOptions);
  const baseline: CareerOSState = {
    ...state,
    resumeDocuments: [resume, ...state.resumeDocuments],
    resumeEvaluations: [deterministicEvaluation, ...state.resumeEvaluations],
    modelTraces: [
      modelStatusTrace(statusReport),
      {
        id: stableId("trace", [deterministicEvaluation.id, "resume", "deterministic"]),
        provider: "deterministic",
        status: "disabled",
        task: "resume-evaluation",
        confidence: deterministicEvaluation.confidence,
        fallbackPath: statusReport.status === "ready" ? "baseline" : "deterministic",
        diagnostic:
          statusReport.status === "ready"
            ? "Deterministic resume baseline stored before model-backed analysis."
            : `Resume evaluation used deterministic fallback because model status is ${statusReport.status}.`,
        createdAt: now
      },
      ...state.modelTraces
    ]
  };

  if (statusReport.status !== "ready") {
    return baseline;
  }

  const analysis = await analyzeResumeWithModel(title, text, statusReport, runtimeOptions);
  const suggestion = analysis.suggestion;
  const blocked = !suggestion || suggestion.confidence < 0.7 || suggestion.riskLevel === "high";
  const modelEvaluation: ResumeEvaluation = suggestion
    ? {
        id: stableId("resume_eval", [resume.id, "ollama", analysis.diagnostic]),
        resumeDocumentId: resume.id,
        summary: suggestion.summary,
        strengths: suggestion.strengths,
        gaps: suggestion.gaps,
        status: blocked ? "blocked_by_review" : "completed",
        confidence: suggestion.confidence,
        source: "ollama",
        modelTag: analysis.statusReport.modelTag,
        diagnostic: blocked
          ? `${analysis.diagnostic} Review blocked: ${suggestion.reason}`
          : `${analysis.diagnostic} Reason: ${suggestion.reason}`,
        createdAt: nowIso()
      }
    : {
        id: stableId("resume_eval", [resume.id, "ollama-invalid", analysis.diagnostic]),
        resumeDocumentId: resume.id,
        summary: "Model-backed resume analysis was blocked. Deterministic fallback remains available.",
        strengths: deterministicEvaluation.strengths,
        gaps: ["Review blocked because the model response failed schema validation."],
        status: "blocked_by_review",
        confidence: 0,
        source: "ollama",
        modelTag: analysis.statusReport.modelTag,
        diagnostic: analysis.diagnostic,
        createdAt: nowIso()
      };

  return {
    ...baseline,
    resumeDocuments: baseline.resumeDocuments.map((document) =>
      document.id === resume.id && suggestion ? { ...document, sections: suggestion.sections } : document
    ),
    resumeEvaluations: [modelEvaluation, ...baseline.resumeEvaluations],
    modelTraces: [
      {
        id: stableId("trace", [modelEvaluation.id, analysis.diagnostic]),
        provider: "ollama",
        modelTag: analysis.statusReport.modelTag,
        status: analysis.statusReport.status,
        task: "resume-analysis",
        latencyMs: analysis.latencyMs,
        confidence: suggestion?.confidence,
        fallbackPath: blocked ? "deterministic" : "model-backed",
        diagnostic: blocked
          ? `${analysis.diagnostic} Resume model output blocked or below confidence threshold.`
          : analysis.diagnostic,
        createdAt: nowIso()
      },
      ...baseline.modelTraces
    ]
  };
}
