import Link from "next/link";
import { applications, emptyWorkspaceActions } from "@/lib/demo-data";
import { ApplicationTable } from "@/components/application-table";
import { StateMatrix } from "@/components/state-panels";
import { PageHeader, SectionHeader, StatusPill } from "@/components/ui";

export default function ApplicationsPage() {
  return (
    <main className="content">
      <PageHeader
        eyebrow="Pipeline list"
        title="Applications"
        description="Dense scanning for company, role, stage, next action, deadlines, evidence, review status, and source. Desktop gets a table; mobile gets stable stacked rows."
        action={
          <>
            <button className="button secondary" type="button">
              Import JSON
            </button>
            <button className="button" type="button">
              Create manual application
            </button>
          </>
        }
      />

      <ApplicationTable applications={applications} />

      <section className="section">
        <SectionHeader eyebrow="List states" title="Loading, empty, error, disabled, and offline behavior" />
        <StateMatrix owner="workspace" />
      </section>

      <section className="section">
        <SectionHeader eyebrow="Empty and offline states" title="Local actions remain available" />
        <div className="grid-3">
          {emptyWorkspaceActions.slice(0, 3).map((action) => {
            const Icon = action.icon;
            return (
              <article key={action.label} className="action-tile">
                <StatusPill tone="neutral">
                  <Icon size={14} aria-hidden="true" />
                  local
                </StatusPill>
                <h3 style={{ marginTop: 12 }}>{action.label}</h3>
                <p className="small muted">{action.detail}</p>
              </article>
            );
          })}
        </div>
        <Link href="/settings" className="button secondary" style={{ width: "fit-content" }}>
          Check API/database setup
        </Link>
      </section>
    </main>
  );
}
