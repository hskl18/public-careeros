import { checkServerOllamaStatus, readServerState } from "@/lib/server-state";
import { getDataDir, getStateRepositoryKind } from "@/lib/store";

export const dynamic = "force-dynamic";

function modelBadge(status: string) {
  if (status === "ready") return "badge ok";
  if (status === "disabled") return "badge";
  return "badge warn";
}

function connectorBadge(status?: string) {
  if (status === "connected") return "badge ok";
  if (status === "needs_attention") return "badge warn";
  if (status === "disabled" || status === "not_configured") return "badge";
  return "badge info";
}

function dateLabel(value?: string) {
  return value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric" }).format(new Date(value)) : "not recorded";
}

export default async function SettingsPage() {
  const [state, modelStatus] = await Promise.all([readServerState(), checkServerOllamaStatus()]);
  const connector = state.connectorAccounts.find((item) => item.provider === "gmail");
  const lastImport = state.importJobs[0];
  const latestTrace = state.modelTraces[0];
  const localMode = process.env.CAREEROS_OLLAMA_ENABLED === "true" ? "model checks enabled" : "deterministic default";

  return (
    <div className="page settings-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Local runtime</h1>
          <p className="subtle">
            CareerOS should explain exactly what is local, what is optional, and what can run before any provider account
            exists.
          </p>
        </div>
        <div className="actions">
          <form action="/api/model-status" method="post">
            <button className="button" type="submit">
              Check model
            </button>
          </form>
          <form action="/api/reset" method="post">
            <button className="button secondary" type="submit">
              Reset seed data
            </button>
          </form>
        </div>
      </header>

      <section className="grid three">
        <article className="runtime-card">
          <p className="eyebrow">Persistence</p>
          <strong>{getStateRepositoryKind()}</strong>
          <span>{state.applications.length} applications in local state</span>
        </article>
        <article className="runtime-card dark">
          <p className="eyebrow">Model mode</p>
          <strong>{modelStatus.status}</strong>
          <span>{localMode}</span>
        </article>
        <article className="runtime-card">
          <p className="eyebrow">Connector mode</p>
          <strong>{connector?.status ?? "not_configured"}</strong>
          <span>Gmail is optional and token-free in this public base</span>
        </article>
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Local data</p>
            <h2>Workspace storage</h2>
            <p className="subtle">Reset and import stay scoped to the local repository state adapter.</p>
          </div>
          <span className="badge ok">{getStateRepositoryKind()}</span>
        </div>
        <div className="grid three">
          <div className="tile">
            <span className="label">Data directory</span>
            <strong>{getDataDir()}</strong>
            <small>SQLite by default, JSON only when explicitly configured.</small>
          </div>
          <div className="tile">
            <span className="label">Seeded demo data</span>
            <strong>{state.importJobs.some((job) => job.source === "seed") ? "Loaded" : "Empty workspace"}</strong>
            <small>First-run value without Gmail, auth, or a hosted API.</small>
          </div>
          <div className="tile">
            <span className="label">Last import</span>
            <strong>{lastImport ? `${lastImport.source} · ${lastImport.status}` : "No imports"}</strong>
            <small>{lastImport ? dateLabel(lastImport.processedAt ?? lastImport.createdAt) : "Manual imports will appear here."}</small>
          </div>
        </div>
        <div className="actions">
          <form action="/api/reset" method="post">
            <button className="button secondary" type="submit">
              Reset local seed
            </button>
          </form>
          <button className="button secondary" disabled type="button">
            Import JSON disabled
          </button>
          <button className="button secondary" disabled type="button">
            Export JSON disabled
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Ollama and Gemma</p>
            <h2>Optional model readiness</h2>
            <p className="subtle">Model-backed behavior is additive; deterministic parsing and review gates remain available.</p>
          </div>
          <span className={modelBadge(modelStatus.status)}>{modelStatus.status}</span>
        </div>
        <div className="state-matrix">
          <div className="state-cell">
            <span className="label">Deterministic fallback</span>
            <strong>{modelStatus.status === "disabled" ? "Active" : "Available"}</strong>
            <small>Rules and review gates work without Ollama or network model calls.</small>
          </div>
          <div className="state-cell">
            <span className="label">Endpoint</span>
            <strong>{modelStatus.endpoint}</strong>
            <small>{modelStatus.latencyMs ? `${modelStatus.latencyMs}ms latest check` : "No successful latency measurement."}</small>
          </div>
          <div className="state-cell">
            <span className="label">Selected Gemma model</span>
            <strong>{modelStatus.modelTag}</strong>
            <small>{modelStatus.installedModels.length} installed model reference{modelStatus.installedModels.length === 1 ? "" : "s"} detected.</small>
          </div>
          <div className="state-cell">
            <span className="label">Model missing</span>
            <strong>{modelStatus.status === "model_missing" ? "Detected" : "Not current"}</strong>
            <small>No automatic download. Pull manually when ready.</small>
          </div>
          <div className="state-cell">
            <span className="label">Health prompt</span>
            <strong>{modelStatus.status === "ready" ? "Passed" : "Not enabled"}</strong>
            <small>{modelStatus.diagnostic}</small>
          </div>
          <div className="state-cell">
            <span className="label">Latest trace</span>
            <strong>{latestTrace?.status ?? "none"}</strong>
            <small>{latestTrace?.diagnostic ?? "Model trace metadata appears after local processing or status checks."}</small>
          </div>
        </div>
        <pre className="code">{`CAREEROS_OLLAMA_ENABLED=${process.env.CAREEROS_OLLAMA_ENABLED ?? "false"}
CAREEROS_OLLAMA_BASE_URL=${modelStatus.endpoint}
CAREEROS_GEMMA_MODEL=${modelStatus.modelTag}
ollama pull ${modelStatus.modelTag}`}</pre>
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Optional Gmail connector</p>
            <h2>Placeholder status without OAuth</h2>
            <p className="subtle">The public base exposes connector state and actions, but does not store credentials or start OAuth.</p>
          </div>
          <span className={connectorBadge(connector?.status)}>{connector?.status ?? "not_configured"}</span>
        </div>
        <div className="connector-flow">
          <div className="tile">
            <span className="label">Current connector</span>
            <strong>{connector?.label ?? "Gmail connector optional"}</strong>
            <small>{connector?.message ?? "Connectors remain disabled until configured."}</small>
          </div>
          <div className="tile">
            <span className="label">Safe boundary</span>
            <strong>No token storage</strong>
            <small>Gmail remains a product accelerator, not a requirement for local value.</small>
          </div>
          <div className="tile">
            <span className="label">Next implementation layer</span>
            <strong>Encrypted credentials first</strong>
            <small>Real OAuth should wait for reviewed local credential storage.</small>
          </div>
        </div>
        <div className="actions">
          <form action="/api/connectors/gmail/connect" method="post">
            <button className="button secondary" type="submit">
              Connect placeholder
            </button>
          </form>
          <form action="/api/connectors/gmail/sync" method="post">
            <button className="button secondary" type="submit">
              Sync placeholder
            </button>
          </form>
          <form action="/api/connectors/gmail/disconnect" method="post">
            <button className="button secondary" type="submit">
              Disconnect
            </button>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Import jobs</p>
            <h2>Processing history</h2>
          </div>
          <span className="badge">{state.importJobs.length}</span>
        </div>
        {state.importJobs.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {state.importJobs.slice(0, 8).map((job) => (
                  <tr key={job.id}>
                    <td>{job.source}</td>
                    <td>
                      <span className={job.status === "processed" ? "badge ok" : "badge warn"}>{job.status}</span>
                    </td>
                    <td>{job.attempts}</td>
                    <td>{job.error ?? "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No import jobs yet. The workspace can run empty without Gmail or model setup.</div>
        )}
      </section>
    </div>
  );
}
