import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import {
  disconnectGmailPlaceholder,
  listConnectorAccounts,
  startGmailConnectPlaceholder,
  syncGmailPlaceholder
} from "@/lib/connectors";
import { agentOperatingContracts, getAgentOperatingContract } from "@/lib/agent-contracts";
import { deriveAgentPipelineSnapshot, runMailboxTriageAgent, runWorkflowExtractionAgent } from "@/lib/agent-pipeline";
import { deriveAnalyticsSummary } from "@/lib/analytics";
import { deriveEvidenceRelationshipViews } from "@/lib/evidence-queries";
import { exchangeGmailCode, hasGmailToken, syncGmailRecruitingMail } from "@/lib/gmail-local";
import { checkOllamaStatus } from "@/lib/model-status";
import { deriveNotifications } from "@/lib/notifications";
import {
  getProviderAdapter,
  listByokRoadmapAdapters,
  listImplementedAdapters,
  listLocalRoadmapAdapters,
  listProviderAdapters,
  listRoadmapAdapters
} from "@/lib/providers";
import { JsonFileStateRepository, MemoryStateRepository } from "@/lib/persistence";
import { evaluateResumeTextWithModel, processLocalImport, processLocalImportWithModel } from "@/lib/pipeline";
import { deriveApplicationTimeline, queryReminderHistory } from "@/lib/reminder-queries";
import { acceptReviewItem, correctReviewItem, dismissReviewItem, updateReminderStatus } from "@/lib/review";
import { queryReviewQueue } from "@/lib/review-queries";
import { createSeedState } from "@/lib/seed";
import { readState, resetState, setStateRepository, updateState } from "@/lib/store";
import type { CareerOSState } from "@/lib/types";
import { POST as postReminder } from "@/app/api/reminders/[id]/route";
import { POST as postImport } from "@/app/api/import/route";
import { GET as getReminders } from "@/app/api/reminders/route";
import { GET as getReviewQueue } from "@/app/api/review/route";
import { GET as getEvidence } from "@/app/api/evidence/route";
import { GET as getAnalytics } from "@/app/api/analytics/route";
import { GET as getModelStatus, POST as postModelStatus } from "@/app/api/model-status/route";
import { GET as getPipelineSnapshot } from "@/app/api/pipeline/route";
import { GET as getExport } from "@/app/api/local-data/export/route";
import { POST as postWorkspaceImport } from "@/app/api/local-data/import/route";
import { POST as postDeleteLocalData } from "@/app/api/local-data/delete/route";
import { GET as getConnectors } from "@/app/api/connectors/route";
import { POST as postGmailConnector } from "@/app/api/connectors/gmail/[action]/route";
import { GET as getDebugStateSnapshot } from "@/app/api/debug/state/route";
import { workspaceImportConfirmation } from "@/lib/workspace-import";

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function workspaceImportRequest(state: unknown, confirm = workspaceImportConfirmation) {
  return new Request("http://localhost/api/local-data/import", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ confirm, state })
  });
}

describe("local deterministic pipeline", () => {
  it("runs mailbox triage and workflow extraction agents on seeded sample threads", () => {
    const state = createSeedState();
    const thread = state.mailboxThreads[0];
    const triage = runMailboxTriageAgent(thread, state.candidateContext);
    const extraction = runWorkflowExtractionAgent(thread, triage);

    expect(triage.id).toBe("mailbox_triage");
    expect(triage.output.relevant).toBe(true);
    expect(triage.output.company).toBe("Atlas Robotics");
    expect(extraction.id).toBe("workflow_extraction");
    expect(extraction.output.stage).toBe("assessment");
    expect(extraction.output.deadlineAt).toBe("2026-05-14T16:00:00.000Z");
  });

  it("keeps noisy recruiting eval cases review-gated and stage-aware", () => {
    const cases = [
      {
        sourceLabel: "eval:gmail-oa-deadline",
        company: "Signal Works",
        role: "Product Engineer",
        text: "Subject: Online assessment reminder. Your Product Engineer OA is due 2026-05-20. Use the same resume version from your application.",
        reviewStage: "assessment"
      },
      {
        sourceLabel: "eval:gmail-interview",
        company: "Northstar AI",
        role: "ML Intern",
        text: "Recruiter reply: we would like to schedule an interview on 2026-05-21. Please send availability.",
        reviewStage: "interview"
      },
      {
        sourceLabel: "eval:gmail-offer",
        company: "Atlas Robotics",
        role: "Backend Engineer",
        text: "Good news, the team is preparing an offer. Reply with your preferred start date.",
        reviewStage: "offer"
      },
      {
        sourceLabel: "eval:gmail-rejection",
        company: "Helios Data",
        role: "Data Platform Intern",
        text: "Thank you for interviewing. We are not moving forward with your application.",
        reviewStage: "rejected"
      },
      {
        sourceLabel: "eval:gmail-ambiguous",
        company: "Unknown Company",
        role: "Candidate pipeline update",
        text: "Maybe this is for either the platform role or the product role. The sender says next steps but gives no company proof.",
        reviewStage: undefined
      }
    ];

    const state = processLocalImport(createSeedState(), cases);

    for (const item of cases) {
      const review = state.reviewItems.find((reviewItem) => reviewItem.sourceLabel === item.sourceLabel);
      expect(review, item.sourceLabel).toBeDefined();
      expect(review?.status).toBe("open");
      expect(review?.proposedChange.stage).toBe(item.reviewStage);
      expect(review?.traceSummary).toContain("review gate required");
    }
  });

  it("applies high-confidence local imports without Ollama", () => {
    const state = createSeedState();
    const next = processLocalImport(state, [
      {
        company: "Cedar Systems",
        role: "Full Stack Engineer",
        sourceLabel: "test:cedar",
        text: "Recruiter reply detected and follow-up is due on 2026-05-12."
      }
    ]);

    const application = next.applications.find((item) => item.company === "Cedar Systems");
    expect(application?.stage).toBe("recruiter_reply");
    expect(next.events.some((event) => event.applicationId === application?.id)).toBe(true);
    expect(next.agentRuns.some((run) => run.agent === "mailbox_triage" && run.inputRef === "test:cedar")).toBe(true);
    expect(next.agentRuns.some((run) => run.agent === "workflow_extraction" && run.inputRef === "test:cedar")).toBe(true);
  });

  it("preserves JD, resume, source, recruiter contact, salary, location, and notes from imports", () => {
    const state = createSeedState();
    const next = processLocalImport(state, [
      {
        company: "Signal Works",
        role: "Backend Engineer",
        sourceLabel: "test:rich-import",
        text: "Application reply from recruiter. Recruiter: Jamie Chen <jamie@signal.example>. Source: LinkedIn.",
        sourceMessageIds: ["msg_signal_reply_1"],
        jobDescriptionUrl: "https://jobs.example.com/signal/backend",
        resumeVersion: "resume-v3",
        coverLetterVersion: "cover-letter-v2",
        applicationSource: "LinkedIn",
        recruiterContactName: "Jamie Chen",
        recruiterContactEmail: "jamie@signal.example",
        location: "Remote US",
        salaryRange: "$120,000-$150,000",
        notes: "Prefers private-workspace backend experience."
      }
    ]);

    const application = next.applications.find((item) => item.company === "Signal Works");
    const evidence = next.evidenceSnippets.find((item) => item.sourceLabel === "test:rich-import");
    expect(application?.jobDescriptionUrl).toBe("https://jobs.example.com/signal/backend");
    expect(application?.resumeVersion).toBe("resume-v3");
    expect(application?.coverLetterVersion).toBe("cover-letter-v2");
    expect(application?.applicationSource).toBe("LinkedIn");
    expect(application?.recruiterContactName).toBe("Jamie Chen");
    expect(application?.recruiterContactEmail).toBe("jamie@signal.example");
    expect(application?.location).toBe("Remote US");
    expect(application?.salaryRange).toBe("$120,000-$150,000");
    expect(application?.notes).toBe("Prefers private-workspace backend experience.");
    expect(evidence?.sourceMessageIds).toEqual(["msg_signal_reply_1"]);
    expect(evidence?.sourceRelationships?.applicationId).toBe(application?.id);
    expect(evidence?.sourceRelationships?.resumeVersion).toBe("resume-v3");
  });

  it("preserves optional enrichment fields from form imports", async () => {
    const previousOllamaEnabled = process.env.CAREEROS_OLLAMA_ENABLED;
    process.env.CAREEROS_OLLAMA_ENABLED = "false";
    setStateRepository(new MemoryStateRepository(createSeedState()));

    try {
      const form = new URLSearchParams({
        company: "Form Signal",
        role: "Platform Engineer",
        sourceLabel: "form:rich-import",
        text: "Recruiter reply detected after application receipt for Platform Engineer.",
        jobDescriptionUrl: "https://jobs.example.com/form-signal/platform",
        resumeVersion: "resume-platform-v5",
        coverLetterVersion: "cover-letter-platform-v2",
        applicationSource: "Wellfound",
        recruiterContactName: "Alex Rivera",
        recruiterContactEmail: "alex@formsignal.example",
        location: "New York, NY",
        salaryRange: "$140,000-$170,000",
        notes: "Use infrastructure-heavy examples."
      });

      const response = await postImport(
        new Request("http://localhost/api/import", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: form
        })
      );
      const state = await readState();
      const application = state.applications.find((item) => item.company === "Form Signal");

      expect(response.status).toBe(303);
      expect(application?.jobDescriptionUrl).toBe("https://jobs.example.com/form-signal/platform");
      expect(application?.resumeVersion).toBe("resume-platform-v5");
      expect(application?.coverLetterVersion).toBe("cover-letter-platform-v2");
      expect(application?.applicationSource).toBe("Wellfound");
      expect(application?.recruiterContactName).toBe("Alex Rivera");
      expect(application?.recruiterContactEmail).toBe("alex@formsignal.example");
      expect(application?.location).toBe("New York, NY");
      expect(application?.salaryRange).toBe("$140,000-$170,000");
      expect(application?.notes).toBe("Use infrastructure-heavy examples.");
    } finally {
      restoreEnv("CAREEROS_OLLAMA_ENABLED", previousOllamaEnabled);
      setStateRepository(new MemoryStateRepository());
    }
  });

  it("routes ambiguous or risky changes through review before mutation", () => {
    const state = createSeedState();
    const before = state.applications.find((item) => item.company === "Atlas Robotics");
    const next = processLocalImport(state, [
      {
        company: "Atlas Robotics",
        role: "Product Engineer",
        sourceLabel: "test:ambiguous-deadline",
        text: "Assessment deadline might be 2026-05-15 or 2026-05-16. This is unclear."
      }
    ]);

    const after = next.applications.find((item) => item.company === "Atlas Robotics");
    expect(after?.deadlineAt).toBe(before?.deadlineAt);
    expect(next.reviewItems.some((item) => item.sourceLabel === "test:ambiguous-deadline" && item.status === "open")).toBe(true);
  });

  it("defers new application creation when the proposed mutation is review-gated", () => {
    const state = createSeedState();
    const next = processLocalImport(state, [
      {
        company: "Offerful Labs",
        role: "Backend Engineer",
        sourceLabel: "test:new-offer-review",
        text: "Recruiter says an offer may be coming, but the details are unclear."
      }
    ]);

    const review = next.reviewItems.find((item) => item.sourceLabel === "test:new-offer-review");
    expect(next.applications.some((item) => item.company === "Offerful Labs")).toBe(false);
    expect(review?.proposedChange.applicationId).toBeUndefined();
  });

  it("keeps distinct evidence when long records share the same clipped prefix", () => {
    const prefix = "Recruiter reply detected. ".repeat(20);
    const state = createSeedState();
    const next = processLocalImport(state, [
      {
        company: "Prefix Labs",
        role: "Backend Engineer",
        sourceLabel: "test:long-prefix",
        text: `${prefix}Tail A follow-up due on 2026-05-12.`
      },
      {
        company: "Prefix Labs",
        role: "Backend Engineer",
        sourceLabel: "test:long-prefix",
        text: `${prefix}Tail B follow-up due on 2026-05-13.`
      }
    ]);

    const evidence = next.evidenceSnippets.filter((item) => item.sourceLabel === "test:long-prefix");
    expect(evidence).toHaveLength(2);
    expect(new Set(evidence.map((item) => item.id)).size).toBe(2);
  });

  it("does not move an application backward on later lower-ranked recruiting signals", () => {
    const state = createSeedState();
    const next = processLocalImport(state, [
      {
        company: "Atlas Robotics",
        role: "Product Engineer",
        sourceLabel: "test:late-receipt",
        text: "Application submitted and receipt confirmed on 2026-05-12."
      }
    ]);

    const application = next.applications.find((item) => item.company === "Atlas Robotics");
    expect(application?.stage).toBe("interview");
    expect(next.events.some((event) => event.type === "application_received")).toBe(true);
  });

  it("suppresses stale follow-up reminders after the pipeline moves forward", () => {
    const state = createSeedState();
    const next = processLocalImport(state, [
      {
        company: "Northstar Labs",
        role: "AI Platform Intern",
        sourceLabel: "test:northstar-oa",
        text: "Application update: online assessment received for the AI Platform Intern role."
      }
    ]);

    const application = next.applications.find((item) => item.company === "Northstar Labs");
    const oldFollowUp = next.reminders.find((item) => item.id === "reminder_northstar_follow_up");
    const assessmentReminder = next.reminders.find(
      (item) => item.applicationId === application?.id && item.type === "assessment_deadline"
    );
    const notifications = deriveNotifications(next);

    expect(application?.stage).toBe("assessment");
    expect(oldFollowUp?.status).toBe("dismissed");
    expect(assessmentReminder?.status).toBe("open");
    expect(notifications.some((item) => item.sourceId === "reminder_northstar_follow_up")).toBe(false);
  });

  it("adds a deduped reminder when a safe recruiter reply is applied", () => {
    const state = createSeedState();
    const next = processLocalImport(state, [
      {
        company: "Cedar Systems",
        role: "Full Stack Engineer",
        sourceLabel: "test:cedar-reminder",
        text: "Recruiter reply detected and follow-up is due on 2026-05-12."
      }
    ]);

    const application = next.applications.find((item) => item.company === "Cedar Systems");
    const reminders = next.reminders.filter((item) => item.applicationId === application?.id && item.status === "open");
    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.type).toBe("follow_up");
  });
});

