import type { LucideIcon } from "lucide-react";
import type { StatusTone } from "@/lib/demo-data";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="lede">{description}</p>
      </div>
      {action ? <div className="toolbar">{action}</div> : null}
    </header>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
}) {
  return <span className={`pill tone-${tone}`}>{children}</span>;
}

export function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: StatusTone;
}) {
  return (
    <article className="metric">
      <div className="metric-top">
        <p className="eyebrow">{label}</p>
        <StatusPill tone={tone}>
          <Icon size={14} aria-hidden="true" />
        </StatusPill>
      </div>
      <div>
        <p className="metric-value">{value}</p>
        <p className="small muted">{hint}</p>
      </div>
    </article>
  );
}

export function KeyValueGrid({
  rows,
}: {
  rows: Array<[string, React.ReactNode]>;
}) {
  return (
    <div className="copy-grid">
      {rows.map(([label, value]) => (
        <div key={label} className="row-card">
          <p className="eyebrow">{label}</p>
          <div className="small muted">{value}</div>
        </div>
      ))}
    </div>
  );
}
