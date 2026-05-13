import type { ApplicationEvent, CareerOSState, Reminder } from "./types";

export interface ReminderHistoryItem {
  reminder: Reminder;
  application?: {
    id: string;
    company: string;
    role: string;
    stage: string;
  };
  decisionEvent?: ApplicationEvent;
}

export interface ApplicationTimelineItem {
  id: string;
  applicationId: string;
  type: "event" | "reminder";
  label: string;
  summary: string;
  status?: Reminder["status"];
  createdAt: string;
}

function decisionEventFor(state: CareerOSState, reminder: Reminder) {
  return state.events.find(
    (event) =>
      event.applicationId === reminder.applicationId &&
      (event.type === "reminder_completed" || event.type === "reminder_dismissed") &&
      event.summary.includes(reminder.title)
  );
}

export function queryReminderHistory(state: CareerOSState, filters: { applicationId?: string; status?: "done" | "dismissed" | "all" } = {}) {
  const status = filters.status ?? "all";
  return state.reminders
    .filter((reminder) => reminder.status !== "open")
    .filter((reminder) => status === "all" || reminder.status === status)
    .filter((reminder) => !filters.applicationId || reminder.applicationId === filters.applicationId)
    .map((reminder): ReminderHistoryItem => {
      const application = state.applications.find((item) => item.id === reminder.applicationId);
      return {
        reminder,
        application: application
          ? {
              id: application.id,
              company: application.company,
              role: application.role,
              stage: application.stage
            }
          : undefined,
        decisionEvent: decisionEventFor(state, reminder)
      };
    })
    .sort((left, right) => (right.reminder.decidedAt ?? right.reminder.createdAt).localeCompare(left.reminder.decidedAt ?? left.reminder.createdAt));
}

export function queryOpenReminders(state: CareerOSState, filters: { applicationId?: string } = {}) {
  return state.reminders
    .filter((reminder) => reminder.status === "open")
    .filter((reminder) => !filters.applicationId || reminder.applicationId === filters.applicationId)
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}

export function deriveApplicationTimeline(state: CareerOSState, applicationId: string): ApplicationTimelineItem[] {
  const eventItems: ApplicationTimelineItem[] = state.events
    .filter((event) => event.applicationId === applicationId)
    .map((event) => ({
      id: event.id,
      applicationId: event.applicationId,
      type: "event",
      label: event.type,
      summary: event.summary,
      createdAt: event.createdAt
    }));

  const reminderItems: ApplicationTimelineItem[] = state.reminders
    .filter((reminder) => reminder.applicationId === applicationId)
    .map((reminder) => ({
      id: reminder.id,
      applicationId: reminder.applicationId,
      type: "reminder",
      label: reminder.type ?? "reminder",
      summary: reminder.title,
      status: reminder.status,
      createdAt: reminder.decidedAt ?? reminder.createdAt
    }));

  return [...eventItems, ...reminderItems].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
