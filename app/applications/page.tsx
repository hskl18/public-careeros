import Link from "next/link";
import { readServerState } from "@/lib/server-state";
import type { Application, ApplicationBucket } from "@/lib/types";

export const dynamic = "force-dynamic";

function stageLabel(stage: string) {
  return stage.replace("_", " ");
}

function stageBadge(stage: string) {
  if (stage === "interview" || stage === "offer") return "badge ok";
  if (stage === "assessment" || stage === "recruiter_reply") return "badge warn";
  if (stage === "rejected") return "badge danger";
  return "badge info";
}

function dateLabel(value?: string) {
  return value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value)) : "not set";
}

function evidenceProfile(application: Application) {
  const recruiter = application.recruiterContactName
    ? `${application.recruiterContactName}${application.recruiterContactEmail ? ` <${application.recruiterContactEmail}>` : ""}`
    : application.contactName ?? "No recruiter contact";
  const compensation = [application.location, application.salaryRange].filter(Boolean).join(" · ") || "Location/salary not captured";
  return {
    jdLink: application.jobDescriptionUrl ?? "Not captured yet",
    resumeVersion: application.resumeVersion ?? "Not attached",
    coverLetterVersion: application.coverLetterVersion ?? "Not attached",
    source: application.applicationSource ?? application.source,
    recruiter,
    compensation,
    notes: application.notes ?? "No notes captured."
  };
}

function bucketForApplication(application: Application, hasClosedFollowUp: boolean): ApplicationBucket {
  if (application.stage === "offer") return "offer";
  if (application.stage === "rejected") return "rejected";
  if (application.stage === "assessment") return "assessment";
  if (application.stage === "interview") return "interview";
  if (application.stage === "applied" && application.followUpAt) return "ghosted";
  if (hasClosedFollowUp) return "followed_up";
  return application.stage === "wishlist" ? "waiting" : "applied";
}

