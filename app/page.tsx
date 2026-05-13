import Link from "next/link";
import { checkServerOllamaStatus, readServerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Waiting for first sync";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function stageLabel(stage: string) {
  return stage.replace("_", " ");
}

function activityTone(type: string) {
  if (type.includes("rejected")) return "bg-[var(--red-soft)] text-[var(--red)]";
  if (type.includes("interview")) return "bg-[var(--accent-soft)] text-[var(--accent-ink)]";
  if (type.includes("review")) return "bg-[var(--yellow-soft)] text-[var(--yellow)]";
  if (type.includes("created")) return "bg-[var(--blue-soft)] text-[var(--blue)]";
  return "bg-[var(--green-soft)] text-[var(--green)]";
}

function reminderTone(kind: string) {
  if (kind === "critical") return "bg-[var(--red-soft)] text-[var(--red)]";
  if (kind === "warning") return "bg-[var(--yellow-soft)] text-[var(--yellow)]";
  return "bg-[var(--blue-soft)] text-[var(--brand-blue-ink)]";
}

function modelHint(status: string, modelTag: string) {
  if (status === "ready") return `Gemma ready · ${modelTag}`;
  if (status === "model_missing") return `${modelTag} is not available to this Ollama account`;
  if (status === "unavailable") return "Check Ollama Cloud key or stay deterministic";
  if (status === "disabled") return "Optional Ollama Cloud is disabled";
  return "Check model setup";
}

type PrimaryAction = {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  tone: "review" | "reminder" | "interview" | "explore";
};

function primaryAction({
  openReviews,
  dueSoon,
  interviews,
  offers,
  workspaceEmpty,
  connectorStatus
}: {
  openReviews: number;
  dueSoon: number;
  interviews: number;
  offers: number;
  workspaceEmpty: boolean;
  connectorStatus?: string;
}): PrimaryAction {
  if (workspaceEmpty && connectorStatus !== "connected") {
    return {
      eyebrow: "Gmail sync",
      title: "Connect Gmail to start your real pipeline",
      body: "This workspace starts clean. Add Google OAuth env values, connect readonly Gmail, then sync recruiting mail into review-gated application state.",
      href: "/settings?section=gmail",
      cta: "Connect Gmail",
      tone: "explore"
    };
  }
  if (workspaceEmpty) {
    return {
      eyebrow: "Gmail sync",
      title: "Sync recruiting mail to build the pipeline",
      body: "Gmail is connected. Sync recent recruiting messages, then CareerOS will triage, extract, review, and track the job workflow.",
      href: "/settings?section=gmail",
      cta: "Sync Gmail",
      tone: "explore"
    };
  }
  if (openReviews > 0) {
    return {
      eyebrow: "Review queue",
      title: `${openReviews} update${openReviews === 1 ? "" : "s"} need your decision`,
      body: "Uncertain or model-backed updates wait here until you accept, correct, or dismiss them.",
      href: "/review",
      cta: "Open review queue",
      tone: "review"
    };
  }
  if (dueSoon > 0) {
    return {
      eyebrow: "Reminders",
      title: `${dueSoon} reminder${dueSoon === 1 ? "" : "s"} due`,
      body: "Recruiter follow-ups and deadlines that need a decision.",
      href: "/notifications",
      cta: "Open notifications",
      tone: "reminder"
    };
  }
  if (offers > 0) {
    return {
      eyebrow: "Offers",
      title: `${offers} offer${offers === 1 ? "" : "s"} on the table`,
      body: "Compare evidence, deadlines, and recruiter notes before you decide.",
      href: "/applications",
      cta: "Open applications",
      tone: "interview"
    };
  }
  if (interviews > 0) {
    return {
      eyebrow: "Interviews",
      title: `${interviews} interview${interviews === 1 ? "" : "s"} in flight`,
      body: "Keep prep notes, JD links, and recruiter context near each application.",
      href: "/applications",
      cta: "Open applications",
      tone: "interview"
    };
  }
  return {
    eyebrow: "Judge demo",
    title: "Inspect the sample mailbox workflow",
    body: "Use the judge demo for the sanitized Kaggle story. Your workspace data stays separate.",
    href: "/judge-demo",
    cta: "Open judge demo",
    tone: "explore"
  };
}

function actionToneClass(tone: PrimaryAction["tone"]) {
  switch (tone) {
    case "review":
      return "bg-[var(--yellow-soft)] text-[var(--yellow)]";
    case "reminder":
      return "bg-[var(--accent-soft)] text-[var(--accent-ink)]";
    case "interview":
      return "bg-[var(--blue-soft)] text-[var(--blue)]";
    default:
      return "bg-[var(--green-soft)] text-[var(--green)]";
  }
}

