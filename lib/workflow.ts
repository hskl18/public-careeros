import { stableId, nowIso } from "./id";
import type {
  Application,
  ApplicationEvent,
  ApplicationStage,
  CareerOSState,
  LocalImportRecord,
  ProposedMutation,
  Reminder
} from "./types";

const unknownCompany = "Unknown Company";
const unknownRole = "Unknown Role";
const manualReviewClassificationThreshold = 0.75;
const manualReviewMatchingThreshold = 0.6;

const stageRank: Record<ApplicationStage, number> = {
  wishlist: 0,
  applied: 10,
  recruiter_reply: 20,
  assessment: 30,
  interview: 40,
  offer: 50,
  rejected: 60
};

export interface ApplicationMatchResult {
  application?: Application;
  applications: Application[];
  created: boolean;
  matchingConfidence: number;
  reviewReason?: string;
}

export interface ReviewDecision {
  requiresReview: boolean;
  reason?: string;
}

export function normalizeIdentity(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isUnknownCompany(company?: string) {
  return !company?.trim() || company.trim().toLowerCase() === unknownCompany.toLowerCase();
}

export function isUnknownRole(role?: string) {
  return !role?.trim() || role.trim().toLowerCase() === unknownRole.toLowerCase();
}

export function canCreateApplication(company?: string) {
  return !isUnknownCompany(company);
}

export function resolveStage(current: ApplicationStage, recommended?: ApplicationStage) {
  if (!recommended) return current;
  if (recommended === "offer" || recommended === "rejected") return recommended;
  return stageRank[recommended] >= stageRank[current] ? recommended : current;
}

export function resolveEventType(stage?: ApplicationStage) {
  switch (stage) {
    case "recruiter_reply":
      return "recruiter_outreach";
    case "assessment":
      return "oa_invitation";
    case "interview":
      return "interview_invitation";
    case "offer":
      return "offer";
    case "rejected":
      return "rejection";
    case "applied":
      return "application_received";
    default:
      return "generic_update";
  }
}

export function matchOrCreateApplication(
  state: CareerOSState,
  record: Pick<LocalImportRecord, "company" | "role"> & { applicationId?: string },
  recommendedStage: ApplicationStage | undefined,
  allowAutoCreate: boolean
): ApplicationMatchResult {
  if (record.applicationId) {
    const current = state.applications.find((application) => application.id === record.applicationId);
    if (current) {
      return { application: current, applications: state.applications, created: false, matchingConfidence: 1 };
    }
  }

  const company = normalizeIdentity(record.company);
  const role = normalizeIdentity(record.role);

  if (isUnknownCompany(company)) {
    return {
      applications: state.applications,
      created: false,
      matchingConfidence: 0.35,
      reviewReason: "Company could not be extracted confidently."
    };
  }

  const sameCompany = state.applications
    .filter((application) => application.company.trim().toLowerCase() === company.toLowerCase())
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const exact = sameCompany.find((application) => application.role.trim().toLowerCase() === role.toLowerCase());
  if (exact) {
    return { application: exact, applications: state.applications, created: false, matchingConfidence: 0.95 };
  }

  const unknownRoleMatches = sameCompany.filter((application) => isUnknownRole(application.role));
  if (!isUnknownRole(role) && unknownRoleMatches.length === 1) {
    const matched = { ...unknownRoleMatches[0], role, updatedAt: nowIso() };
    return {
      application: matched,
      applications: state.applications.map((application) => (application.id === matched.id ? matched : application)),
      created: false,
      matchingConfidence: 0.78,
      reviewReason: "Matched by company because the existing application was created before the role was known."
    };
  }

  if (sameCompany.length === 1) {
    return {
      application: sameCompany[0],
      applications: state.applications,
      created: false,
      matchingConfidence: 0.72,
      reviewReason: "Matched by company because only one application exists for this company."
    };
  }

  if (sameCompany.length > 1) {
    return {
      applications: state.applications,
      created: false,
      matchingConfidence: isUnknownRole(role) ? 0.48 : 0.35,
      reviewReason: isUnknownRole(role)
        ? "Multiple applications exist for this company, and the role was not extracted confidently."
        : "Multiple applications exist for this company, and no exact role match was found."
    };
  }

  if (!allowAutoCreate) {
    return {
      applications: state.applications,
      created: false,
      matchingConfidence: 0.35,
      reviewReason: "Could not confidently map this record to an existing application."
    };
  }

  const application: Application = {
    id: stableId("app", [company, role || unknownRole]),
    workspaceUserId: state.workspaceUser.id,
    company,
    role: role || unknownRole,
    stage: recommendedStage ?? "applied",
    updatedAt: nowIso(),
    source: "import"
  };

  if (state.applications.some((item) => item.id === application.id)) {
    return { application, applications: state.applications, created: false, matchingConfidence: 0.95 };
  }

  return {
    application,
    applications: [application, ...state.applications],
    created: true,
    matchingConfidence: 0.82
  };
}

export function buildReviewDecision(input: {
  classificationConfidence: number;
  matchingConfidence: number;
  eventType: string;
  company?: string;
  role?: string;
  matchReviewReason?: string;
  risky: boolean;
  modelBacked?: boolean;
  invalidModelOutput?: boolean;
}): ReviewDecision {
  const reasons: string[] = [];

  if (input.classificationConfidence < manualReviewClassificationThreshold) {
    reasons.push(`Low classification confidence (${input.classificationConfidence.toFixed(2)}).`);
  }

  if (input.matchingConfidence < manualReviewMatchingThreshold) {
    reasons.push(`Low application-match confidence (${input.matchingConfidence.toFixed(2)}).`);
  }

  if (input.eventType === "generic_update") {
    reasons.push("Record was classified as a generic update.");
  }

  if (isUnknownRole(input.role)) {
    reasons.push("Role could not be extracted confidently.");
  }

  if (isUnknownCompany(input.company)) {
    reasons.push("Company could not be extracted confidently.");
  }

  if (input.matchReviewReason && input.matchingConfidence < manualReviewMatchingThreshold) {
    reasons.push(input.matchReviewReason);
  }

  if (input.risky) {
    reasons.push("The proposed change affects deadline, contact, offer, rejection, or other high-impact state.");
  }

  if (input.modelBacked) {
    reasons.push("Model-backed suggestion requires user review before mutating application state.");
  }

  if (input.invalidModelOutput) {
    reasons.push("Model output failed schema validation and was blocked before mutation.");
  }

  return {
    requiresReview: reasons.length > 0,
    reason: reasons.join(" ")
  };
}

export function applyProposedMutation(
  application: Application,
  change: ProposedMutation,
  source: Application["source"]
): Application {
  return {
    ...application,
    company: normalizeIdentity(change.company ?? application.company),
    role: normalizeIdentity(change.role ?? application.role),
    stage: resolveStage(application.stage, change.stage),
    contactName: change.contactName ?? application.contactName,
    deadlineAt: change.deadlineAt ?? application.deadlineAt,
    followUpAt: change.followUpAt ?? application.followUpAt,
    updatedAt: nowIso(),
    source
  };
}

export function buildDecisionEvent(
  applicationId: string | undefined,
  idParts: string[],
  type: string,
  summary: string,
  source: ApplicationEvent["source"],
  confidence: number
): ApplicationEvent | undefined {
  if (!applicationId) return undefined;
  return {
    id: stableId("event", idParts),
    applicationId,
    type,
    summary,
    source,
    confidence,
    createdAt: nowIso()
  };
}

export function reminderTypeFor(change: ProposedMutation) {
  if (change.stage === "assessment") return "assessment_deadline";
  if (change.stage === "interview") return "interview_preparation";
  return "follow_up";
}

export function buildReminderTitle(application: Application, change: ProposedMutation) {
  switch (reminderTypeFor(change)) {
    case "assessment_deadline":
      return `Complete assessment for ${application.company}`;
    case "interview_preparation":
      return `Prepare for interview with ${application.company}`;
    default:
      return change.stage === "recruiter_reply"
        ? `Reply to recruiter at ${application.company}`
        : `Review next step for ${application.company}`;
  }
}

export function ensureReminder(reminders: Reminder[], application: Application, change: ProposedMutation): Reminder[] {
  const dueAt = change.deadlineAt ?? change.followUpAt;
  const needsReminder = Boolean(dueAt || change.stage === "recruiter_reply" || change.stage === "assessment" || change.stage === "interview");
  if (!needsReminder) return reminders;

  const type = reminderTypeFor(change);
  const existingOpen = reminders.some(
    (reminder) => reminder.applicationId === application.id && reminder.status === "open" && reminder.type === type
  );
  if (existingOpen) return reminders;

  const createdAt = nowIso();
  const reminder: Reminder = {
    id: stableId("reminder", [application.id, type, dueAt ?? createdAt]),
    applicationId: application.id,
    type,
    title: buildReminderTitle(application, change),
    dueAt: dueAt ?? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: "open",
    createdAt
  };

  return [reminder, ...reminders];
}
