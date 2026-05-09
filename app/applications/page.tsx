import Link from "next/link";
import { readServerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

const APPLICATION_CARD_LIMIT = 12;
const APPLICATION_TABLE_LIMIT = 50;
const APPLICATION_EVIDENCE_LIMIT = 3;
const APPLICATION_EVENT_LIMIT = 4;

function dateLabel(value?: string) {
  return value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value)) : "not set";
}

function timeLabel(value?: string) {
  return value
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric" }).format(new Date(value))
    : "waiting";
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

export default async function ApplicationsPage() {
  const state = await readServerState();
  const openReviews = state.reviewItems.filter((item) => item.status === "open");
  const openReminders = state.reminders.filter((item) => item.status === "open");
  const evidenceWithApplication = state.evidenceSnippets.filter((item) => item.applicationId);
  const latestImport = state.importJobs[0];
  const displayedApplications = state.applications.slice(0, APPLICATION_CARD_LIMIT);
  const tableApplications = state.applications.slice(0, APPLICATION_TABLE_LIMIT);
  const hiddenApplicationCards = Math.max(state.applications.length - displayedApplications.length, 0);
  const hiddenTableRows = Math.max(state.applications.length - tableApplications.length, 0);

  return (
    <div className="page applications-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Applications</p>
          <h1>Application pipeline</h1>
          <p className="subtle">
            Each application keeps stage, next action, source evidence, and review status together so automation stays
            inspectable instead of becoming a hidden inbox parser.
          </p>
        </div>
        <div className="header-stack">
          <a className="button" href="#import">
            Import local record
          </a>
          <Link className="button secondary" href="/review">
            Review queue
          </Link>
        </div>
      </header>

      <section className="grid four">
        {[
          ["Tracked applications", state.applications.length, "Durable local records"],
          ["Evidence snippets", evidenceWithApplication.length, "Bounded source excerpts"],
          ["Open reminders", openReminders.length, "Follow-ups and deadlines"],
          ["Review blocked", openReviews.length, "User confirmation required"]
        ].map(([label, value, detail]) => (
          <article className="card metric compact-metric" key={label}>
            <span className="eyebrow">{label}</span>
            <strong>{value}</strong>
            <span className="subtle">{detail}</span>
          </article>
        ))}
      </section>

      <section className="section" id="import">
        <div className="section-head">
          <div>
            <p className="eyebrow">Local import</p>
            <h2>Add bounded recruiting evidence</h2>
            <p className="subtle">
              Local text is enough to exercise the real product loop: parse, attach evidence, create events, and route
              uncertain mutations to review.
            </p>
          </div>
          <span className="badge info">{latestImport ? `${latestImport.source} · ${latestImport.status}` : "provider-free"}</span>
        </div>
        <form className="form" action="/api/import" method="post">
          <div className="grid two">
            <label>
              Company
              <input name="company" placeholder="Example Systems" required />
            </label>
            <label>
              Role
              <input name="role" placeholder="Software Engineer" required />
            </label>
          </div>
          <label>
            Source label
            <input name="sourceLabel" placeholder="local-note:follow-up-1" required />
          </label>
          <label>
            Bounded source text
            <textarea
              name="text"
              placeholder="Recruiter replied with an interview request and asked for availability before 2026-05-20."
              required
            />
          </label>
          <button className="button" type="submit">
            Import and process
          </button>
        </form>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Pipeline workspace</p>
            <h2>{state.applications.length} application cards</h2>
            <p className="subtle">
              Showing {displayedApplications.length} of {state.applications.length}; compact table keeps the broader
              local state scannable.
            </p>
          </div>
          <div className="badge-group">
            <span className={openReviews.length ? "badge warn" : "badge ok"}>
              {openReviews.length ? `${openReviews.length} review-blocked` : "review clear"}
            </span>
            {hiddenApplicationCards ? <span className="badge info">+{hiddenApplicationCards} in table</span> : null}
          </div>
        </div>

        <div className="application-board">
          {displayedApplications.map((application) => {
            const events = state.events.filter((event) => event.applicationId === application.id);
            const evidence = state.evidenceSnippets.filter((item) => item.applicationId === application.id);
            const visibleEvents = events.slice(0, APPLICATION_EVENT_LIMIT);
            const visibleEvidence = evidence.slice(0, APPLICATION_EVIDENCE_LIMIT);
            const reminders = state.reminders.filter((item) => item.applicationId === application.id && item.status === "open");
            const openReview = openReviews.find((review) => review.proposedChange.applicationId === application.id);
            const latestEvidence = evidence[0];

            return (
              <article className="section application-card" id={application.id} key={application.id}>
                <div className="application-card-head">
                  <div>
                    <p className="eyebrow">{application.source} source</p>
                    <h2>{application.company}</h2>
                    <p className="subtle">{application.role}</p>
                  </div>
                  <div className="badge-group">
                    <span className={stageBadge(application.stage)}>{stageLabel(application.stage)}</span>
                    <Link className={openReview ? "badge warn" : "badge ok"} href={openReview ? `/review#${openReview.id}` : "#"}>
                      {openReview ? "review blocked" : "review clear"}
                    </Link>
                  </div>
                </div>

                <div className="grid three compact">
                  <div className="state-cell">
                    <span className="label">Deadline</span>
                    <strong>{dateLabel(application.deadlineAt)}</strong>
                    <small>Follow-up {dateLabel(application.followUpAt)}</small>
                  </div>
                  <div className="state-cell">
                    <span className="label">Open actions</span>
                    <strong>{reminders.length}</strong>
                    <small>{reminders[0]?.title ?? "No active reminder"}</small>
                  </div>
                  <div className="state-cell">
                    <span className="label">Evidence</span>
                    <strong>{evidence.length}</strong>
                    <small>{latestEvidence?.sourceLabel ?? "No evidence attached yet"}</small>
                  </div>
                </div>

                <div className="grid two application-detail-grid">
                  <div>
                    <div className="section-title">
                      <div>
                        <p className="eyebrow">Evidence</p>
                        <h3>Source snippets</h3>
                      </div>
                    </div>
                    <div className="list">
                      {evidence.length ? (
                        visibleEvidence.map((item) => (
                          <div className="evidence-card" key={item.id}>
                            <div className="inline-between">
                              <strong>{item.sourceLabel}</strong>
                              <span className="badge info">{Math.round(item.confidence * 100)}%</span>
                            </div>
                            <p className="subtle">{item.snippet}</p>
                            <span className="label">hash {item.hash.slice(0, 12)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state">Import local evidence to anchor this application.</div>
                      )}
                      {evidence.length > visibleEvidence.length ? (
                        <div className="density-note">+{evidence.length - visibleEvidence.length} more evidence snippets in local state.</div>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <div className="section-title">
                      <div>
                        <p className="eyebrow">Timeline</p>
                        <h3>What changed</h3>
                      </div>
                    </div>
                    <div className="timeline compact-timeline">
                      {events.length ? (
                        visibleEvents.map((event) => (
                          <div className="timeline-item" key={event.id}>
                            <span className="timeline-dot" />
                            <strong>{event.summary}</strong>
                            <p className="subtle">
                              {event.type} · {event.source} · confidence {Math.round(event.confidence * 100)}% ·{" "}
                              {timeLabel(event.createdAt)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state">No events have been recorded for this application yet.</div>
                      )}
                      {events.length > visibleEvents.length ? (
                        <div className="density-note">+{events.length - visibleEvents.length} older events.</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Compact table</p>
            <h2>Scan all records</h2>
            <p className="subtle">
              Showing {tableApplications.length} of {state.applications.length} rows{hiddenTableRows ? `; ${hiddenTableRows} more stay in local state` : ""}.
            </p>
          </div>
          <span className="badge info">mobile cards above</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company / role</th>
                <th>Stage</th>
                <th>Deadline</th>
                <th>Latest evidence</th>
                <th>Next action</th>
                <th>Review</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {tableApplications.map((application) => {
                const events = state.events.filter((event) => event.applicationId === application.id);
                const evidence = state.evidenceSnippets.filter((item) => item.applicationId === application.id);
                const openReview = openReviews.find((review) => review.proposedChange.applicationId === application.id);
                const latestEvidence = evidence[0];

                return (
                  <tr key={`${application.id}-row`}>
                    <td>
                      <strong>{application.company}</strong>
                      <p className="subtle">{application.role}</p>
                    </td>
                    <td>
                      <span className={stageBadge(application.stage)}>{stageLabel(application.stage)}</span>
                    </td>
                    <td>
                      <span className={application.deadlineAt ? "badge warn" : "badge"}>{dateLabel(application.deadlineAt)}</span>
                      <p className="subtle">Follow-up {dateLabel(application.followUpAt)}</p>
                    </td>
                    <td>
                      <strong>{latestEvidence?.sourceLabel ?? "No evidence"}</strong>
                      <p className="subtle">{latestEvidence?.snippet ?? "Import local JSON or create manual evidence."}</p>
                    </td>
                    <td>
                      {events[0]?.summary ?? "Waiting for local activity"}
                      <p className="subtle">{events[0] ? `confidence ${events[0].confidence}` : "deterministic-only"}</p>
                    </td>
                    <td>
                      <Link className={openReview ? "badge warn" : "badge ok"} href={openReview ? `/review#${openReview.id}` : "#"}>
                        {openReview ? "blocked" : "clear"}
                      </Link>
                    </td>
                    <td>{application.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
