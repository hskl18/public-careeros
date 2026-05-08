import { hashText, newId, nowIso, stableId } from "./id";
import { analyzeImportRecordWithModel } from "./model-analysis";
import { checkOllamaStatus, modelStatusTrace, type ModelRuntimeOptions } from "./model-status";
import type {
  Application,
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

function toStage(text: string): ProposedMutation["stage"] | undefined {
  const normalized = text.toLowerCase();
  if (normalized.includes("offer")) return "offer";
  if (normalized.includes("reject") || normalized.includes("not moving forward")) return "rejected";
  if (normalized.includes("interview")) return "interview";
  if (normalized.includes("assessment") || normalized.includes("take-home")) return "assessment";
  if (normalized.includes("reply") || normalized.includes("recruiter")) return "recruiter_reply";
  if (normalized.includes("applied") || normalized.includes("submitted")) return "applied";
  return undefined;
}

function confidenceFor(text: string) {
  const normalized = text.toLowerCase();
  let confidence = 0.45;
  if (/interview|assessment|offer|reject|deadline|follow[- ]?up|recruiter/.test(normalized)) confidence += 0.22;
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(normalized)) confidence += 0.12;
  if (/maybe|possibly|unclear|either|or /.test(normalized)) confidence -= 0.2;
  return Math.max(0.1, Math.min(0.98, Number(confidence.toFixed(2))));
}