describe("review decisions", () => {
  it("accept is transactional and idempotent", () => {
    const state = createSeedState();
    const once = acceptReviewItem(state, "review_deadline_conflict");
    const twice = acceptReviewItem(once, "review_deadline_conflict");
    const application = twice.applications.find((item) => item.id === "app_atlas");

    expect(application?.deadlineAt).toBe("2026-05-15T16:00:00.000Z");
    expect(twice.reviewItems.find((item) => item.id === "review_deadline_conflict")?.status).toBe("accepted");
    expect(twice.events.length).toBe(once.events.length);
  });

  it("dismiss records the decision without mutating application state", () => {
    const state = createSeedState();
    const before = state.applications.find((item) => item.id === "app_atlas");
    const next = dismissReviewItem(state, "review_deadline_conflict");
    const after = next.applications.find((item) => item.id === "app_atlas");

    expect(after?.deadlineAt).toBe(before?.deadlineAt);
    expect(next.reviewItems.find((item) => item.id === "review_deadline_conflict")?.status).toBe("dismissed");
  });

  it("does not close an unresolved review when accept cannot resolve an application", () => {
    const state = processLocalImport(createSeedState(), [
      {
        company: "Unknown Company",
        role: "Unknown Role",
        sourceLabel: "test:accept-unresolved",
        text: "Interview scheduling note, but the company and role are unclear."
      }
    ]);
    const review = state.reviewItems.find((item) => item.sourceLabel === "test:accept-unresolved");
    const next = acceptReviewItem(state, review?.id ?? "");

    expect(next.reviewItems.find((item) => item.id === review?.id)?.status).toBe("open");
    expect(next.events.length).toBe(state.events.length);
  });

  it("correct can create a deferred application and reminder through the same workflow rules", () => {
    const state = processLocalImport(createSeedState(), [
      {
        company: "Unknown Company",
        role: "Unknown Role",
        sourceLabel: "test:unknown-company",
        text: "Interview scheduling note, but the company and role are unclear."
      }
    ]);
    const review = state.reviewItems.find((item) => item.sourceLabel === "test:unknown-company");
    expect(review?.proposedChange.applicationId).toBeUndefined();

    const next = correctReviewItem(state, review?.id ?? "", {
      company: "Clearview Labs",
      role: "Backend Engineer",
      stage: "interview",
      deadlineAt: "2026-05-20T16:00:00.000Z",
      eventSummary: "User identified the company, role, and interview deadline."
    });

    const application = next.applications.find((item) => item.company === "Clearview Labs");
    expect(application?.stage).toBe("interview");
    expect(next.reminders.some((item) => item.applicationId === application?.id && item.type === "interview_preparation")).toBe(true);
    expect(next.reviewItems.find((item) => item.id === review?.id)?.status).toBe("corrected");
  });

  it("updates reminder lifecycle idempotently and writes an event", () => {
    const state = createSeedState();
    const once = updateReminderStatus(state, "reminder_atlas_follow_up", "done");
    const twice = updateReminderStatus(once, "reminder_atlas_follow_up", "dismissed");

    expect(twice.reminders.find((item) => item.id === "reminder_atlas_follow_up")?.status).toBe("done");
    expect(twice.events.filter((event) => event.type === "reminder_completed")).toHaveLength(1);
  });

  it("filters and sorts review queue by status, confidence, source, provider, and company", async () => {
    let generateCalls = 0;
    const state = await processLocalImportWithModel(
      createSeedState(),
      [
        {
          company: "Atlas Robotics",
          role: "Product Engineer",
          sourceLabel: "test:review-query-model",
          text: "The recruiter says there may be an offer soon."
        }
      ],
      {
        enabled: true,
        apiKey: "test-key",
        modelTag: "gemma4:e4b",
        fetchFn: async (input) => {
          if (String(input).endsWith("/api/tags")) return Response.json({ models: [{ name: "gemma4:e4b" }] });
          generateCalls += 1;
          if (generateCalls === 1) return Response.json({ response: "{\"ok\":true}" });
          return Response.json({
            response:
              "{\"confidence\":0.91,\"summary\":\"Offer signal.\",\"reason\":\"Recruiter language suggests offer intent.\",\"stage\":\"offer\",\"deadlineAt\":null,\"followUpAt\":null,\"contactName\":null}"
          });
        }
      }
    );

    const modelReviews = queryReviewQueue(state, {
      status: "open",
      minConfidence: 0.9,
      source: "model",
      provider: "model",
      company: "Atlas",
      sort: "confidence_high"
    });
    const deterministicReviews = queryReviewQueue(state, { status: "all", provider: "deterministic", sort: "oldest" });

    expect(modelReviews.total).toBeGreaterThan(0);
    expect(modelReviews.items.every((item) => item.modelBacked)).toBe(true);
    expect(modelReviews.items[0]?.review.confidence).toBeGreaterThanOrEqual(0.9);
    expect(deterministicReviews.items.every((item) => !item.modelBacked)).toBe(true);

    setStateRepository(new MemoryStateRepository(state));
    const response = await getReviewQueue(new Request("http://localhost/api/review?status=open&provider=model&company=Atlas&sort=confidence_high"));
    const body = await response.json();
    expect(body.items[0].modelBacked).toBe(true);
  });
});

