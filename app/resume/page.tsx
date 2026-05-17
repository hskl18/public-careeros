import type { ReactNode } from "react";
import Link from "next/link";
import { checkServerOllamaStatus, readServerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

function dateLabel(value?: string) {
  return value
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value))
    : "not filed";
}

export default async function ResumePage() {
  const [state, modelStatus] = await Promise.all([readServerState(), checkServerOllamaStatus()]);
  const latestDocument = state.resumeDocuments[0];
  const latestEvaluation = state.resumeEvaluations.find((item) => item.resumeDocumentId === latestDocument?.id);
  const fallbackEvaluation =
    latestEvaluation?.source === "ollama" && latestEvaluation.status === "blocked_by_review"
      ? state.resumeEvaluations.find(
          (item) => item.resumeDocumentId === latestDocument?.id && item.source === "deterministic"
        )
      : undefined;
  const skills = latestEvaluation?.strengths.length ?? 0;
  const gaps = latestEvaluation?.gaps.length ?? 0;
  const score = latestEvaluation ? Math.round(latestEvaluation.confidence * 100) : 0;
  const analysisMode = latestEvaluation?.source === "ollama" ? "Gemma via Ollama Cloud" : "Deterministic fallback";
  const modelReady = modelStatus.status === "ready";

  return (
    <main className="app-scroll-main">
      <div className="workspace-shell resume-workspace mx-auto w-full max-w-[104rem] px-3 py-4 sm:px-5 sm:py-6">
        <section className="card app-workspace-panel resume-dossier overflow-hidden p-0">
          <header className="resume-dossier-head">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge info">Dossier</span>
                <span className="badge">{analysisMode}</span>
                <span className="badge info">Review-gated output</span>
                {latestEvaluation?.status === "blocked_by_review" ? <span className="badge warning">Review blocked</span> : null}
              </div>
              <h1 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">
                {latestDocument?.title ?? "Candidate context not set"}
              </h1>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                saved {dateLabel(latestDocument?.createdAt)} - {latestEvaluation?.status ?? "not analyzed"}
              </p>
            </div>
            <div className="resume-score-grid">
              {[
                ["Overall", score],
                ["Skills", skills],
                ["Gaps", gaps],
                ["Sections", latestDocument?.sections.length ?? 0]
              ].map(([label, value]) => (
                <div className="metric-filter" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </header>

          <div className="resume-dossier-body">
            <aside className="resume-agent-rail">
              <p className="eyebrow">Resume agents</p>
              {(() => {
                const activeIndex = latestEvaluation ? 3 : latestDocument ? 1 : 0;
                const steps: Array<[string, string, string]> = [
                  ["01", "Ingest", latestDocument ? "resume source saved" : "waiting for text"],
                  ["02", "Extract", `${latestDocument?.sections.length ?? 0} sections`],
                  ["03", "Correct", latestEvaluation?.status === "blocked_by_review" ? "needs edits" : "0 saved edits"],
                  ["04", "Review", latestEvaluation ? `${score}/100 recruiter score` : "not analyzed"]
                ];
                return steps.map(([step, title, detail], index) => (
                  <div className={`resume-agent-step ${index === activeIndex ? "active" : ""}`} key={step}>
                    <span>{step}</span>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </div>
                ));
              })()}
            </aside>

            <section className="resume-dossier-content">
              <ResumeSection number="01" status={latestDocument ? "Saved" : "Empty"} title="Paste resume text">
                <form className="form" action="/api/resume" method="post">
                  <label>
                    <span className="label">Title</span>
                    <input
                      name="title"
                      defaultValue={latestDocument?.title ?? ""}
                      placeholder="resume-product-v3.pdf"
                      required
                    />
                  </label>
                  <label>
                    <span className="label">Resume text</span>
                    <textarea
                      name="text"
                      placeholder="Experience: ... Projects: ... Skills: ..."
                      required
                      rows={8}
                      defaultValue={latestDocument?.text ?? ""}
                    />
                  </label>
                  <div className="actions">
                    <button className="button primary" name="intent" type="submit" value="analyze">Analyze resume</button>
                    <button className="button secondary" name="intent" type="submit" value="save">Save draft only</button>
                  </div>
                </form>
              </ResumeSection>

              <section className="resume-first-run-path" aria-label="Resume analysis path">
                <div>
                  <p className="eyebrow">Candidate context path</p>
                  <h2>Add resume context so mailbox updates can be judged against the candidate.</h2>
                  <p>
                    Deterministic extraction is always available. Gemma via Ollama Cloud is optional and only becomes
                    model-backed when your API key and model tag pass the readiness check.
                  </p>
                  {!latestDocument ? (
                    <div className="actions mt-3">
                      <Link className="button primary" href="/judge-demo">Open judge demo</Link>
                      <Link className="button secondary" href="/settings">Set up Gemma</Link>
                    </div>
                  ) : null}
                </div>
                <div className="resume-path-grid">
                  {[
                    ["01", "Paste", latestDocument ? "local text saved" : "waiting for resume text"],
                    ["02", "Analyze", latestEvaluation ? analysisMode : "not analyzed"],
                    ["03", "Inspect", latestEvaluation?.status === "blocked_by_review" ? "review-gated" : "ready for review"],
                    ["04", "Correct", "user edits stay local"]
                  ].map(([step, label, detail]) => (
                    <article key={step}>
                      <span>{step}</span>
                      <strong>{label}</strong>
                      <small>{detail}</small>
                    </article>
                  ))}
                </div>
              </section>

              <section className="resume-model-state" aria-label="Resume model state">
                <div>
                  <span>Active mode</span>
                  <strong>{analysisMode}</strong>
                  <small>
                    {latestEvaluation?.source === "ollama"
                      ? "Model-backed Gemma analysis is schema-checked and review-gated before it can affect application context."
                      : "Deterministic fallback keeps resume context usable without Ollama Cloud, API keys, or downloads."}
                  </small>
                </div>
                <div>
                  <span>Optional Gemma</span>
                  <strong>{modelReady ? `${modelStatus.modelTag} ready` : `${modelStatus.status}`}</strong>
                  <small>
                    {modelReady
                      ? "Resume analysis can use Ollama Cloud when requested."
                      : "Connect Gemma in Settings when you want model-backed proposals."}
                  </small>
                </div>
                <div>
                  <span>Blocked output</span>
                  <strong>{latestEvaluation?.status === "blocked_by_review" ? "Review-gated" : "No blocker"}</strong>
                  <small>Invalid or uncertain model output is kept for review instead of being treated as a silent failure.</small>
                </div>
              </section>

              <ResumeSection number="02" status={latestEvaluation ? "Parsed" : "Waiting"} title="Summary">
                <div className="resume-field">
                    {latestEvaluation?.summary ?? "Paste resume text above, then analyze it to create a local resume profile."}
                </div>
                {latestEvaluation?.diagnostic ? (
                  <div className="resume-field mt-3">
                    <span>Analysis path</span>
                    <strong>
                      {latestEvaluation.source === "ollama" ? `Gemma via Ollama Cloud${latestEvaluation.modelTag ? ` (${latestEvaluation.modelTag})` : ""}` : "Deterministic fallback"}
                    </strong>
                    <small>{latestEvaluation.diagnostic}</small>
                  </div>
                ) : null}
                {fallbackEvaluation ? (
                  <div className="resume-field mt-3">
                    <span>Deterministic fallback</span>
                    <strong>{fallbackEvaluation.summary}</strong>
                    <small>Kept because model-backed resume output is blocked until the user reviews it.</small>
                  </div>
                ) : null}
              </ResumeSection>

              <ResumeSection number="03" status={latestEvaluation ? "Parsed" : "Waiting"} title="Strengths and gaps">
                <div className="resume-field-grid">
                  <ResumeField label="Strengths" value={latestEvaluation?.strengths.join(", ") || "Not analyzed"} />
                  <ResumeField label="Gaps" value={latestEvaluation?.gaps.join(", ") || "Not analyzed"} />
                </div>
              </ResumeSection>

              {latestDocument?.sections.length ? (
                <ResumeSection number="04" status="Parsed" title="Detected sections">
                  <ul className="resume-section-list">
                    {latestDocument.sections.map((section) => (
                      <li key={section}>{section}</li>
                    ))}
                  </ul>
                </ResumeSection>
              ) : null}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function ResumeSection({ number, status, title, children }: { number: string; status: string; title: string; children: ReactNode }) {
  return (
    <article className="resume-section">
      <header>
        <span>{number}</span>
        <small>{status}</small>
        <strong>{title}</strong>
      </header>
      {children}
    </article>
  );
}

function ResumeField({ label, value }: { label: string; value: string }) {
  return (
    <div className="resume-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
