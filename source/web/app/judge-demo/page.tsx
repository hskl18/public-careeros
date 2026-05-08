import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicSiteFooter,
  PublicSiteNav,
} from "@/components/public-site-chrome";
import {
  PublicSignalIcon,
  type PublicSignalIconName,
} from "@/components/public-signal-icon";
import { PublicJsonLd } from "@/components/public-json-ld";
import { buildPageMetadata } from "@/lib/site-metadata";

const pageTitle = "Judge demo dashboard";
const pageDescription =
  "Inspect an anonymized Other Candidate sample workspace with recruiting threads, application state, review gates, resume context, and Gemma traces without connecting Gmail.";

const judgeDemoFaq = [
  {
    question: "Does the judge demo require Gmail, sign-in, or an API?",
    answer:
      "No. The judge demo is a public read-only route with anonymized static sample data, so judges can inspect the workflow without connecting Gmail, signing in, or calling the backend.",
  },
  {
    question: "What does the Gemma trace panel show?",
    answer:
      "Each sample thread shows the model path, confidence, evidence source, review-gate outcome, and fallback behavior so the demo can be judged from visible evidence.",
  },
];

export const metadata: Metadata = buildPageMetadata({
  title: pageTitle,
  description: pageDescription,
  path: "/judge-demo",
  keywords: [
    "Gemma hackathon demo",
    "AI recruiting email demo",
    "job application pipeline demo",
  ],
});

const demoMetrics = [
  ["Applications", "3", "all source-backed"],
  ["Needs action", "1", "assessment due"],
  ["In review", "1", "blocked safely"],
  ["Trace cards", "4", "thread + artifact evidence"],
];

const demoThreads: Array<{
  icon: PublicSignalIconName;
  company: string;
  role: string;
  subject: string;
  status: string;
  evidence: string;
  modelPath: string;
  confidence: string;
  evidenceSource: string;
  reviewGateOutcome: string;
  fallbackBehavior: string;
  traceSummary: string;
  tone: string;
}> = [
  {
    icon: "mail",
    company: "Northstar Labs",
    role: "Software Engineer Intern",
    subject: "Interview availability for next week",
    status: "Interviewing",
    evidence:
      "Recruiter asked for Tuesday or Thursday availability and confirmed the role title.",
    modelPath: "gemma4:31b-cloud",
    confidence: "0.91",
    evidenceSource: "Gmail thread: interview availability, recruiter reply",
    reviewGateOutcome: "Trusted interview update; application stage can advance.",
    fallbackBehavior: "deterministic parse preserves the schedule clue if Gemma is unavailable",
    traceSummary:
      "deterministic filter -> Gemma extraction -> review evidence accepts update",
    tone: "border-[var(--blue)]/28 bg-[var(--blue-soft)]",
  },
  {
    icon: "clock",
    company: "Atlas Robotics",
    role: "Backend Engineer",
    subject: "Online assessment due Friday",
    status: "Needs action",
    evidence:
      "Assessment invite includes a Friday deadline and a one-hour completion window.",
    modelPath: "gemma4:31b-cloud",
    confidence: "0.88",
    evidenceSource: "Gmail thread: assessment invite with explicit due date",
    reviewGateOutcome: "Trusted deadline; reminder creation is allowed.",
    fallbackBehavior: "deterministic parse keeps the Friday deadline as the safe fallback",
    traceSummary:
      "deterministic filter -> Gemma extraction -> deadline reminder created",
    tone: "border-[var(--accent)]/30 bg-[var(--accent-soft)]",
  },
  {
    icon: "review",
    company: "Unknown Company",
    role: "Product Engineering role",
    subject: "Next steps for your application",
    status: "Needs review",
    evidence:
      "Sender mentions next steps but does not clearly identify the company or exact role.",
    modelPath: "gemma4:31b-cloud",
    confidence: "0.54",
    evidenceSource: "Gmail thread: weak sender identity and ambiguous next steps",
    reviewGateOutcome: "Blocked; no application mutation until a human confirms it.",
    fallbackBehavior: "manual review because deterministic parse cannot safely match the application",
    traceSummary:
      "deterministic filter -> Gemma extraction -> review gate blocks mutation",
    tone: "border-[var(--red)]/24 bg-[var(--red-soft)]",
  },
];