describe("analytics summary", () => {
  it("derives local product metrics from application stages and events", () => {
    const state = processLocalImport(createSeedState(), [
      {
        company: "Cedar Systems",
        role: "Full Stack Engineer",
        sourceLabel: "test:analytics-reply",
        text: "Recruiter reply detected and follow-up is due on 2026-05-12."
      }
    ]);

    const analytics = deriveAnalyticsSummary(state);
    expect(analytics.metrics.applicationsCount).toBe(state.applications.length);
    expect(analytics.metrics.uniqueCompanies).toBeGreaterThanOrEqual(3);
    expect(analytics.metrics.replyRate).toBeGreaterThan(0);
    expect(analytics.metrics.followUpLoad).toBeGreaterThan(0);
    expect(analytics.metrics.reviewBlockedCount).toBeGreaterThan(0);
    expect(analytics.companyBreakdown.some((item) => item.label === "Cedar Systems")).toBe(true);
    expect(analytics.trends.length).toBeGreaterThan(0);
  });

  it("derives reply, interview, offer rates and status buckets from local events", () => {
    const base = createSeedState();
    const state: CareerOSState = {
      ...base,
      applications: [
        {
          id: "app_applied",
          workspaceUserId: base.workspaceUser.id,
          company: "Applied Co",
          role: "Backend Engineer",
          stage: "applied",
          updatedAt: "2026-05-08T12:00:00.000Z",
          source: "seed"
        },
        {
          id: "app_waiting",
          workspaceUserId: base.workspaceUser.id,
          company: "Waiting Co",
          role: "Backend Engineer",
          stage: "recruiter_reply",
          updatedAt: "2026-05-08T12:00:00.000Z",
          source: "seed"
        },
        {
          id: "app_interview",
          workspaceUserId: base.workspaceUser.id,
          company: "Interview Co",
          role: "Backend Engineer",
          stage: "interview",
          updatedAt: "2026-05-08T12:00:00.000Z",
          source: "seed"
        },
        {
          id: "app_offer",
          workspaceUserId: base.workspaceUser.id,
          company: "Offer Co",
          role: "Backend Engineer",
          stage: "offer",
          updatedAt: "2026-05-08T12:00:00.000Z",
          source: "seed"
        }
      ],
      events: [
        {
          id: "event_applied",
          applicationId: "app_applied",
          type: "application_created",
          summary: "Applied.",
          source: "seed",
          confidence: 1,
          createdAt: "2026-05-08T12:00:00.000Z"
        },
        {
          id: "event_interview",
          applicationId: "app_interview",
          type: "interview_invitation",
          summary: "Interview.",
          source: "seed",
          confidence: 1,
          createdAt: "2026-05-08T12:00:00.000Z"
        },
        {
          id: "event_offer",
          applicationId: "app_offer",
          type: "offer",
          summary: "Offer.",
          source: "seed",
          confidence: 1,
          createdAt: "2026-05-08T12:00:00.000Z"
        }
      ],
      reminders: [
        {
          id: "reminder_waiting",
          applicationId: "app_waiting",
          type: "follow_up",
          title: "Follow up",
          dueAt: "2026-05-11T16:00:00.000Z",
          status: "open",
          createdAt: "2026-05-08T12:00:00.000Z"
        }
      ],
      reviewItems: []
    };

    const analytics = deriveAnalyticsSummary(state);
    expect(analytics.metrics.replyRate).toBe(75);
    expect(analytics.metrics.interviewRate).toBe(50);
    expect(analytics.metrics.offerRate).toBe(25);
    expect(analytics.metrics.followUpLoad).toBe(1);
    expect(analytics.statusBuckets.find((item) => item.bucket === "waiting")?.count).toBe(1);
    expect(analytics.statusBuckets.find((item) => item.bucket === "interview")?.count).toBe(1);
    expect(analytics.statusBuckets.find((item) => item.bucket === "offer")?.count).toBe(1);
  });

  it("derives deterministic weekly trends and reminder history counts from local events", async () => {
    const base = updateReminderStatus(createSeedState(), "reminder_atlas_follow_up", "done");
    const state = processLocalImport(base, [
      {
        company: "Trend Systems",
        role: "Platform Engineer",
        sourceLabel: "test:trend-reply",
        text: "Recruiter reply detected after application receipt."
      }
    ]);

    const analytics = deriveAnalyticsSummary(state);
    const currentWeek = analytics.trends.find((bucket) => bucket.periodStart === "2026-05-04T00:00:00.000Z");

    expect(analytics.metrics.completedReminderCount).toBe(1);
    expect(analytics.metrics.replyRate).toBeGreaterThan(0);
    expect(currentWeek?.applicationsCreated).toBeGreaterThan(0);
    expect(currentWeek?.replies).toBeGreaterThan(0);

    setStateRepository(new MemoryStateRepository(state));
    const response = await getAnalytics();
    const body = await response.json();
    expect(body.trends.length).toBeGreaterThan(0);
    expect(body.metrics.completedReminderCount).toBe(1);
  });

  it("does not count pure application-created events as weekly replies", () => {
    const base = createSeedState();
    const state: CareerOSState = {
      ...base,
      applications: [
        {
          id: "app_created_only",
          workspaceUserId: base.workspaceUser.id,
          company: "Created Only Co",
          role: "Backend Engineer",
          stage: "applied",
          updatedAt: "2026-05-08T12:00:00.000Z",
          source: "seed"
        }
      ],
      events: [
        {
          id: "event_created_only",
          applicationId: "app_created_only",
          type: "application_created",
          summary: "Application created from local import.",
          source: "seed",
          confidence: 1,
          createdAt: "2026-05-08T12:00:00.000Z"
        }
      ],
      reminders: [],
      reviewItems: []
    };

    const analytics = deriveAnalyticsSummary(state);
    const week = analytics.trends.find((bucket) => bucket.periodStart === "2026-05-04T00:00:00.000Z");

    expect(analytics.metrics.replyRate).toBe(0);
    expect(week?.applicationsCreated).toBe(1);
    expect(week?.replies).toBe(0);
  });
});

describe("notifications", () => {
  it("derives stable deduped notifications from state", () => {
    const state = createSeedState();
    const first = deriveNotifications(state);
    const second = deriveNotifications({ ...state, notifications: first });

    expect(first.length).toBeGreaterThan(0);
    expect(new Set(second.map((item) => item.dedupeKey)).size).toBe(second.length);
    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id));
  });

  it("derives recruiter reply, deadline, follow-up, review, model, and connector health notifications", () => {
    const state: CareerOSState = {
      ...createSeedState(),
      applications: createSeedState().applications.map((application, index) =>
        index === 0 ? { ...application, stage: "recruiter_reply" } : application
      ),
      connectorAccounts: [
        {
          id: "connector_gmail",
          provider: "gmail",
          status: "needs_attention",
          label: "Gmail connector optional",
          updatedAt: new Date().toISOString()
        }
      ],
      modelTraces: [
        {
          id: "trace_model_missing",
          provider: "ollama",
          modelTag: "gemma4:e4b",
          status: "model_missing",
          task: "model-provider-status",
          diagnostic: "Selected model missing.",
          createdAt: new Date().toISOString()
        }
      ]
    };

    const notifications = deriveNotifications(state);
    expect(notifications.some((item) => item.title === "Recruiter reply detected")).toBe(true);
    expect(notifications.some((item) => item.title === "Deadline approaching")).toBe(true);
    expect(notifications.some((item) => item.title === "Follow-up reminder due")).toBe(true);
    expect(notifications.some((item) => item.title === "Review item blocking automation")).toBe(true);
    expect(notifications.some((item) => item.title === "Model setup needs attention")).toBe(true);
    expect(notifications.some((item) => item.title === "Gmail connector needs attention")).toBe(true);
  });

  it("uses the latest model trace when deriving model setup notifications", () => {
    const state: CareerOSState = {
      ...createSeedState(),
      modelTraces: [
        {
          id: "trace_ready",
          provider: "ollama",
          modelTag: "gemma4:e4b",
          status: "ready",
          task: "model-provider-status",
          diagnostic: "Ready now.",
          createdAt: "2026-05-08T12:10:00.000Z"
        },
        {
          id: "trace_missing",
          provider: "ollama",
          modelTag: "gemma4:e4b",
          status: "model_missing",
          task: "model-provider-status",
          diagnostic: "Missing earlier.",
          createdAt: "2026-05-08T12:00:00.000Z"
        }
      ]
    };

    const notifications = deriveNotifications(state);
    expect(notifications.some((item) => item.title === "Model setup needs attention")).toBe(false);
  });
});

