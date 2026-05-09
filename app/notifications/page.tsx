import Link from "next/link";
import { readServerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

const NOTIFICATION_ROW_LIMIT = 50;

function severityBadge(severity: string) {
  if (severity === "critical") return "badge danger";
  if (severity === "warning") return "badge warn";
  return "badge info";
}

function statusBadge(status: string) {
  if (status === "unread") return "badge warn";
  if (status === "dismissed") return "badge";
  return "badge ok";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric" }).format(new Date(value));
}

function sourceLabel(sourceType: string) {
  if (sourceType === "review") return "Review blocker";
  if (sourceType === "reminder") return "Next action";
  if (sourceType === "connector") return "Connector health";
  if (sourceType === "settings") return "Runtime status";
  return sourceType;
}

export default async function NotificationsPage() {
  const state = await readServerState();
  const unread = state.notifications.filter((notification) => notification.status === "unread");
  const dismissed = state.notifications.filter((notification) => notification.status === "dismissed");
  const critical = state.notifications.filter((notification) => notification.severity === "critical");
  const active = state.notifications.filter((notification) => notification.status !== "dismissed");
  const connector = state.connectorAccounts[0];
  const visibleNotifications = state.notifications.slice(0, NOTIFICATION_ROW_LIMIT);

  return (
    <div className="page notifications-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Notifications</p>
          <h1>Action window</h1>
          <p className="subtle">
            Notifications turn review blocks, reminders, model status, connector state, and application updates into one
            operating queue with links back to the owning surface.
          </p>
        </div>
        <div className="header-stack">
          <span className={unread.length ? "badge warn" : "badge ok"}>{unread.length} unread</span>
          <span className={critical.length ? "badge danger" : "badge ok"}>{critical.length} critical</span>
          <span className="badge">{dismissed.length} dismissed</span>
        </div>
      </header>

      <section className="grid four">
        {[
          ["Active queue", active.length, "Rows that still need attention"],
          ["Review links", state.notifications.filter((item) => item.sourceType === "review").length, "Automation blockers"],
          ["Next actions", state.notifications.filter((item) => item.sourceType === "reminder").length, "Follow-ups and deadlines"],
          ["Connector", connector?.status ?? "not_configured", "Gmail remains optional"]
        ].map(([label, value, detail]) => (
          <article className="card metric compact-metric" key={label}>
            <span className="eyebrow">{label}</span>
            <strong>{value}</strong>
            <span className="subtle">{detail}</span>
          </article>
        ))}
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Operating states</p>
            <h2>What can appear here</h2>
          </div>
        </div>
        <div className="state-matrix">
          <div className="state-cell">
            <span className="label">Recruiter reply detected</span>
            <strong>{state.notifications.some((item) => item.title.toLowerCase().includes("reply")) ? "Visible" : "Waiting"}</strong>
            <small>Reply notifications route into the owning application timeline.</small>
          </div>
          <div className="state-cell">
            <span className="label">Deadline due soon</span>
            <strong>
              {state.notifications.some((item) => item.sourceType === "reminder" || item.title.toLowerCase().includes("deadline"))
                ? "Visible"
                : "Clear"}
            </strong>
            <small>Reminder and deadline rows stay visible until reviewed or dismissed.</small>
          </div>
          <div className="state-cell">
            <span className="label">Connector health</span>
            <strong>{connector?.status ?? "not_configured"}</strong>
            <small>Optional Gmail status stays separate from local-only processing.</small>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Queue</p>
            <h2>Notification rows</h2>
            <p className="subtle">
              Showing {visibleNotifications.length} of {state.notifications.length}. Sorted by derivation time with the
              next action kept in row.
            </p>
          </div>
          {state.notifications.length > visibleNotifications.length ? (
            <span className="badge info">+{state.notifications.length - visibleNotifications.length} older</span>
          ) : null}
        </div>
        {state.notifications.length ? (
          <div className="notification-list">
            {visibleNotifications.map((notification) => (
              <article className="notification-row" id={notification.id} key={notification.id}>
                <div className="notification-main">
                  <div className="row split">
                    <div>
                      <p className="eyebrow">{sourceLabel(notification.sourceType)}</p>
                      <Link href={notification.href}>
                        <strong>{notification.title}</strong>
                      </Link>
                      <p className="subtle">{notification.body}</p>
                    </div>
                    <div className="badge-group">
                      <span className={severityBadge(notification.severity)}>{notification.severity}</span>
                      <span className={statusBadge(notification.status)}>{notification.status}</span>
                    </div>
                  </div>
                  <div className="mini-meta">
                    <span>{notification.sourceType}</span>
                    <span>{dateLabel(notification.createdAt)}</span>
                    <span>{notification.dedupeKey}</span>
                  </div>
                </div>
                <div className="actions notification-actions">
                  <Link className="button secondary" href={notification.href}>
                    Open source
                  </Link>
                  <form action={`/api/notifications/${notification.id}`} method="post">
                    <input name="intent" type="hidden" value="read" />
                    <button className="button secondary" type="submit">
                      Mark read
                    </button>
                  </form>
                  <form action={`/api/notifications/${notification.id}`} method="post">
                    <input name="intent" type="hidden" value="dismiss" />
                    <button className="button secondary" type="submit">
                      Dismiss
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">No notifications are active. Review, deadline, model, connector, and resume states will appear here.</div>
        )}
      </section>
    </div>
  );
}