const multimodalArtifact = {
  artifactType: "Anonymized interview screenshot",
  title: "Calendar invite screenshot from recruiter",
  tiedApplication: "Northstar Labs · Software Engineer Intern",
  extractedFact: "Technical interview: Tuesday, May 12 at 10:30 AM PT.",
  confidence: "0.86",
  sourceSnippet:
    "Tech Screen · Tue May 12 · 10:30 AM PT · 45 min · video link hidden",
  reviewBehavior:
    "Accepted as schedule evidence; route to manual review if the date/time or company cannot be read.",
  modelPath: "gemma4:31b-cloud",
};

const reviewFacts = [
  ["Why blocked", "Company evidence is weak and role could attach to the wrong application."],
  ["Human action", "Confirm company, role, and whether a reminder should be created."],
  ["After save", "Correction would update the pipeline and leave a durable review trace."],
];

const resumeSignals = [
  ["Latest score", "84/100"],
  ["Mailbox context", "Interview signal from Northstar Labs"],
  ["Gap", "Backend systems bullets need stronger metrics"],
];

const traceRows = [
  ["Provider", "Ollama"],
  ["Model", "gemma4:31b-cloud"],
  ["Purpose", "workflow_extraction / review_evidence / resume_evaluation"],
  ["Fallback", "deterministic parse or manual review"],
];