describe("reminder API", () => {
  it("rejects unsupported reminder statuses", async () => {
    setStateRepository(new MemoryStateRepository(createSeedState()));
    const response = await postReminder(
      new Request("http://localhost/api/reminders/reminder_atlas_follow_up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "don" })
      }),
      { params: Promise.resolve({ id: "reminder_atlas_follow_up" }) }
    );
    const state = await readState();

    expect(response.status).toBe(400);
    expect(state.reminders.find((item) => item.id === "reminder_atlas_follow_up")?.status).toBe("open");
  });

  it("preserves completed and dismissed reminder history and exposes application timeline", async () => {
    const done = updateReminderStatus(createSeedState(), "reminder_atlas_follow_up", "done");
    const state = updateReminderStatus(done, "reminder_northstar_follow_up", "dismissed");
    const history = queryReminderHistory(state);
    const timeline = deriveApplicationTimeline(state, "app_atlas");

    expect(history.map((item) => item.reminder.status).sort()).toEqual(["dismissed", "done"]);
    expect(history.find((item) => item.reminder.id === "reminder_atlas_follow_up")?.decisionEvent?.type).toBe("reminder_completed");
    expect(timeline.some((item) => item.type === "reminder" && item.status === "done")).toBe(true);

    setStateRepository(new MemoryStateRepository(state));
    const response = await getReminders(new Request("http://localhost/api/reminders?applicationId=app_atlas"));
    const body = await response.json();
    expect(body.history[0].reminder.status).toBe("done");
    expect(body.timeline.some((item: { type: string; status?: string }) => item.type === "reminder" && item.status === "done")).toBe(true);
  });
});

describe("model status", () => {
  it("reports disabled mode without touching the network", async () => {
    const previous = process.env.CAREEROS_OLLAMA_ENABLED;
    process.env.CAREEROS_OLLAMA_ENABLED = "false";
    const report = await checkOllamaStatus();
    restoreEnv("CAREEROS_OLLAMA_ENABLED", previous);

    expect(report.status).toBe("disabled");
    expect(report.diagnostic).toContain("Deterministic");
    expect(report.diagnostic).toContain("Next step");
  });

  it("saves model setup without touching the network", async () => {
    setStateRepository(new MemoryStateRepository(createSeedState()));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("network should not be touched for save");
    }) as typeof fetch;

    try {
      const response = await postModelStatus(
        new Request("http://localhost/api/model-status", {
          method: "POST",
          body: new URLSearchParams({
            intent: "save",
            enabled: "on",
            endpoint: "https://ollama.com",
            modelTag: "gemma4:e4b"
          })
        })
      );
      const state = await readState();

      expect(response.status).toBe(303);
      expect(state.modelRuntime.enabled).toBe(true);
      expect(state.modelRuntime.modelTag).toBe("gemma4:e4b");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses saved Ollama Cloud model settings for the pipeline snapshot API", async () => {
    const seed = createSeedState();
    seed.modelRuntime = {
      provider: "ollama",
      enabled: false,
      endpoint: "https://ollama.com",
      modelTag: "gemma4:e4b-custom",
      updatedAt: "2026-05-10T00:00:00.000Z"
    };
    setStateRepository(new MemoryStateRepository(seed));

    const response = await getPipelineSnapshot();
    const body = await response.json();

    expect(body.modelRouter.selectedModel).toBe("gemma4:e4b-custom");
    expect(body.modelRouter.apiBaseUrl).toBe("https://ollama.com/api");
  });

  it("blocks non-Ollama Cloud model endpoints without touching the network", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("network should not be touched for blocked endpoints");
    }) as typeof fetch;

    try {
      const report = await checkOllamaStatus({
        enabled: true,
        endpoint: "https://example.com/ollama",
        modelTag: "gemma4:e4b"
      });
      const response = await postModelStatus(
        new Request("http://localhost/api/model-status", {
          method: "POST",
          body: new URLSearchParams({
            intent: "check",
            enabled: "on",
            endpoint: "https://example.com/ollama",
            modelTag: "gemma4:e4b"
          })
        })
      );

      expect(report.status).toBe("health_check_failed");
      expect(report.diagnostic).toContain("only connects to Ollama Cloud");
      expect(response.status).toBe(400);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("checks model setup through the API and stores a bounded trace", async () => {
    setStateRepository(new MemoryStateRepository(createSeedState()));
    const originalFetch = globalThis.fetch;
    const previousApiKey = process.env.OLLAMA_API_KEY;
    process.env.OLLAMA_API_KEY = "test-key";
    const calls: string[] = [];
    globalThis.fetch = (async (input, init) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      if (String(input).endsWith("/api/tags")) {
        return Response.json({ models: [{ name: "gemma4:e4b" }] });
      }
      return Response.json({ response: "{\"ok\":true}" });
    }) as typeof fetch;

    try {
      const response = await postModelStatus(
        new Request("http://localhost/api/model-status", {
          method: "POST",
          body: new URLSearchParams({
            intent: "check",
            enabled: "on",
            endpoint: "https://ollama.com",
            modelTag: "gemma4:e4b"
          })
        })
      );
      const state = await readState();

      expect(response.status).toBe(303);
      expect(calls).toEqual(["GET https://ollama.com/api/tags", "POST https://ollama.com/api/generate"]);
      expect(state.modelTraces[0]?.status).toBe("ready");
      expect(state.modelTraces[0]?.diagnostic).toContain("Next step");
    } finally {
      globalThis.fetch = originalFetch;
      restoreEnv("OLLAMA_API_KEY", previousApiKey);
    }
  });

  it("reports unavailable when the enabled Ollama endpoint cannot be reached", async () => {
    const report = await checkOllamaStatus({
      enabled: true,
      apiKey: "test-key",
      modelTag: "gemma4:e4b",
      fetchFn: async () => {
        throw new Error("offline");
      }
    });

    expect(report.status).toBe("unavailable");
    expect(report.diagnostic).toContain("not reachable");
    expect(report.diagnostic).toContain("Next step");
  });

  it("reports selected model missing before model-backed analysis", async () => {
    const report = await checkOllamaStatus({
      enabled: true,
      apiKey: "test-key",
      modelTag: "gemma4:e4b",
      fetchFn: async () => Response.json({ models: [{ name: "other-model:latest" }] })
    });

    expect(report.status).toBe("model_missing");
    expect(report.diagnostic).toContain("not listed");
    expect(report.diagnostic).toContain("Next step");
  });

  it("runs a bounded health prompt before ready status", async () => {
    const calls: string[] = [];
    const report = await checkOllamaStatus({
      enabled: true,
      apiKey: "test-key",
      modelTag: "gemma4:e4b",
      fetchFn: async (input, init) => {
        calls.push(`${init?.method ?? "GET"} ${String(input)}`);
        if (String(input).endsWith("/api/tags")) {
          return Response.json({ models: [{ name: "gemma4:e4b" }] });
        }
        return Response.json({ response: "{\"ok\":true}" });
      }
    });

    expect(report.status).toBe("ready");
    expect(report.diagnostic).toContain("Next step");
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("/api/generate");
  });
});

