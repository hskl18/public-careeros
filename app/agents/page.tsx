import Link from "next/link";
import { AgentFlowAnimation } from "@/components/agent-flow-animation";
import { agentOperatingContracts, careerOsFullAgentAlignment } from "@/lib/agent-contracts";
import { pipelineAgentDefinitions } from "@/lib/agent-pipeline";
import { checkServerOllamaStatus, readServerState } from "@/lib/server-state";
import type { AgentName } from "@/lib/types";

export const dynamic = "force-dynamic";

function labelForStatus(status: string) {
  return status.replaceAll("_", " ");
}

function statusClass(status: string) {
  if (status === "model_ready" || status === "deterministic") return "badge ok";
  if (status === "review_blocked") return "badge warn";
  if (status === "roadmap") return "badge";
  return "badge info";
}

function latestAgentRunsByAgent(
  runs: Array<{ agent: AgentName; status: string; reason: string; confidence?: number; createdAt: string }>
) {
  const map = new Map<AgentName, (typeof runs)[number]>();
  for (const run of runs) {
    if (!map.has(run.agent)) map.set(run.agent, run);
  }
  return map;
}

export default async function AgentsPage() {
  const [state, modelStatus] = await Promise.all([readServerState(), checkServerOllamaStatus()]);
  const latestRuns = latestAgentRunsByAgent(state.agentRuns);
  const definitions = new Map(pipelineAgentDefinitions.map((definition) => [definition.id, definition]));
  const latestTrace = state.modelTraces[0];
  const openReviews = state.reviewItems.filter((item) => item.status === "open");
  const memoryFacts = [
    ["Applications", `${state.applications.length} workspace records`],
    ["Bounded evidence", `${state.evidenceSnippets.length} snippets`],
    ["Review items", `${openReviews.length} open / ${state.reviewItems.length} total`],
    ["Agent runs", `${state.agentRuns.length} compact traces`],
    ["Model traces", `${state.modelTraces.length} bounded traces`],
    ["Candidate context", `${state.candidateContext.targetRoles.length} roles · ${state.candidateContext.skills.length} skills`]
  ];

  return (
    <main className="app-scroll-main">
      <div className="workspace-shell fixed-workspace mx-auto flex w-full max-w-[104rem] flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6">
        <header className="card app-workspace-panel workspace-fixed-top app-page-header p-4 sm:p-5">
          <div>
            <p className="eyebrow">Agent operating system</p>
            <h1 className="mt-2 text-base font-semibold text-[var(--text-primary)] sm:text-xl">
              CareerOS agent contracts
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              This is the product boundary behind CareerOS: each agent has a narrow job, bounded prompting, workspace
              memory, review gates, and explicit rules for what it cannot do. CareerOS stays an agentic Gmail mailbox
              pipeline instead of becoming a generic tracker.
            </p>
          </div>
          <div className="actions">
            <Link className="button primary" href="/settings?section=gmail">
              Connect Gmail
            </Link>
            <Link className="button secondary" href="/judge-demo">
              Judge demo
            </Link>
            <Link className="button secondary" href="/api/pipeline">
              Pipeline JSON
            </Link>
          </div>
        </header>

        <div className="workspace-scroll-region shell-scroll-region">
          <AgentFlowAnimation modelStatus={modelStatus.status} modelTag={modelStatus.modelTag} />

          <section className="grid three">
            <article className="runtime-card runtime-card--featured">
              <p className="eyebrow">Model path</p>
              <strong>{modelStatus.status}</strong>
              <span>{modelStatus.modelTag} · {modelStatus.diagnostic}</span>
            </article>
            <article className="runtime-card">
              <p className="eyebrow">Latest model trace</p>
              <strong>{latestTrace?.task ?? "No model trace yet"}</strong>
              <span>
                {latestTrace
                  ? `${latestTrace.provider}/${latestTrace.modelTag ?? "rules"} · ${latestTrace.latencyMs ?? 0}ms`
                  : "Run a model check or import analysis to create one."}
              </span>
            </article>
            <article className="runtime-card">
              <p className="eyebrow">Review gate</p>
              <strong>{openReviews.length} open</strong>
              <span>Model-backed and uncertain changes wait for accept, correct, or dismiss.</span>
            </article>
          </section>

          <section className="section">
            <div className="section-title">
              <div>
                <p className="eyebrow">Agent memory</p>
                <h2>What the agents are allowed to remember</h2>
                <p className="subtle">
                  Memory is normalized workspace state, not a hidden prompt dump. Full Gmail bodies, OAuth tokens, provider
                  keys, raw prompts, and raw model responses stay outside the workspace model.
                </p>
              </div>
            </div>
            <div className="grid three">
              {memoryFacts.map(([label, value]) => (
                <div className="tile" key={label}>
                  <span className="label">{label}</span>
                  <strong>{value}</strong>
                  <small>Stored under `.careeros-data` or derived from workspace state.</small>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-title">
              <div>
                <p className="eyebrow">Agent prompting and boundaries</p>
                <h2>Can do / cannot do</h2>
              </div>
            </div>
            <div className="agent-contract-grid">
              {agentOperatingContracts.map((contract, index) => {
                const definition = definitions.get(contract.id);
                const run = latestRuns.get(contract.id);
                return (
                  <article className="agent-contract-card" key={contract.id}>
                    <div className="agent-contract-card__head">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <h3>{contract.label}</h3>
                        <p>{contract.purpose}</p>
                      </div>
                    </div>
                    <div className="agent-contract-meta">
                      <span className={statusClass(run?.status ?? definition?.firstRunMode ?? "deterministic")}>
                        {labelForStatus(run?.status ?? definition?.firstRunMode ?? "deterministic")}
                      </span>
                      <span className="badge info">
                        {typeof run?.confidence === "number" ? `${Math.round(run.confidence * 100)}%` : "bounded"}
                      </span>
                      <span className="badge">{contract.family}</span>
                    </div>
                    <div className="agent-source-map" aria-label={`${contract.label} CareerOS source souls`}>
                      {contract.careerOsSouls.map((soul) => (
                        <span key={soul}>{soul}</span>
                      ))}
                    </div>
                    <dl className="agent-boundary-list">
                      <div>
                        <dt>Prompt/input</dt>
                        <dd>{contract.promptBoundary}</dd>
                      </div>
                      <div>
                        <dt>Memory</dt>
                        <dd>{contract.memoryBoundary}</dd>
                      </div>
                      <div>
                        <dt>Cost/runtime</dt>
                        <dd>{contract.costBoundary}</dd>
                      </div>
                    </dl>
                    <div className="agent-can-grid">
                      <div>
                        <span className="label">Can do</span>
                        <ul>
                          {contract.canDo.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="label">Cannot do</span>
                        <ul>
                          {contract.cannotDo.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <p className="subtle">{contract.publicScopeNote}</p>
                    <p className="subtle">{run?.reason ?? definition?.purpose}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="section">
            <div className="section-title">
              <div>
                <p className="eyebrow">CareerOS alignment</p>
                <h2>Full agent families folded into the lightweight demo</h2>
                <p className="subtle">
                  The open-source repo stays small, but it preserves the same family boundaries as CareerOS: Gmail
                  mailbox, resume/context, evidence review, reminders, and orchestration. Specialist agents that are
                  not standalone services here are represented as visible contracts and review gates rather than hidden
                  automation.
                </p>
              </div>
            </div>
            <div className="agent-family-grid">
              {careerOsFullAgentAlignment.map((family) => (
                <article className="agent-family-card" key={family.family}>
                  <h3>{family.family}</h3>
                  <div>
                    <span className="label">Full CareerOS agents</span>
                    <p>{family.fullCareerOsAgents.join(" · ")}</p>
                  </div>
                  <div>
                    <span className="label">Public demo layer</span>
                    <p>{family.publicDemoLayers.join(" · ")}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