function extractIsoDate(text: string) {
  const match = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (!match) return undefined;
  const date = new Date(`${match[0]}T16:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function isRiskyMutation(change: ProposedMutation) {
  return Boolean(change.deadlineAt || change.stage === "offer" || change.stage === "rejected" || change.contactName);
}

function createEvidence(record: LocalImportRecord, applicationId?: string, reviewItemId?: string): EvidenceSnippet {
  const clipped = record.text.trim().slice(0, 360);
  return {
    id: stableId("evidence", [record.sourceLabel, clipped]),
    applicationId,
    reviewItemId,
    sourceLabel: record.sourceLabel,
    snippet: clipped,
    hash: hashText(record.text),
    confidence: confidenceFor(record.text),
    createdAt: nowIso()
  };
}

function findOrCreateApplication(state: CareerOSState, record: LocalImportRecord): Application {
  const existing = state.applications.find(
    (application) =>
      application.company.toLowerCase() === record.company.toLowerCase() &&
      application.role.toLowerCase() === record.role.toLowerCase()
  );

  if (existing) return existing;

  return {
    id: stableId("app", [record.company, record.role]),
    workspaceUserId: state.workspaceUser.id,
    company: record.company,
    role: record.role,
    stage: "applied",
    updatedAt: nowIso(),
    source: "import"
  };
}

function applyMutation(application: Application, change: ProposedMutation): Application {
  return {
    ...application,
    stage: change.stage ?? application.stage,
    contactName: change.contactName ?? application.contactName,
    deadlineAt: change.deadlineAt ?? application.deadlineAt,
    followUpAt: change.followUpAt ?? application.followUpAt,
    updatedAt: nowIso(),
    source: "import"
  };
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
    const application = findOrCreateApplication(next, record);
    const confidence = confidenceFor(record.text);
    const stage = toStage(record.text);
    const date = extractIsoDate(record.text);
    const normalizedText = record.text.toLowerCase();
    const proposedChange: ProposedMutation = {
      applicationId: application.id,
      company: application.company,
      role: application.role,
      stage,
      deadlineAt: /deadline|assessment|interview/.test(normalizedText) ? date : undefined,
      followUpAt: normalizedText.includes("follow") ? date : undefined,
      eventSummary: `Imported ${record.sourceLabel}: ${record.text.trim().slice(0, 140)}`
    };
    const needsReview = confidence < 0.78 || isRiskyMutation(proposedChange);
    const reviewId = stableId("review", [record.sourceLabel, record.text]);
    const evidence = createEvidence(record, application.id, needsReview ? reviewId : undefined);
    const applications = next.applications.some((item) => item.id === application.id)
      ? next.applications
      : [application, ...next.applications];

    if (needsReview) {
      const alreadyQueued = next.reviewItems.some((item) => item.id === reviewId);
      const review: ReviewItem = {
        id: reviewId,
        status: "open",
        reason:
          confidence < 0.78
            ? "Deterministic parser confidence is below the automatic mutation threshold."
            : "The proposed change affects stage, deadline, contact, offer, or rejection state.",
        sourceLabel: record.sourceLabel,
        confidence,
        proposedChange,
        evidenceSnippetIds: [evidence.id],
        traceSummary: "deterministic parser; review gate required",
        createdAt: now
      };

      next = {
        ...next,
        applications,
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

    const updated = applyMutation(application, proposedChange);
    const event: ApplicationEvent = {
      id: stableId("event", [record.sourceLabel, record.text]),
      applicationId: updated.id,
      type: "import_applied",
      summary: proposedChange.eventSummary,
      source: "import",
      confidence,
      createdAt: now
    };
    next = {
      ...next,
      applications: applications.map((item) => (item.id === updated.id ? updated : item)),
      events: next.events.some((item) => item.id === event.id) ? next.events : [event, ...next.events],
      evidenceSnippets: [evidence, ...next.evidenceSnippets.filter((item) => item.id !== evidence.id)]
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
    const application = findOrCreateApplication(next, record);
    const reviewId = stableId("review", [
      analysis.suggestion ? "model-suggestion" : "model-invalid",
      record.sourceLabel,
      record.text
    ]);
    const evidence = createEvidence(record, application.id, reviewId);
    const proposedChange: ProposedMutation = analysis.suggestion
      ? {
          applicationId: application.id,
          company: application.company,
          role: application.role,
          stage: analysis.suggestion.stage,
          contactName: analysis.suggestion.contactName,
          deadlineAt: analysis.suggestion.deadlineAt,
          followUpAt: analysis.suggestion.followUpAt,
          eventSummary: `Model suggested: ${analysis.suggestion.summary}`
        }
      : {
          applicationId: application.id,
          company: application.company,
          role: application.role,
          eventSummary: "Invalid model output was blocked before mutation."
        };
    const alreadyQueued = next.reviewItems.some((item) => item.id === reviewId);
    const review: ReviewItem = {
      id: reviewId,
      status: "open",
      reason: analysis.suggestion
        ? "Model-backed suggestion requires user review before mutating application state."
        : "Model output failed schema validation and was blocked before mutation.",
      sourceLabel: `model:${record.sourceLabel}`,
      confidence: analysis.suggestion?.confidence ?? 0,
      proposedChange,
      evidenceSnippetIds: [evidence.id],
      traceSummary: `ollama ${analysis.statusReport.modelTag}; ${analysis.diagnostic}`,
      createdAt: nowIso()
    };

    next = {
      ...next,
      applications: next.applications.some((item) => item.id === application.id)
        ? next.applications
        : [application, ...next.applications],
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

export function evaluateResumeText(state: CareerOSState, title: string, text: string): CareerOSState {
  const now = nowIso();
  const sections = ["experience", "project", "education", "skill"].filter((section) =>
    text.toLowerCase().includes(section)
  );
  const resume: ResumeDocument = {
    id: newId("resume"),
    workspaceUserId: state.workspaceUser.id,
    title: title.trim() || "Pasted resume",
    text: text.trim().slice(0, 6000),
    sections: sections.length ? sections.map((section) => section[0].toUpperCase() + section.slice(1)) : ["General"],
    createdAt: now
  };
  const hasEvidence = text.length > 120;
  const evaluation: ResumeEvaluation = {
    id: stableId("resume_eval", [resume.id]),
    resumeDocumentId: resume.id,
    summary: hasEvidence
      ? "Deterministic resume pass completed. Review bullets against the target role before applying changes."
      : "Resume text is short; add more evidence before trusting automated conclusions.",
    strengths: sections.length ? sections.map((section) => `${section} section detected`) : ["Readable resume text"],
    gaps: hasEvidence ? ["Add role-specific metrics", "Connect projects to business impact"] : ["More resume context needed"],
    status: hasEvidence ? "completed" : "blocked_by_review",
    confidence: hasEvidence ? 0.74 : 0.42,
    createdAt: now
  };

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
