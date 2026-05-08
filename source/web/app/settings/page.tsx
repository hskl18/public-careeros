import { AlertTriangle, CheckCircle2, Copy, RotateCcw, Trash2 } from "lucide-react";
import { settingsSections, stateVariants } from "@/lib/demo-data";
import { PageHeader, SectionHeader, StatusPill } from "@/components/ui";

export default function SettingsPage() {
  return (
    <main className="content">
      <PageHeader
        eyebrow="Local setup"
        title="Settings"
        description="Configure local data, optional Ollama/Gemma, optional Gmail, privacy, import/export, and destructive actions without requiring hosted providers."
        action={
          <>
            <button className="button secondary" type="button">
              <RotateCcw size={15} aria-hidden="true" />
              Run health check
            </button>
            <button className="button" type="button">
              Export local data
            </button>
          </>
        }
      />

      <section className="settings-grid">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <article key={section.id} className="section">
              <div className="row-top">
                <div>
                  <p className="eyebrow">{section.id}</p>
                  <h2>{section.title}</h2>
                </div>
                <StatusPill tone="info">
                  <Icon size={14} aria-hidden="true" />
                </StatusPill>
              </div>
              <div className="list">
                {section.rows.map(([label, value]) => (
                  <div key={label} className="row-card">
                    <p className="eyebrow">{label}</p>
                    <p className="small muted">{value}</p>
                    {label === "Pull command" ? (
                      <button className="button secondary" type="button" style={{ marginTop: 10 }}>
                        <Copy size={15} aria-hidden="true" />
                        Copy command
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="section">
        <SectionHeader eyebrow="Global states" title="Configured, offline, missing, and blocked states" />
        <div className="grid-3">
          {stateVariants.map((variant) => (
            <article key={variant.id} className="row-card">
              <div className="row-top">
                <StatusPill tone={variant.tone}>{variant.label}</StatusPill>
                {variant.tone === "good" ? (
                  <CheckCircle2 size={17} color="var(--green)" aria-hidden="true" />
                ) : variant.tone === "danger" || variant.tone === "warn" ? (
                  <AlertTriangle size={17} color="var(--amber)" aria-hidden="true" />
                ) : null}
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>
                {variant.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeader eyebrow="Destructive confirmation" title="Delete local data" />
        <article className="row-card">
          <StatusPill tone="danger">
            <Trash2 size={14} aria-hidden="true" />
            confirmation required
          </StatusPill>
          <p className="small muted" style={{ marginTop: 8 }}>
            Destructive local data actions require explicit confirmation and should not run from
            a passive status check.
          </p>
          <button className="button secondary" type="button">
            Type DELETE to enable
          </button>
        </article>
      </section>
    </main>
  );
}