describe("model-backed import analysis", () => {
  it("queues valid model suggestions for review without mutating application state", async () => {
    const state = createSeedState();
    let generateCalls = 0;
    const next = await processLocalImportWithModel(
      state,
      [
        {
          company: "Atlas Robotics",
          role: "Product Engineer",
          sourceLabel: "test:model-offer",
          text: "The recruiter says there may be an offer soon."
        }
      ],
      {
        enabled: true,
        apiKey: "test-key",
        modelTag: "gemma4:e4b",
        fetchFn: async (input) => {
          if (String(input).endsWith("/api/tags")) {
            return Response.json({ models: [{ name: "gemma4:e4b" }] });
          }
          if (String(input).endsWith("/api/generate")) {
            generateCalls += 1;
            if (generateCalls === 1) {
              return Response.json({ response: "{\"ok\":true}" });
            }
            return Response.json({
              response:
                "{\"confidence\":0.93,\"summary\":\"Possible offer signal detected.\",\"reason\":\"Recruiter language suggests offer intent.\",\"stage\":\"offer\",\"deadlineAt\":null,\"followUpAt\":null,\"contactName\":null}"
            });
          }
          return Response.json({}, { status: 404 });
        }
      }
    );

    const application = next.applications.find((item) => item.company === "Atlas Robotics");
    expect(application?.stage).toBe("interview");
    expect(next.reviewItems.some((item) => item.sourceLabel === "model:test:model-offer" && item.status === "open")).toBe(true);
    expect(next.agentRuns.some((run) => run.agent === "model_router" && run.status === "model_ready")).toBe(true);
  });

  it("turns invalid model output into a review item instead of crashing or mutating", async () => {
    let generateCalls = 0;
    const next = await processLocalImportWithModel(
      createSeedState(),
      [
        {
          company: "Maple AI",
          role: "ML Engineer",
          sourceLabel: "test:invalid-model",
          text: "Interview update from recruiter."
        }
      ],
      {
        enabled: true,
        apiKey: "test-key",
        modelTag: "gemma4:e4b",
        fetchFn: async (input) => {
          if (String(input).endsWith("/api/tags")) {
            return Response.json({ models: [{ name: "gemma4:e4b" }] });
          }
          if (String(input).endsWith("/api/generate")) {
            generateCalls += 1;
            if (generateCalls === 1) {
              return Response.json({ response: "{\"ok\":true}" });
            }
            return Response.json({ response: "not-json" });
          }
          return Response.json({}, { status: 404 });
        }
      }
    );

    expect(next.reviewItems.some((item) => item.reason.includes("schema validation"))).toBe(true);
    expect(next.modelTraces.some((item) => item.diagnostic.includes("Invalid model output"))).toBe(true);
  });
});

describe("model-backed resume analysis", () => {
  const resumeText =
    "Experience: Built private-workspace TypeScript systems with JSON persistence and review workflows. Projects: CareerOS mailbox pipeline. Education: Computer Science. Skills: TypeScript, React, SQL, model review gates.";

  it("uses deterministic resume analysis when the model is disabled without touching the network", async () => {
    const next = await evaluateResumeTextWithModel(createSeedState(), "resume-v1", resumeText, {
      enabled: false,
      fetchFn: async () => {
        throw new Error("network should not be touched");
      }
    });

    expect(next.resumeEvaluations[0]?.source).toBe("deterministic");
    expect(next.resumeEvaluations[0]?.status).toBe("completed");
    expect(next.modelTraces[0]?.task).toBe("model-provider-status");
    expect(next.modelTraces[0]?.status).toBe("disabled");
  });

  it("falls back deterministically when Ollama Cloud is unavailable", async () => {
    const next = await evaluateResumeTextWithModel(createSeedState(), "resume-v1", resumeText, {
      enabled: true,
      apiKey: "test-key",
      modelTag: "gemma4:e4b",
      fetchFn: async () => {
        throw new Error("offline");
      }
    });

    expect(next.resumeEvaluations[0]?.source).toBe("deterministic");
    expect(next.resumeEvaluations[0]?.status).toBe("completed");
    expect(next.modelTraces[0]?.status).toBe("unavailable");
    expect(next.modelTraces[1]?.diagnostic).toContain("deterministic fallback");
  });

  it("stores valid Gemma resume JSON as model-backed analysis after readiness checks", async () => {
    let generateCalls = 0;
    const next = await evaluateResumeTextWithModel(createSeedState(), "resume-v2", resumeText, {
      enabled: true,
      apiKey: "test-key",
      modelTag: "gemma4:e4b",
      fetchFn: async (input) => {
        if (String(input).endsWith("/api/tags")) {
          return Response.json({ models: [{ name: "gemma4:e4b" }] });
        }
        generateCalls += 1;
        if (generateCalls === 1) {
          return Response.json({ response: "{\"ok\":true}" });
        }
        return Response.json({
          response:
            "RAW_PREAMBLE_NOT_STORED {\"confidence\":0.88,\"summary\":\"Strong private-workspace backend profile with credible pipeline experience.\",\"strengths\":[\"TypeScript systems\",\"JSON persistence\",\"Review workflow experience\"],\"gaps\":[\"Add quantified impact\",\"Name target role keywords\"],\"sections\":[\"Experience\",\"Projects\",\"Education\",\"Skills\"],\"reason\":\"Resume has relevant evidence for backend and privacy-first roles.\",\"riskLevel\":\"low\"}"
        });
      }
    });

    const evaluation = next.resumeEvaluations[0];
    expect(evaluation?.source).toBe("ollama");
    expect(evaluation?.modelTag).toBe("gemma4:e4b");
    expect(evaluation?.status).toBe("completed");
    expect(evaluation?.confidence).toBe(0.88);
    expect(next.resumeDocuments[0]?.sections).toEqual(["Experience", "Projects", "Education", "Skills"]);
    expect(next.modelTraces[0]?.task).toBe("resume-analysis");
    expect(next.modelTraces[0]?.fallbackPath).toBe("model-backed");
    expect(JSON.stringify(next)).not.toContain("RAW_PREAMBLE_NOT_STORED");
    expect(JSON.stringify(next)).not.toContain("Return only a JSON object");
  });

  it("blocks invalid resume model output and keeps deterministic fallback visible", async () => {
    let generateCalls = 0;
    const next = await evaluateResumeTextWithModel(createSeedState(), "resume-v3", resumeText, {
      enabled: true,
      apiKey: "test-key",
      modelTag: "gemma4:e4b",
      fetchFn: async (input) => {
        if (String(input).endsWith("/api/tags")) {
          return Response.json({ models: [{ name: "gemma4:e4b" }] });
        }
        generateCalls += 1;
        if (generateCalls === 1) {
          return Response.json({ response: "{\"ok\":true}" });
        }
        return Response.json({ response: "not-json RAW_RESPONSE_SHOULD_NOT_STORE" });
      }
    });

    expect(next.resumeEvaluations[0]?.source).toBe("ollama");
    expect(next.resumeEvaluations[0]?.status).toBe("blocked_by_review");
    expect(next.resumeEvaluations[1]?.source).toBe("deterministic");
    expect(next.modelTraces[0]?.fallbackPath).toBe("deterministic");
    expect(next.modelTraces[0]?.diagnostic).toContain("schema validation");
    expect(JSON.stringify(next)).not.toContain("RAW_RESPONSE_SHOULD_NOT_STORE");
  });

  it("blocks low-confidence resume model output instead of replacing deterministic fallback", async () => {
    let generateCalls = 0;
    const next = await evaluateResumeTextWithModel(createSeedState(), "resume-v4", resumeText, {
      enabled: true,
      apiKey: "test-key",
      modelTag: "gemma4:e4b",
      fetchFn: async (input) => {
        if (String(input).endsWith("/api/tags")) {
          return Response.json({ models: [{ name: "gemma4:e4b" }] });
        }
        generateCalls += 1;
        if (generateCalls === 1) {
          return Response.json({ response: "{\"ok\":true}" });
        }
        return Response.json({
          response:
            "{\"confidence\":0.52,\"summary\":\"Some relevant backend evidence, but not enough confidence.\",\"strengths\":[\"Backend keywords\"],\"gaps\":[\"Needs quantified impact\"],\"sections\":[\"Experience\",\"Skills\"],\"reason\":\"Model confidence is below the CareerOS threshold.\",\"riskLevel\":\"medium\"}"
        });
      }
    });

    expect(next.resumeEvaluations[0]?.source).toBe("ollama");
    expect(next.resumeEvaluations[0]?.status).toBe("blocked_by_review");
    expect(next.resumeEvaluations[1]?.source).toBe("deterministic");
    expect(next.modelTraces[0]?.fallbackPath).toBe("deterministic");
    expect(next.modelTraces[0]?.confidence).toBe(0.52);
  });
});

describe("evidence relationship queries", () => {
  it("groups bounded evidence by thread, application, company, role, recruiter, source label, and resume version", async () => {
    const state = processLocalImport(createSeedState(), [
      {
        company: "Signal Works",
        role: "Backend Engineer",
        sourceLabel: "test:evidence-relationships",
        text: "Recruiter reply detected after application receipt. Recruiter: Jamie Chen <jamie@signal.example>. Source: LinkedIn.",
        sourceMessageIds: ["msg_atlas_oa_1"],
        resumeVersion: "resume-v3",
        recruiterContactName: "Jamie Chen",
        recruiterContactEmail: "jamie@signal.example"
      }
    ]);

    const views = deriveEvidenceRelationshipViews(state);
    expect(views.byThread.some((group) => group.key === "thread_atlas_oa")).toBe(true);
    expect(views.byApplication.some((group) => group.label.includes("Signal Works"))).toBe(true);
    expect(views.byCompany.some((group) => group.key === "signal works")).toBe(true);
    expect(views.byRole.some((group) => group.key === "backend engineer")).toBe(true);
    expect(views.byRecruiter.some((group) => group.label === "Jamie Chen <jamie@signal.example>")).toBe(true);
    expect(views.bySourceLabel.some((group) => group.key === "test:evidence-relationships")).toBe(true);
    expect(views.byResumeVersion.some((group) => group.key === "resume-v3")).toBe(true);
    expect(JSON.stringify(views)).not.toContain("OAuth");

    setStateRepository(new MemoryStateRepository(state));
    const response = await getEvidence();
    const body = await response.json();
    expect(body.byThread.some((group: { key: string }) => group.key === "thread_atlas_oa")).toBe(true);
  });
});

