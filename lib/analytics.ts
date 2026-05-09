import type { Application, ApplicationEvent, CareerOSState } from "./types";

export interface AnalyticsMetrics {
  applicationsCount: number;
  uniqueCompanies: number;
  rolesCount: number;
  replyRate: number;
  interviewRate: number;
  offerRate: number;
  avgTimeToFirstResponseHours: number | null;
}

export interface AnalyticsBreakdownItem extends AnalyticsMetrics {
  label: string;
}

export interface AnalyticsSummary {
  metrics: AnalyticsMetrics;
  companyBreakdown: AnalyticsBreakdownItem[];
  roleBreakdown: AnalyticsBreakdownItem[];
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

  const firstResponse = events
    .filter((event) => event.applicationId === application.id)
    .filter((event) => replyEventTypes.has(event.type))
    .filter((event) => new Date(event.createdAt).getTime() > createdAt)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
  if (!firstResponse) return null;

  const elapsed = new Date(firstResponse.createdAt).getTime() - createdAt;
  return elapsed >= 0 ? Number((elapsed / 36e5).toFixed(1)) : null;
}

function hasReply(application: Application, events: ApplicationEvent[]) {
  return application.stage !== "applied" || events.some((event) => event.applicationId === application.id && replyEventTypes.has(event.type));
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

function buildMetrics(applications: Application[], events: ApplicationEvent[]): AnalyticsMetrics {
  return {
    applicationsCount: applications.length,
    uniqueCompanies: new Set(applications.map((application) => normalizeDimension(application.company)).filter(Boolean)).size,
    rolesCount: new Set(applications.map((application) => normalizeDimension(application.role)).filter(Boolean)).size,
    replyRate: toPercent(applications.filter((application) => hasReply(application, events)).length, applications.length),
    interviewRate: toPercent(applications.filter((application) => hasInterview(application, events)).length, applications.length),
    offerRate: toPercent(applications.filter((application) => hasOffer(application, events)).length, applications.length),
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
        ...buildMetrics(values, events)
      };
    })
    .sort((left, right) => right.applicationsCount - left.applicationsCount || left.label.localeCompare(right.label));
}

export function deriveAnalyticsSummary(state: CareerOSState): AnalyticsSummary {
  const applications = state.applications;
  const metrics = buildMetrics(applications, state.events);
  return {
    metrics,
    companyBreakdown: buildBreakdown(applications, state.events, (application) => application.company),
    roleBreakdown: buildBreakdown(applications, state.events, (application) => application.role)
  };
}
