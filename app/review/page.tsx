import Link from "next/link";
import { readServerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

const OPEN_REVIEW_LIMIT = 20;
const REVIEW_HISTORY_LIMIT = 50;
const REVIEW_EVIDENCE_LIMIT = 3;

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

function stageLabel(value?: string) {
  return value ? value.replace("_", " ") : "unchanged";
}

export default async function ReviewPage() {
  const state = await readServerState();
  const open = state.reviewItems.filter((item) => item.status === "open");
  const decided = state.reviewItems.filter((item) => item.status !== "open");
  const blockedApplications = new Set(open.map((item) => item.proposedChange.applicationId).filter(Boolean));
  const modelBacked = state.reviewItems.filter((item) => item.traceSummary.toLowerCase().includes("model"));
  const lowConfidence = open.filter((item) => item.confidence < 0.7);
  const visibleOpen = open.slice(0, OPEN_REVIEW_LIMIT);
  const visibleDecided = decided.slice(0, REVIEW_HISTORY_LIMIT);

  return (
    <div className="page review-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Manual review</p>
          <h1>Review queue</h1>
          <p className="subtle">
            The review queue is the product safety boundary: imported evidence and model traces stay visible until the
            user accepts, dismisses, or corrects the proposed update.
          </p>
        </div>
        <div className="header-stack">
          <span className={open.length ? "badge warn" : "badge ok"}>
            {open.length ? `${open.length} blocking update${open.length === 1 ? "" : "s"}` : "No blockers"}
          </span>
          <span className="badge">{decided.length} decided</span>
        </div>
      </header>

      <section className="grid four">
        {[
          ["Open decisions", open.length, "Needs explicit user action"],
          ["Blocked records", blockedApplications.size, "Applications held back"],
          ["Low confidence", lowConfidence.length, "Below automation threshold"],
          ["Model traces", modelBacked.length, "Review-visible model path"]
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
            <p className="eyebrow">Decision inbox</p>
            <h2>Open updates</h2>
            <p className="subtle">
              Showing {visibleOpen.length} of {open.length}. Evidence, confidence, trace metadata, and the proposed
              mutation are kept in one review card.
            </p>
          </div>
          {open.length > visibleOpen.length ? <span className="badge info">+{open.length - visibleOpen.length} queued</span> : null}
        </div>
        {open.length ? (
          <div className="review-list">
            {visibleOpen.map((review) => {
              const app = state.applications.find((item) => item.id === review.proposedChange.applicationId);
              const evidence = state.evidenceSnippets.filter((item) => review.evidenceSnippetIds.includes(item.id));
              const visibleEvidence = evidence.slice(0, REVIEW_EVIDENCE_LIMIT);
              return (
                <article className="section review-card" id={review.id} key={review.id}>
                  <div className="review-card-head">
                    <div>
                      <p className="eyebrow">{review.sourceLabel}</p>
                      <h2>{review.reason}</h2>
                      <p className="subtle">
                        {app ? (
                          <Link href={`/applications#${app.id}`}>
                            {app.company} · {app.role}
                          </Link>
                        ) : (
                          "Unmatched application"
                        )}
                      </p>
                    </div>
                    <div className="badge-group">
                      <span className={statusBadge(review.status)}>{review.status}</span>
                      <span className={review.confidence < 0.7 ? "badge warn" : "badge info"}>
                        {Math.round(review.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>

                  <div className="grid four compact">
                    <div className="state-cell">
                      <span className="label">Current stage</span>
                      <strong>{stageLabel(app?.stage)}</strong>
                      <small>Current durable state</small>
                    </div>
                    <div className="state-cell">
                      <span className="label">Proposed stage</span>
                      <strong>{stageLabel(review.proposedChange.stage)}</strong>
                      <small>Only applies after accept/correct</small>
                    </div>
                    <div className="state-cell">
                      <span className="label">Current deadline</span>
                      <strong>{dateLabel(app?.deadlineAt)}</strong>
                      <small>Application record</small>
                    </div>
                    <div className="state-cell">
                      <span className="label">Proposed deadline</span>
                      <strong>{dateLabel(review.proposedChange.deadlineAt)}</strong>
                      <small>Queued mutation</small>
                    </div>
                  </div>

                  <div className="grid two review-detail-grid">
                    <div>
                      <p className="eyebrow">Evidence</p>
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
                          <div className="empty-state">No snippet ids were attached to this review item.</div>
                        )}
                        {evidence.length > visibleEvidence.length ? (
                          <div className="density-note">+{evidence.length - visibleEvidence.length} more evidence snippets.</div>
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <p className="eyebrow">Trace and mutation</p>
                      <div className="trace-panel">
                        <span className="badge info">{review.traceSummary}</span>
                        <p className="subtle">{review.proposedChange.eventSummary}</p>
                        <pre className="code">{JSON.stringify(review.proposedChange, null, 2)}</pre>
                      </div>
                    </div>
                  </div>

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
          <div>
            <p className="eyebrow">Decision history</p>
            <h2>Closed review items</h2>
            <p className="subtle">Showing {visibleDecided.length} of {decided.length} recent decisions.</p>
          </div>
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
                {visibleDecided.map((review) => (
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
