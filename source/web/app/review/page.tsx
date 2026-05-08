import Link from "next/link";
import { Check, Clock, Edit3, X } from "lucide-react";
import { reviewItems } from "@/lib/demo-data";
import { StateMatrix } from "@/components/state-panels";
import { PageHeader, SectionHeader, StatusPill } from "@/components/ui";

const queueLabels = ["email update", "artifact evidence", "state change"] as const;

export default function ReviewPage() {
  return (
    <main className="content">
      <PageHeader
        eyebrow="Manual review"
        title="Blocked updates"
        description="Uncertain extracted updates, artifact evidence, and state changes are separated by queue. No application mutation happens until the user accepts, edits, rejects, or defers it."
        action={<StatusPill tone="warn">{reviewItems.length} open</StatusPill>}
      />

      {queueLabels.map((queue) => {
        const items = reviewItems.filter((item) => item.queue === queue);
        return (
          <section key={queue} className="section">
            <SectionHeader eyebrow="Review queue" title={queue} />
            <div className="list">
              {items.length > 0 ? (
                items.map((item) => (
                  <article key={item.id} className="row-card">
                    <div className="row-top">
                      <div>
                        <h3>{item.proposedChange}</h3>
                        <p className="small muted">{item.applicationLabel}</p>
                      </div>
                      <StatusPill tone={item.confidence > 0.7 ? "warn" : "danger"}>
                        {item.confidence.toFixed(2)}
                      </StatusPill>
                    </div>
                    <div className="grid-3" style={{ marginTop: 12 }}>
                      <div>
                        <p className="eyebrow">Current state</p>
                        <p className="small muted">{item.currentState}</p>
                      </div>
                      <div>
                        <p className="eyebrow">Evidence snippet</p>
                        <p className="small muted">{item.evidenceSnippet}</p>
                      </div>
                      <div>
                        <p className="eyebrow">Review reason</p>
                        <p className="small muted">{item.reviewReason}</p>
                      </div>
                    </div>
                    <div className="grid-2" style={{ marginTop: 12 }}>
                      <p className="code-line">{item.modelPath}</p>
                      <p className="code-line">{item.fallbackPath}</p>
                    </div>
                    <div className="toolbar" style={{ marginTop: 12 }}>
                      <button className="button" type="button">
                        <Check size={15} aria-hidden="true" />
                        Accept
                      </button>
                      <button className="button secondary" type="button">
                        <Edit3 size={15} aria-hidden="true" />
                        Edit before accept
                      </button>
                      <button className="button secondary" type="button">
                        <X size={15} aria-hidden="true" />
                        Reject
                      </button>
                      <button className="button ghost" type="button">
                        <Clock size={15} aria-hidden="true" />
                        Defer
                      </button>
                      <Link href={`/applications/${item.applicationId}`} className="button secondary">
                        Open application
                      </Link>
                    </div>
                  </article>
                ))
              ) : (
                <article className="row-card">
                  <h3>No blocked updates in this queue</h3>
                  <p className="small muted">
                    Return to the dashboard or applications list. Model-missing and invalid-output
                    states route here instead of failing silently.
                  </p>
                  <Link href="/dashboard" className="button secondary" style={{ width: "fit-content" }}>
                    Dashboard
                  </Link>
                </article>
              )}
            </div>
          </section>
        );
      })}

      <section className="section">
        <SectionHeader eyebrow="Safety contract" title="Blocked automation states" />
        <StateMatrix owner="review" />
      </section>
    </main>
  );
}