export default function JudgeDemoPage() {
  return (
    <main className="public-landing-page flex-1 px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
      <PublicJsonLd
        title={pageTitle}
        description={pageDescription}
        path="/judge-demo"
        pageType="CollectionPage"
        includeProduct
        breadcrumbLabel="Judge demo"
        faq={judgeDemoFaq}
      />
      <div className="mx-auto grid max-w-[1600px] gap-4">
        <PublicSiteNav current="showcase" />

        <section className="paper-card public-feature-card border border-[var(--border)] p-5 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1fr)]">
            <div>
              <p className="eyebrow text-[var(--ink-blue)]">
                Judge demo · anonymized sample data
              </p>
              <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-[1.12] text-[var(--ink-black)] sm:text-5xl sm:leading-[1.08]">
                A fake-user dashboard that shows the full recruiting loop.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--ink-black)]/74 sm:text-lg sm:leading-relaxed">
                This route is read-only and does not require Gmail access. It
                shows how Other Candidate turns sanitized recruiting mail into
                application state, reminders, review items, resume context, and
                traceable Gemma decisions.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/showcase" className="btn btn-secondary">
                  Back to demo path
                </Link>
                <Link href="/tech" className="btn btn-primary">
                  Open architecture
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {demoMetrics.map(([label, value, hint]) => (
                <div
                  key={label}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
                >
                  <p className="typewriter-text text-[0.66rem] uppercase tracking-[0.18em] text-[var(--ink-blue)]">
                    {label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[var(--ink-black)]">
                    {value}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ink-black)]/62">
                    {hint}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.62fr)]">
          <div className="grid gap-4">
            <section className="paper-card border border-[var(--border-active)] p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow text-[var(--ink-blue)]">Sample inbox</p>
                  <h2 className="mt-2 text-2xl font-bold text-[var(--ink-black)]">
                    Three recruiting threads, one fake user.
                  </h2>
                </div>
                <span className="w-fit rounded-full border border-[var(--green)]/30 bg-[var(--green-soft)] px-3 py-1 text-xs font-bold text-[var(--green)]">
                  Gmail not required
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                {demoThreads.map((thread) => (
                  <article
                    key={thread.subject}
                    className={`rounded-xl border p-4 ${thread.tone}`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                      <PublicSignalIcon icon={thread.icon} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-bold text-[var(--ink-black)]">
                              {thread.company} · {thread.role}
                            </p>
                            <h3 className="mt-1 text-lg font-bold leading-tight text-[var(--ink-black)]">
                              {thread.subject}
                            </h3>
                          </div>
                          <span className="w-fit rounded-full border border-[var(--ink-black)]/12 bg-[var(--surface-elevated)] px-3 py-1 text-xs font-bold text-[var(--ink-black)]/72">
                            {thread.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-medium leading-6 text-[var(--ink-black)]/70">
                          {thread.evidence}
                        </p>
                        <p className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--ink-black)]/68">
                          {thread.traceSummary}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="paper-card border border-[var(--border-active)] p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow text-[var(--ink-blue)]">
                    Multimodal evidence demo
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-[var(--ink-black)]">
                    One static artifact becomes schedule evidence.
                  </h2>
                </div>
                <span className="w-fit rounded-full border border-[var(--ink-black)]/12 bg-[var(--surface-elevated)] px-3 py-1 text-xs font-bold text-[var(--ink-black)]/72">
                  No upload · no API
                </span>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1fr)]">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
                  <div className="rounded-lg border border-[var(--ink-black)]/16 bg-[var(--paper)] p-3 shadow-[0_12px_30px_rgba(23,37,84,0.08)]">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                      <div>
                        <p className="typewriter-text text-[0.62rem] uppercase tracking-[0.18em] text-[var(--ink-blue)]">
                          {multimodalArtifact.artifactType}
                        </p>
                        <p className="mt-1 text-sm font-bold text-[var(--ink-black)]">
                          {multimodalArtifact.title}
                        </p>
                      </div>
                      <span className="rounded-full border border-[var(--green)]/30 bg-[var(--green-soft)] px-2 py-1 text-[0.64rem] font-bold text-[var(--green)]">
                        sanitized
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs font-semibold text-[var(--ink-black)]/70">
                      <div className="rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2">
                        Northstar Labs recruiting
                      </div>
                      <div className="rounded-md border border-[var(--blue)]/26 bg-[var(--blue-soft)] px-3 py-2">
                        Technical interview · Tue May 12 · 10:30 AM PT
                      </div>
                      <div className="rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2">
                        Video link hidden · candidate name hidden
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  {[
                    ["Tied application", multimodalArtifact.tiedApplication],
                    ["Extracted fact", multimodalArtifact.extractedFact],
                    ["Confidence", multimodalArtifact.confidence],
                    ["Source evidence", multimodalArtifact.sourceSnippet],
                    ["Review behavior", multimodalArtifact.reviewBehavior],
                    ["Model path", multimodalArtifact.modelPath],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2"
                    >
                      <p className="typewriter-text text-[0.62rem] uppercase text-[var(--ink-blue)]">
                        {label}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-5 text-[var(--ink-black)]/72">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="paper-card border border-[var(--border)] p-5">
                <p className="eyebrow text-[var(--ink-blue)]">Review gate</p>
                <h2 className="mt-2 text-xl font-bold text-[var(--ink-black)]">
                  Ambiguous update pauses before mutation.
                </h2>
                <div className="mt-4 grid gap-2">
                  {reviewFacts.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2"
                    >
                      <p className="typewriter-text text-[0.62rem] uppercase text-[var(--ink-blue)]">
                        {label}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-5 text-[var(--ink-black)]/70">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="paper-card border border-[var(--border)] p-5">
                <p className="eyebrow text-[var(--ink-blue)]">Resume context</p>
                <h2 className="mt-2 text-xl font-bold text-[var(--ink-black)]">
                  Resume feedback is tied to mailbox outcomes.
                </h2>
                <div className="mt-4 grid gap-2">
                  {resumeSignals.map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2"
                    >
                      <span className="typewriter-text text-[0.62rem] uppercase text-[var(--ink-blue)]">
                        {label}
                      </span>
                      <span className="text-right text-sm font-bold text-[var(--ink-black)]/72">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="paper-card h-fit border border-[var(--border-active)] p-5 sm:p-6">
            <p className="eyebrow text-[var(--ink-blue)]">Gemma trace</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-[var(--ink-black)]">
              The demo is fake data; the model path matches production config.
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-[var(--ink-black)]/70">
              Judge data is anonymized, but the displayed runtime contract
              mirrors the deployed environment: deterministic checks first,
              Gemma through Ollama where semantics matter, and review when the
              result should not write automatically.
            </p>
            <div className="mt-4 grid gap-2">
              {traceRows.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2"
                >
                  <p className="typewriter-text text-[0.62rem] uppercase text-[var(--ink-blue)]">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-bold leading-5 text-[var(--ink-black)]/74">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3">
              {demoThreads.map((thread) => (
                <article
                  key={thread.subject}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold leading-tight text-[var(--ink-black)]">
                        {thread.company}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ink-black)]/58">
                        {thread.subject}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--ink-black)]/12 bg-[var(--surface-strong)] px-2 py-1 text-[0.64rem] font-bold text-[var(--ink-black)]/70">
                      {thread.confidence}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {[
                      ["Model path", thread.modelPath],
                      ["Evidence source", thread.evidenceSource],
                      ["Review-gate outcome", thread.reviewGateOutcome],
                      ["Fallback behavior", thread.fallbackBehavior],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-lg border border-[var(--border)] bg-[var(--paper)]/72 px-3 py-2"
                      >
                        <p className="typewriter-text text-[0.58rem] uppercase text-[var(--ink-blue)]">
                          {label}
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ink-black)]/70">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <PublicSiteFooter />
      </div>
    </main>
  );
}
