import Link from "next/link";
import {
  applications,
  attentionItems,
  dashboardMetrics,
  emptyWorkspaceActions,
  formatDateTime,
  notifications,
  stageCounts,
} from "@/lib/demo-data";
import { OperatingStatusPanel, StateMatrix } from "@/components/state-panels";
import { MetricTile, PageHeader, SectionHeader, StatusPill } from "@/components/ui";

export default function DashboardPage() {
  const recentChanges = applications.flatMap((application) =>
    application.timeline.slice(0, 2).map((event) => ({
      ...event,
      application,
    })),
  );

  return (
    <main className="content">
      <PageHeader
        eyebrow="Command center"
        title="Local recruiting pipeline"
        description="A working CareerOS dashboard with seeded demo data, optional Gmail, optional Gemma/Ollama, explicit review gates, and local-first setup states."
        action={
          <>
            <Link href="/applications" className="button secondary">
              Open applications
            </Link>
            <Link href="/settings" className="button">
              Setup checks
            </Link>
          </>
        }
      />

      <section className="grid-6" aria-label="Pipeline summary">
        {dashboardMetrics.map((metric) => (
          <MetricTile key={metric.label} {...metric} />
        ))}
      </section>

      <section className="ops-board">
        <OperatingStatusPanel />
        <section className="section">
          <SectionHeader eyebrow="Designed states" title="First-run, offline, model, Gmail, review, resume" />
          <StateMatrix limit={9} />
        </section>
      </section>

      <section className="grid-2">
        <div className="section">
          <SectionHeader eyebrow="Needs attention" title="Blocked, due, or unconfigured" />
          <div className="scroll-list">
            {attentionItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} href={item.href} className="row-card">
                  <div className="row-top">
                    <StatusPill tone={item.tone}>
                      <Icon size={14} aria-hidden="true" />
                      {item.title}
                    </StatusPill>
                    <span className="small muted">next action</span>
                  </div>
                  <p className="small muted">{item.detail}</p>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="section">
          <SectionHeader eyebrow="Notification window" title="Current local signals" />
          <div className="scroll-list">
            {notifications.map((item) => (
              <article key={item.id} className="row-card">
                <div className="row-top">
                  <StatusPill tone={item.severity}>{item.status}</StatusPill>
                  <span className="small muted">{formatDateTime(item.timestamp)}</span>
                </div>
                <h3>{item.message}</h3>
                <p className="small muted">{item.source}</p>
                <Link href={item.destination} className="button secondary">
                  {item.destinationLabel}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid-2">
        <div className="section">
          <SectionHeader eyebrow="Recent recruiting changes" title="Evidence before automation" />
          <div className="scroll-list">
            {recentChanges.map((event) => (
              <Link
                key={event.id}
                href={`/applications/${event.application.id}`}
                className="row-card"
              >
                <div className="row-top">
                  <div>
                    <h3>{event.title}</h3>
                    <p className="small muted">
                      {event.application.company} · {event.application.role}
                    </p>
                  </div>
                  {typeof event.confidence === "number" ? (
                    <StatusPill tone={event.confidence > 0.8 ? "good" : "warn"}>
                      {event.confidence.toFixed(2)}
                    </StatusPill>
                  ) : (
                    <StatusPill>local</StatusPill>
                  )}
                </div>
                <p className="small muted">
                  {formatDateTime(event.timestamp)} · {event.source}
                </p>
              </Link>
            ))}
          </div>
        </div>

        <div className="section">
          <SectionHeader eyebrow="Stage overview" title="Application distribution" />
          <div className="list">
            {stageCounts.map((stage) => (
              <div key={stage.stage} className="row-card">
                <div className="inline-between">
                  <h3>{stage.stage}</h3>
                  <StatusPill tone={stage.count > 0 ? "info" : "neutral"}>
                    {stage.count}
                  </StatusPill>
                </div>
                <div
                  aria-hidden="true"
                  style={{
                    height: 8,
                    marginTop: 12,
                    borderRadius: 999,
                    background: "var(--surface-muted)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(8, stage.count * 32)}%`,
                      height: "100%",
                      background: "var(--blue)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <SectionHeader
          eyebrow="Empty workspace state"
          title="Useful local actions before Gmail or Ollama"
        />
        <div className="empty-preview">
          <div className="inline-between">
            <div>
              <h3>Empty workspace preview</h3>
              <p className="small muted">
                No blank surface: seeded demo, JSON import, manual application, resume paste,
                setup check, and Gmail skip actions stay visible.
              </p>
            </div>
            <StatusPill tone="neutral">Gmail optional</StatusPill>
          </div>
        </div>
        <div className="grid-3">
          {emptyWorkspaceActions.map((action) => {
            const Icon = action.icon;
            return (
              <article key={action.label} className="action-tile">
                <StatusPill tone="neutral">
                  <Icon size={14} aria-hidden="true" />
                  local
                </StatusPill>
                <h3 style={{ marginTop: 12 }}>{action.label}</h3>
                <p className="small muted">{action.detail}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
