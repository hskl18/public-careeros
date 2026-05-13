import Link from "next/link";
import { notFound } from "next/navigation";
import { readServerState } from "@/lib/server-state";
import type { Application, CareerOSState, EvidenceSnippet, MailboxMessage, ReviewItem } from "@/lib/types";

export const dynamic = "force-dynamic";

type ApplicationDetailPageProps = {
  params: Promise<{ id: string }>;
};

type TimelineItem = {
  id: string;
  kind: "event" | "reminder" | "review";
  label: string;
  summary: string;
  detail: string;
  confidence?: number;
  createdAt: string;
};

function stageLabel(stage?: string) {
  return stage ? stage.replace("_", " ") : "not set";
}

function stageBadge(stage: string) {
  if (stage === "interview" || stage === "offer") return "badge ok";
  if (stage === "assessment" || stage === "recruiter_reply") return "badge warn";
  if (stage === "rejected") return "badge danger";
  return "badge info";
}

function dateLabel(value?: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function shortDate(value?: string) {
  if (!value) return "not set";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function applicationProfile(application: Application) {
  const recruiter = application.recruiterContactName
    ? `${application.recruiterContactName}${application.recruiterContactEmail ? ` <${application.recruiterContactEmail}>` : ""}`
    : application.contactName ?? "No recruiter contact";

  return {
    jdLink: application.jobDescriptionUrl ?? "Not captured yet",
    resumeVersion: application.resumeVersion ?? "Not attached",
    coverLetterVersion: application.coverLetterVersion ?? "Not attached",
    source: application.applicationSource ?? application.source,
    recruiter,
    location: application.location ?? "Location not captured",
    salaryRange: application.salaryRange ?? "Salary not captured",
    notes: application.notes ?? "No notes captured."
  };
}

function evidenceForApplication(state: CareerOSState, application: Application) {
  return state.evidenceSnippets.filter(
    (snippet) =>
      snippet.applicationId === application.id ||
      snippet.sourceRelationships?.applicationId === application.id ||
      snippet.sourceRelationships?.company === application.company ||
      snippet.sourceRelationships?.role === application.role
  );
}

function messageMatchesEvidence(message: MailboxMessage, evidence: EvidenceSnippet[]) {
  return evidence.some((snippet) => snippet.sourceMessageIds.includes(message.id));
}

function threadsForApplication(state: CareerOSState, application: Application, evidence: EvidenceSnippet[]) {
  return state.mailboxThreads
    .map((thread) => ({
      thread,
      messages: thread.messages.filter(
        (message) =>
          messageMatchesEvidence(message, evidence) ||
          thread.companyHint === application.company ||
          thread.roleHint === application.role ||
          message.subject.toLowerCase().includes(application.company.toLowerCase())
      )
    }))
    .filter((entry) => entry.messages.length > 0);
}

function timelineForApplication(
  state: CareerOSState,
  application: Application,
  reviewItems: ReviewItem[]
): TimelineItem[] {
  const eventItems: TimelineItem[] = state.events
    .filter((event) => event.applicationId === application.id)
    .map((event) => ({
      id: event.id,
      kind: "event",
      label: event.type,
      summary: event.summary,
      detail: `${event.source} · ${Math.round(event.confidence * 100)}% confidence`,
      confidence: event.confidence,
      createdAt: event.createdAt
    }));

  const reminderItems: TimelineItem[] = state.reminders
    .filter((reminder) => reminder.applicationId === application.id)
    .map((reminder) => ({
      id: reminder.id,
      kind: "reminder",
      label: reminder.type ?? "reminder",
      summary: reminder.title,
      detail: `${reminder.status} · due ${dateLabel(reminder.dueAt)}`,
      createdAt: reminder.decidedAt ?? reminder.createdAt
    }));

  const reviewTimeline: TimelineItem[] = reviewItems.map((review) => ({
    id: review.id,
    kind: "review",
    label: "review gate",
    summary: review.reason,
    detail: `${review.status} · ${Math.round(review.confidence * 100)}% confidence · ${review.sourceLabel}`,
    confidence: review.confidence,
    createdAt: review.decidedAt ?? review.createdAt
  }));

  return [...eventItems, ...reminderItems, ...reviewTimeline].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

function nextActionFor(application: Application, openReviews: ReviewItem[], openReminders: CareerOSState["reminders"]) {
  if (openReviews.length) return "Review gate blocks this update";
  const reminder = openReminders[0];
  if (reminder) return reminder.title;
  if (application.deadlineAt) return `Prepare before ${shortDate(application.deadlineAt)}`;
  if (application.followUpAt) return `Follow up ${shortDate(application.followUpAt)}`;
  if (application.stage === "rejected") return "Archive or dispute";
  return "Monitor mailbox evidence";
}

export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const { id } = await params;
  const state = await readServerState();
  const application = state.applications.find((item) => item.id === id);

  if (!application) notFound();

  const profile = applicationProfile(application);
  const evidence = evidenceForApplication(state, application);
  const sourceMessageIds = Array.from(new Set(evidence.flatMap((snippet) => snippet.sourceMessageIds)));
  const threadGroups = threadsForApplication(state, application, evidence);
  const reviews = state.reviewItems.filter((item) => item.proposedChange.applicationId === application.id);
  const openReviews = reviews.filter((item) => item.status === "open");
  const reminders = state.reminders.filter((item) => item.applicationId === application.id);
  const openReminders = reminders.filter((item) => item.status === "open").sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const notifications = state.notifications.filter(
    (item) =>
      item.sourceId === application.id ||
      item.href === `/applications/${application.id}` ||
      item.href === `/applications#${application.id}`
  );
  const timeline = timelineForApplication(state, application, reviews);
  const nextAction = nextActionFor(application, openReviews, openReminders);

  return (
    <main className="app-scroll-main">
      <div className="workspace-shell application-detail-workspace mx-auto grid w-full max-w-[104rem] gap-4 px-3 py-4 sm:px-5 sm:py-6">
        <section className="card app-workspace-panel application-detail-hero p-4 sm:p-5">
          <div className="application-detail-hero-main">
            <Link className="button secondary" href="/applications">
              Back to applications
            </Link>
            <div>
              <p className="eyebrow">Application detail</p>
              <h1>{application.company}</h1>
              <p className="application-detail-role">{application.role}</p>
            </div>
            <div className="badge-group">
              <span className={stageBadge(application.stage)}>{stageLabel(application.stage)}</span>
              <span className={openReviews.length ? "badge warn" : "badge ok"}>
                {openReviews.length ? "review blocked" : "review clear"}
              </span>
              <span className="badge info">{application.source}</span>
            </div>
          </div>
          <div className="application-detail-next">
            <p className="eyebrow">Next action</p>
            <strong>{nextAction}</strong>
            <span>
              Deadline {dateLabel(application.deadlineAt)} · follow-up {dateLabel(application.followUpAt)}
            </span>
          </div>
        </section>

        <section className="application-dossier-strip" aria-label="Evidence-backed application dossier">
          {[
            ["Evidence-backed dossier", `${evidence.length} bounded snippets · ${sourceMessageIds.length} source message ids`],
            ["Mailbox relationship", threadGroups.length ? `${threadGroups.length} matched thread${threadGroups.length === 1 ? "" : "s"}` : "no matched thread yet"],
            ["Review gate", openReviews.length ? `${openReviews.length} blocking update${openReviews.length === 1 ? "" : "s"}` : "clear before state changes"],
            ["Operating queue", `${openReminders.length} open reminders · ${notifications.length} notifications`]
          ].map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>

        <section className="application-detail-grid">
          <div className="application-detail-main">
            <section className="card app-workspace-panel p-4 sm:p-5">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Spreadsheet replacement fields</p>
                  <h2>Structured application state</h2>
                  <p className="subtle">
                    The fields candidates usually lose in a spreadsheet stay attached to the evidence-backed record.
                  </p>
                </div>
                <span className="badge info">{sourceMessageIds.length} source message ids</span>
              </div>
              <div className="application-field-grid">
                <span>JD link</span>
                {profile.jdLink.startsWith("http") ? (
                  <a href={profile.jdLink} rel="noreferrer" target="_blank">
                    {profile.jdLink.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <strong>{profile.jdLink}</strong>
                )}
                <span>Resume version</span>
                <strong>{profile.resumeVersion}</strong>
                <span>Cover-letter version</span>
                <strong>{profile.coverLetterVersion}</strong>
                <span>Source</span>
                <strong>{profile.source}</strong>
                <span>Recruiter contact</span>
                <strong>{profile.recruiter}</strong>
                <span>Location</span>
                <strong>{profile.location}</strong>
                <span>Salary range</span>
                <strong>{profile.salaryRange}</strong>
                <span>Notes</span>
                <strong>{profile.notes}</strong>
              </div>
            </section>

            <section className="card app-workspace-panel p-4 sm:p-5">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Application timeline</p>
                  <h2>What changed and why</h2>
                  <p className="subtle">Events, reminders, and review gates are shown together so state changes stay traceable.</p>
                </div>
                <span className="badge info">{timeline.length} items</span>
              </div>
              <div className="application-timeline">
                {timeline.length ? (
                  timeline.map((item) => (
                    <article key={`${item.kind}:${item.id}`}>
                      <span className={`application-timeline-dot ${item.kind}`} aria-hidden="true" />
                      <div>
                        <div className="inline-between">
                          <p className="eyebrow">{item.label}</p>
                          <span className="subtle">{dateLabel(item.createdAt)}</span>
                        </div>
                        <strong>{item.summary}</strong>
                        <p>{item.detail}</p>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">No timeline items have been recorded for this application.</div>
                )}
              </div>
            </section>

            <section className="card app-workspace-panel p-4 sm:p-5">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Bounded evidence snippets</p>
                  <h2>Evidence attached to this record</h2>
                  <p className="subtle">CareerOS keeps bounded snippets and hashes, not private raw mailbox bodies.</p>
                </div>
                <span className="badge info">{evidence.length} snippets</span>
              </div>
              <div className="application-evidence-list">
                {evidence.length ? (
                  evidence.map((snippet) => (
                    <article className="evidence-card" key={snippet.id}>
                      <div className="inline-between">
                        <strong>{snippet.sourceLabel}</strong>
                        <span className="badge info">{Math.round(snippet.confidence * 100)}%</span>
                      </div>
                      <p className="subtle">{snippet.snippet}</p>
                      <div className="mini-meta">
                        <span>hash {snippet.hash.slice(0, 12)}</span>
                        <span>source message ids: {snippet.sourceMessageIds.join(", ") || "none"}</span>
                        <span>{snippet.reason}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">No bounded evidence snippets are attached to this application yet.</div>
                )}
              </div>
            </section>

            <section className="card app-workspace-panel p-4 sm:p-5">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Thread-level relationship map</p>
                  <h2>Mailbox thread to application state</h2>
                  <p className="subtle">
                    Mailbox thread, recruiter, company, role, resume version, and extracted state stay connected.
                  </p>
                </div>
                <span className="badge info">{threadGroups.length} threads</span>
              </div>
              <div className="application-thread-grid">
                <div className="relationship-map-card">
                  <p className="eyebrow">Relationship map</p>
                  <div className="relationship-chain">
                    {[
                      ["Mailbox", threadGroups[0]?.thread.subject ?? "No matched thread"],
                      ["Recruiter", profile.recruiter],
                      ["Company", application.company],
                      ["Role", application.role],
                      ["Resume", profile.resumeVersion],
                      ["Evidence", `${evidence.length} bounded snippet${evidence.length === 1 ? "" : "s"}`]
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mailbox-thread-card">
                  {threadGroups.length ? (
                    threadGroups.map(({ thread, messages }) => (
                      <article className="application-thread-card" key={thread.id}>
                        <div className="inline-between">
                          <strong>{thread.subject}</strong>
                          <span className="badge">{thread.source}</span>
                        </div>
                        <div className="mailbox-message-list">
                          {messages.map((message) => (
                            <article key={message.id}>
                              <div className="inline-between">
                                <span>{message.fromLabel}</span>
                                <code>{message.id}</code>
                              </div>
                              <strong>{message.subject}</strong>
                              <p>{message.snippet}</p>
                              <small>{message.sourceLabel} · {dateLabel(message.receivedAt)}</small>
                            </article>
                          ))}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">No mailbox thread matched this application.</div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside className="application-detail-rail">
            <section className="card app-workspace-panel p-4">
              <p className="eyebrow">Review blockers</p>
              <h2>Review blockers for this application</h2>
              <div className="application-rail-list">
                {openReviews.length ? (
                  openReviews.map((review) => (
                    <article key={review.id}>
                      <div className="inline-between">
                        <span className="badge warn">blocked</span>
                        <span className="badge info">{Math.round(review.confidence * 100)}%</span>
                      </div>
                      <strong>{review.reason}</strong>
                      <p>{review.proposedChange.eventSummary}</p>
                      <Link className="button secondary" href={`/review?status=open&selected=${review.id}#${review.id}`}>
                        Open review gate
                      </Link>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">No review item is blocking this application.</div>
                )}
              </div>
            </section>

            <section className="card app-workspace-panel p-4">
              <p className="eyebrow">Reminder and notification context</p>
              <h2>Actions tied to this record</h2>
              <div className="application-rail-list">
                {reminders.length ? (
                  reminders.map((reminder) => (
                    <article key={reminder.id}>
                      <div className="inline-between">
                        <span className={reminder.status === "open" ? "badge warn" : "badge ok"}>{reminder.status}</span>
                        <span className="subtle">{dateLabel(reminder.dueAt)}</span>
                      </div>
                      <strong>{reminder.title}</strong>
                      <p>{reminder.type ?? "reminder"}</p>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">No reminders are attached to this application.</div>
                )}
                {notifications.length ? (
                  notifications.map((notification) => (
                    <article key={notification.id}>
                      <div className="inline-between">
                        <span className="badge info">{notification.sourceType}</span>
                        <span className="subtle">{notification.status}</span>
                      </div>
                      <strong>{notification.title}</strong>
                      <p>{notification.body}</p>
                      <small>{notification.dedupeKey}</small>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">No derived notification currently targets this application.</div>
                )}
              </div>
            </section>

            <section className="card app-workspace-panel p-4">
              <p className="eyebrow">Agentic pipeline framing</p>
              <h2>Evidence before state changes</h2>
              <div className="application-field-grid compact">
                <span>Mailbox triage</span>
                <strong>{threadGroups.length ? "thread matched" : "no thread"}</strong>
                <span>Workflow extraction</span>
                <strong>{stageLabel(application.stage)}</strong>
                <span>Evidence/review</span>
                <strong>{openReviews.length ? "blocked" : "clear"}</strong>
                <span>Reminder agent</span>
                <strong>{openReminders.length} open</strong>
                <span>Model router</span>
                <strong>{state.modelRuntime.enabled ? "Gemma via Ollama Cloud optional" : "deterministic fallback"}</strong>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
