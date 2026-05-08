import { FileText, Upload } from "lucide-react";
import { applications, resumeState, stateVariants } from "@/lib/demo-data";
import { StateMatrix } from "@/components/state-panels";
import { PageHeader, SectionHeader, StatusPill } from "@/components/ui";

export default function ResumePage() {
  const resumeVariants = stateVariants.filter((item) => item.owner === "resume" || item.owner === "model");

  return (
    <main className="content">
      <PageHeader
        eyebrow="Resume intelligence"
        title="Local resume context"
        description="Paste or upload locally, run deterministic extraction first, optionally enable Gemma-backed analysis, and review corrections before changing the resume."
        action={
          <>
            <button className="button secondary" type="button">
              <Upload size={15} aria-hidden="true" />
              Upload
            </button>
            <button className="button" type="button">
              <FileText size={15} aria-hidden="true" />
              Paste resume
            </button>
          </>
        }
      />

      <section className="grid-2">
        <div className="section">
          <SectionHeader eyebrow="Resume input" title="Paste or upload locally" />
          <textarea
            className="input-shell"
            defaultValue={
              "Paste a resume here for deterministic section extraction. Gemma-backed evaluation stays disabled until the model health check passes."
            }
            aria-label="Resume paste area"
          />
          <div className="toolbar">
            <StatusPill tone="info">uploaded but not analyzed supported</StatusPill>
            <StatusPill tone="good">analysis complete supported</StatusPill>
            <StatusPill tone="warn">model unavailable supported</StatusPill>
          </div>
        </div>

        <div className="section">
          <SectionHeader eyebrow="Resume states" title="Upload, analysis, and correction path" />
          <StateMatrix owner="resume" />
        </div>
      </section>

      <section className="grid-2">
        <div className="section">
          <SectionHeader eyebrow="Analysis summary" title={resumeState.mode} />
          <div className="metric">
            <p className="eyebrow">Latest result</p>
            <p className="metric-value">{resumeState.score}</p>
            <p className="muted">{resumeState.summary}</p>
          </div>
          <div className="grid-2">
            {resumeState.sections.map(([label, value]) => (
              <article key={label} className="row-card">
                <p className="eyebrow">{label}</p>
                <p className="small muted">{value}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="section">
          <SectionHeader eyebrow="State coverage" title="Safe resume states" />
          <div className="scroll-list">
            {resumeVariants.map((variant) => (
              <article key={variant.id} className="row-card">
                <StatusPill tone={variant.tone}>{variant.label}</StatusPill>
                <p className="small muted" style={{ marginTop: 8 }}>
                  {variant.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid-3">
        <div className="section">
          <SectionHeader eyebrow="Gaps" title="Suggested edits" />
          <div className="list">
            {resumeState.gaps.map((gap) => (
              <article key={gap} className="row-card">
                <p className="small muted">{gap}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="section">
          <SectionHeader eyebrow="Corrections" title="Review before accepting" />
          <div className="list">
            {resumeState.corrections.map((correction) => (
              <article key={correction} className="row-card">
                <p className="small muted">{correction}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="section">
          <SectionHeader eyebrow="Matched context" title="Applications" />
          <div className="list">
            {applications.slice(0, 3).map((application) => (
              <article key={application.id} className="row-card">
                <h3>{application.company}</h3>
                <p className="small muted">{application.role} · {application.nextAction}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