describe("judge pipeline API snapshot", () => {
  it("exposes pipeline stages, sample thread, evidence, review gate, notifications, and provider roadmap", async () => {
    const state = createSeedState();
    const snapshot = deriveAgentPipelineSnapshot(state, {
      status: "disabled",
      endpoint: "https://ollama.com",
      modelTag: "gemma4:e4b",
      installedModels: [],
      diagnostic: "Ollama disabled."
    });

    expect(snapshot.thesis).toContain("multi-agent job mailbox pipeline");
    expect(snapshot.sampleThread.id).toBe("thread_atlas_oa");
    expect(snapshot.stages.map((stage) => stage.id)).toEqual([
      "mailbox_triage",
      "workflow_extraction",
      "evidence_review",
      "resume_context",
      "reminder_notification",
      "model_router"
    ]);
    expect(snapshot.extractedProposal.stage).toBe("assessment");
    expect(snapshot.evidence[0]?.sourceMessageIds).toContain("msg_atlas_oa_1");
    expect(snapshot.reviewGate.openCount).toBeGreaterThan(0);
    expect(snapshot.notifications.length).toBeGreaterThan(0);
    expect(snapshot.modelRouter.primary).toBe("ollama_gemma");
    expect(snapshot.modelRouter.roadmapAdapters.every((adapter) => adapter.implemented === false)).toBe(true);
  });

  it("keeps public API payloads free of local paths, provider dashboards, and real email patterns", async () => {
    setStateRepository(new MemoryStateRepository(createSeedState()));
    const responses = await Promise.all([
      getPipelineSnapshot(),
      getModelStatus(),
      getConnectors(),
      getAnalytics(),
      getEvidence(),
      getReviewQueue(new Request("http://localhost/api/review?status=all")),
      getReminders(new Request("http://localhost/api/reminders")),
      getExport()
    ]);

    for (const response of responses) {
      const text = await response.text();
      expect(text).not.toMatch(/\/Users\/|\/private\/tmp|[A-Z]:\\/);
      const providerDashboardPattern = new RegExp(
        ["console\\.neon\\.tech", "railway\\.app\\/project", "vercel\\.com\\/[^\"\\s]+\\/[^\"\\s]+"].join("|"),
        "i"
      );
      expect(text).not.toMatch(providerDashboardPattern);
      expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@(gmail|ucsd|usc|gatech)\.edu/i);
      expect(text).not.toContain(`@${"gmail"}.com`);
      expect(text).not.toMatch(/access_token|refresh_token|oauth_token|client_secret/i);
    }
  });

  it("keeps the full state snapshot behind an explicit development debug flag", async () => {
    const previousDebug = process.env.CAREEROS_DEBUG_STATE_ENABLED;
    setStateRepository(new MemoryStateRepository(createSeedState()));

    try {
      delete process.env.CAREEROS_DEBUG_STATE_ENABLED;
      const disabled = await getDebugStateSnapshot();
      expect(disabled.status).toBe(404);

      process.env.CAREEROS_DEBUG_STATE_ENABLED = "true";
      const enabled = await getDebugStateSnapshot();
      const state = (await enabled.json()) as CareerOSState;
      expect(enabled.status).toBe(200);
      expect(state.workspaceUser.id).toBe("user_local_workspace");
      expect(enabled.headers.get("cache-control")).toBe("no-store");
    } finally {
      restoreEnv("CAREEROS_DEBUG_STATE_ENABLED", previousDebug);
    }
  });
});

