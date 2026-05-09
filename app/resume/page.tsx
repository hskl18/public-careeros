import { readServerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

const RESUME_EVALUATION_LIMIT = 20;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(value)
  );
}

export default async function ResumePage() {
  const state = await readServerState();
  const completed = state.resumeEvaluations.filter((item) => item.status === "completed");
  const blocked = state.resumeEvaluations.filter((item) => item.status === "blocked_by_review");
  const latestDocument = state.resumeDocuments[0];
  const latestEvaluation = state.resumeEvaluations.find((item) => item.resumeDocumentId === latestDocument?.id);
  const visibleEvaluations = state.resumeEvaluations.slice(0, RESUME_EVALUATION_LIMIT);

  return (
    <div className="page resume-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Resume</p>
          <h1>Analyze local resume text</h1>
          <p className="subtle">
            Paste a resume, keep the raw text local, and route weak extraction results through correction before applying them.
          </p>
        </div>
        <div className="header-stack">
          <span className={completed.length ? "badge ok" : "badge warn"}>{completed.length} complete</span>
          <span className={blocked.length ? "badge warn" : "badge ok"}>{blocked.length} need correction</span>
        </div>
      </header>

      <section className="grid two">
        <article className="section">
          <div className="section-title">
            <div>
              <h2>Paste or upload resume</h2>
              <p className="subtle">The demo runtime accepts pasted text. Upload support is represented as a disabled local control.</p>
            </div>
          </div>
          <form className="form" action="/api/resume" method="post">
            <label>
              Title
              <input name="title" placeholder="Software engineering resume" />
            </label>
            <label>
              Resume text
              <textarea
                name="text"
                placeholder="Experience: ... Projects: ... Skills: ..."
                required
                rows={11}
              />
            </label>
            <div className="actions">
              <button className="button" name="intent" type="submit" value="analyze">
                Analyze resume
              </button>
              <button className="button secondary" name="intent" type="submit" value="save">
                Save draft only
              </button>
              <button className="button secondary" disabled type="button">
                Upload PDF disabled
              </button>
            </div>
          </form>
        </article>

        <article className="section">
          <div className="section-title">
            <h2>Analysis status</h2>
            <span className={latestEvaluation?.status === "completed" ? "badge ok" : "badge warn"}>
              {latestEvaluation?.status ?? "not analyzed"}
            </span>
          </div>
          <div className="state-matrix single">
            <div className="state-cell">
              <span className="label">Resume text pasted but not analyzed</span>
              <strong>{latestDocument && !latestEvaluation ? "Pending" : "Ready path"}</strong>
              <small>Text can exist before evaluation; the correction path remains visible instead of hiding uncertainty.</small>
            </div>
            <div className="state-cell">
              <span className="label">Resume analysis complete</span>
              <strong>{completed.length ? `${completed.length} completed` : "No completed pass"}</strong>
              <small>Completed evaluations still keep gaps editable before you reuse bullets in applications.</small>
            </div>
            <div className="state-cell">
              <span className="label">Correction path</span>
              <strong>{blocked.length ? "Required" : "Available"}</strong>
              <small>Short or weak input is marked blocked by review and asks for more evidence.</small>
            </div>
          </div>
        </article>
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <h2>Resume evaluations</h2>
            <p className="subtle">
              Showing {visibleEvaluations.length} of {state.resumeEvaluations.length}. Newest evaluations first, with
              deterministic confidence and correction guidance.
            </p>
          </div>
          {state.resumeEvaluations.length > visibleEvaluations.length ? (
            <span className="badge info">+{state.resumeEvaluations.length - visibleEvaluations.length} older</span>
          ) : null}
        </div>
        {state.resumeEvaluations.length ? (
          <div className="list">
            {visibleEvaluations.map((evaluation) => {
              const resume = state.resumeDocuments.find((item) => item.id === evaluation.resumeDocumentId);
              return (
                <article className="card" key={evaluation.id}>
                  <div className="row split">
                    <div>
                      <h3>{resume?.title ?? "Resume"}</h3>
                      <p className="subtle">
                        {dateLabel(evaluation.createdAt)} · confidence {Math.round(evaluation.confidence * 100)}%
                      </p>
                    </div>
                    <span className={evaluation.status === "completed" ? "badge ok" : "badge warn"}>
                      {evaluation.status}
                    </span>
                  </div>
                  <p>{evaluation.summary}</p>
                  <div className="grid two compact">
                    <div className="tile">
                      <span className="label">Strengths</span>
                      <strong>{evaluation.strengths.join(", ")}</strong>
                    </div>
                    <div className="tile">
                      <span className="label">Gaps to correct</span>
                      <strong>{evaluation.gaps.join(", ")}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">No resume has been analyzed yet. Paste text above to create the first local result.</div>
        )}
      </section>
    </div>
  );
}
