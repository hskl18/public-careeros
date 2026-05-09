import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import {
  disconnectGmailPlaceholder,
  listConnectorAccounts,
  startGmailConnectPlaceholder,
  syncGmailPlaceholder
} from "@/lib/connectors";
import { deriveAnalyticsSummary } from "@/lib/analytics";
import { checkOllamaStatus } from "@/lib/model-status";
import { deriveNotifications } from "@/lib/notifications";
import { MemoryStateRepository, SQLiteStateRepository } from "@/lib/persistence";
import { processLocalImport, processLocalImportWithModel } from "@/lib/pipeline";
import { acceptReviewItem, correctReviewItem, dismissReviewItem, updateReminderStatus } from "@/lib/review";
import { createSeedState } from "@/lib/seed";
import { readState, resetState, setStateRepository, updateState } from "@/lib/store";
import type { CareerOSState } from "@/lib/types";
import { POST as postReminder } from "@/app/api/reminders/[id]/route";

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("local deterministic pipeline", () => {
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
    expect(analytics.companyBreakdown.some((item) => item.label === "Cedar Systems")).toBe(true);
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
          modelTag: "gemma3:4b",
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
          modelTag: "gemma3:4b",
          status: "ready",
          task: "model-provider-status",
          diagnostic: "Ready now.",
          createdAt: "2026-05-08T12:10:00.000Z"
        },
        {
          id: "trace_missing",
          provider: "ollama",
          modelTag: "gemma3:4b",
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
});

describe("model status", () => {
  it("reports disabled mode without touching the network", async () => {
    const previous = process.env.CAREEROS_OLLAMA_ENABLED;
    process.env.CAREEROS_OLLAMA_ENABLED = "false";
    const report = await checkOllamaStatus();
    restoreEnv("CAREEROS_OLLAMA_ENABLED", previous);

    expect(report.status).toBe("disabled");
    expect(report.diagnostic).toContain("Deterministic");
  });

  it("reports selected model missing before model-backed analysis", async () => {
    const report = await checkOllamaStatus({
      enabled: true,
      modelTag: "gemma3:4b",
      fetchFn: async () => Response.json({ models: [{ name: "other-model:latest" }] })
    });

    expect(report.status).toBe("model_missing");
    expect(report.diagnostic).toContain("ollama pull gemma3:4b");
  });

  it("runs a bounded health prompt before ready status", async () => {
    const calls: string[] = [];
    const report = await checkOllamaStatus({
      enabled: true,
      modelTag: "gemma3:4b",
      fetchFn: async (input, init) => {
        calls.push(`${init?.method ?? "GET"} ${String(input)}`);
        if (String(input).endsWith("/api/tags")) {
          return Response.json({ models: [{ name: "gemma3:4b" }] });
        }
        return Response.json({ response: "{\"ok\":true}" });
      }
    });

    expect(report.status).toBe("ready");
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
        modelTag: "gemma3:4b",
        fetchFn: async (input) => {
          if (String(input).endsWith("/api/tags")) {
            return Response.json({ models: [{ name: "gemma3:4b" }] });
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
        modelTag: "gemma3:4b",
        fetchFn: async (input) => {
          if (String(input).endsWith("/api/tags")) {
            return Response.json({ models: [{ name: "gemma3:4b" }] });
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

describe("persistence abstraction", () => {
  it("reads, seeds, updates, and re-reads through the repository interface", async () => {
    setStateRepository(new MemoryStateRepository());
    const seeded = await readState();
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

    expect(seeded.workspaceUser.id).toBe("user_local_workspace");
    expect(reread.applications.some((item) => item.id === "app_test_persisted")).toBe(true);
    expect(reread.notifications.length).toBeGreaterThan(0);
  });

  it("persists create, read, update, reset, import, and derived notifications with SQLite", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "careeros-sqlite-"));
    try {
      setStateRepository(new SQLiteStateRepository(dir));
      const seeded = await readState();
      expect(seeded.applications.length).toBeGreaterThan(0);

      await updateState((state) =>
        processLocalImport(state, [
          {
            company: "SQLite Works",
            role: "Local Persistence Engineer",
            sourceLabel: "sqlite-test:import",
            text: "Recruiter reply detected for Local Persistence Engineer. Follow-up is due on 2026-05-12."
          }
        ])
      );
      const imported = await readState();
      expect(imported.applications.some((item) => item.company === "SQLite Works")).toBe(true);
      expect(imported.importJobs[0]?.source).toBe("json");
      expect(imported.notifications.length).toBeGreaterThan(0);

      const reset = await resetState();
      expect(reset.applications.some((item) => item.company === "SQLite Works")).toBe(false);
      expect(reset.applications.some((item) => item.id === "app_atlas")).toBe(true);
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
    expect(gmail.message).toContain("Local dashboard");
  });

  it("reports not_configured when enabled without OAuth placeholders", () => {
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
    expect(gmail.message).toContain("placeholders");
  });

  it("keeps connect, disconnect, and sync placeholders idempotent and token-free", () => {
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
});