describe("persistence abstraction", () => {
  it("clears legacy seed-only workspace state without touching real records", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "careeros-legacy-seed-"));
    const repository = new JsonFileStateRepository(dir);

    try {
      const legacySeed = createSeedState();
      legacySeed.modelRuntime = {
        ...legacySeed.modelRuntime,
        enabled: true,
        modelTag: "gemma4:e4b"
      };
      await repository.write(legacySeed);
      setStateRepository(repository);

      const cleaned = await readState();
      expect(cleaned.applications).toEqual([]);
      expect(cleaned.mailboxThreads).toEqual([]);
      expect(cleaned.reviewItems).toEqual([]);
      expect(cleaned.importJobs).toEqual([]);
      expect(cleaned.modelRuntime.enabled).toBe(true);

      const mixedRepository = new JsonFileStateRepository(dir);
      await mixedRepository.write({
        ...createSeedState(),
        applications: [
          {
            id: "app_real",
            workspaceUserId: "user_local_workspace",
            company: "Real Systems",
            role: "Backend Engineer",
            stage: "applied",
            updatedAt: "2026-05-12T00:00:00.000Z",
            source: "manual"
          },
          ...createSeedState().applications
        ]
      });
      setStateRepository(mixedRepository);

      const mixed = await readState();
      expect(mixed.applications.some((application) => application.id === "app_real")).toBe(true);
      expect(mixed.applications.some((application) => application.id === "app_atlas")).toBe(true);
    } finally {
      setStateRepository(new MemoryStateRepository());
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reads a clean workspace, updates, and re-reads through the repository interface", async () => {
    setStateRepository(new MemoryStateRepository());
    const initial = await readState();
    await updateState((state) => ({
      ...state,
      applications: [
        {
          id: "app_test_persisted",
          workspaceUserId: state.workspaceUser.id,
          company: "Persisted Systems",
          role: "Backend Engineer",
          stage: "applied",
          updatedAt: new Date().toISOString(),
          source: "manual"
        },
        ...state.applications
      ]
    }));
    const reread = await readState();

    expect(initial.workspaceUser.id).toBe("user_local_workspace");
    expect(initial.applications).toEqual([]);
    expect(initial.mailboxThreads).toEqual([]);
    expect(reread.applications.some((item) => item.id === "app_test_persisted")).toBe(true);
  });

  it("persists create, read, update, reset, import, and derived notifications with JSON file storage", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "careeros-json-"));
    try {
      setStateRepository(new JsonFileStateRepository(dir));
      const initial = await readState();
      expect(initial.applications).toEqual([]);
      expect(initial.mailboxThreads).toEqual([]);

      await updateState((state) =>
        processLocalImport(state, [
          {
            company: "JSON Works",
            role: "Local Persistence Engineer",
            sourceLabel: "json-test:import",
            text: "Recruiter reply detected for Local Persistence Engineer. Follow-up is due on 2026-05-12."
          }
        ])
      );
      const imported = await readState();
      expect(imported.applications.some((item) => item.company === "JSON Works")).toBe(true);
      expect(imported.importJobs[0]?.source).toBe("json");
      expect(imported.notifications.length).toBeGreaterThan(0);

      const reset = await resetState();
      expect(reset.applications.some((item) => item.company === "JSON Works")).toBe(false);
      expect(reset.applications).toEqual([]);
      expect(reset.mailboxThreads).toEqual([]);
    } finally {
      setStateRepository(new MemoryStateRepository());
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("exports normalized local state without absolute paths or private provider values", async () => {
    setStateRepository(new MemoryStateRepository(createSeedState()));
    const response = await getExport();
    const text = await response.text();
    const exported = JSON.parse(text) as CareerOSState;

    expect(response.headers.get("content-disposition")).toContain("careeros-local-state.json");
    expect(exported.workspaceUser.id).toBe("user_local_workspace");
    expect(text).not.toContain("/Users/");
    expect(text).not.toContain(["console", "neon", "tech"].join("."));
    expect(text).not.toContain(`railway.${"app"}/project`);
    expect(text).not.toContain(`@${"gmail"}.com`);
  });

  it("round-trips a normalized workspace export through strict JSON import", async () => {
    setStateRepository(new MemoryStateRepository(createSeedState()));
    const exportResponse = await getExport();
    const exported = (await exportResponse.json()) as CareerOSState;
    const importedState: CareerOSState = {
      ...exported,
      applications: [
        {
          id: "app_workspace_round_trip",
          workspaceUserId: exported.workspaceUser.id,
          company: "Round Trip Systems",
          role: "Pipeline Engineer",
          stage: "applied",
          jobDescriptionUrl: "https://jobs.example.com/round-trip/pipeline-engineer",
          resumeVersion: "resume-platform-v7.pdf",
          coverLetterVersion: "round-trip-cover-v1.md",
          applicationSource: "Wellfound",
          recruiterContactName: "Round Trip recruiting",
          recruiterContactEmail: "recruiting@round-trip.example",
          location: "Remote US",
          salaryRange: "$130,000-$150,000",
          notes: "Imported from a strict CareerOS workspace export.",
          updatedAt: "2026-05-10T00:00:00.000Z",
          source: "manual"
        },
        ...exported.applications
      ]
    };

    await resetState();
    expect((await readState()).applications.some((item) => item.company === "Round Trip Systems")).toBe(false);

    const response = await postWorkspaceImport(workspaceImportRequest(importedState));
    const body = await response.json();
    const state = await readState();

    expect(response.status).toBe(200);
    expect(body.imported).toBe(true);
    expect(state.schemaVersion).toBe(1);
    expect(state.importJobs[0]?.source).toBe("json");
    expect(state.applications.find((item) => item.company === "Round Trip Systems")?.resumeVersion).toBe(
      "resume-platform-v7.pdf"
    );
  });

  it("rejects malformed workspace JSON without mutating current state", async () => {
    setStateRepository(new MemoryStateRepository(createSeedState()));
    const before = await readState();
    const response = await postWorkspaceImport(
      new Request("http://localhost/api/local-data/import", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: "{"
      })
    );
    const after = await readState();

    expect(response.status).toBe(400);
    expect(after.applications.map((item) => item.id)).toEqual(before.applications.map((item) => item.id));
  });

  it("rejects future workspace schema versions without mutating current state", async () => {
    const seed = createSeedState();
    setStateRepository(new MemoryStateRepository(seed));
    const response = await postWorkspaceImport(workspaceImportRequest({ ...seed, schemaVersion: 999 }));
    const body = await response.json();
    const state = await readState();

    expect(response.status).toBe(400);
    expect(body.code).toBe("schema_version_unsupported");
    expect(state.schemaVersion).toBe(1);
    expect(state.applications.map((item) => item.id)).toEqual(seed.applications.map((item) => item.id));
  });

  it("rejects private local paths in workspace imports", async () => {
    const seed = createSeedState();
    setStateRepository(new MemoryStateRepository(seed));
    const privatePath = ["/Users", "local", "career-data.json"].join("/");
    const response = await postWorkspaceImport(
      workspaceImportRequest({
        ...seed,
        applications: [{ ...seed.applications[0], notes: privatePath }, ...seed.applications.slice(1)]
      })
    );

    expect(response.status).toBe(400);
    expect((await readState()).applications[0]?.notes).not.toBe(privatePath);
  });

  it("rejects secret-looking token values in workspace imports", async () => {
    const seed = createSeedState();
    setStateRepository(new MemoryStateRepository(seed));
    const token = ["sk", "test", "abcdefghijklmnopqrstuvwxyz123456"].join("-");
    const response = await postWorkspaceImport(
      workspaceImportRequest({
        ...seed,
        modelTraces: [{ ...seed.modelTraces[0], diagnostic: token }]
      })
    );

    expect(response.status).toBe(400);
    expect((await readState()).modelTraces.some((trace) => trace.diagnostic === token)).toBe(false);
  });

  it("rejects OAuth and provider-key fields in workspace imports", async () => {
    const seed = createSeedState();
    setStateRepository(new MemoryStateRepository(seed));
    const response = await postWorkspaceImport(
      workspaceImportRequest({
        ...seed,
        connectorAccounts: [{ ...seed.connectorAccounts[0], accessToken: "placeholder" }]
      })
    );

    expect(response.status).toBe(400);
    expect((await readState()).connectorAccounts.some((account) => "accessToken" in account)).toBe(false);
  });

  it("imports a validated workspace file from the settings form contract", async () => {
    const seed = createSeedState();
    const importedState: CareerOSState = {
      ...seed,
      applications: [
        {
          ...seed.applications[0],
          id: "app_file_import",
          company: "File Import Labs",
          updatedAt: "2026-05-10T00:00:00.000Z"
        },
        ...seed.applications.slice(1)
      ]
    };
    setStateRepository(new MemoryStateRepository(createSeedState()));

    const form = new FormData();
    form.set("confirm", workspaceImportConfirmation);
    form.set("file", new Blob([JSON.stringify(importedState)], { type: "application/json" }), "careeros-local-state.json");
    const response = await postWorkspaceImport(
      new Request("http://localhost/api/local-data/import", {
        method: "POST",
        headers: { accept: "application/json" },
        body: form
      })
    );

    expect(response.status).toBe(200);
    expect((await readState()).applications.some((item) => item.company === "File Import Labs")).toBe(true);
  });

  it("deletes only a .careeros-data workspace directory after explicit confirmation", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "careeros-delete-"));
    const dataDir = path.join(dir, ".careeros-data");
    try {
      setStateRepository(new JsonFileStateRepository(dataDir));
      await updateState((state) => ({
        ...state,
        applications: [
          {
            id: "app_delete_check",
            workspaceUserId: state.workspaceUser.id,
            company: "Delete Check Labs",
            role: "Backend Engineer",
            stage: "applied",
            updatedAt: "2026-05-10T00:00:00.000Z",
            source: "manual"
          },
          ...state.applications
        ]
      }));
      expect((await readState()).applications.some((item) => item.company === "Delete Check Labs")).toBe(true);

      const rejected = await postDeleteLocalData(
        new Request("http://localhost/api/local-data/delete", {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify({ confirm: "delete" })
        })
      );
      expect(rejected.status).toBe(400);

      const accepted = await postDeleteLocalData(
        new Request("http://localhost/api/local-data/delete", {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify({ confirm: "DELETE LOCAL DATA" })
        })
      );
      const body = await accepted.json();
      const state = await readState();

      expect(accepted.status).toBe(200);
      expect(body.deleted).toBe(true);
      expect(state.applications.some((item) => item.company === "Delete Check Labs")).toBe(false);
      expect(state.applications).toEqual([]);
      expect(state.mailboxThreads).toEqual([]);
    } finally {
      setStateRepository(new MemoryStateRepository());
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("optional Gmail connector architecture", () => {
  it("reports Gmail disabled by default without blocking local state", () => {
    const previous = process.env.CAREEROS_GMAIL_CONNECTOR_ENABLED;
    process.env.CAREEROS_GMAIL_CONNECTOR_ENABLED = "false";
    const [gmail] = listConnectorAccounts(createSeedState());
    restoreEnv("CAREEROS_GMAIL_CONNECTOR_ENABLED", previous);

    expect(gmail.status).toBe("disabled");
    expect(gmail.message).toContain("Local console");
  });

  it("reports not_configured when enabled without OAuth credentials", () => {
    const previousEnabled = process.env.CAREEROS_GMAIL_CONNECTOR_ENABLED;
    const previousId = process.env.CAREEROS_GMAIL_CLIENT_ID;
    const previousSecret = process.env.CAREEROS_GMAIL_CLIENT_SECRET;
    process.env.CAREEROS_GMAIL_CONNECTOR_ENABLED = "true";
    delete process.env.CAREEROS_GMAIL_CLIENT_ID;
    delete process.env.CAREEROS_GMAIL_CLIENT_SECRET;

    const [gmail] = listConnectorAccounts(createSeedState());

    restoreEnv("CAREEROS_GMAIL_CONNECTOR_ENABLED", previousEnabled);
    restoreEnv("CAREEROS_GMAIL_CLIENT_ID", previousId);
    restoreEnv("CAREEROS_GMAIL_CLIENT_SECRET", previousSecret);

    expect(gmail.status).toBe("not_configured");
    expect(gmail.message).toContain("CAREEROS_GMAIL_CLIENT_ID");
  });

  it("keeps connect, disconnect, and sync fallback idempotent and workspace-token-free", () => {
    const previousEnabled = process.env.CAREEROS_GMAIL_CONNECTOR_ENABLED;
    const previousId = process.env.CAREEROS_GMAIL_CLIENT_ID;
    const previousSecret = process.env.CAREEROS_GMAIL_CLIENT_SECRET;
    process.env.CAREEROS_GMAIL_CONNECTOR_ENABLED = "true";
    process.env.CAREEROS_GMAIL_CLIENT_ID = "local-placeholder-client";
    process.env.CAREEROS_GMAIL_CLIENT_SECRET = "local-placeholder-secret";

    const connected = startGmailConnectPlaceholder(createSeedState());
    const synced = syncGmailPlaceholder(connected.state);
    const disconnected = disconnectGmailPlaceholder(synced.state);
    const disconnectedAgain = disconnectGmailPlaceholder(disconnected.state);

    restoreEnv("CAREEROS_GMAIL_CONNECTOR_ENABLED", previousEnabled);
    restoreEnv("CAREEROS_GMAIL_CLIENT_ID", previousId);
    restoreEnv("CAREEROS_GMAIL_CLIENT_SECRET", previousSecret);

    expect(connected.result.status).toBe("needs_attention");
    expect(synced.result.importJob?.source).toBe("gmail");
    expect(synced.result.importJob?.status).toBe("failed");
    expect(disconnected.result.status).toBe("disconnected");
    expect(disconnectedAgain.result.status).toBe("disconnected");
    expect(JSON.stringify(disconnectedAgain.state)).not.toMatch(/access_token|refresh_token|oauth_token/i);
  });

  it("exposes disabled connector status through API routes without credentials", async () => {
    const previousEnabled = process.env.CAREEROS_GMAIL_CONNECTOR_ENABLED;
    process.env.CAREEROS_GMAIL_CONNECTOR_ENABLED = "false";
    setStateRepository(new MemoryStateRepository(createSeedState()));

    try {
      const listResponse = await getConnectors();
      const list = await listResponse.json();
      expect(list.connectors[0].status).toBe("disabled");

      const syncResponse = await postGmailConnector(
        new Request("http://localhost/api/connectors/gmail/sync", {
          method: "POST",
          headers: { accept: "application/json" }
        }),
        { params: Promise.resolve({ action: "sync" }) }
      );
      const result = await syncResponse.json();
      const state = await readState();

      expect(result.status).toBe("disabled");
      expect(result.message).toContain("Local console");
      expect(JSON.stringify(state)).not.toMatch(/oauth|refresh_token|access_token/i);
    } finally {
      restoreEnv("CAREEROS_GMAIL_CONNECTOR_ENABLED", previousEnabled);
    }
  });

  it("exchanges local OAuth and converts Gmail recruiting mail into bounded import records", async () => {
    const previousEnabled = process.env.CAREEROS_GMAIL_CONNECTOR_ENABLED;
    const previousId = process.env.CAREEROS_GMAIL_CLIENT_ID;
    const previousSecret = process.env.CAREEROS_GMAIL_CLIENT_SECRET;
    const previousDir = process.env.CAREEROS_DATA_DIR;
    const dir = await mkdtemp(path.join(tmpdir(), "careeros-gmail-"));
    const originalFetch = globalThis.fetch;
    process.env.CAREEROS_GMAIL_CONNECTOR_ENABLED = "true";
    process.env.CAREEROS_GMAIL_CLIENT_ID = "local-client";
    process.env.CAREEROS_GMAIL_CLIENT_SECRET = "local-secret";
    process.env.CAREEROS_DATA_DIR = dir;

    try {
      globalThis.fetch = (async (input) => {
        const url = String(input);
        if (url.includes("oauth2.googleapis.com/token")) {
          return Response.json({ access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600 });
        }
        if (url.endsWith("/messages?maxResults=1&q=newer_than%3A90d+%28recruiter+OR+application+OR+assessment+OR+interview+OR+%22next+steps%22+OR+offer+OR+OA%29")) {
          return Response.json({ messages: [{ id: "gmail_msg_1", threadId: "gmail_thread_1" }] });
        }
        if (url.includes("/messages/gmail_msg_1")) {
          return Response.json({
            id: "gmail_msg_1",
            threadId: "gmail_thread_1",
            snippet: "Assessment due 2026-05-20 for Product Engineer.",
            internalDate: String(Date.parse("2026-05-12T12:00:00.000Z")),
            payload: {
              mimeType: "text/plain",
              headers: [
                { name: "Subject", value: "Assessment from Signal Works for Product Engineer" },
                { name: "From", value: "Recruiting <recruiting@signal.example>" },
                { name: "Date", value: "Tue, 12 May 2026 12:00:00 +0000" }
              ],
              body: {
                data: Buffer.from("Please complete the assessment by 2026-05-20.").toString("base64url")
              }
            }
          });
        }
        return new Response("not found", { status: 404 });
      }) as typeof fetch;

      await exchangeGmailCode("local-code", "http://localhost/api/connectors/gmail/callback");
      const synced = await syncGmailRecruitingMail(1);
      const tokenFile = await readFile(path.join(dir, "gmail-oauth.json"), "utf8");

      expect(await hasGmailToken()).toBe(true);
      expect(tokenFile).toContain("aes-256-gcm");
      expect(tokenFile).not.toMatch(/access-token|refresh-token/);
      expect(synced.records[0]?.sourceLabel).toBe("gmail:gmail_msg_1");
      expect(synced.records[0]?.company).toBe("Signal Works");
      expect(synced.records[0]?.role).toContain("Product Engineer");
      expect(synced.records[0]?.text).toContain("Assessment");
      expect(JSON.stringify(synced.records)).not.toMatch(/access-token|refresh-token/);
    } finally {
      globalThis.fetch = originalFetch;
      restoreEnv("CAREEROS_GMAIL_CONNECTOR_ENABLED", previousEnabled);
      restoreEnv("CAREEROS_GMAIL_CLIENT_ID", previousId);
      restoreEnv("CAREEROS_GMAIL_CLIENT_SECRET", previousSecret);
      restoreEnv("CAREEROS_DATA_DIR", previousDir);
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("local API security boundaries", () => {
  it("blocks cross-origin state-changing requests", async () => {
    setStateRepository(new MemoryStateRepository(createSeedState()));

    const response = await postImport(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          company: "Cross Origin Labs",
          role: "Backend Engineer",
          sourceLabel: "csrf:import",
          text: "Recruiter reply detected after application receipt."
        })
      })
    );
    const body = await response.json();
    const state = await readState();

    expect(response.status).toBe(403);
    expect(body.error).toContain("app origin");
    expect(state.applications.some((item) => item.company === "Cross Origin Labs")).toBe(false);
  });
});

describe("provider adapter registry", () => {
  it("exposes deterministic + ollama as the only implemented adapters", () => {
    const implemented = listImplementedAdapters().map((adapter) => adapter.id).sort();
    expect(implemented).toEqual(["deterministic", "ollama"]);
  });

  it("keeps every BYOK hosted adapter gated on credential storage", () => {
    const byok = listByokRoadmapAdapters();
    expect(byok.length).toBeGreaterThan(0);
    for (const adapter of byok) {
      expect(adapter.implementation).toBe("roadmap");
      expect(adapter.trust).toBe("byok-credentials");
      expect(adapter.unlockGate).toMatch(/credential storage/i);
    }
  });

  it("keeps every local roadmap adapter explicit about the unlock gate", () => {
    const localRoadmap = listLocalRoadmapAdapters();
    expect(localRoadmap.map((adapter) => adapter.id).sort()).toEqual(
      ["litert", "llama-cpp", "mlx", "mtp-drafters", "sglang", "vllm"].sort()
    );
    for (const adapter of localRoadmap) {
      expect(adapter.implementation).toBe("roadmap");
      expect(adapter.trust).toBe("local-credentials");
      expect(adapter.unlockGate ?? "").not.toBe("");
    }
  });

  it("lists all roadmap adapters as the union of local + BYOK", () => {
    const all = listRoadmapAdapters().map((adapter) => adapter.id).sort();
    const expected = [
      ...listLocalRoadmapAdapters().map((adapter) => adapter.id),
      ...listByokRoadmapAdapters().map((adapter) => adapter.id)
    ].sort();
    expect(all).toEqual(expected);
  });

  it("getProviderAdapter returns the right entry by id", () => {
    expect(getProviderAdapter("ollama")?.label).toBe("Gemma via Ollama Cloud");
    expect(getProviderAdapter("unknown")).toBeUndefined();
  });

  it("agent-pipeline snapshot routes its roadmap lists through the registry", async () => {
    setStateRepository(new MemoryStateRepository(createSeedState()));
    const state = await readState();
    const status = await checkOllamaStatus({ enabled: false });
    const snapshot = deriveAgentPipelineSnapshot(state, status);
    const router = snapshot.stages.find((stage) => stage.id === "model_router");
    expect(router).toBeDefined();
    const output = router?.output as { localRoadmapAdapters: string[]; byokRoadmapAdapters: string[] };
    expect(output.localRoadmapAdapters.sort()).toEqual(
      listLocalRoadmapAdapters().map((adapter) => adapter.id).sort()
    );
    expect(output.byokRoadmapAdapters.sort()).toEqual(
      listByokRoadmapAdapters().map((adapter) => adapter.id).sort()
    );
  });

  it("does not present any roadmap adapter as shipped", () => {
    const adapters = listProviderAdapters();
    for (const adapter of adapters) {
      if (adapter.implementation === "roadmap") {
        expect(adapter.unlockGate, `${adapter.id} should declare its unlock gate`).toBeTruthy();
      }
    }
  });
});

describe("agent operating contracts", () => {
  it("keeps every pipeline agent backed by a product-facing contract", () => {
    const ids = agentOperatingContracts.map((contract) => contract.id).sort();
    expect(ids).toEqual([
      "evidence_review",
      "mailbox_triage",
      "model_router",
      "reminder_notification",
      "resume_context",
      "workflow_extraction"
    ]);

    for (const contract of agentOperatingContracts) {
      expect(contract.promptBoundary).not.toBe("");
      expect(contract.memoryBoundary).not.toBe("");
      expect(contract.costBoundary).not.toBe("");
      expect(contract.canDo.length).toBeGreaterThan(1);
      expect(contract.cannotDo.length).toBeGreaterThan(1);
      expect(getAgentOperatingContract(contract.id)).toBe(contract);
    }
  });

  it("keeps model and review contracts conservative", () => {
    expect(getAgentOperatingContract("model_router")?.cannotDo.join(" ")).toMatch(/raw prompts/i);
    expect(getAgentOperatingContract("model_router")?.costBoundary).toMatch(/zero model\/API cost/i);
    expect(getAgentOperatingContract("evidence_review")?.cannotDo.join(" ")).toMatch(/Hide uncertainty/i);
    expect(getAgentOperatingContract("workflow_extraction")?.cannotDo.join(" ")).toMatch(/Apply model output directly/i);
  });
});
