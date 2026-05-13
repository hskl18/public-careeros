import Link from "next/link";
import { readServerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

const NOTIFICATION_ROW_LIMIT = 50;

type NotificationFilter = "all" | "unread" | "critical" | "dismissed";

const NOTIFICATION_FILTERS: ReadonlyArray<{ key: NotificationFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "critical", label: "Critical" },
  { key: "dismissed", label: "Dismissed" }
];

function resolveNotificationFilter(raw: string | undefined): NotificationFilter {
  return NOTIFICATION_FILTERS.find((entry) => entry.key === raw)?.key ?? "all";
}

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

export default async function NotificationsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const rawFilter = typeof params.filter === "string" ? params.filter : undefined;
  const activeFilter = resolveNotificationFilter(rawFilter);
  const state = await readServerState();
  const unread = state.notifications.filter((notification) => notification.status === "unread");
  const dismissed = state.notifications.filter((notification) => notification.status === "dismissed");
  const critical = state.notifications.filter((notification) => notification.severity === "critical");
  const active = state.notifications.filter((notification) => notification.status !== "dismissed");
  const connector = state.connectorAccounts[0];
  const filterCounts: Record<NotificationFilter, number> = {
    all: state.notifications.length,
    unread: unread.length,
    critical: critical.length,
    dismissed: dismissed.length
  };
  const filteredNotifications = state.notifications.filter((notification) => {
    if (activeFilter === "unread") return notification.status === "unread";
    if (activeFilter === "critical") return notification.severity === "critical" && notification.status !== "dismissed";
    if (activeFilter === "dismissed") return notification.status === "dismissed";
    return true;
  });
  const visibleNotifications = filteredNotifications.slice(0, NOTIFICATION_ROW_LIMIT);

  return (
    <main className="app-scroll-main">
      <div className="workspace-shell fixed-workspace notifications-workspace mx-auto flex w-full max-w-[104rem] flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6">
      <header className="card app-workspace-panel workspace-fixed-top app-page-header p-4 sm:p-5">
        <div>
          <p className="eyebrow">Notifications</p>
          <h1 className="mt-2 text-base font-semibold text-[var(--text-primary)] sm:text-xl">Action queue</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            Review blockers, Gmail connector health, reminders, model status, and application updates appear here with
            links back to the owning record.
          </p>
        </div>
        <div className="header-stack">
          <span className={unread.length ? "badge warn" : "badge ok"}>{unread.length} unread</span>
          <span className={critical.length ? "badge danger" : "badge ok"}>{critical.length} critical</span>
          <span className="badge">{dismissed.length} dismissed</span>
        </div>
      </header>

      <nav className="tab-strip workspace-fixed-top" aria-label="Notification filter" role="tablist">
        {NOTIFICATION_FILTERS.map((filter) => (
          <Link
            key={filter.key}
            href={filter.key === "all" ? "/notifications" : `/notifications?filter=${filter.key}`}
            aria-current={filter.key === activeFilter ? "page" : undefined}
            aria-selected={filter.key === activeFilter}
            role="tab"
            className={filter.key === activeFilter ? "is-active" : undefined}
            prefetch={false}
          >
            <span>{filter.label}</span>
            <span className="tab-strip__count">{filterCounts[filter.key]}</span>
          </Link>
        ))}
      </nav>

      <section className="grid four workspace-fixed-top">
        {[
          ["Open actions", active.length, "Rows that still need attention"],
          ["Review blockers", state.notifications.filter((item) => item.sourceType === "review").length, "Updates waiting on approval"],
          ["Next actions", state.notifications.filter((item) => item.sourceType === "reminder").length, "Follow-ups and deadlines"],
          ["Connector", connector?.status ?? "not_configured", "Gmail sync status"]
        ].map(([label, value, detail]) => (
          <article className="card metric compact-metric" key={label}>
            <span className="eyebrow">{label}</span>
            <strong>{value}</strong>
            <span className="subtle">{detail}</span>
          </article>
        ))}
      </section>

      <div className="workspace-scroll-region shell-scroll-region">
      <section className="section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Queue</p>
            <h2>Notification rows</h2>
            <p className="subtle">
              Showing {visibleNotifications.length} of {filteredNotifications.length}
              {activeFilter !== "all" ? ` (filtered: ${activeFilter})` : ""}. Sorted by derivation time with the
              next action kept in the row.
            </p>
          </div>
          {filteredNotifications.length > visibleNotifications.length ? (
            <span className="badge info">+{filteredNotifications.length - visibleNotifications.length} older</span>
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
                  <form action={`/api/notifications/${notification.id}`} method="post">
                    <input name="intent" type="hidden" value="read" />
                    <button className="button secondary" type="submit">
                      Mark as read
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
          <div className="empty-state">
            <strong>No active notifications.</strong>
            <p className="subtle">
              After Gmail sync, CareerOS will derive review blockers, deadlines, connector health, model checks, and
              resume states here.
            </p>
            <div className="actions mt-3">
              <Link className="button primary" href="/settings?section=gmail">Connect Gmail</Link>
              <Link className="button secondary" href="/">Open pipeline console</Link>
            </div>
          </div>
        )}
      </section>

      <section className="section notification-state-reference">
        <div className="section-title">
          <div>
            <p className="eyebrow">Operating states</p>
            <h2>Tracked notification states</h2>
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
            <small>Gmail status stays separate from workspace state and never stores OAuth tokens in exports.</small>
          </div>
        </div>
      </section>
      </div>
      </div>
    </main>
  );
}
