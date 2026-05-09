import { nowIso } from "./id";
import type { Application, CareerOSState, ProposedMutation, ReviewItem } from "./types";
import {
  applyProposedMutation,
  buildDecisionEvent,
  canCreateApplication,
  ensureReminder,
  matchOrCreateApplication
} from "./workflow";

function resolveReviewApplication(state: CareerOSState, change: ProposedMutation) {
  const match = matchOrCreateApplication(
    state,
    {
      applicationId: change.applicationId,
      company: change.company ?? "",
      role: change.role ?? ""
    },
    change.stage,
    canCreateApplication(change.company)
  );
  return match;
}

function applyReviewedChange(
  state: CareerOSState,
  review: ReviewItem,
  change: ProposedMutation,
  status: "accepted" | "corrected",
  confidence: number
): CareerOSState {
  const match = resolveReviewApplication(state, change);
  const application = match.application;
  if (!application) {
    return state;
  }

  const event = buildDecisionEvent(
    application.id,
    [review.id, status, change.eventSummary],
    status === "accepted" ? "review_accepted" : "review_corrected",
    `${status === "accepted" ? "Accepted" : "Corrected"} review: ${change.eventSummary}`,
    "review",
    confidence
  );
  const revisedChange = { ...change, applicationId: application.id };
  const applications = match.applications.map((item: Application) =>
    item.id === application.id ? applyProposedMutation(application, revisedChange, "review") : item
  );
  const updatedApplication = applications.find((item) => item.id === application.id) ?? application;

  return {
    ...state,
    applications,
    reminders: ensureReminder(state.reminders, updatedApplication, revisedChange),
    events: event && !state.events.some((item) => item.id === event.id) ? [event, ...state.events] : state.events,
    reviewItems: state.reviewItems.map((item) =>
      item.id === review.id
        ? {
            ...review,
            proposedChange: revisedChange,
            status,
            confidence,
            traceSummary:
              status === "corrected" ? `${item.traceSummary}; user correction trusted` : `${item.traceSummary}; user accepted`,
            decidedAt: nowIso(),
            decisionEventId: event?.id
          }
        : item
    )
  };
}

export function acceptReviewItem(state: CareerOSState, reviewId: string): CareerOSState {
  const review = state.reviewItems.find((item) => item.id === reviewId);
  if (!review || review.status !== "open") return state;

  return applyReviewedChange(state, review, review.proposedChange, "accepted", review.confidence);
}

export function dismissReviewItem(state: CareerOSState, reviewId: string): CareerOSState {
  const review = state.reviewItems.find((item) => item.id === reviewId);
  if (!review || review.status !== "open") return state;

  const event = buildDecisionEvent(
    review.proposedChange.applicationId,
    [review.id, "dismiss", review.reason],
    "review_dismissed",
    `Dismissed review without applying mutation: ${review.reason}`,
    "review",
    review.confidence
  );
  return {
    ...state,
    events: event && !state.events.some((item) => item.id === event.id) ? [event, ...state.events] : state.events,
    reviewItems: state.reviewItems.map((item) =>
      item.id === reviewId
        ? { ...item, status: "dismissed", decidedAt: nowIso(), decisionEventId: event?.id }
        : item
    )
  };
}

export function correctReviewItem(
  state: CareerOSState,
  reviewId: string,
  correctedChange: ProposedMutation
): CareerOSState {
  const review = state.reviewItems.find((item) => item.id === reviewId);
  if (!review || review.status !== "open") return state;

  const mergedChange = { ...review.proposedChange, ...correctedChange };
  return applyReviewedChange(state, review, mergedChange, "corrected", 1);
}

export function updateReminderStatus(
  state: CareerOSState,
  reminderId: string,
  status: "done" | "dismissed"
): CareerOSState {
  const reminder = state.reminders.find((item) => item.id === reminderId);
  if (!reminder || reminder.status !== "open") return state;

  const application = state.applications.find((item) => item.id === reminder.applicationId);
  const now = nowIso();
  const event = buildDecisionEvent(
    reminder.applicationId,
    [reminder.id, status],
    status === "done" ? "reminder_completed" : "reminder_dismissed",
    `${status === "done" ? "Completed" : "Dismissed"} reminder: ${reminder.title}`,
    "manual",
    1
  );

  return {
    ...state,
    applications: application
      ? state.applications.map((item) => (item.id === application.id ? { ...item, updatedAt: now } : item))
      : state.applications,
    reminders: state.reminders.map((item) =>
      item.id === reminderId ? { ...item, status, decidedAt: now } : item
    ),
    events: event && !state.events.some((item) => item.id === event.id) ? [event, ...state.events] : state.events
  };
}
