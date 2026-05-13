import Link from "next/link";
import { readServerState } from "@/lib/server-state";
import type { Application, ReviewItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const OPEN_REVIEW_LIMIT = 20;
const REVIEW_HISTORY_LIMIT = 50;
const REVIEW_EVIDENCE_LIMIT = 3;
const DEFAULT_SORT = "newest";

type ReviewSearchParams = Record<string, string | string[] | undefined>;

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

function getParam(params: ReviewSearchParams, key: string, fallback: string) {
  const value = params[key];
  return typeof value === "string" && value.length ? value : fallback;
}

function buildSelectHref(params: ReviewSearchParams, reviewId: string) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "selected") continue;
    if (typeof value === "string" && value.length) search.set(key, value);
  }
  search.set("selected", reviewId);
  return `/review?${search.toString()}#${reviewId}`;
}

function toDatetimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function isModelBacked(review: ReviewItem) {
  const trace = review.traceSummary.toLowerCase();
  return trace.includes("model") || trace.includes("ollama") || trace.includes("gemma");
}

function confidenceBand(confidence: number) {
  if (confidence < 0.6) return "low";
  if (confidence < 0.8) return "medium";
  return "high";
}

function applicationForReview(applications: Application[], review: ReviewItem) {
  return applications.find((item) => item.id === review.proposedChange.applicationId);
}

