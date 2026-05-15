import type { Application, ApplicationBucket, ApplicationEvent, AuditEvent, CareerOSState } from "./types";
import { applicationBucketFor } from "./workflow";

export interface AnalyticsMetrics {
  applicationsCount: number;
  uniqueCompanies: number;
  rolesCount: number;
  replyRate: number;
  interviewRate: number;
  offerRate: number;
  weeklyApplicationCount: number;
  followUpLoad: number;
  reviewBlockedCount: number;
  waitingCount: number;
  ghostedCount: number;
  completedReminderCount: number;
  dismissedReminderCount: number;
  avgTimeToFirstResponseHours: number | null;
}

export interface AnalyticsBreakdownItem extends AnalyticsMetrics {
  label: string;
}

export interface AnalyticsSummary {
  metrics: AnalyticsMetrics;
  companyBreakdown: AnalyticsBreakdownItem[];
  roleBreakdown: AnalyticsBreakdownItem[];
  statusBuckets: Array<{ bucket: ApplicationBucket; count: number }>;
  trends: AnalyticsTrendBucket[];
  audit: {
    total: number;
    recent: AuditEvent[];
  };
}

export interface AnalyticsTrendBucket {
  periodStart: string;
  applicationsCreated: number;
  replies: number;
  interviews: number;
  offers: number;
  replyRate: number;
  interviewRate: number;
  offerRate: number;
  reviewBlockedCount: number;
  waitingCount: number;
  ghostedCount: number;
  avgTimeToFirstResponseHours: number | null;
}

const replyEventTypes = new Set([
  "recruiter_outreach",
  "oa_invitation",
  "interview_invitation",
  "interview_confirmation",
  "generic_update",
  "rejection",
  "offer",
  "import_applied"
]);
const applicationCreatedEventTypes = new Set(["application_created", "application_received"]);
const interviewEventTypes = new Set(["interview_invitation", "interview_confirmation"]);

function normalizeDimension(value: string) {
  return value.trim().toLowerCase();
}

function toPercent(count: number, total: number) {
  if (!count || !total) return 0;
  return Number(((count * 100) / total).toFixed(1));
}

function averageHours(values: Array<number | null>) {
  const present = values.filter((value): value is number => value !== null);
  if (!present.length) return null;
  return Number((present.reduce((sum, value) => sum + value, 0) / present.length).toFixed(1));
}

function createdAtFor(application: Application, events: ApplicationEvent[]) {
  return events
    .filter((event) => event.applicationId === application.id)
    .map((event) => event.createdAt)
    .sort()[0] ?? application.updatedAt;
}

function hoursToFirstResponse(application: Application, events: ApplicationEvent[]) {
  const createdAt = new Date(createdAtFor(application, events)).getTime();
  if (!Number.isFinite(createdAt)) return null;

  const firstResponse = firstResponseEvent(application, events, false);
  if (!firstResponse) return null;

  const elapsed = new Date(firstResponse.createdAt).getTime() - createdAt;
  return elapsed >= 0 ? Number((elapsed / 36e5).toFixed(1)) : null;
}

function hasReply(application: Application, events: ApplicationEvent[]) {
  return application.stage !== "applied" || events.some((event) => event.applicationId === application.id && replyEventTypes.has(event.type));
}

function isResponseEvent(event: ApplicationEvent) {
  if (replyEventTypes.has(event.type)) return true;
  if (applicationCreatedEventTypes.has(event.type)) return false;
  if (event.type === "stage_changed") {
    return /recruiter|reply|assessment|oa|interview|screen|offer|reject|not moving forward/i.test(event.summary);
  }
  return false;
}

function firstResponseEvent(application: Application, events: ApplicationEvent[], allowStageFallback: boolean) {
  const applicationEvents = events
    .filter((event) => event.applicationId === application.id)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const explicit = applicationEvents.find(isResponseEvent);
  if (explicit) return explicit;
  if (allowStageFallback && application.stage !== "applied") {
    return applicationEvents.find((event) => !applicationCreatedEventTypes.has(event.type));
  }
  return undefined;
}

function firstResponseAtFor(application: Application, events: ApplicationEvent[]) {
  const explicit = firstResponseEvent(application, events, true);
  if (explicit) return explicit.createdAt;
  return application.stage !== "applied" ? createdAtFor(application, events) : undefined;
}

function hasInterview(application: Application, events: ApplicationEvent[]) {
  return (
    application.stage === "interview" ||
    application.stage === "offer" ||
    events.some((event) => event.applicationId === application.id && interviewEventTypes.has(event.type))
  );
}

function hasOffer(application: Application, events: ApplicationEvent[]) {
  return application.stage === "offer" || events.some((event) => event.applicationId === application.id && event.type === "offer");
}

function weeklyApplicationCount(applications: Application[], events: ApplicationEvent[]) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return applications.filter((application) => {
    const createdAt = new Date(createdAtFor(application, events)).getTime();
    return Number.isFinite(createdAt) && createdAt >= weekAgo;
  }).length;
}

