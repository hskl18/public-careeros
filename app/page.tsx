import Link from "next/link";
import { checkOllamaStatus } from "@/lib/model-status";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

function dateLabel(value?: string) {
  return value ? new Date(value).toLocaleDateString() : "not set";
}

function severityClass(severity: string) {
  if (severity === "critical") return "badge danger";
  if (severity === "warning") return "badge warn";
  return "badge info";
}

export default async function DashboardPage() {
  const [state, modelStatus] = await Promise.all([readState(), checkOllamaStatus()]);
  const openReviews = state.reviewItems.filter((item) => item.status === "open");
  const activeApplications = state.applications.filter((item) => !["rejected", "offer"].includes(item.stage));
  const unreadNotifications = state.notifications.filter((item) => item.status === "unread");
  const latestEvents = state.events.slice(0, 6);
  const connector = state.connectorAccounts.find((item) => item.provider === "gmail");
  const dueSoon = state.reminders.filter((item) => item.status === "open");
  const recruiterReplies = state.applications.filter((item) => item.stage === "recruiter_reply");

  const stageCounts = ["wishlist", "applied", "recruiter_reply", "assessment", "interview", "offer", "rejected"].map(
    (stage) => ({
      stage,
      count: state.applications.filter((application) => application.stage === stage).length
    })
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Command center</p>
          <h1>Operational job pipeline</h1>
          <p className="subtle">
            Local-first CareerOS starts with seeded data, deterministic processing, explicit review gates, notification
            routing, resume analysis, optional Gmail, and optional Ollama/Gemma.
          </p>
        </div>
        <div className="actions">
          <form action="/api/process" method="post">
            <button className="button" type="submit">
              Run local processing
            </button>
          </form>
          <Link className="button secondary" href="/settings">
            Setup
          </Link>
        </div>
      </header>

      <section className="section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Pipeline health</p>
            <h2>Daily operating snapshot</h2>
          </div>
        </div>
        <div className="grid six">
          {[
            ["Applications", state.applications.length, "seed/manual/import"],
            ["Active", activeApplications.length, "not rejected or offer"],
            ["Needs review", openReviews.length, "blocked automation"],
            ["Due soon", dueSoon.length, "open reminders"],
            ["Recruiter replies", recruiterReplies.length, "detected replies"],
            ["Unread", unreadNotifications.length, "notification window"]
          ].map(([label, value, hint]) => (
            <article className="card metric" key={label}>
              <span className="eyebrow">{label}</span>
              <strong>{value}</strong>
              <span className="subtle">{hint}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="grid two">
        <section className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Needs attention</p>
              <h2>Blocking or time-sensitive work</h2>
            </div>
            <Link className="badge warn" href="/review">
              {openReviews.length} review
            </Link>
          </div>
          <div className="scroll-list">
            {state.notifications
              .filter((item) => item.status !== "dismissed")
              .slice(0, 6)
              .map((notification) => (
                <Link className="tile" href={notification.href} key={notification.id}>
                  <div className="inline-between">
                    <strong>{notification.title}</strong>
                    <span className={severityClass(notification.severity)}>{notification.severity}</span>
                  </div>
                  <p className="subtle">{notification.body}</p>
                </Link>
              ))}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Notification window</p>
              <h2>Derived local signals</h2>
            </div>
            <Link className="button secondary" href="/notifications">
              Open all
            </Link>
          </div>
          <div className="list">
            {unreadNotifications.slice(0, 4).map((notification) => (
              <div className="row" key={notification.id}>
                <span>
                  <strong>{notification.title}</strong>
                  <span className="subtle"> · {notification.sourceType}</span>
                </span>
                <Link className={severityClass(notification.severity)} href={notification.href}>
                  {notification.status}
                </Link>
              </div>
            ))}
            {unreadNotifications.length === 0 ? (
              <p className="subtle">No unread notifications. Reviewed and dismissed rows remain in history.</p>
            ) : null}
          </div>
        </section>
      </section>

      <section className="grid two">
        <section className="section">
          <p className="eyebrow">Recent changes</p>
          <h2>Evidence-backed updates</h2>
          <div className="scroll-list">
            {latestEvents.map((event) => {
              const application = state.applications.find((item) => item.id === event.applicationId);
              return (
                <Link className="event" href={`/applications#${event.applicationId}`} key={event.id}>
                  <strong>{event.summary}</strong>
                  <p className="subtle">
                    {application?.company ?? "Application"} · {event.source} · confidence {event.confidence}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="section">
          <p className="eyebrow">Local setup status</p>
          <h2>Model status, data, and optional connector</h2>
          <div className="state-matrix">
            <div className="state-cell">
              <span className="badge ok">first run</span>
              <p className="subtle">Seeded demo data is loaded automatically when the local state file is empty.</p>
            </div>
            <div className="state-cell">
              <span className={modelStatus.status === "ready" ? "badge ok" : "badge warn"}>
                {modelStatus.status}
              </span>
              <p className="subtle">{modelStatus.diagnostic}</p>
            </div>
            <div className="state-cell">
              <span className="badge info">{connector?.status ?? "disconnected"}</span>
              <p className="subtle">Gmail is optional. Local use is unaffected when it is not connected.</p>
            </div>
            <div className="state-cell">
              <span className="badge warn">model missing</span>
              <p className="subtle">Settings shows the pull command without triggering a large download.</p>
            </div>
            <div className="state-cell">
              <span className="badge danger">Ollama unreachable</span>
              <p className="subtle">The dashboard stays deterministic-only and routes risky output to review.</p>
            </div>
            <div className="state-cell">
              <span className="badge ok">model ready</span>
              <p className="subtle">Ready state is supported when the bounded health prompt passes.</p>
            </div>
          </div>
        </section>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Stage overview</p>
            <h2>Pipeline distribution</h2>
          </div>
          <Link className="button secondary" href="/applications">
            Open applications
          </Link>
        </div>
        <div className="grid three">
          {stageCounts.map((item) => (
            <div className="tile" key={item.stage}>
              <div className="inline-between">
                <strong>{item.stage.replace("_", " ")}</strong>
                <span className={item.count > 0 ? "badge info" : "badge"}>{item.count}</span>
              </div>
              <p className="subtle">Next local deadline: {dateLabel(state.applications.find((app) => app.stage === item.stage)?.deadlineAt)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