function sortReviews(reviews: ReviewItem[], sort: string) {
  return [...reviews].sort((a, b) => {
    if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sort === "confidence_high") return b.confidence - a.confidence;
    if (sort === "confidence_low") return a.confidence - b.confidence;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export default async function ReviewPage({
  searchParams
}: {
  searchParams?: Promise<ReviewSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const state = await readServerState();
  const open = state.reviewItems.filter((item) => item.status === "open");
  const workspaceEmpty = state.applications.length === 0 && state.reviewItems.length === 0;
  const decided = state.reviewItems.filter((item) => item.status !== "open");
  const blockedApplications = new Set(open.map((item) => item.proposedChange.applicationId).filter(Boolean));
  const modelBacked = state.reviewItems.filter(isModelBacked);
  const lowConfidence = open.filter((item) => item.confidence < 0.7);
  const selectedStatus = getParam(params, "status", "open");
  const selectedCompany = getParam(params, "company", "all");
  const selectedSource = getParam(params, "source", "all");
  const selectedConfidence = getParam(params, "confidence", "all");
  const selectedMode = getParam(params, "mode", "all");
  const selectedSort = getParam(params, "sort", DEFAULT_SORT);
  const companyOptions = Array.from(new Set(state.applications.map((item) => item.company))).sort();
  const sourceOptions = Array.from(new Set(state.reviewItems.map((item) => item.sourceLabel))).sort();
  const filteredReviews = sortReviews(
    state.reviewItems.filter((review) => {
      const app = applicationForReview(state.applications, review);
      if (selectedStatus !== "all" && review.status !== selectedStatus) return false;
      if (selectedCompany !== "all" && app?.company !== selectedCompany) return false;
      if (selectedSource !== "all" && review.sourceLabel !== selectedSource) return false;
      if (selectedConfidence !== "all" && confidenceBand(review.confidence) !== selectedConfidence) return false;
      if (selectedMode === "model" && !isModelBacked(review)) return false;
      if (selectedMode === "deterministic" && isModelBacked(review)) return false;
      return true;
    }),
    selectedSort
  );
  const filteredOpen = filteredReviews.filter((item) => item.status === "open");
  const visibleOpen = filteredReviews.slice(0, OPEN_REVIEW_LIMIT);
  const visibleDecided = decided.slice(0, REVIEW_HISTORY_LIMIT);
  const requestedSelected = getParam(params, "selected", "");
  const selectedReview =
    (requestedSelected ? visibleOpen.find((item) => item.id === requestedSelected) : undefined) ?? visibleOpen[0];
  const selectedId = selectedReview?.id;
  const selectedIndex = selectedReview ? visibleOpen.findIndex((item) => item.id === selectedReview.id) : -1;
  const selectedPosition = selectedIndex >= 0 ? selectedIndex + 1 : 0;
  const selectedApp = selectedReview
    ? applicationForReview(state.applications, selectedReview)
    : undefined;
  const selectedEvidence = selectedReview
    ? state.evidenceSnippets.filter((item) => selectedReview.evidenceSnippetIds.includes(item.id)).slice(0, REVIEW_EVIDENCE_LIMIT)
    : [];
  const selectedThreadIds = new Set(selectedEvidence.flatMap((item) => item.sourceMessageIds));
  const selectedMessages = state.mailboxThreads.flatMap((thread) =>
    thread.messages
      .filter((message) => selectedThreadIds.has(message.id))
      .map((message) => ({ ...message, threadSubject: thread.subject }))
  );

  const reviewQuickFilters: Array<{
    key: string;
    label: string;
    href: string;
    count: number;
    isActive: boolean;
  }> = [
    {
      key: "all",
      label: "All",
      href: "/review?status=all",
      count: state.reviewItems.length,
      isActive: selectedStatus === "all" && selectedConfidence === "all" && selectedMode === "all"
    },
    {
      key: "open",
      label: "Open",
      href: "/review",
      count: open.length,
      isActive: selectedStatus === "open" && selectedConfidence === "all" && selectedMode === "all"
    },
    {
      key: "low",
      label: "Low confidence",
      href: "/review?status=open&confidence=low",
      count: lowConfidence.length,
      isActive: selectedStatus === "open" && selectedConfidence === "low"
    },
    {
      key: "model",
      label: "Model-backed",
      href: "/review?status=open&mode=model",
      count: modelBacked.filter((item) => item.status === "open").length,
      isActive: selectedMode === "model"
    },
    {
      key: "decided",
      label: "Decided",
      href: "/review?status=accepted",
      count: decided.length,
      isActive: selectedStatus !== "all" && selectedStatus !== "open"
    }
  ];

  return (
    <main className="app-scroll-main">
      <div className="workspace-shell review-workspace mx-auto grid w-full max-w-[104rem] gap-4 px-3 py-4 sm:px-5 sm:py-6">
        <section className="card app-workspace-panel review-command-panel p-4 sm:p-5">
          <div>
            <p className="eyebrow">Manual review</p>
            <h1 className="mt-2 text-base font-semibold text-[var(--text-primary)] sm:text-xl">Review queue</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              Approve only the updates you trust. Gmail imports, deterministic rules, and Gemma-backed proposals must
              carry evidence, confidence, and trace data before they can mutate application state.
            </p>
          </div>
          <nav className="tab-strip review-quick-filters" aria-label="Review quick filter" role="tablist">
            {reviewQuickFilters.map((filter) => (
              <Link
                key={filter.key}
                href={filter.href}
                aria-current={filter.isActive ? "page" : undefined}
                aria-selected={filter.isActive}
                role="tab"
                className={filter.isActive ? "is-active" : undefined}
                prefetch={false}
              >
                <span>{filter.label}</span>
                <span className="tab-strip__count">{filter.count}</span>
              </Link>
            ))}
          </nav>
          <div className="review-command-stats">
            {[
              ["Open", open.length, "decision"],
              ["Blocked", blockedApplications.size, "record"],
              ["Low confidence", lowConfidence.length, "item"],
              ["Traces", modelBacked.length, "model"]
            ].map(([label, value, detail]) => (
              <div className="metric-filter" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
        </section>

        {workspaceEmpty ? (
          <section className="card app-workspace-panel p-4 sm:p-5">
            <div className="section-title">
              <div>
                <p className="eyebrow">No review work yet</p>
                <h2>The review gate wakes up after Gmail sync or import</h2>
                <p className="subtle">
                  Clean workspaces start with no fake blockers. Sync Gmail recruiting mail or import records; uncertain
                  deadlines, model-backed proposals, and low-confidence extractions will appear here for accept, correct,
                  or dismiss.
                </p>
              </div>
              <span className="badge ok">clear</span>
            </div>
            <div className="actions">
              <Link className="button primary" href="/settings?section=gmail">Connect Gmail</Link>
              <Link className="button secondary" href="/applications">Open applications</Link>
              <Link className="button secondary" href="/judge-demo">Inspect sample review gate</Link>
            </div>
          </section>
        ) : null}

        <section className="review-workbench">
          <div className="card app-workspace-panel review-queue-panel overflow-hidden p-0">
            <div className="review-panel-head">
              <div>
                <p className="eyebrow">Decision inbox</p>
                <h2>Review filters</h2>
                <p className="subtle">
                  Showing {visibleOpen.length} of {filteredReviews.length} filtered items · {filteredOpen.length} open
                </p>
              </div>
              {open.length > visibleOpen.length ? <span className="badge info">+{open.length - visibleOpen.length}</span> : null}
            </div>
            <form className="review-filter-bar" method="get">
              <label>
                <span>Status</span>
                <select name="status" defaultValue={selectedStatus}>
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="accepted">Accepted</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="corrected">Corrected</option>
                </select>
              </label>
              <label>
                <span>Company</span>
                <select name="company" defaultValue={selectedCompany}>
                  <option value="all">All companies</option>
                  {companyOptions.map((company) => (
                    <option key={company} value={company}>{company}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Source</span>
                <select name="source" defaultValue={selectedSource}>
                  <option value="all">All sources</option>
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Confidence</span>
                <select name="confidence" defaultValue={selectedConfidence}>
                  <option value="all">All confidence</option>
                  <option value="low">Low (&lt;60%)</option>
                  <option value="medium">Medium (60-79%)</option>
                  <option value="high">High (80%+)</option>
                </select>
              </label>
              <label>
                <span>Mode</span>
                <select name="mode" defaultValue={selectedMode}>
                  <option value="all">All modes</option>
                  <option value="deterministic">Deterministic</option>
                  <option value="model">Model-backed</option>
                </select>
              </label>
              <label>
                <span>Sort</span>
                <select name="sort" defaultValue={selectedSort}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="confidence_low">Lowest confidence</option>
                  <option value="confidence_high">Highest confidence</option>
                </select>
              </label>
              <button className="button secondary" type="submit">Apply filters</button>
              <Link className="button secondary" href="/review">Reset</Link>
            </form>
            <div className="workspace-scroll-region review-list">
              {visibleOpen.length ? (
                visibleOpen.map((review) => {
                  const app = applicationForReview(state.applications, review);
                  const isSelected = review.id === selectedId;
                  return (
                    <Link
                      className={`review-list-row ${isSelected ? "is-selected" : ""}`}
                      id={review.id}
                      key={review.id}
                      href={buildSelectHref(params, review.id)}
                      aria-current={isSelected ? "true" : undefined}
                      scroll={false}
                    >
                      <div>
                        <div className="inline-between">
                          <p className="eyebrow">{review.sourceLabel}</p>
                          <span className={review.confidence < 0.7 ? "badge warn" : "badge info"}>
                            {Math.round(review.confidence * 100)}%
                          </span>
                        </div>
                        <h3>{review.reason}</h3>
                        <p className="subtle">
                          {app ? `${app.company} · ${app.role}` : "Unmatched application"}
                        </p>
                      </div>
                      <div className="mini-meta">
                        <span>{review.status}</span>
                        <span className={isModelBacked(review) ? "badge info" : "badge"}>
                          {isModelBacked(review) ? "Model-backed" : "Deterministic"}
                        </span>
                        <span>{stageLabel(review.proposedChange.stage)}</span>
                        <span>{dateLabel(review.proposedChange.deadlineAt)}</span>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="empty-state">
                  No review items match these filters. New low-confidence Gmail imports and model-backed proposals will appear here.
                </div>
              )}
            </div>
          </div>

          <aside className="card app-workspace-panel review-detail-panel p-0">
            {selectedReview ? (
              <>
                <div className="review-panel-head">
                  <div>
                    <p className="eyebrow">
                      Review item {selectedPosition} of {visibleOpen.length}
                    </p>
                    <h2>{selectedReview.reason}</h2>
                    <p className="subtle">
                      {selectedApp ? `${selectedApp.company} · ${selectedApp.role}` : "Unmatched application"}
                    </p>
                    {selectedApp ? (
                      <Link className="button secondary" href={`/applications/${selectedApp.id}`}>
                        Open application detail
                      </Link>
                    ) : null}
                  </div>
                  <div className="badge-group">
                    <span className={statusBadge(selectedReview.status)}>{selectedReview.status}</span>
                    <span className={selectedReview.confidence < 0.7 ? "badge warn" : "badge info"}>
                      {Math.round(selectedReview.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>

                <div className="workspace-scroll-region review-detail-scroll">
                  <div className="review-state-grid">
                    {[
                      ["Current stage", stageLabel(selectedApp?.stage), "Durable state"],
                      ["Proposed stage", stageLabel(selectedReview.proposedChange.stage), "Applies after review"],
                      ["Current deadline", dateLabel(selectedApp?.deadlineAt), "Application record"],
                      ["Proposed deadline", dateLabel(selectedReview.proposedChange.deadlineAt), "Pending approval"]
                    ].map(([label, value, detail]) => (
                      <div className="state-cell" key={label}>
                        <span className="label">{label}</span>
                        <strong>{value}</strong>
                        <small>{detail}</small>
                      </div>
                    ))}
                  </div>

                  <div className="review-detail-columns">
                    <section>
                      <p className="eyebrow">Evidence</p>
                      <div className="list">
                        {selectedEvidence.length ? (
                          selectedEvidence.map((item) => (
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
                          <div className="empty-state">No evidence snippets are attached to this review item.</div>
                        )}
                      </div>
                      <div className="thread-mini-panel">
                        <p className="eyebrow">Source mailbox thread</p>
                        {selectedMessages.length ? (
                          selectedMessages.map((message) => (
                            <article key={message.id}>
                              <div className="inline-between">
                                <strong>{message.subject}</strong>
                                <span className="badge info">{message.id}</span>
                              </div>
                              <p>{message.snippet}</p>
                              <small>{message.fromLabel} · {message.sourceLabel} · {message.threadSubject}</small>
                            </article>
                          ))
                        ) : (
                          <span className="subtle">No source message ids attached.</span>
                        )}
                      </div>
                    </section>

                    <section>
                      <p className="eyebrow">Trace and proposed update</p>
                      <div className="trace-panel">
                        <span className="badge info">{selectedReview.traceSummary}</span>
                        <p className="subtle">{selectedReview.proposedChange.eventSummary}</p>
                        <pre className="code">{JSON.stringify(selectedReview.proposedChange, null, 2)}</pre>
                      </div>
                      <div className="mutation-choice-grid">
                        <div>
                          <strong>Accept update</strong>
                          <span>Apply the proposed change exactly as shown.</span>
                        </div>
                        <div>
                          <strong>Dismiss</strong>
                          <span>Close the item and leave application state unchanged.</span>
                        </div>
                        <div>
                          <strong>Correct</strong>
                          <span>Apply your corrected deadline or summary through the review gate.</span>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>

                {selectedReview.status === "open" ? (
                  <div className="review-action-bar">
                    <form action={`/api/review/${selectedReview.id}`} method="post">
                      <input name="intent" type="hidden" value="accept" />
                      <button className="button" type="submit">Accept update</button>
                    </form>
                    <form action={`/api/review/${selectedReview.id}`} method="post">
                      <input name="intent" type="hidden" value="dismiss" />
                      <button className="button secondary" type="submit">Dismiss</button>
                    </form>
                    <form className="inline-correction" action={`/api/review/${selectedReview.id}`} method="post">
                      <input name="intent" type="hidden" value="correct" />
                      <label>
                        <span className="label">Corrected deadline</span>
                        <input
                          name="deadlineAt"
                          type="datetime-local"
                          defaultValue={toDatetimeLocal(selectedReview.proposedChange.deadlineAt)}
                        />
                      </label>
                      <label>
                        <span className="label">Corrected summary</span>
                        <input
                          name="eventSummary"
                          type="text"
                          placeholder="Corrected after user review"
                          defaultValue={selectedReview.proposedChange.eventSummary ?? ""}
                        />
                      </label>
                      <button className="button secondary" type="submit">Correct</button>
                    </form>
                  </div>
                ) : (
                  <div className="review-closed-bar">
                    <strong>Decision already recorded</strong>
                    <span>Closed review items remain traceable, but their update controls are disabled.</span>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <strong>No selected review item.</strong>
                <p className="subtle">
                  The queue is clear. Sync Gmail or run a validated import to generate review-gated proposals.
                </p>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
