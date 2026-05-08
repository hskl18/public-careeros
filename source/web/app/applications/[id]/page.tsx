import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Check, Edit3, GitPullRequestArrow, X } from "lucide-react";
import { applications, formatDateTime, getApplicationById } from "@/lib/demo-data";
import { KeyValueGrid, PageHeader, SectionHeader, StatusPill } from "@/components/ui";

export function generateStaticParams() {
  return applications.map((application) => ({ id: application.id }));
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const application = getApplicationById(id);

  if (!application) {
    notFound();
  }

  return (
    <main className="content">
      <PageHeader
        eyebrow="Application detail"
        title={`${application.company} · ${application.role}`}
        description="Evidence, reminders, timeline, contacts, and correction controls stay visible before any model-suggested mutation is accepted."
        action={
          <>
            <StatusPill tone={application.reviewStatus === "blocked" ? "warn" : "info"}>
              {application.stage}
            </StatusPill>
            <Link href="/applications" className="button secondary">
              Back to list
            </Link>
          </>
        }
      />

      <section className="grid-3">
        {[
          ["Priority", application.priority],
          ["Source", application.source],
          ["Last activity", formatDateTime(application.lastActivity)],
          ["Action required", application.actionRequired ? "Yes" : "No"],
          ["Next action", application.nextAction],
          ["Review status", application.reviewStatus],
        ].map(([label, value]) => (
          <article key={label} className="metric">
            <p className="eyebrow">{label}</p>
            <h3>{value}</h3>
          </article>
        ))}
      </section>

      <section className="grid-2">
        <div className="section">
          <SectionHeader eyebrow="Activity timeline" title="Bounded recent events" />
          <div className="scroll-list">
            {application.timeline.map((event) => (
              <article key={event.id} className="row-card">
                <div className="row-top">
                  <h3>{event.title}</h3>
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
                {event.reviewReason ? (
                  <p className="small muted">Review reason: {event.reviewReason}</p>
                ) : null}
              </article>
            ))}
          </div>
          <button className="button secondary" type="button">
            Load more
          </button>
        </div>

        <div className="section">
          <SectionHeader eyebrow="Reminders and contacts" title="Deadlines, source, and recruiters" />
          <div className="list">
            {application.reminders.length > 0 ? (
              application.reminders.map((reminder) => (
                <article key={reminder.id} className="row-card">
                  <div className="row-top">
                    <h3>{reminder.title}</h3>
                    <StatusPill tone={reminder.status === "overdue" ? "danger" : "warn"}>
                      {reminder.status}
                    </StatusPill>
                  </div>
                  <p className="small muted">
                    Due {formatDateTime(reminder.due)} · {reminder.source} ·{" "}
                    {reminder.explicit ? "explicit due date" : "inferred"}
                  </p>
                </article>
              ))
            ) : (
              <article className="row-card">
                <h3>No reminders yet</h3>
                <p className="small muted">Create one manually or wait for local import evidence.</p>
              </article>
            )}

            {application.contacts.length > 0 ? (
              application.contacts.map((contact) => (
                <article key={contact.name} className="row-card">
                  <h3>{contact.name}</h3>
                  <p className="small muted">
                    {contact.role} · {contact.source} · last seen {formatDateTime(contact.lastSeen)}
                  </p>
                </article>
              ))
            ) : (
              <article className="row-card">
                <h3>No recruiter contact recorded</h3>
                <p className="small muted">Gmail links are hidden while Gmail is not connected.</p>
              </article>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <SectionHeader eyebrow="Model trace summary" title="Evidence path before write" />
        <KeyValueGrid
          rows={[
            ["Mode", "Deterministic-only is active unless Gemma health check passes."],
            [
              "Current trace",
              application.evidence[0]?.trace ?? "No model or deterministic trace recorded.",
            ],
            [
              "Confidence",
              typeof application.evidence[0]?.confidence === "number"
                ? application.evidence[0].confidence.toFixed(2)
                : "local manual evidence",
            ],
            [
              "Gate",
              application.reviewStatus === "blocked"
                ? "Application mutation blocked until review."
                : "No low-confidence mutation is pending.",
            ],
          ]}
        />
      </section>

      <section className="section">
        <SectionHeader eyebrow="Evidence cards" title="Safe snippets, trace summaries, and review reasons" />
        <div className="evidence-grid">
          {application.evidence.map((evidence) => (
            <article key={evidence.id} className="row-card">
              <div className="row-top">
                <StatusPill tone={evidence.reviewReason ? "warn" : "info"}>{evidence.type}</StatusPill>
                {typeof evidence.confidence === "number" ? (
                  <StatusPill tone={evidence.confidence > 0.8 ? "good" : "warn"}>
                    {evidence.confidence.toFixed(2)}
                  </StatusPill>
                ) : null}
              </div>
              <h3>{evidence.title}</h3>
              <p className="small muted">{evidence.snippet}</p>
              <p className="small muted">Source: {evidence.source}</p>
              {evidence.reviewReason ? (
                <p className="small muted">Review reason: {evidence.reviewReason}</p>
              ) : null}
              <p className="code-line">{evidence.trace}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeader
          eyebrow="Correction controls"
          title="Model-suggested changes require explicit review"
        />
        <div className="toolbar">
          <button className="button secondary" type="button">
            <Edit3 size={15} aria-hidden="true" />
            Wrong category
          </button>
          <button className="button secondary" type="button">
            <GitPullRequestArrow size={15} aria-hidden="true" />
            Wrong application match
          </button>
          <button className="button secondary" type="button">
            <X size={15} aria-hidden="true" />
            Not an assessment
          </button>
          <button className="button secondary" type="button">
            <AlertTriangle size={15} aria-hidden="true" />
            Wrong deadline
          </button>
          <button className="button" type="button">
            <Check size={15} aria-hidden="true" />
            Confirm reviewed update
          </button>
        </div>
        <p className="small muted">
          Accepting a low-confidence update must show the affected application, current state,
          proposed state, evidence snippet, and audit outcome before confirmation.
        </p>
      </section>
    </main>
  );
}