export default async function ApplicationsPage() {
  const state = await readServerState();
  const selected = state.applications[0];
  const workspaceEmpty = state.applications.length === 0;
  const selectedEvents = selected ? state.events.filter((event) => event.applicationId === selected.id) : [];
  const selectedEvidence = selected ? state.evidenceSnippets.filter((item) => item.applicationId === selected.id) : [];
  const selectedReview = selected
    ? state.reviewItems.find((item) => item.proposedChange.applicationId === selected.id && item.status === "open")
    : undefined;
  const metrics = [
    ["All", state.applications.length],
    ["Needs review", state.reviewItems.filter((item) => item.status === "open").length],
    ["Waiting", state.applications.filter((item) => item.stage === "applied").length],
    ["Interviews", state.applications.filter((item) => item.stage === "interview" || item.stage === "assessment").length],
    ["Offers", state.applications.filter((item) => item.stage === "offer").length],
    ["Rejected", state.applications.filter((item) => item.stage === "rejected").length]
  ];
  const selectedProfile = selected ? evidenceProfile(selected) : undefined;
  const boardLanes: { key: ApplicationBucket; label: string; description: string }[] = [
    { key: "applied", label: "Applied", description: "New workspace records" },
    { key: "waiting", label: "Waiting", description: "No follow-up date" },
    { key: "followed_up", label: "Followed up", description: "Closed follow-up loop" },
    { key: "assessment", label: "Assessment", description: "OA or take-home" },
    { key: "interview", label: "Interview", description: "Active loop" },
    { key: "offer", label: "Offer", description: "Decision pending" },
    { key: "rejected", label: "Rejected", description: "Terminal/dispute" },
    { key: "ghosted", label: "Ghosted", description: "Waiting past follow-up" }
  ];
  const applicationsByLane = new Map<ApplicationBucket, Application[]>(boardLanes.map((lane) => [lane.key, []]));
  for (const application of state.applications) {
    const hasClosedFollowUp = state.reminders.some(
      (item) => item.applicationId === application.id && item.type === "follow_up" && item.status !== "open"
    );
    applicationsByLane.get(bucketForApplication(application, hasClosedFollowUp))?.push(application);
  }
  const selectedSourceMessageIds = new Set(selectedEvidence.flatMap((item) => item.sourceMessageIds));
  const selectedThread = selected
    ? state.mailboxThreads.find((thread) =>
        thread.messages.some(
          (message) =>
            selectedSourceMessageIds.has(message.id) ||
            message.subject.toLowerCase().includes(selected.company.toLowerCase()) ||
            thread.companyHint === selected.company
        )
      )
    : undefined;
  const selectedThreadMessages = selectedThread?.messages ?? [];

  return (
    <main className="app-scroll-main">
      <div className="workspace-shell fixed-workspace applications-workspace mx-auto grid w-full max-w-[104rem] gap-4 px-3 py-4 sm:px-5 sm:py-6 xl:grid-cols-[minmax(0,7fr)_minmax(360px,3fr)]">
        <div className="applications-main-stack grid min-w-0 gap-4">
          <section className="card app-workspace-panel workspace-fixed-top applications-page-header p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="eyebrow">Applications</p>
                <h1 className="mt-2 text-base font-semibold text-[var(--text-primary)] sm:text-xl">Job pipeline</h1>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Gmail recruiting mail becomes evidence-backed application records: stage, JD link, resume version,
                  recruiter contact, review state, and next action stay together.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="btn btn-primary btn-sm" href="/settings?section=gmail">
                  Connect Gmail
                </Link>
                <Link className="btn btn-secondary btn-sm" href="/review">
                  Email review <span className="badge info">{state.reviewItems.filter((item) => item.status === "open").length}</span>
                </Link>
              </div>
            </div>
            <div className="applications-summary-strip mt-4">
              {metrics.map(([label, value], index) => (
                <div className={`applications-summary-pill ${index === 0 ? "selected" : ""}`} key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>

          <div className="workspace-scroll-region applications-scroll-region min-w-0">
          {workspaceEmpty ? (
            <section className="card app-workspace-panel p-4 sm:p-5">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Clean workspace</p>
                  <h2>Sync Gmail to create the first application records</h2>
                  <p className="subtle">
                    CareerOS no longer preloads sample applications. Connect readonly Gmail, sync recent recruiting mail,
                    and the mailbox triage and workflow extraction agents will create review-gated records here.
                  </p>
                </div>
                <span className="badge info">0 records</span>
              </div>
              <div className="grid three">
                {[
                  ["1. Connect", "Authorize readonly Gmail with the Google OAuth client in `.env.local`."],
                  ["2. Sync", "Fetch bounded recruiting snippets from the Gmail query window."],
                  ["3. Review", "Accept, correct, or dismiss uncertain/model-backed updates before state changes."]
                ].map(([title, body]) => (
                  <div className="state-cell" key={title}>
                    <span className="label">{title}</span>
                    <strong>{body}</strong>
                  </div>
                ))}
              </div>
              <div className="actions mt-4">
                <form action="/api/connectors/gmail/connect" method="post">
                  <button className="button primary" type="submit">Connect Gmail</button>
                </form>
                <form action="/api/connectors/gmail/sync" method="post">
                  <button className="button secondary" type="submit">Sync recruiting mail</button>
                </form>
                <Link className="button secondary" href="/judge-demo">View judge demo</Link>
              </div>
            </section>
          ) : null}
          <details className="card app-workspace-panel stage-lane-panel stage-lane-disclosure p-4 sm:p-5">
            <summary className="section-title">
              <div>
                <p className="eyebrow">Stage board</p>
                <h2>Board view for quick scanning</h2>
                <p className="subtle">Buckets help scanning, but evidence-backed records remain the source of truth.</p>
              </div>
              <span className="badge info">{state.applications.length} records</span>
            </summary>
            <div className="stage-lane-grid" aria-label="Application stage board">
              {boardLanes.map((lane) => {
                const laneApplications = applicationsByLane.get(lane.key) ?? [];
                const visible = laneApplications.slice(0, 3);
                const hidden = laneApplications.length - visible.length;
                return (
                  <article className="stage-lane" key={lane.key}>
                    <div className="stage-lane-head">
                      <div>
                        <strong>{lane.label}</strong>
                        <span>{lane.description}</span>
                      </div>
                      <span className="badge info">{laneApplications.length}</span>
                    </div>
                    <div className="stage-lane-items">
                      {visible.length ? (
                        visible.map((application) => {
                          const profile = evidenceProfile(application);
                          const hasOpenReview = state.reviewItems.some(
                            (item) => item.proposedChange.applicationId === application.id && item.status === "open"
                          );
                          const nextDeadline = application.deadlineAt ?? application.followUpAt;
                          return (
                            <Link className="stage-lane-card" href={`/applications/${application.id}`} key={application.id}>
                              <div className="stage-lane-card__title">
                                <strong>{application.company}</strong>
                                {hasOpenReview ? (
                                  <span
                                    className="stage-lane-card__review-dot"
                                    aria-label="Review item open for this application"
                                    title="Review item open"
                                  />
                                ) : null}
                              </div>
                              <span>{application.role}</span>
                              <small>{profile.source} · {profile.resumeVersion}</small>
                              {nextDeadline ? (
                                <span className="stage-lane-card__deadline">
                                  {application.deadlineAt ? "Due" : "Follow up"} {dateLabel(nextDeadline)}
                                </span>
                              ) : null}
                            </Link>
                          );
                        })
                      ) : (
                        <span className="stage-lane-empty">No records</span>
                      )}
                      {hidden > 0 ? (
                        <Link className="stage-lane-more" href={`/applications/${laneApplications[3]?.id ?? ""}`}>
                          +{hidden} more
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </details>

          <section className="card app-workspace-panel applications-table-panel overflow-hidden p-0">
            <div className="border-b border-[var(--border)] p-4 sm:p-5">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Application records</p>
                  <h2>Evidence-first records</h2>
                </div>
                <span className="badge info">{state.applications.length} records</span>
              </div>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                Core fields stay visible first; <Link href="/notifications">notifications</Link> handles urgency.
              </p>
            </div>
            <div className="table-wrap border-0">
              <table className="data-table applications-data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Stage</th>
                    <th>Next action</th>
                    <th>Evidence context</th>
                  </tr>
                </thead>
                <tbody>
                  {state.applications.length ? state.applications.map((application, index) => {
                    const events = state.events.filter((event) => event.applicationId === application.id);
                    const reminder = state.reminders.find((item) => item.applicationId === application.id && item.status === "open");
                    const profile = evidenceProfile(application);
                    return (
                      <tr className={index === 0 ? "is-selected" : ""} key={application.id}>
                        <td data-label="Company">
                          <span id={application.id} />
                          <Link href={`/applications/${application.id}`}>
                            <strong>{application.company}</strong>
                          </Link>
                          <p className="subtle">{profile.source} - {dateLabel(events[0]?.createdAt ?? application.updatedAt)}</p>
                          {profile.jdLink.startsWith("http") ? (
                            <p className="subtle">
                              <a href={profile.jdLink}>JD link</a>
                            </p>
                          ) : null}
                        </td>
                        <td data-label="Role">
                          <Link href={`/applications/${application.id}`}>{application.role}</Link>
                          <p className="subtle">{profile.resumeVersion}</p>
                          <p className="subtle">{profile.coverLetterVersion}</p>
                        </td>
                        <td data-label="Stage"><span className={stageBadge(application.stage)}>{stageLabel(application.stage)}</span></td>
                        <td data-label="Next action">{reminder?.title ?? (application.stage === "rejected" ? "Archive or dispute" : "Follow up")}</td>
                        <td data-label="Evidence context">
                          <strong>{profile.recruiter.split(" <")[0]}</strong>
                          <p className="subtle">{profile.compensation}</p>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">
                          No application records yet. Connect Gmail or import a validated CareerOS JSON workspace to populate this table.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card app-workspace-panel thread-evidence-panel p-4 sm:p-5">
            <div className="section-title">
              <div>
                <p className="eyebrow">Thread-level evidence</p>
                <h2>Mailbox evidence behind the record</h2>
                <p className="subtle">Bounded snippets stay attached to extracted fields, source message ids, confidence, and the owning application.</p>
              </div>
              <span className="badge info">{selectedThreadMessages.length} messages</span>
            </div>
            {selected ? (
              <div className="thread-evidence-grid">
                <div className="mailbox-thread-card">
                  <div className="inline-between">
                    <strong>{selectedThread?.subject ?? "No source thread matched"}</strong>
                    <span className="badge">{selectedThread?.source ?? "local"}</span>
                  </div>
                  <div className="mailbox-message-list">
                    {selectedThreadMessages.length ? (
                      selectedThreadMessages.map((message) => (
                        <article key={message.id}>
                          <div className="inline-between">
                            <span>{message.fromLabel}</span>
                            <code>{message.id}</code>
                          </div>
                          <strong>{message.subject}</strong>
                          <p>{message.snippet}</p>
                          <small>{message.sourceLabel} · {dateLabel(message.receivedAt)}</small>
                        </article>
                      ))
                    ) : (
                      <div className="empty-state">No mailbox thread ids attached yet.</div>
                    )}
                  </div>
                </div>
                <div className="extracted-state-card">
                  <p className="eyebrow">Extracted update</p>
                  <div className="evidence-field-grid">
                    <span>Owning application</span>
                    <strong>{selected.company} · {selected.role}</strong>
                    <span>Stage</span>
                    <strong>{stageLabel(selected.stage)}</strong>
                    <span>Deadline</span>
                    <strong>{dateLabel(selected.deadlineAt)}</strong>
                    <span>Confidence</span>
                    <strong>{selectedEvidence[0] ? `${Math.round(selectedEvidence[0].confidence * 100)}%` : "Not attached"}</strong>
                    <span>Evidence source</span>
                    <strong>{selectedEvidence[0]?.sourceLabel ?? "local workspace"}</strong>
                    <span>Source message ids</span>
                    <strong>{selectedEvidence[0]?.sourceMessageIds.join(", ") || "none"}</strong>
                  </div>
                  <div className="bounded-snippet-box">
                    <span>Bounded snippet</span>
                    <p>{selectedEvidence[0]?.snippet ?? "No bounded snippet attached yet."}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">No application selected for evidence inspection.</div>
            )}
          </section>
          </div>
        </div>

        <aside className="card app-workspace-panel selected-rail applications-selected-rail p-3 sm:p-4">
          <p className="eyebrow">Selected record</p>
          {selected ? (
            <>
              <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{selected.company}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{selected.role}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={stageBadge(selected.stage)}>{stageLabel(selected.stage)}</span>
                <span className={selectedReview ? "badge warn" : "badge ok"}>{selectedReview ? "review blocked" : "review clear"}</span>
              </div>
              <div className="mt-5 grid gap-3">
                <section className="rail-panel">
                  <p className="eyebrow">Next action</p>
                  <strong>{state.reminders.find((item) => item.applicationId === selected.id)?.title ?? "No open action"}</strong>
                  <span>Deadline {dateLabel(selected.deadlineAt)} - follow-up {dateLabel(selected.followUpAt)}</span>
                </section>
                <section className="rail-panel">
                  <p className="eyebrow">Evidence summary</p>
                  <strong>{selectedEvidence[0]?.snippet ?? "No evidence attached yet."}</strong>
                  <span>{selectedEvidence[0]?.sourceLabel ?? "local workspace"}</span>
                </section>
                {selectedProfile ? (
                  <section className="rail-panel">
                    <p className="eyebrow">Relationship map</p>
                    <strong>Company, role, recruiter, resume, and evidence</strong>
                    <div className="evidence-field-grid">
                      <span>Source</span>
                      <strong>{selectedProfile.source}</strong>
                      <span>JD link</span>
                      {selectedProfile.jdLink.startsWith("http") ? (
                        <a href={selectedProfile.jdLink}>{selectedProfile.jdLink.replace(/^https?:\/\//, "")}</a>
                      ) : (
                        <strong>{selectedProfile.jdLink}</strong>
                      )}
                      <span>Resume</span>
                      <strong>{selectedProfile.resumeVersion}</strong>
                      <span>Cover letter</span>
                      <strong>{selectedProfile.coverLetterVersion}</strong>
                      <span>Recruiter contact</span>
                      <strong>{selectedProfile.recruiter}</strong>
                      <span>Location/pay</span>
                      <strong>{selectedProfile.compensation}</strong>
                      <span>Notes</span>
                      <strong>{selectedProfile.notes}</strong>
                      <span>Evidence</span>
                      <strong>{selectedEvidence.length} bounded snippet{selectedEvidence.length === 1 ? "" : "s"}</strong>
                    </div>
                  </section>
                ) : null}
                <Link className="btn btn-primary" href={`/applications/${selected.id}`}>Open application detail</Link>
                {selectedReview ? (
                  <Link className="btn btn-secondary" href={`/review?company=${encodeURIComponent(selected.company)}`}>
                    Open review queue for {selected.company}
                  </Link>
                ) : null}
                <Link className="btn btn-secondary" href="/settings">Open connector settings</Link>
                <section className="rail-panel">
                  <div className="section-title">
                    <p className="eyebrow">Open tasks</p>
                    <span className="badge info">{state.reminders.filter((item) => item.applicationId === selected.id && item.status === "open").length}</span>
                  </div>
                  <span>{state.reminders.find((item) => item.applicationId === selected.id)?.title ?? "No open action for this record."}</span>
                </section>
                <section className="rail-panel">
                  <div className="section-title">
                    <p className="eyebrow">Recent evidence</p>
                    <span className="badge info">{selectedEvents.length}</span>
                  </div>
                  <strong>{selectedEvents[0]?.summary ?? "No recent evidence."}</strong>
                </section>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <strong>No application selected.</strong>
              <p className="subtle">
                Sync Gmail to create the first evidence-backed record, or open the judge demo to inspect the sample flow.
              </p>
              <div className="actions mt-3">
                <Link className="button primary" href="/settings?section=gmail">Gmail setup</Link>
                <Link className="button secondary" href="/judge-demo">Judge demo</Link>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
