import Link from "next/link";
import { checkServerOllamaStatus, readServerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

function dateLabel(value?: string) {
  if (!value) return "not set";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function timeLabel(value?: string) {
  if (!value) return "waiting";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric" }).format(new Date(value));
}

function severityClass(severity: string) {
  if (severity === "critical") return "badge danger";
  if (severity === "warning") return "badge warn";
  return "badge info";
}

function stageBadge(stage: string) {
  if (stage === "interview" || stage === "offer") return "badge ok";
  if (stage === "assessment" || stage === "recruiter_reply") return "badge warn";
  if (stage === "rejected") return "badge danger";
  return "badge info";
}

function stageLabel(stage: string) {
  return stage.replace("_", " ");
}

export default async function DashboardPage() {
  const [state, modelStatus] = await Promise.all([readServerState(), checkServerOllamaStatus()]);
  const openReviews = state.reviewItems.filter((item) => item.status === "open");
  const activeApplications = state.applications.filter((item) => !["rejected", "offer"].includes(item.stage));
  const unreadNotifications = state.notifications.filter((item) => item.status === "unread");
  const latestEvents = state.events.slice(0, 5);
  const connector = state.connectorAccounts.find((item) => item.provider === "gmail");
  const dueSoon = state.reminders.filter((item) => item.status === "open");
  const recruiterReplies = state.applications.filter((item) => item.stage === "recruiter_reply");
  const latestTrace = state.modelTraces[0];
  const inboxStatus = connector?.status ?? "disconnected";
  const latestImport = state.importJobs[0];

  const stageCounts = ["wishlist", "applied", "recruiter_reply", "assessment", "interview", "offer", "rejected"].map(
    (stage) => ({
      stage,
      count: state.applications.filter((application) => application.stage === stage).length
    })
  );

  const sourceCards = [
    {
      label: "Local seed/import",
      value: latestImport ? latestImport.status : "ready",
      detail: latestImport ? `${latestImport.source} source · ${latestImport.attempts} attempt` : "Provider-free path"
    },
    {
      label: "Optional Gmail",
      value: inboxStatus,
      detail: connector?.message ?? "Placeholder only until safe credentials exist"
    },
    {
      label: "Model analysis",
      value: modelStatus.status,
      detail: modelStatus.status === "ready" ? `${modelStatus.modelTag} ready` : "Deterministic fallback active"
    }
  ];

  return (
    <div className="page dashboard-page">
      <section className="dashboard-hero-grid">
        <header className="dashboard-hero">
          <div className="hero-copy">
            <p className="eyebrow">CareerOS local workspace</p>
            <h1>Local pipeline control tower</h1>
            <p className="subtle hero-subtitle">
              Inbox signals, local imports, review blocks, next actions, and connector state stay visible in one
              provider-free workspace.
            </p>
          </div>

          <div className="hero-actions">
            <form action="/api/process" method="post">
              <button className="button" type="submit">
                Run local processing
              </button>
            </form>
            <Link className="button secondary" href="/review">
              Review blockers
            </Link>
            <Link className="button secondary" href="/applications#import">
              Import evidence
            </Link>
          </div>

          <div className="metric-strip">
            {[
              ["Pipeline", state.applications.length, "tracked applications"],
              ["Active loops", activeApplications.length, "not closed"],
              ["Needs review", openReviews.length, "blocked automation"],
              ["Next actions", dueSoon.length, "open reminders"],
              ["Replies", recruiterReplies.length, "recruiter signals"],
              ["Unread", unreadNotifications.length, "notification window"]
            ].map(([label, value, hint]) => (
              <article className="card metric" key={label}>
                <span className="eyebrow">{label}</span>
                <strong>{value}</strong>
                <span className="subtle">{hint}</span>
              </article>
            ))}
          </div>
        </header>

        <aside className="inbox-panel">
          <p className="eyebrow">Signal intake</p>
          <div className="inbox-address">
            <span>Primary source</span>
            <strong>{inboxStatus === "connected" ? "Gmail" : "Local"}</strong>
          </div>
          <div className="inbox-stats">
            <div>
              <span>Connector</span>
              <strong>{inboxStatus}</strong>
            </div>
            <div>
              <span>Review gate</span>
              <strong>{openReviews.length}</strong>
            </div>
          </div>
          <div className="inbox-sync">
            <span className={modelStatus.status === "ready" ? "badge ok" : "badge warn"}>{modelStatus.status}</span>
            <p>{modelStatus.diagnostic}</p>
          </div>
          <div className="inbox-sync">
            <span className="badge info">{latestTrace?.provider ?? "deterministic"}</span>
            <p>{latestTrace?.diagnostic ?? "No model trace has been recorded yet."}</p>
          </div>
        </aside>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Source readiness</p>
            <h2>Provider-free first, optional connectors after</h2>
          </div>
          <Link className="button secondary" href="/settings">
            Runtime settings
          </Link>
        </div>
        <div className="grid three">
          {sourceCards.map((card) => (
            <article className="tile signal-card" key={card.label}>
              <span className="label">{card.label}</span>
              <strong>{card.value}</strong>
              <p className="subtle">{card.detail}</p>
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
            <Link className={openReviews.length ? "badge warn" : "badge ok"} href="/review">
              {openReviews.length} review
            </Link>
          </div>
          <div className="scroll-list">
            {state.notifications
              .filter((item) => item.status !== "dismissed")
              .slice(0, 6)
              .map((notification) => (
                <Link className="tile attention-tile" href={notification.href} key={notification.id}>
                  <div className="inline-between">
                    <strong>{notification.title}</strong>
                    <span className={severityClass(notification.severity)}>{notification.severity}</span>
                  </div>
                  <p className="subtle">{notification.body}</p>
                  <span className="label">
                    {notification.sourceType} · {timeLabel(notification.createdAt)}
                  </span>
                </Link>
              ))}
            {state.notifications.filter((item) => item.status !== "dismissed").length === 0 ? (
              <div className="empty-state">No active notifications. Review blocks and reminders will appear here.</div>
            ) : null}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Application pipeline</p>
              <h2>Current tracked loops</h2>
            </div>
            <Link className="button secondary" href="/applications">
              Open all
            </Link>
          </div>
          <div className="list">
            {state.applications.slice(0, 4).map((application) => {
              const event = state.events.find((item) => item.applicationId === application.id);
              const evidence = state.evidenceSnippets.filter((item) => item.applicationId === application.id);
              const review = openReviews.find((item) => item.proposedChange.applicationId === application.id);
              return (
                <Link className="tile application-mini" href={`/applications#${application.id}`} key={application.id}>
                  <div className="inline-between">
                    <div>
                      <strong>{application.company}</strong>
                      <p className="subtle">{application.role}</p>
                    </div>
                    <span className={stageBadge(application.stage)}>{stageLabel(application.stage)}</span>
                  </div>
                  <p className="subtle">{event?.summary ?? "Waiting for local activity"}</p>
                  <div className="mini-meta">
                    <span>{evidence.length} evidence</span>
                    <span>{review ? "review blocked" : "review clear"}</span>
                    <span>next {dateLabel(application.followUpAt ?? application.deadlineAt)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </section>

      <section className="dashboard-masonry">
        <div className="dashboard-main-stack">
          <section className="section">
            <p className="eyebrow">Recent changes</p>
            <h2>Evidence-backed updates</h2>
            <div className="timeline">
              {latestEvents.map((event) => {
                const application = state.applications.find((item) => item.id === event.applicationId);
                return (
                  <Link className="timeline-item" href={`/applications#${event.applicationId}`} key={event.id}>
                    <span className="timeline-dot" />
                    <strong>{event.summary}</strong>
                    <p className="subtle">
                      {application?.company ?? "Application"} · {event.source} · confidence {Math.round(event.confidence * 100)}%
                    </p>
                  </Link>
                );
              })}
            </div>
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
            <div className="stage-board">
              {stageCounts.map((item) => (
                <div className="tile stage-card" key={item.stage}>
                  <div className="inline-between">
                    <strong>{stageLabel(item.stage)}</strong>
                    <span className={item.count > 0 ? "badge info" : "badge"}>{item.count}</span>
                  </div>
                  <p className="subtle">
                    Next local deadline: {dateLabel(state.applications.find((app) => app.stage === item.stage)?.deadlineAt)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="section">
          <p className="eyebrow">Runtime state</p>
          <h2>Model, connector, and review boundaries</h2>
          <div className="state-matrix single">
            <div className="state-cell">
              <span className={modelStatus.status === "ready" ? "badge ok" : "badge warn"}>{modelStatus.status}</span>
              <strong>{modelStatus.status === "ready" ? "Model-backed checks available" : "Deterministic-only path active"}</strong>
              <small>{modelStatus.diagnostic}</small>
            </div>
            <div className="state-cell">
              <span className={inboxStatus === "connected" ? "badge ok" : "badge info"}>{inboxStatus}</span>
              <strong>{connector?.label ?? "Gmail connector optional"}</strong>
              <small>{connector?.message ?? "Local imports, seeded data, and manual records work without Gmail."}</small>
            </div>
            <div className="state-cell">
              <span className={openReviews.length ? "badge warn" : "badge ok"}>{openReviews.length} open</span>
              <strong>Review gate</strong>
              <small>Low-confidence or risky mutations wait for explicit user confirmation.</small>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