function weekStartIso(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "unknown";
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - day + 1);
  return `${utc.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

function buildStatusBuckets(applications: Application[]) {
  const buckets = new Map<ApplicationBucket, number>();
  for (const application of applications) {
    const bucket = applicationBucketFor(application);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  const order: ApplicationBucket[] = [
    "applied",
    "waiting",
    "followed_up",
    "assessment",
    "interview",
    "rejected",
    "offer",
    "ghosted"
  ];
  return order.map((bucket) => ({ bucket, count: buckets.get(bucket) ?? 0 }));
}

function bucketCount(applications: Application[], bucket: ApplicationBucket) {
  return applications.filter((application) => applicationBucketFor(application) === bucket).length;
}

function buildMetrics(state: Pick<CareerOSState, "applications" | "events" | "reminders" | "reviewItems">): AnalyticsMetrics {
  const applications = state.applications;
  const events = state.events;
  return {
    applicationsCount: applications.length,
    uniqueCompanies: new Set(applications.map((application) => normalizeDimension(application.company)).filter(Boolean)).size,
    rolesCount: new Set(applications.map((application) => normalizeDimension(application.role)).filter(Boolean)).size,
    replyRate: toPercent(applications.filter((application) => hasReply(application, events)).length, applications.length),
    interviewRate: toPercent(applications.filter((application) => hasInterview(application, events)).length, applications.length),
    offerRate: toPercent(applications.filter((application) => hasOffer(application, events)).length, applications.length),
    weeklyApplicationCount: weeklyApplicationCount(applications, events),
    followUpLoad: state.reminders.filter((reminder) => reminder.status === "open" && reminder.type === "follow_up").length,
    reviewBlockedCount: state.reviewItems.filter((review) => review.status === "open").length,
    waitingCount: bucketCount(applications, "waiting"),
    ghostedCount: bucketCount(applications, "ghosted"),
    completedReminderCount: state.reminders.filter((reminder) => reminder.status === "done").length,
    dismissedReminderCount: state.reminders.filter((reminder) => reminder.status === "dismissed").length,
    avgTimeToFirstResponseHours: averageHours(applications.map((application) => hoursToFirstResponse(application, events)))
  };
}

function buildBreakdown(
  applications: Application[],
  events: ApplicationEvent[],
  selector: (application: Application) => string
): AnalyticsBreakdownItem[] {
  const groups = new Map<string, Application[]>();
  for (const application of applications) {
    const key = normalizeDimension(selector(application));
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), application]);
  }

  return [...groups.entries()]
    .map(([key, values]) => {
      const label = values
        .map(selector)
        .map((value) => value.trim())
        .sort((left, right) => left.localeCompare(right))[0];
      return {
        label: label || key,
        ...buildMetrics({ applications: values, events, reminders: [], reviewItems: [] })
      };
    })
    .sort((left, right) => right.applicationsCount - left.applicationsCount || left.label.localeCompare(right.label));
}

function buildTrends(state: CareerOSState): AnalyticsTrendBucket[] {
  const events = state.events;
  const applicationCreatedAt = new Map(state.applications.map((application) => [application.id, createdAtFor(application, events)]));
  const periods = new Set<string>();
  for (const createdAt of applicationCreatedAt.values()) {
    periods.add(weekStartIso(createdAt));
  }
  for (const event of events) {
    periods.add(weekStartIso(event.createdAt));
  }
  for (const review of state.reviewItems) {
    periods.add(weekStartIso(review.createdAt));
  }

  return [...periods]
    .filter((period) => period !== "unknown")
    .sort()
    .map((periodStart) => {
      const applicationsInPeriod = state.applications.filter((application) => weekStartIso(applicationCreatedAt.get(application.id) ?? application.updatedAt) === periodStart);
      const eventsInPeriod = events.filter((event) => weekStartIso(event.createdAt) === periodStart);
      const replies = state.applications.filter((application) => {
        const responseAt = firstResponseAtFor(application, events);
        return responseAt ? weekStartIso(responseAt) === periodStart : false;
      }).length;
      const interviews = eventsInPeriod.filter((event) => interviewEventTypes.has(event.type)).length;
      const offers = eventsInPeriod.filter((event) => event.type === "offer").length;
      const reviewBlockedCount = state.reviewItems.filter((review) => review.status === "open" && weekStartIso(review.createdAt) === periodStart).length;
      return {
        periodStart,
        applicationsCreated: applicationsInPeriod.length,
        replies,
        interviews,
        offers,
        replyRate: toPercent(replies, applicationsInPeriod.length),
        interviewRate: toPercent(interviews, applicationsInPeriod.length),
        offerRate: toPercent(offers, applicationsInPeriod.length),
        reviewBlockedCount,
        waitingCount: applicationsInPeriod.filter((application) => applicationBucketFor(application) === "waiting").length,
        ghostedCount: applicationsInPeriod.filter((application) => applicationBucketFor(application) === "ghosted").length,
        avgTimeToFirstResponseHours: averageHours(applicationsInPeriod.map((application) => hoursToFirstResponse(application, events)))
      };
    });
}

export function deriveAnalyticsSummary(state: CareerOSState): AnalyticsSummary {
  const applications = state.applications;
  const metrics = buildMetrics(state);
  return {
    metrics,
    companyBreakdown: buildBreakdown(applications, state.events, (application) => application.company),
    roleBreakdown: buildBreakdown(applications, state.events, (application) => application.role),
    statusBuckets: buildStatusBuckets(applications),
    trends: buildTrends(state),
    audit: {
      total: state.auditEvents.length,
      recent: state.auditEvents.slice(0, 10)
    }
  };
}
