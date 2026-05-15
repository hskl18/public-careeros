import type { CandidateContext, CareerOSState, MailboxThread } from "./types";
import { hashText, nowIso, stableId } from "./id";

const createdAt = "2026-05-08T12:00:00.000Z";

export function createSeedMailboxThreads(): MailboxThread[] {
  return [
    {
      id: "thread_atlas_oa",
      source: "seed",
      subject: "Atlas Robotics assessment next steps",
      companyHint: "Atlas Robotics",
      roleHint: "Product Engineer",
      createdAt,
      messages: [
        {
          id: "msg_atlas_oa_1",
          threadId: "thread_atlas_oa",
          fromLabel: "Atlas recruiting",
          subject: "Atlas Robotics assessment next steps",
          snippet:
            "Thanks for speaking with us. Your online assessment is due on 2026-05-14 and we can schedule the technical interview after completion.",
          receivedAt: "2026-05-08T09:15:00.000Z",
          sourceLabel: "seed-mailbox:atlas-oa"
        }
      ]
    },
    {
      id: "thread_northstar_follow_up",
      source: "seed",
      subject: "Northstar Labs application received",
      companyHint: "Northstar Labs",
      roleHint: "AI Platform Intern",
      createdAt,
      messages: [
        {
          id: "msg_northstar_1",
          threadId: "thread_northstar_follow_up",
          fromLabel: "Northstar recruiting",
          subject: "Northstar Labs application received",
          snippet:
            "We received your application for AI Platform Intern. If you do not hear back by 2026-05-13, feel free to follow up.",
          receivedAt: "2026-05-08T10:20:00.000Z",
          sourceLabel: "seed-mailbox:northstar-receipt"
        }
      ]
    }
  ];
}

export function createSeedCandidateContext(): CandidateContext {
  return {
    id: "candidate_context_local",
    targetRoles: ["Product Engineer", "AI Platform Intern", "Full Stack Engineer"],
    skills: ["TypeScript", "SQL", "private-workspace systems", "model review gates"],
    preferences: ["privacy-preserving workflow", "evidence-backed decisions", "internship and new-grad roles"],
    resumeKeywords: ["CareerOS", "resume intelligence", "notification derivation", "review-gated automation"],
    updatedAt: createdAt
  };
}

export function createEmptyCandidateContext(): CandidateContext {
  return {
    id: "candidate_context_local",
    targetRoles: [],
    skills: [],
    preferences: [],
    resumeKeywords: [],
    updatedAt: nowIso()
  };
}

export function createEmptyState(): CareerOSState {
  const createdAt = nowIso();

  return {
    workspaceUser: {
      id: "user_local_workspace",
      name: "Local Workspace",
      createdAt
    },
    mailboxThreads: [],
    candidateContext: createEmptyCandidateContext(),
    agentRuns: [],
    applications: [],
    events: [],
    evidenceSnippets: [],
    reviewItems: [],
    reminders: [],
    notifications: [],
    resumeDocuments: [],
    resumeEvaluations: [],
    modelRuntime: {
      provider: "ollama",
      enabled: process.env.CAREEROS_OLLAMA_ENABLED === "true",
      endpoint: process.env.CAREEROS_OLLAMA_BASE_URL ?? "https://ollama.com",
      modelTag: process.env.CAREEROS_GEMMA_MODEL ?? "gemma4:31b",
      updatedAt: createdAt
    },
    modelTraces: [],
    importJobs: [],
    connectorAccounts: [],
    auditEvents: []
  };
}

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
    mailboxThreads: createSeedMailboxThreads(),
    candidateContext: createSeedCandidateContext(),
    agentRuns: [
      {
        id: stableId("agent_run", ["seed", "mailbox_triage"]),
        agent: "mailbox_triage",
        status: "deterministic",
        inputRef: "thread_atlas_oa",
        confidence: 0.9,
        reason: "Seed mailbox thread classified with deterministic local rules.",
        createdAt
      },
      {
        id: stableId("agent_run", ["seed", "evidence_review"]),
        agent: "evidence_review",
        status: "review_blocked",
        inputRef: "review_deadline_conflict",
        outputRef: evidenceId,
        confidence: 0.54,
        reason: "Ambiguous deadline evidence is review-gated before application mutation.",
        createdAt
      }
    ],
    applications: [
      {
        id: atlasId,
        workspaceUserId: userId,
        company: "Atlas Robotics",
        role: "Product Engineer",
        stage: "interview",
        contactName: "Recruiting team",
        jobDescriptionUrl: "https://jobs.example.com/atlas/product-engineer-intern",
        resumeVersion: "resume-product-v3.pdf",
        coverLetterVersion: "atlas-cover-letter-v2.md",
        applicationSource: "LinkedIn",
        recruiterContactName: "Atlas recruiting",
        recruiterContactEmail: "recruiting@atlas.example",
        location: "San Francisco, CA",
        salaryRange: "$42/hr - $48/hr",
        notes: "Interview loop scheduled from mailbox evidence; deadline mutation is still review-gated.",
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
        contactName: "Northstar recruiting",
        jobDescriptionUrl: "https://jobs.example.com/northstar/ai-platform-intern",
        resumeVersion: "resume-ml-v4.pdf",
        coverLetterVersion: "northstar-cover-letter-v1.md",
        applicationSource: "Handshake",
        recruiterContactName: "Northstar recruiting",
        recruiterContactEmail: "talent@northstar.example",
        location: "Remote / Seattle, WA",
        salaryRange: "$38/hr - $45/hr",
        notes: "Follow-up reminder comes from local seed mailbox receipt, not a connected Gmail account.",
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
        sourceMessageIds: ["msg_atlas_oa_1"],
        sourceLabel: "seed:atlas-follow-up",
        snippet: "The message mentions an assessment due next week but gives two possible dates.",
        hash: hashText("atlas deadline conflict"),
        confidence: 0.54,
        reason: "Seed evidence is bounded to a short mailbox snippet and attached to a review-gated deadline proposal.",
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
        type: "follow_up",
        title: "Send interview follow-up",
        dueAt: "2026-05-11T16:00:00.000Z",
        status: "open",
        createdAt
      },
      {
        id: "reminder_northstar_follow_up",
        applicationId: northstarId,
        type: "follow_up",
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
        text: "Experience: built private-workspace dashboards and model review gates. Projects: CareerOS, resume intelligence, notification derivation. Skills: TypeScript, SQL.",
        sections: ["Experience", "Projects", "Skills"],
        createdAt
      }
    ],
    resumeEvaluations: [
      {
        id: "resume_eval_seed",
        resumeDocumentId: resumeId,
        summary: "Strong local product and pipeline language. Add quantified impact for the target role.",
        strengths: ["Local-first systems", "Review-gated automation", "Pipeline console product work"],
        gaps: ["Quantified outcomes", "Role-specific keywords"],
        status: "completed",
        confidence: 0.82,
        createdAt
      }
    ],
    modelRuntime: {
      provider: "ollama",
      enabled: false,
      endpoint: "https://ollama.com",
      modelTag: "gemma4:31b",
      updatedAt: createdAt
    },
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
    ],
    auditEvents: [
      {
        id: stableId("audit", ["seed", "workspace"]),
        action: "workspace.seeded",
        status: "succeeded",
        summary: "Sanitized local demo workspace was created.",
        actor: "system",
        sourceType: "local_data",
        metadata: {
          applications: 2,
          mailboxThreads: 2,
          reviewItems: 1
        },
        createdAt
      }
    ]
  };
}
