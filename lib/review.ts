import { stableId, nowIso } from "./id";
import type { Application, ApplicationEvent, CareerOSState, ProposedMutation, ReviewItem } from "./types";

function applyProposedMutation(application: Application, change: ProposedMutation, source: Application["source"]): Application {
  return {
    ...application,
    company: change.company ?? application.company,
    role: change.role ?? application.role,
    stage: change.stage ?? application.stage,
    contactName: change.contactName ?? application.contactName,
    deadlineAt: change.deadlineAt ?? application.deadlineAt,
    followUpAt: change.followUpAt ?? application.followUpAt,
    updatedAt: nowIso(),
    source
  };
}

function buildDecisionEvent(review: ReviewItem, summary: string, confidence: number): ApplicationEvent | undefined {
  if (!review.proposedChange.applicationId) return undefined;
  return {
    id: stableId("event", [review.id, summary]),
    applicationId: review.proposedChange.applicationId,
    type: "review_decision",
    summary,
    source: "review",
    confidence,
    createdAt: nowIso()
  };
}

export function acceptReviewItem(state: CareerOSState, reviewId: string): CareerOSState {
  const review = state.reviewItems.find((item) => item.id === reviewId);
  if (!review || review.status !== "open") return state;

  const event = buildDecisionEvent(review, `Accepted review: ${review.proposedChange.eventSummary}`, review.confidence);
  const applications = state.applications.map((application) =>
    application.id === review.proposedChange.applicationId
      ? applyProposedMutation(application, review.proposedChange, "review")
      : application
  );

  return {
    ...state,
    applications,
    events: event && !state.events.some((item) => item.id === event.id) ? [event, ...state.events] : state.events,
    reviewItems: state.reviewItems.map((item) =>
      item.id === reviewId
        ? { ...item, status: "accepted", decidedAt: nowIso(), decisionEventId: event?.id }
        : item
    )
  };
}

export function dismissReviewItem(state: CareerOSState, reviewId: string): CareerOSState {
  const review = state.reviewItems.find((item) => item.id === reviewId);
  if (!review || review.status !== "open") return state;

  const event = buildDecisionEvent(review, `Dismissed review without applying mutation: ${review.reason}`, review.confidence);
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
  const correctedReview = {
    ...review,
    proposedChange: mergedChange
  };
  const event = buildDecisionEvent(correctedReview, `Corrected review: ${mergedChange.eventSummary}`, 1);
  const applications = state.applications.map((application) =>
    application.id === mergedChange.applicationId ? applyProposedMutation(application, mergedChange, "review") : application
  );

  return {
    ...state,
    applications,
    events: event && !state.events.some((item) => item.id === event.id) ? [event, ...state.events] : state.events,
    reviewItems: state.reviewItems.map((item) =>
      item.id === reviewId
        ? {
            ...correctedReview,
            status: "corrected",
            confidence: 1,
            traceSummary: `${item.traceSummary}; user correction trusted`,
            decidedAt: nowIso(),
            decisionEventId: event?.id
          }
        : item
    )
  };
}
