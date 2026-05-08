import type { CareerOSState } from "./types";
import { hashText, nowIso, stableId } from "./id";

const createdAt = "2026-05-08T12:00:00.000Z";

export function createSeedState(): CareerOSState {
  const userId = "user_local_workspace";
  const atlasId = "app_atlas";
  const northstarId = "app_northstar";
  const reviewId = "review_deadline_conflict";
  const evidenceId = "ev_deadline_conflict";
  const resumeId = "resume_seed";

  return {
    workspaceUser: {
      id: userId,
      name: "Local Workspace",
      createdAt
    },
    applications: [
      {
        id: atlasId,
        workspaceUserId: userId,
        company: "Atlas Robotics",
        role: "Product Engineer",
        stage: "interview",
        contactName: "Recruiting team",
        deadlineAt: "2026-05-14T16:00:00.000Z",
        followUpAt: "2026-05-11T16:00:00.000Z",
        updatedAt: createdAt,
        source: "seed"
      },
      {
        id: northstarId,
        workspaceUserId: userId,
        company: "Northstar Labs",
        role: "AI Platform Intern",
        stage: "applied",
        followUpAt: "2026-05-13T16:00:00.000Z",
        updatedAt: createdAt,
        source: "seed"
      }
    ],
    events: [
      {
        id: "event_atlas_interview",
        applicationId: atlasId,
        type: "stage_changed",
        summary: "Interview loop scheduled from sanitized local seed evidence.",
        source: "seed",
        confidence: 0.95,
        createdAt
      },
      {
        id: "event_northstar_applied",
        applicationId: northstarId,
        type: "application_created",
        summary: "Application imported from local seed data.",
        source: "seed",
        confidence: 0.98,
        createdAt
      }
    ],
    evidenceSnippets: [
      {
        id: evidenceId,
        applicationId: atlasId,
        reviewItemId: reviewId,
        sourceLabel: "seed:atlas-follow-up",
        snippet: "The message mentions an assessment due next week but gives two possible dates.",
        hash: hashText("atlas deadline conflict"),
        confidence: 0.54,
        createdAt
      }
    ],
    reviewItems: [
      {
        id: reviewId,
        status: "open",
        reason: "Conflicting deadline wording needs user confirmation before mutating the application.",
        sourceLabel: "seed:atlas-follow-up",
        confidence: 0.54,
        proposedChange: {
          applicationId: atlasId,
          deadlineAt: "2026-05-15T16:00:00.000Z",
          eventSummary: "Possible assessment deadline detected, awaiting confirmation."
        },
        evidenceSnippetIds: [evidenceId],
        traceSummary: "deterministic fallback; low confidence; review required",
        createdAt
      }
    ],
    reminders: [
      {
        id: "reminder_atlas_follow_up",
        applicationId: atlasId,
        title: "Send interview follow-up",
        dueAt: "2026-05-11T16:00:00.000Z",
        status: "open",
        createdAt
      },
      {
        id: "reminder_northstar_follow_up",
        applicationId: northstarId,
        title: "Check for recruiter response",
        dueAt: "2026-05-13T16:00:00.000Z",
        status: "open",
        createdAt
      }
    ],
    notifications: [],
    resumeDocuments: [
      {
        id: resumeId,
        workspaceUserId: userId,
        title: "Seed resume text",
        text: "Experience: built local-first dashboards and model review gates. Projects: CareerOS, resume intelligence, notification derivation. Skills: TypeScript, C#, SQL.",
        sections: ["Experience", "Projects", "Skills"],
        createdAt
      }
    ],
    resumeEvaluations: [
      {
        id: "resume_eval_seed",
        resumeDocumentId: resumeId,
        summary: "Strong local product and pipeline language. Add quantified impact for the target role.",
        strengths: ["Local-first systems", "Review-gated automation", "Dashboard product work"],
        gaps: ["Quantified outcomes", "Role-specific keywords"],
        status: "completed",
        confidence: 0.82,
        createdAt
      }
    ],
    modelTraces: [
      {
        id: stableId("trace", ["seed", "deterministic"]),
        provider: "deterministic",
        status: "disabled",
        task: "seed-demo",
        confidence: 0.9,
        fallbackPath: "ollama-disabled",
        diagnostic: "Seed data uses deterministic trace metadata only.",
        createdAt
      }
    ],
    importJobs: [
      {
        id: "job_seed",
        source: "seed",
        status: "processed",
        attempts: 1,
        createdAt,
        processedAt: createdAt
      }
    ],
    connectorAccounts: [
      {
        id: "connector_gmail",
        provider: "gmail",
        status: "disabled",
        label: "Gmail connector optional",
        message: "Disabled by default. Local CareerOS works without Gmail.",
        updatedAt: nowIso()
      }
    ]
  };
}
