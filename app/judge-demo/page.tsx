import Link from "next/link";
import { listProviderAdapters } from "@/lib/providers";
import { checkServerOllamaStatus } from "@/lib/server-state";

export const dynamic = "force-dynamic";

const agentStages = [
  {
    label: "01",
    title: "Mailbox triage agent",
    body: "Classifies recruiter mail, OA invites, follow-ups, rejections, offers, and vague emails with missing context.",
    output: "intent: recruiter_oa_follow_up"
  },
  {
    label: "02",
    title: "Workflow extraction agent",
    body: "Maps the thread to company, role, source, JD link, resume version, recruiter contact, deadline, and action.",
    output: "proposal: update_application"
  },
  {
    label: "03",
    title: "Evidence/review agent",
    body: "Attaches bounded evidence snippets and blocks low-confidence updates behind explicit review.",
    output: "review_gate: required"
  },
  {
    label: "04",
    title: "Resume/context agent",
    body: "Adds candidate context so the system can prioritize replies, fit, and preparation work.",
    output: "context: candidate_ready"
  },
  {
    label: "05",
    title: "Reminder/notification agent",
    body: "Creates deadline and follow-up notifications after review, then suppresses stale reminders once the thread moves.",
    output: "notify: oa_due_no_stale_followup"
  },
  {
    label: "06",
    title: "Model router/provider layer",
    body: "Prefers Gemma via Ollama Cloud when the API key is ready, falls back to deterministic parsing when unavailable.",
    output: "provider: gemma_or_rules"
  }
];

const mailboxThread = [
  {
    from: "candidate note",
    subject: "What role is this recruiter email for?",
    body: "I have 83 applications in a spreadsheet and cannot tell which role this OA belongs to.",
    tag: "real pain"
  },
  {
    from: "mira.chen@heliosdata.example",
    subject: "Helios Data online assessment reminder",
    body: "Your OA for the Machine Learning Platform Intern role is due Friday at 5:00 PM PT. Use the JD link from Handshake if you need the role details.",
    tag: "recruiter email"
  },
  {
    from: "mira.chen@heliosdata.example",
    subject: "Re: Helios Data online assessment reminder",
    body: "You applied with resume-ml-v4.pdf. Reply here when the OA is complete and I can confirm the next interview window.",
    tag: "evidence"
  }
];

const extractedUpdate = [
  ["Company", "Helios Data"],
  ["Role", "Machine Learning Platform Intern"],
  ["Source", "Handshake"],
  ["JD link", "helios.example/jobs/ml-platform-intern"],
  ["Resume version", "resume-ml-v4.pdf"],
  ["Recruiter contact", "Mira Chen"],
  ["Deadline", "May 15, 5:00 PM PT"],
  ["Next action", "Complete OA and suppress stale follow-up"],
  ["Confidence", "81%"]
];

const handoffSteps = [
  ["Email evidence", "random recruiter thread"],
  ["Structured proposal", "fields + confidence"],
  ["Review gate", "accept, correct, or dismiss"],
  ["Tracker state", "deadline + notification"]
];

const painSignals = [
  "random recruiter email with missing context",
  "spreadsheet drift after 50-100 applications",
  "stale follow-up reminders when the process moves",
  "JD, resume version, source, contact, and notes tracked together"
];

type ProviderTone = "hero" | "default" | "roadmap";

function providerTone(adapter: { id: string; implementation: string }): ProviderTone {
  if (adapter.implementation === "implemented" && adapter.id === "ollama") return "hero";
  if (adapter.implementation === "implemented") return "default";
  return "roadmap";
}

function providerStatusLabel(adapter: {
  implementation: string;
  kind: string;
  trust: string;
  id: string;
}): string {
  if (adapter.id === "ollama") return "Primary cloud path";
  if (adapter.id === "deterministic") return "Always available";
  if (adapter.kind === "hosted-byok") return "BYOK adapter roadmap";
  return "Advanced adapter roadmap";
}

