import Link from "next/link";
import { BellOff } from "lucide-react";
import { formatDateTime, notifications } from "@/lib/demo-data";
import { PageHeader, SectionHeader, StatusPill } from "@/components/ui";

export default function NotificationsPage() {
  return (
    <main className="content">
      <PageHeader
        eyebrow="In-app notifications"
        title="Notification history"
        description="Notifications are derived from pipeline state, reminders, review items, model status, connector health, and resume results. They do not create a competing source of truth."
        action={<StatusPill tone="info">{notifications.length} total</StatusPill>}
      />

      <section className="section">
        <SectionHeader eyebrow="Window" title="Current and reviewed events" />
        <div className="list">
          {notifications.map((item) => (
            <article key={item.id} className="row-card">
              <div className="row-top">
                <div>
                  <h3>{item.message}</h3>
                  <p className="small muted">
                    {formatDateTime(item.timestamp)} · {item.source}
                  </p>
                </div>
                <StatusPill tone={item.severity}>{item.status}</StatusPill>
              </div>
              <div className="toolbar" style={{ marginTop: 12 }}>
                <Link href={item.destination} className="button secondary">
                  {item.destinationLabel}
                </Link>
                <button className="button ghost" type="button">
                  Mark reviewed
                </button>
                <button className="button ghost" type="button">
                  Dismiss
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeader eyebrow="Empty state" title="No current notifications" />
        <article className="row-card">
          <StatusPill tone="good">
            <BellOff size={14} aria-hidden="true" />
            clear
          </StatusPill>
          <p className="small muted" style={{ marginTop: 8 }}>
            When the list is empty, the useful next destinations are Applications, Review,
            Resume, and Settings.
          </p>
          <div className="toolbar">
            <Link href="/applications" className="button secondary">Applications</Link>
            <Link href="/review" className="button secondary">Review</Link>
            <Link href="/resume" className="button secondary">Resume</Link>
            <Link href="/settings" className="button secondary">Settings</Link>
          </div>
        </article>
      </section>
    </main>
  );
}
