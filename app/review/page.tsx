import Link from "next/link";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

function statusBadge(status: string) {
  if (status === "open") return "badge warn";
  if (status === "accepted" || status === "corrected") return "badge ok";
  return "badge";
}

function dateLabel(value?: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(value)
  );
}

export default async function ReviewPage() {
  const state = await readState();
  const open = state.reviewItems.filter((item) => item.status === "open");
  const decided = state.reviewItems.filter((item) => item.status !== "open");
  const blockedApplications = new Set(open.map((item) => item.proposedChange.applicationId).filter(Boolean));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Review queue</p>
          <h1>Confirm uncertain updates</h1>
          <p className="subtle">
            Risky imports stop here until you accept, dismiss, or correct the proposed application mutation.
          </p>
        </div>
        <div className="header-stack">
          <span className={open.length ? "badge warn" : "badge ok"}>
            {open.length ? `${open.length} blocking update${open.length === 1 ? "" : "s"}` : "No blockers"}
          </span>
          <span className="badge">{decided.length} decided</span>
        </div>
      </header>

      <section className="state-matrix">
        <div className="state-cell">
          <span className="label">Review item blocks update</span>
          <strong>{blockedApplications.size ? "Active" : "Clear"}</strong>
          <small>{blockedApplications.size || "No"} application records are held behind explicit confirmation.</small>
        </div>
        <div className="state-cell">
          <span className="label">Accept</span>
          <strong>Apply mutation</strong>
          <small>Writes the proposed deadline, stage, or contact change and records a decision event.</small>
        </div>
        <div className="state-cell">
          <span className="label">Dismiss</span>
          <strong>Keep current data</strong>
          <small>Closes the item without changing the owning application.</small>
        </div>
        <div className="state-cell">
          <span className="label">Correct</span>
          <strong>User wins</strong>
          <small>Applies your corrected value with confidence pinned to 1.0.</small>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <h2>Open decisions</h2>
            <p className="subtle">Evidence and model trace are preserved with every queued update.</p>
          </div>
        </div>
        {open.length ? (
          <div className="list">
            {open.map((review) => {
              const app = state.applications.find((item) => item.id === review.proposedChange.applicationId);
              const evidence = state.evidenceSnippets.filter((item) => review.evidenceSnippetIds.includes(item.id));
              return (
                <article className="card decision-card" id={review.id} key={review.id}>
                  <div className="row split">
                    <div>
                      <h3>{review.sourceLabel}</h3>
                      <p className="subtle">
                        {app ? (
                          <Link href={`/applications#${app.id}`}>
                            {app.company} · {app.role}
                          </Link>
                        ) : (
                          "Unmatched application"
                        )}{" "}
                        · confidence {Math.round(review.confidence * 100)}%
                      </p>
                    </div>
                    <span className={statusBadge(review.status)}>{review.status}</span>
                  </div>

                  <div className="grid three compact">
                    <div className="tile">
                      <span className="label">Reason</span>
                      <strong>{review.reason}</strong>
                    </div>
                    <div className="tile">
                      <span className="label">Current deadline</span>
                      <strong>{dateLabel(app?.deadlineAt)}</strong>
                    </div>
                    <div className="tile">
                      <span className="label">Proposed deadline</span>
                      <strong>{dateLabel(review.proposedChange.deadlineAt)}</strong>
                    </div>
                  </div>

                  <div className="evidence-list">
                    {evidence.map((item) => (
                      <p className="subtle" key={item.id}>
                        <strong>{item.sourceLabel}:</strong> {item.snippet}
                      </p>
                    ))}
                  </div>
                  <pre className="code">{JSON.stringify(review.proposedChange, null, 2)}</pre>
                  <p className="subtle">Trace: {review.traceSummary}</p>

                  <div className="actions decision-actions">
                    <form action={`/api/review/${review.id}`} method="post">
                      <input name="intent" type="hidden" value="accept" />
                      <button className="button" type="submit">
                        Accept update
                      </button>
                    </form>
                    <form action={`/api/review/${review.id}`} method="post">
                      <input name="intent" type="hidden" value="dismiss" />
                      <button className="button secondary" type="submit">
                        Dismiss
                      </button>
                    </form>
                    <form className="inline-correction" action={`/api/review/${review.id}`} method="post">
                      <input name="intent" type="hidden" value="correct" />
                      <input name="deadlineAt" placeholder="2026-05-18T16:00:00.000Z" />
                      <input name="eventSummary" placeholder="Corrected after user review" />
                      <button className="button secondary" type="submit">
                        Correct
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">No open review items. New low-confidence imports will appear here.</div>
        )}
      </section>

      <section className="section">
        <div className="section-title">
          <h2>Decision history</h2>
          <span className="badge">{decided.length}</span>
        </div>
        {decided.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Status</th>
                  <th>Decision</th>
                  <th>Trace</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((review) => (
                  <tr key={review.id}>
                    <td>{review.sourceLabel}</td>
                    <td>
                      <span className={statusBadge(review.status)}>{review.status}</span>
                    </td>
                    <td>{dateLabel(review.decidedAt)}</td>
                    <td>{review.traceSummary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">Decision history is empty until the first review item is accepted, dismissed, or corrected.</div>
        )}
      </section>
    </div>
  );
}
