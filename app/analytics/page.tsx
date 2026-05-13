import { deriveAnalyticsSummary } from "@/lib/analytics";
import { readServerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

function pct(value: number) {
  return `${value}%`;
}

function hours(value: number | null) {
  if (value === null) return "waiting";
  const days = Math.floor(value / 24);
  const remaining = Math.round(value % 24);
  return days ? `${days}d ${remaining}h` : `${Math.round(value)}h`;
}

function bar(value: number, tone: "blue" | "green" = "blue") {
  return (
    <span className="analytics-bar" aria-hidden="true">
      <span className={tone} style={{ width: `${Math.min(Math.max(value, 2), 100)}%` }} />
    </span>
  );
}

export default async function AnalyticsPage() {
  const state = await readServerState();
  const summary = deriveAnalyticsSummary(state);
  const workspaceEmpty = state.applications.length === 0;
  const companyRows = summary.companyBreakdown.slice(0, 12);
  const roleRows = summary.roleBreakdown.slice(0, 8);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weeklyApplications = state.applications.filter((application) => new Date(application.updatedAt) >= weekAgo).length;
  const followUpLoad = state.reminders.filter((reminder) => reminder.type === "follow_up" && reminder.status === "open").length;
  const reviewBlockedUpdates = state.reviewItems.filter((item) => item.status === "open").length;
  const insights = workspaceEmpty
    ? [
        "No conversion data yet because the workspace is clean.",
        "Connect Gmail and sync recruiting mail to populate the funnel.",
        "Review-gated updates will feed reply, interview, offer, and follow-up metrics."
      ]
    : [
        `${companyRows.filter((row) => row.applicationsCount > 1 && row.interviewRate === 0).length} company groups have volume but no interviews`,
        `${state.applications.filter((item) => item.role.toLowerCase().includes("unknown")).length} applications need role cleanup`,
        `Average first reply is ${hours(summary.metrics.avgTimeToFirstResponseHours)} across workspace evidence`
      ];

  return (
    <main className="app-scroll-main">
      <div className="workspace-shell analytics-workspace mx-auto flex w-full max-w-[104rem] flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6">
        <section className="card app-workspace-panel p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="eyebrow">Analytics</p>
              <h1 className="mt-2 text-base font-semibold text-[var(--text-primary)] sm:text-xl">
                Which applications are converting?
              </h1>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                As of {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date())}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={workspaceEmpty ? "badge" : "badge ok"}>{workspaceEmpty ? "Clean workspace" : "Live"}</span>
              <span className="badge info">Avg 1st reply {hours(summary.metrics.avgTimeToFirstResponseHours)}</span>
              <span className="badge">All time</span>
              <span className="badge">Workspace data</span>
            </div>
          </div>
        </section>

        {workspaceEmpty ? (
          <section className="card app-workspace-panel p-4 sm:p-5">
            <div className="section-title">
              <div>
                <p className="eyebrow">Analytics setup</p>
                <h2>Sync Gmail before reading conversion metrics</h2>
                <p className="subtle">
                  The analytics page intentionally starts empty. Once Gmail recruiting mail creates application records,
                  the same evidence-backed state will power reply rate, interview rate, offer rate, stale follow-ups,
                  and review-blocked counts.
                </p>
              </div>
              <span className="badge info">0 applications</span>
            </div>
            <div className="actions">
              <a className="button primary" href="/settings?section=gmail">Connect Gmail</a>
              <a className="button secondary" href="/judge-demo">Inspect judge demo</a>
            </div>
          </section>
        ) : null}

        <section className="card app-workspace-panel operational-metrics p-4 sm:p-5">
          <div>
            <p className="eyebrow">Operational metrics</p>
            <h2 className="mt-2 text-base font-semibold text-[var(--text-primary)]">Inbox-to-pipeline health</h2>
          </div>
          <div className="operational-metric-grid">
            {[
              ["Reply rate", pct(summary.metrics.replyRate), "Responses from recruiting evidence"],
              ["Interview rate", pct(summary.metrics.interviewRate), "Assessment/interview conversion"],
              ["Weekly apps", weeklyApplications, "Recently touched applications"],
              ["Follow-up load", followUpLoad, "Open reminders that still matter"],
              ["Review blocked", reviewBlockedUpdates, "Model/rules output waiting for review"]
            ].map(([label, value, note]) => (
              <article className="metric-filter" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{note}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.85fr)]">
          <article className="card app-workspace-panel p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Funnel</p>
                <h2 className="mt-2 text-base font-semibold text-[var(--text-primary)]">
                  Applied - Reply - Interview - Offer
                </h2>
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">
                Reply {pct(summary.metrics.replyRate)} - interview {pct(summary.metrics.interviewRate)}
              </p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-5">
              {[
                ["Applied", summary.metrics.applicationsCount, 100, "baseline"],
                ["Any response", Math.round((summary.metrics.replyRate / 100) * summary.metrics.applicationsCount), summary.metrics.replyRate, "advance"],
                ["Interview", Math.round((summary.metrics.interviewRate / 100) * summary.metrics.applicationsCount), summary.metrics.interviewRate, "advance"],
                ["Offer", Math.round((summary.metrics.offerRate / 100) * summary.metrics.applicationsCount), summary.metrics.offerRate, "advance"],
                ["Companies", summary.metrics.uniqueCompanies, 100, "tracked"]
              ].map(([label, count, percent, note]) => (
                <div className="analytics-funnel-card" key={label}>
                  <span>{label}</span>
                  <strong>{count}</strong>
                  {bar(Number(percent), label === "Offer" ? "green" : "blue")}
                  <small>{pct(Number(percent))} {note}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="card app-workspace-panel p-4 sm:p-5">
            <div className="section-title">
              <div>
                <p className="eyebrow">Insights</p>
              </div>
              <span className="badge info">{insights.length}</span>
            </div>
            <div className="mt-4 divide-y divide-[var(--border)]">
              {insights.map((insight, index) => (
                <div className="flex gap-3 py-3" key={insight}>
                  <span className={`mt-1.5 h-2 w-2 rounded-full ${index === 2 ? "bg-[var(--text-tertiary)]" : "bg-[var(--blue)]"}`} />
                  <p className="text-sm font-semibold leading-6 text-[var(--text-primary)]">{insight}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <AnalyticsTable title="Companies" count={summary.metrics.uniqueCompanies} rows={companyRows} />
          <AnalyticsTable title="Roles" count={summary.metrics.rolesCount} rows={roleRows} />
        </section>
      </div>
    </main>
  );
}

function AnalyticsTable({
  title,
  count,
  rows
}: {
  title: string;
  count: number;
  rows: Array<{
    label: string;
    applicationsCount: number;
    replyRate: number;
    interviewRate: number;
    offerRate: number;
  }>;
}) {
  return (
    <article className="card app-workspace-panel overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <p className="eyebrow">{title}</p>
        <span className="badge info">{count}</span>
      </div>
      <div className="table-wrap border-0">
        <table className="data-table analytics-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Apps</th>
              <th>Reply</th>
              <th>Interview</th>
              <th>Offer</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={row.label}>
                <td><strong>{row.label}</strong></td>
                <td>{row.applicationsCount}</td>
                <td>{bar(row.replyRate)} {pct(row.replyRate)}</td>
                <td>{bar(row.interviewRate)} {pct(row.interviewRate)}</td>
                <td>{bar(row.offerRate, "green")} {pct(row.offerRate)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">No rows yet. Sync Gmail or import records to populate this breakdown.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
