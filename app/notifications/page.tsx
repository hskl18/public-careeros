import Link from "next/link";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

function severityBadge(severity: string) {
  if (severity === "critical") return "badge danger";
  if (severity === "warning") return "badge warn";
  return "badge ok";
}

function statusBadge(status: string) {
  if (status === "unread") return "badge warn";
  if (status === "dismissed") return "badge";
  return "badge ok";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric" }).format(new Date(value));
}

export default async function NotificationsPage() {
  const state = await readState();
  const unread = state.notifications.filter((notification) => notification.status === "unread");
  const dismissed = state.notifications.filter((notification) => notification.status === "dismissed");
  const critical = state.notifications.filter((notification) => notification.severity === "critical");

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Notifications</p>
          <h1>Operational notification window</h1>
          <p className="subtle">
            Every row deep-links to the owning application, review item, resume result, or settings panel.
          </p>
        </div>
        <div className="header-stack">
          <span className={unread.length ? "badge warn" : "badge ok"}>{unread.length} unread</span>
          <span className={critical.length ? "badge danger" : "badge ok"}>{critical.length} critical</span>
          <span className="badge">{dismissed.length} dismissed</span>
        </div>
      </header>

      <section className="state-matrix">
        <div className="state-cell">
          <span className="label">Recruiter reply detected</span>
          <strong>{state.notifications.some((item) => item.title.toLowerCase().includes("reply")) ? "Visible" : "Waiting"}</strong>
          <small>Reply notifications route into the owning application timeline.</small>
        </div>
        <div className="state-cell">
          <span className="label">Deadline due soon</span>
          <strong>{state.notifications.some((item) => item.sourceType === "reminder" || item.title.toLowerCase().includes("deadline")) ? "Visible" : "Clear"}</strong>
          <small>Reminder and deadline rows stay in the main queue until reviewed or dismissed.</small>
        </div>
        <div className="state-cell">
          <span className="label">Notification dismissed or reviewed</span>
          <strong>{dismissed.length || state.notifications.some((item) => item.status === "read") ? "Tracked" : "Ready"}</strong>
          <small>Read and dismiss actions update local notification state without removing the source record.</small>
        </div>
        <div className="state-cell">
          <span className="label">Connector health</span>
          <strong>{state.connectorAccounts[0]?.status ?? "not_configured"}</strong>
          <small>Optional Gmail status stays separate from local-only processing.</small>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <h2>Notification queue</h2>
            <p className="subtle">Sorted by derivation time with action buttons kept in row.</p>
          </div>
        </div>
        {state.notifications.length ? (
          <div className="list notification-list">
            {state.notifications.map((notification) => (
              <article className="notification-row" id={notification.id} key={notification.id}>
                <div className="notification-main">
                  <div className="row split">
                    <div>
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
                  <p className="subtle">
                    {notification.sourceType} · {dateLabel(notification.createdAt)}
                  </p>
                </div>
                <div className="actions">
                  <Link className="button secondary" href={notification.href}>
                    Open
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
          <div className="empty-state">No notifications are active. New review, deadline, model, connector, and resume states will appear here.</div>
        )}
      </section>
    </div>
  );
}