function statusLabel(status: string) {
  if (status === "ready") return "Gemma ready";
  if (status === "model_missing") return "Gemma model missing";
  if (status === "unavailable") return "Ollama Cloud unreachable";
  if (status === "disabled") return "Deterministic fallback";
  return status.replaceAll("_", " ");
}

export default async function JudgeDemoPage() {
  const modelStatus = await checkServerOllamaStatus();
  const isGemmaReady = modelStatus.status === "ready";
  // Provider options come from the static adapter registry so this page,
  // the agent-pipeline snapshot, and /api/providers agree on what's shipped.
  const providerOptions = listProviderAdapters().map((adapter) => ({
    label: adapter.label,
    status: providerStatusLabel(adapter),
    detail: adapter.unlockGate ? `${adapter.summary} ${adapter.unlockGate}` : adapter.summary,
    tone: providerTone(adapter)
  }));

  return (
    <main className="app-scroll-main">
      <div className="workspace-shell fixed-workspace judge-agent-console mx-auto flex w-full max-w-[104rem] flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6">
        <header className="agent-console-hero workspace-fixed-top">
          <div>
            <p className="eyebrow">Kaggle Gemma 4 Good judge demo</p>
            <h1>CareerOS public demo: recruiting mail becomes a reviewed job pipeline</h1>
            <p>
              CareerOS is the limited open-source hackathon demo of the Other Candidate workflow at careeroc.com. This
              route uses sanitized sample mail, requires no Gmail or model key, and shows how Gemma via Ollama Cloud,
              deterministic fallback, evidence, and review gates work before state mutation.
            </p>
            <p className="review-demo-hint">
              It is not the full hosted Other Candidate source; it is the public demo/source repo for the agentic
              recruiting pipeline.
            </p>
            <div className="fact-strip pain-signal-row" aria-label="Job-search pain signals reflected in this demo">
              {painSignals.map((signal) => (
                <span key={signal}>{signal}</span>
              ))}
            </div>
            <div className="agent-hero-actions">
              <Link className="btn btn-primary btn-sm" href="/review">Open review gate</Link>
              <Link className="btn btn-secondary btn-sm" href="/settings?section=gmail">Connect Gmail sync</Link>
              <Link className="btn btn-secondary btn-sm" href="/settings">Set up Gemma</Link>
              <Link className="btn btn-secondary btn-sm" href="/api/pipeline">Inspect pipeline JSON</Link>
            </div>
          </div>
          <aside className="agent-runtime-panel" aria-label="Model runtime status">
            <img className="agent-runtime-mascot" src="/mascots/pixel-inbox-buddy-review-gate.svg" alt="" aria-hidden="true" />
            <span className={`agent-runtime-led ${isGemmaReady ? "ready" : "fallback"}`} />
            <p className="eyebrow">Model path</p>
            <strong>Gemma via Ollama Cloud</strong>
            <span>{statusLabel(modelStatus.status)} · {modelStatus.modelTag}</span>
            <small>No desktop model runtime. Deterministic fallback remains available.</small>
          </aside>
        </header>

        <div className="workspace-scroll-region agent-console-scroll">
          <section className="agent-console-grid">
            <aside className="agent-pipeline-panel">
              <div className="agent-panel-head">
                <p className="eyebrow">Agent handoff</p>
                <h2>Mailbox to pipeline state</h2>
              </div>
              <div className="agent-stage-list">
                {agentStages.map((stage) => (
                  <article className="agent-stage" key={stage.label}>
                    <span>{stage.label}</span>
                    <div>
                      <h3>{stage.title}</h3>
                      <p>{stage.body}</p>
                      <code>{stage.output}</code>
                    </div>
                  </article>
                ))}
              </div>
            </aside>

            <section className="mailbox-transform-panel">
              <div className="agent-panel-head">
                <p className="eyebrow">Live demo object</p>
                <h2>Random recruiter email becomes a reviewed tracker update</h2>
              </div>
              <div className="mail-thread">
                {mailboxThread.map((message) => (
                  <article className="mail-message" key={message.subject}>
                    <div className="mail-message-meta">
                      <span>{message.tag}</span>
                      <small>{message.from}</small>
                    </div>
                    <h3>{message.subject}</h3>
                    <p>{message.body}</p>
                  </article>
                ))}
              </div>

              <div className="handoff-rail" aria-label="Evidence to state handoff">
                {handoffSteps.map(([label, detail], index) => (
                  <div key={label}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </div>
                ))}
              </div>

              <div className="extraction-card">
                <div className="agent-panel-head compact">
                  <p className="eyebrow">Extracted application proposal</p>
                  <span className="badge warn">Review required</span>
                </div>
                <div className="extraction-grid">
                  {extractedUpdate.map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="trace-review-panel">
              <div className="agent-panel-head">
                <p className="eyebrow">Trace and review gate</p>
                <h2>Evidence before state changes</h2>
              </div>
              <div className="trace-stack">
                <article>
                  <span className="badge info">provider: ollama/{modelStatus.modelTag}</span>
                  <p>Gemma produces a bounded proposal through Ollama Cloud. If unavailable, deterministic parsing keeps the demo usable.</p>
                </article>
                <article>
                  <p className="eyebrow">Evidence snippets</p>
                  <blockquote>"OA for the Machine Learning Platform Intern role is due Friday at 5:00 PM PT"</blockquote>
                  <blockquote>"applied with resume-ml-v4.pdf"</blockquote>
                </article>
                <article className="review-gate-card">
                  <p className="eyebrow">Review decision</p>
                  <strong>The review gate blocks state changes until the candidate confirms the mapping.</strong>
                  <p className="review-demo-hint">
                    Accept, correct, or dismiss happens in the live review queue after Gmail sync or local import.
                  </p>
                </article>
                <article className="notification-output">
                  <p className="eyebrow">Generated after review</p>
                  <strong>OA deadline approaching; stale follow-up suppressed</strong>
                  <span>Helios Data - May 15, 5:00 PM PT - linked to source thread and JD</span>
                </article>
              </div>
            </aside>
          </section>

          <section className="agent-setup-strip">
            <div>
              <p className="eyebrow">Setup and provider boundary</p>
              <h2>Privacy-first demo with a model-pluggable architecture</h2>
              <p>
                The judge demo works without keys. For a real workspace, add Google OAuth env values, connect readonly
                Gmail, add OLLAMA_API_KEY for Ollama Cloud, then sync recruiting mail into the same review-gated agent
                pipeline. Other hosted providers remain adapter or BYOK extension points unless explicitly implemented.
              </p>
            </div>
            <div className="handoff-rail" aria-label="Live demo setup path">
              <div>
                <span>01</span>
                <strong>.env.local</strong>
                <small>Set Google OAuth and optional OLLAMA_API_KEY.</small>
              </div>
              <div>
                <span>02</span>
                <strong>Connect Gmail</strong>
                <small>Readonly OAuth stores a local token under .careeros-data.</small>
              </div>
              <div>
                <span>03</span>
                <strong>Enable Ollama Cloud</strong>
                <small>CareerOS calls https://ollama.com/api from the server.</small>
              </div>
              <div>
                <span>04</span>
                <strong>Review output</strong>
                <small>Mailbox triage, extraction, evidence, and notifications stay inspectable.</small>
              </div>
            </div>
            <div className="provider-option-grid">
              {providerOptions.map((option) => (
                <article className={`provider-option provider-option-${option.tone}`} key={option.label}>
                  <span>{option.label}</span>
                  <strong>{option.status}</strong>
                  <small>{option.detail}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="agent-proof-band">
            <p className="eyebrow">Product proof</p>
            <strong>Built from a real high-volume recruiting workflow with offers, OA deadlines, and recruiter follow-ups.</strong>
            <span>The technical story is the review-gated Gemma pipeline — every claim is reproducible from sanitized fixtures.</span>
          </section>
        </div>
      </div>
    </main>
  );
}
