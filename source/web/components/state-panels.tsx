import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import {
  stateVariants,
  type StateVariant,
  type StatusTone,
} from "@/lib/demo-data";
import { SectionHeader, StatusPill } from "@/components/ui";

const ownerLabels: Record<StateVariant["owner"], string> = {
  workspace: "Local data",
  api: "Runtime",
  model: "Model",
  gmail: "Gmail",
  review: "Review",
  resume: "Resume",
};

const modeRows = [
  {
    label: "Workspace",
    value: "Seeded demo loaded",
    detail: "Empty workspace, local import, partial import, and API-offline states are designed.",
    tone: "good" as StatusTone,
    icon: Database,
  },
  {
    label: "Model",
    value: "Deterministic-only active",
    detail: "Ollama disabled, unreachable, model missing, ready, and invalid-output states stay visible.",
    tone: "warn" as StatusTone,
    icon: Bot,
  },
  {
    label: "Gmail",
    value: "Optional connector",
    detail: "Not connected is normal. Connector attention is separate from local use.",
    tone: "neutral" as StatusTone,
    icon: MailCheck,
  },
  {
    label: "Review",
    value: "State writes gated",
    detail: "Weak matches and invalid output route to review before application mutation.",
    tone: "warn" as StatusTone,
    icon: ShieldCheck,
  },
];

export function OperatingStatusPanel() {
  return (
    <section className="section">
      <SectionHeader eyebrow="Operating mode" title="Local-first runtime status" />
      <div className="mode-panel">
        {modeRows.map((row) => {
          const Icon = row.icon;
          return (
            <article key={row.label} className="mode-row">
              <StatusPill tone={row.tone}>
                <Icon size={14} aria-hidden="true" />
                {row.label}
              </StatusPill>
              <div>
                <strong>{row.value}</strong>
                <span>{row.detail}</span>
              </div>
              {row.tone === "good" ? (
                <CheckCircle2 size={18} color="var(--green)" aria-hidden="true" />
              ) : (
                <AlertTriangle size={18} color="var(--amber)" aria-hidden="true" />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function StateMatrix({
  owner,
  limit,
}: {
  owner?: StateVariant["owner"];
  limit?: number;
}) {
  const states = stateVariants
    .filter((state) => (owner ? state.owner === owner : true))
    .slice(0, limit);

  return (
    <div className="state-matrix">
      {states.map((state) => (
        <article key={state.id} className="state-cell">
          <div className="inline-between">
            <StatusPill tone={state.tone}>{state.label}</StatusPill>
          </div>
          <p className="small muted">{ownerLabels[state.owner]}</p>
          <p className="small muted">{state.description}</p>
        </article>
      ))}
    </div>
  );
}
