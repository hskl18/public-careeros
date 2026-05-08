import { nowIso, stableId } from "./id";
import type { CareerOSState, Notification } from "./types";

function keepExistingStatus(state: CareerOSState, dedupeKey: string): Notification["status"] {
  return state.notifications.find((notification) => notification.dedupeKey === dedupeKey)?.status ?? "unread";
}

export function deriveNotifications(state: CareerOSState): Notification[] {
  const createdAt = nowIso();
  const notifications: Notification[] = [];

  for (const review of state.reviewItems.filter((item) => item.status === "open")) {
    const dedupeKey = `review:${review.id}`;
    notifications.push({
      id: stableId("notification", [dedupeKey]),
      dedupeKey,
      title: "Review item blocking automation",
      body: review.reason,
      severity: "warning",
      sourceType: "review",
      sourceId: review.id,
      href: `/review#${review.id}`,
      status: keepExistingStatus(state, dedupeKey),
      createdAt
    });
  }

  for (const reminder of state.reminders.filter((item) => item.status === "open")) {
    const due = new Date(reminder.dueAt).getTime();
    const inSevenDays = Date.now() + 7 * 24 * 60 * 60 * 1000;
    if (Number.isFinite(due) && due <= inSevenDays) {
      const application = state.applications.find((item) => item.id === reminder.applicationId);
      const dedupeKey = `reminder:${reminder.id}`;
      notifications.push({
        id: stableId("notification", [dedupeKey]),
        dedupeKey,
        title: "Follow-up reminder due",
        body: `${reminder.title}${application ? ` for ${application.company}` : ""}`,
        severity: due < Date.now() ? "critical" : "info",
        sourceType: "reminder",
        sourceId: reminder.id,
        href: application ? `/applications#${application.id}` : "/applications",
        status: keepExistingStatus(state, dedupeKey),
        createdAt
      });
    }
  }

  for (const application of state.applications.filter((item) => item.deadlineAt)) {
    const deadline = new Date(application.deadlineAt as string).getTime();
    const inSevenDays = Date.now() + 7 * 24 * 60 * 60 * 1000;
    if (Number.isFinite(deadline) && deadline <= inSevenDays) {
      const dedupeKey = `application-deadline:${application.id}:${application.deadlineAt}`;
      notifications.push({
        id: stableId("notification", [dedupeKey]),
        dedupeKey,
        title: "Deadline approaching",
        body: `${application.company} has a deadline on ${new Date(application.deadlineAt as string).toLocaleDateString()}.`,
        severity: deadline < Date.now() ? "critical" : "warning",
        sourceType: "application",
        sourceId: application.id,
        href: `/applications#${application.id}`,
        status: keepExistingStatus(state, dedupeKey),
        createdAt
      });
    }
  }

  for (const application of state.applications.filter((item) => item.stage === "recruiter_reply")) {
    const dedupeKey = `application-reply:${application.id}`;
    notifications.push({
      id: stableId("notification", [dedupeKey]),
      dedupeKey,
      title: "Recruiter reply detected",
      body: `${application.company} has a recruiter update waiting in the pipeline.`,
      severity: "info",
      sourceType: "application",
      sourceId: application.id,
      href: `/applications#${application.id}`,
      status: keepExistingStatus(state, dedupeKey),
      createdAt
    });
  }

  const latestTrace = [...state.modelTraces].reverse().find((trace) => trace.provider === "ollama");
  if (latestTrace && latestTrace.status !== "ready") {
    const dedupeKey = `model:${latestTrace.status}:${latestTrace.modelTag ?? "none"}`;
    notifications.push({
      id: stableId("notification", [dedupeKey]),
      dedupeKey,
      title: "Model setup needs attention",
      body: latestTrace.diagnostic,
      severity: latestTrace.status === "disabled" ? "info" : "warning",
      sourceType: "settings",
      href: "/settings",
      status: keepExistingStatus(state, dedupeKey),
      createdAt
    });
  }

  const connector = state.connectorAccounts.find((item) => item.provider === "gmail");
  if (connector?.status === "needs_attention") {
    const dedupeKey = `connector:${connector.id}`;
    notifications.push({
      id: stableId("notification", [dedupeKey]),
      dedupeKey,
      title: "Gmail connector needs attention",
      body: "The optional connector is disconnected or needs setup. Local dashboard use is unaffected.",
      severity: "warning",
      sourceType: "connector",
      sourceId: connector.id,
      href: "/settings",
      status: keepExistingStatus(state, dedupeKey),
      createdAt
    });
  }

  for (const evaluation of state.resumeEvaluations) {
    const dedupeKey = `resume:${evaluation.id}:${evaluation.status}`;
    notifications.push({
      id: stableId("notification", [dedupeKey]),
      dedupeKey,
      title: evaluation.status === "completed" ? "Resume analysis completed" : "Resume analysis blocked by review",
      body: evaluation.summary,
      severity: evaluation.status === "completed" ? "info" : "warning",
      sourceType: "resume",
      sourceId: evaluation.id,
      href: "/resume",
      status: keepExistingStatus(state, dedupeKey),
      createdAt
    });
  }

  return notifications.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
