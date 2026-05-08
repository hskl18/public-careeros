import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

function dateLabel(value?: string) {
  return value ? new Date(value).toLocaleDateString() : "not set";
}

function stageBadge(stage: string) {
  if (stage === "interview" || stage === "offer") return "badge ok";
  if (stage === "assessment" || stage === "recruiter_reply") return "badge warn";
  if (stage === "rejected") return "badge danger";
  return "badge info";
}

export default async function ApplicationsPage() {
  const state = await readState();

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Applications</p>
          <h1>Dense pipeline list</h1>
          <p className="subtle">
            Scan company, role, stage, deadline, latest evidence, and review state. Gmail is optional; local import and
            manual records are first-class sources.
          </p>
        </div>
        <a className="button secondary" href="#import">
          Import local record
        </a>
      </header>

      <section className="section" id="import">
        <div className="section-head">
          <div>
            <p className="eyebrow">Local import</p>
            <h2>Create or update one application</h2>
          </div>
          <span className="badge info">provider-free</span>
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
            <input name="sourceLabel" placeholder="local-json:record-1" required />
          </label>
          <label>
            Bounded source text
            <textarea
              name="text"
              placeholder="Recruiter replied and asked for interview availability on 2026-05-20."
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
            <p className="eyebrow">Pipeline</p>
            <h2>{state.applications.length} applications</h2>
          </div>
          <span className="badge warn">
            {state.reviewItems.filter((item) => item.status === "open").length} review-blocked
          </span>
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
              {state.applications.map((application) => {
                const events = state.events.filter((event) => event.applicationId === application.id);
                const evidence = state.evidenceSnippets.filter((item) => item.applicationId === application.id);
                const openReview = state.reviewItems.find(
                  (review) => review.status === "open" && review.proposedChange.applicationId === application.id
                );
                const latestEvidence = evidence[0];

                return (
                  <tr id={application.id} key={application.id}>
                    <td>
                      <strong>{application.company}</strong>
                      <p className="subtle">{application.role}</p>
                    </td>
                    <td>
                      <span className={stageBadge(application.stage)}>{application.stage.replace("_", " ")}</span>
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
                      <a className={openReview ? "badge warn" : "badge ok"} href={openReview ? `/review#${openReview.id}` : "#"}>
                        {openReview ? "blocked" : "clear"}
                      </a>
                    </td>
                    <td>{application.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mobile-list list">
          {state.applications.map((application) => {
            const openReview = state.reviewItems.find(
              (review) => review.status === "open" && review.proposedChange.applicationId === application.id
            );
            return (
              <article className="tile" id={`${application.id}-mobile`} key={application.id}>
                <div className="inline-between">
                  <div>
                    <strong>{application.company}</strong>
                    <p className="subtle">{application.role}</p>
                  </div>
                  <span className={stageBadge(application.stage)}>{application.stage.replace("_", " ")}</span>
                </div>
                <p className="subtle">Deadline {dateLabel(application.deadlineAt)} · follow-up {dateLabel(application.followUpAt)}</p>
                <div className="actions">
                  <span className={openReview ? "badge warn" : "badge ok"}>{openReview ? "review blocked" : "review clear"}</span>
                  <span className="badge info">{application.source}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Empty and offline states</p>
            <h2>Useful actions without Gmail or Ollama</h2>
          </div>
          <span className="badge info">Gmail optional</span>
        </div>
        <div className="grid three">
          {[
            ["Empty workspace", "Seed demo data, import JSON, or create a manual application."],
            ["Loading/importing", "Keep the table dimensions stable while records are processed."],
            ["API/database unavailable", "Show retry and local setup status instead of a blank page."]
          ].map(([title, body]) => (
            <div className="state-cell" key={title}>
              <span className="badge">{title}</span>
              <p className="subtle">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