const homeAgentStages = [
  "Mailbox triage agent",
  "Workflow extraction agent",
  "Evidence/review agent",
  "Resume/context agent",
  "Reminder/notification agent",
  "Model router/provider layer"
];

export default async function DashboardPage() {
  const [state, modelStatus] = await Promise.all([readServerState(), checkServerOllamaStatus()]);
  const openReviews = state.reviewItems.filter((item) => item.status === "open");
  const waitingApplications = state.applications.filter((item) => item.stage === "applied");
  const interviews = state.applications.filter((item) => item.stage === "interview" || item.stage === "assessment");
  const offers = state.applications.filter((item) => item.stage === "offer");
  const rejections = state.applications.filter((item) => item.stage === "rejected");
  const dueSoon = state.reminders.filter((item) => item.status === "open");
  const recentEvents = state.events.slice(0, 8);
  const activeNotifications = state.notifications.filter((item) => item.status !== "dismissed");
  const connector = state.connectorAccounts.find((item) => item.provider === "gmail");
  const workspaceEmpty = state.applications.length === 0 && state.mailboxThreads.length === 0 && state.reviewItems.length === 0;
  const latestUpdate = recentEvents[0]?.createdAt ?? state.workspaceUser.createdAt;

  const action = primaryAction({
    openReviews: openReviews.length,
    dueSoon: dueSoon.length,
    interviews: interviews.length,
    offers: offers.length,
    workspaceEmpty,
    connectorStatus: connector?.status
  });

  const metrics = [
    {
      label: "Needs review",
      value: openReviews.length,
      href: "/review",
      color: "var(--yellow)"
    },
    {
      label: "Reminders",
      value: dueSoon.length,
      href: "/notifications",
      color: "var(--accent)"
    },
    {
      label: "Waiting",
      value: waitingApplications.length,
      href: "/applications",
      color: "var(--green)"
    },
    {
      label: "Interviews",
      value: interviews.length,
      href: "/applications",
      color: "var(--blue)"
    },
    {
      label: "Offers",
      value: offers.length,
      href: "/applications",
      color: "var(--green)"
    },
    {
      label: "Rejected",
      value: rejections.length,
      href: "/applications",
      color: "var(--red)"
    }
  ];

  return (
    <main className="app-scroll-main">
      <div className="workspace-shell fixed-workspace mx-auto flex w-full max-w-[104rem] flex-col gap-3 px-3 py-4 animate-in sm:gap-4 sm:px-5 sm:py-6">
        <section className="card app-workspace-panel home-agent-console workspace-fixed-top p-3 sm:p-4">
          <div className="home-agent-header">
            <div className="min-w-0">
              <p className="eyebrow">Agentic pipeline console</p>
              <h1 className="mt-1 text-base font-semibold text-[var(--text-primary)] sm:mt-2 sm:text-xl">
                Mailbox pipeline console
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                CareerOS is the open-source CareerOC demo: connect readonly Gmail, sync recruiting evidence, and turn
                mailbox signals into structured application state with agent handoffs, Gemma via Ollama Cloud, deterministic
                fallback, and review gates before state changes.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              {action.tone === "explore" ? (
                <>
                  <Link href={action.href} className="btn btn-primary btn-sm justify-center max-lg:min-h-9">
                    {action.cta}
                  </Link>
                  <Link
                    href="/judge-demo"
                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-tint-3)] px-3 font-mono text-[0.64rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)] transition hover:border-[var(--brand-blue)]/35 hover:bg-[var(--surface-tint-5)]"
                  >
                    Judge demo
                  </Link>
                </>
              ) : (
                <>
                  <Link href={action.href} className="btn btn-primary btn-sm justify-center max-lg:min-h-9">
                    {action.cta}
                  </Link>
                  <Link
                    href="/judge-demo"
                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-tint-3)] px-3 font-mono text-[0.64rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)] transition hover:border-[var(--brand-blue)]/35 hover:bg-[var(--surface-tint-5)]"
                  >
                    Judge demo
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Agent strip stays visible at all times so the page reads as an agentic pipeline,
              not a generic dashboard. */}
          <details className="home-agent-stages home-agent-explainer mt-3">
            <summary className="home-agent-panel-head">
              <p className="eyebrow">Agent handoff</p>
              <span className="badge info">6 stages · review-gated</span>
            </summary>
            <div className="home-stage-strip">
              {homeAgentStages.map((stage, index) => (
                <div key={stage}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{stage}</strong>
                </div>
              ))}
            </div>
          </details>

          <div className="mt-3 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 sm:mt-4 sm:grid-cols-3 xl:grid-cols-6">
            {metrics.map((metric) => (
              <Link
                key={metric.label}
                href={metric.href}
                className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-tint-1)] px-3 py-2 transition hover:border-[var(--border-hover)] hover:bg-[var(--surface-tint-3)] sm:block sm:py-2.5"
              >
                <p className="min-w-0 truncate font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)] lg:text-[0.72rem] lg:tracking-[0.16em]">
                  {metric.label}
                </p>
                <p
                  className="text-base font-semibold tabular-nums sm:mt-1 sm:text-lg"
                  style={{ color: metric.value === 0 ? "var(--text-tertiary)" : metric.color }}
                >
                  {metric.value}
                </p>
              </Link>
            ))}
          </div>

          {/* RUNTIME STATUS — single line so users always see model + fallback + connector + last update */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--border)] pt-3 text-[11px] text-[var(--text-tertiary)]">
            <span className="inline-flex items-center gap-1.5">
              <span className={`badge ${actionToneClass(action.tone)}`}>Workspace pipeline</span>
              <span>{state.applications.length} applications · {recentEvents.length} recent events</span>
            </span>
            <span>Model: {modelHint(modelStatus.status, modelStatus.modelTag)}</span>
            <span>
              Fallback:{" "}
              {modelStatus.status === "ready" ? "Deterministic mode available" : "Deterministic mode active"}
            </span>
            <span>Gmail: {connector?.status ?? "disabled"}</span>
            <span className="ml-auto">Last update {formatTimestamp(latestUpdate)}</span>
          </div>
        </section>

        {/* WORKSPACE: activity + needs attention — takes remaining shell height and scrolls internally */}
        <section className="grid min-h-0 flex-1 items-stretch gap-4 [grid-template-rows:minmax(0,1fr)] xl:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
          <div className="workspace-scroll-region min-h-0">
            <section className="card app-workspace-panel flex h-full min-h-0 flex-col p-0">
              <div className="shrink-0 px-4 pt-4 sm:px-5 sm:pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">Activity log</p>
              <h2 className="mt-1.5 text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                      Recent changes
                    </h2>
                  </div>
                  <span className="badge bg-[var(--surface-elevated)] text-[var(--text-tertiary)]">
                    {recentEvents.length}
                  </span>
                </div>
              </div>

              <div className="workspace-scroll-region min-h-0 flex-1 px-4 pt-3 pb-4 sm:px-5 sm:pt-4 sm:pb-5">
                <div className="space-y-2.5 sm:space-y-3">
                  {workspaceEmpty ? (
                    <article className="card-elevated p-4 sm:p-5">
                      <p className="eyebrow">Start from your mailbox</p>
                      <h3 className="mt-2 text-base font-semibold text-[var(--text-primary)]">
                        No applications loaded yet
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                        CareerOS now waits for your readonly Gmail sync before creating application records. Connect
                        Gmail, sync recent recruiting mail, then every extracted update goes through evidence and
                        review before it changes the pipeline.
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-tint-1)] p-3">
                          <span className="label">1. Configure</span>
                          <strong className="mt-1 block text-sm text-[var(--text-primary)]">Google OAuth env</strong>
                          <small className="mt-1 block text-xs leading-5 text-[var(--text-tertiary)]">
                            Add Gmail client id, secret, redirect URI, and readonly scope in `.env.local`.
                          </small>
                        </div>
                        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-tint-1)] p-3">
                          <span className="label">2. Connect</span>
                          <strong className="mt-1 block text-sm text-[var(--text-primary)]">Authorize Gmail</strong>
                          <small className="mt-1 block text-xs leading-5 text-[var(--text-tertiary)]">
                            Finish Google OAuth once. The encrypted token stays under `.careeros-data`.
                          </small>
                        </div>
                        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-tint-1)] p-3">
                          <span className="label">3. Process</span>
                          <strong className="mt-1 block text-sm text-[var(--text-primary)]">Sync and review</strong>
                          <small className="mt-1 block text-xs leading-5 text-[var(--text-tertiary)]">
                            Mailbox triage, extraction, Gemma when enabled, reminders, and review gates run together.
                          </small>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <form action="/api/connectors/gmail/connect" method="post">
                          <button className="btn btn-primary btn-sm" type="submit">
                            Connect Gmail
                          </button>
                        </form>
                        <form action="/api/connectors/gmail/sync" method="post">
                          <button className="button secondary" type="submit">
                            Sync recruiting mail
                          </button>
                        </form>
                        <Link href="/settings?section=gmail" className="button secondary">
                          Gmail setup
                        </Link>
                        <Link href="/judge-demo" className="button secondary">
                          View judge demo
                        </Link>
                      </div>
                    </article>
                  ) : null}
                  {state.applications.map((application) => {
                    const appEvents = recentEvents.filter((event) => event.applicationId === application.id);
                    const latest = appEvents[0];
                    return (
                      <article key={application.id} className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-tint-2)]">
                        <div className="p-3 sm:p-4">
                          <p className="break-words text-sm font-semibold text-[var(--text-primary)]">
                            {application.company}
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-[var(--text-tertiary)]">
                            {Math.max(appEvents.length, 1)} update
                            {Math.max(appEvents.length, 1) === 1 ? "" : "s"} · Latest {formatTimestamp(latest?.createdAt ?? application.updatedAt)}
                          </p>
                        </div>
                        <div className="border-t border-[var(--border)]">
                          <Link
                            href={`/applications/${application.id}`}
                            className="grid gap-2 px-3 py-2.5 transition-colors hover:bg-[var(--surface-tint-2)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:px-4 lg:py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold leading-5 text-[var(--text-primary)]">
                                {application.role}
                              </p>
                              <p className="text-[11px] leading-5 text-[var(--text-secondary)]">
                                {latest?.summary ?? `Current stage: ${stageLabel(application.stage)}`}
                              </p>
                            </div>
                            <span className="hidden w-fit rounded-full border border-[var(--border)] bg-[var(--surface-tint-3)] px-2 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)] lg:inline-flex lg:justify-self-end">
                              {stageLabel(application.stage)}
                            </span>
                          </Link>
                          {appEvents.length > 0 ? (
                            <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                              {appEvents.map((event) => (
                                <Link
                                  key={`${application.id}:${event.id}`}
                                  href={`/applications/${application.id}`}
                                  className="grid gap-2 px-3 py-2.5 transition-colors hover:bg-[var(--surface-tint-1)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:px-4 lg:py-3"
                                >
                                  <div className="flex min-w-0 gap-2.5">
                                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface-tint-4)]" aria-hidden="true" />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium leading-5 text-[var(--text-primary)]">
                                        {event.summary}
                                      </p>
                                      <p className="text-[11px] leading-5 text-[var(--text-tertiary)]">
                                        Logged {formatTimestamp(event.createdAt)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="lg:text-right">
                                    <span className={`badge max-lg:hidden ${activityTone(event.type)}`}>
                                      {event.source}
                                    </span>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          <div className="workspace-scroll-region min-h-0">
            <section className="card app-workspace-panel flex h-full min-h-0 flex-col p-0">
              <div className="shrink-0 px-5 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow">Needs attention</p>
                    <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                      Action queue
                    </h2>
                  </div>
                  <span className="badge bg-[var(--surface-elevated)] text-[var(--text-tertiary)]">
                    {activeNotifications.length}
                  </span>
                </div>
              </div>

              {activeNotifications.length === 0 ? (
                <div className="px-5 pt-4 pb-5">
                  <div className="card-elevated p-6">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      No action needed
                    </p>
                    <p className="mt-1 text-xs leading-6 text-[var(--text-tertiary)]">
                      Review decisions, reminders, connector issues, and model checks will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="workspace-scroll-region min-h-0 flex-1 px-5 pt-4 pb-5">
                  <div className="space-y-3">
                    {activeNotifications.slice(0, 8).map((notification) => (
                      <article key={notification.id} className="card-elevated min-w-0 px-3 py-2.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className={`badge ${reminderTone(notification.severity)}`}>
                            {notification.sourceType}
                          </span>
                          <span className="min-w-0 max-w-full truncate text-[11px] font-medium text-[var(--text-tertiary)] sm:ml-auto">
                            {formatTimestamp(notification.createdAt)}
                          </span>
                        </div>
                        <Link
                          href={notification.href}
                          className="mt-2 block min-w-0 break-words text-sm font-semibold leading-snug text-[var(--text-primary)] hover:underline"
                        >
                          {notification.title}
                        </Link>
                        <p className="mt-0.5 min-w-0 break-words text-xs text-[var(--text-secondary)]">
                          {notification.body}
                        </p>
                        <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                          <Link href={notification.href} className="btn btn-primary btn-sm min-w-0 max-w-full">
                            Open detail
                          </Link>
                          <span className="text-[11px] font-medium text-[var(--text-tertiary)]">
                            {notification.status}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
