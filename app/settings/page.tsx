import { checkOllamaStatus } from "@/lib/model-status";
import { getDataDir, getStateRepositoryKind, readState } from "@/lib/store";

export const dynamic = "force-dynamic";

function modelBadge(status: string) {
  if (status === "ready") return "badge ok";
  if (status === "disabled") return "badge";
  return "badge warn";
}

function connectorBadge(status?: string) {
  if (status === "connected") return "badge ok";
  if (status === "needs_attention") return "badge warn";
  return "badge";
}

export default async function SettingsPage() {
  const [state, modelStatus] = await Promise.all([readState(), checkOllamaStatus()]);
  const connector = state.connectorAccounts.find((item) => item.provider === "gmail");
  const lastImport = state.importJobs[0];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Local runtime controls</h1>
          <p className="subtle">
            CareerOS runs local-first by default. External model and Gmail paths are opt-in and isolated.
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

      <section className="section">
        <div className="section-title">
          <div>
            <h2>Local data</h2>
            <p className="subtle">Reset, import, and export stay scoped to the local workspace repository.</p>
          </div>
          <span className="badge ok">{getStateRepositoryKind()}</span>
        </div>
        <div className="grid three">
          <div className="tile">
            <span className="label">Data directory</span>
            <strong>{getDataDir()}</strong>
          </div>
          <div className="tile">
            <span className="label">Seeded demo data</span>
            <strong>{state.importJobs.some((job) => job.source === "seed") ? "Loaded" : "Empty workspace"}</strong>
          </div>
          <div className="tile">
            <span className="label">Last import</span>
            <strong>{lastImport ? `${lastImport.source} · ${lastImport.status}` : "No imports"}</strong>
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
            <h2>Ollama and Gemma</h2>
            <p className="subtle">Dashboard mode changes only after an explicit model check records current status.</p>
          </div>
          <span className={modelBadge(modelStatus.status)}>{modelStatus.status}</span>
        </div>
        <div className="state-matrix">
          <div className="state-cell">
            <span className="label">Local deterministic-only mode</span>
            <strong>{modelStatus.status === "disabled" ? "Active" : "Fallback available"}</strong>
            <small>Rules and review gates work without Ollama or network model calls.</small>
          </div>
          <div className="state-cell">
            <span className="label">Ollama disabled</span>
            <strong>{process.env.CAREEROS_OLLAMA_ENABLED === "true" ? "No" : "Yes"}</strong>
            <small>Set CAREEROS_OLLAMA_ENABLED=true only when you want local model-backed checks.</small>
          </div>
          <div className="state-cell">
            <span className="label">Ollama unreachable</span>
            <strong>{modelStatus.status === "unavailable" ? "Detected" : "Not current"}</strong>
            <small>Unavailable status keeps deterministic fallback active.</small>
          </div>
          <div className="state-cell">
            <span className="label">Selected model missing</span>
            <strong>{modelStatus.status === "model_missing" ? "Detected" : "Not current"}</strong>
            <small>No automatic download. Pull manually when ready.</small>
          </div>
          <div className="state-cell">
            <span className="label">Model ready</span>
            <strong>{modelStatus.status === "ready" ? "Ready" : "Supported"}</strong>
            <small>Ready requires a reachable Ollama service and installed configured model.</small>
          </div>
          <div className="state-cell">
            <span className="label">Selected Gemma model</span>
            <strong>{modelStatus.modelTag}</strong>
            <small>{modelStatus.diagnostic}</small>
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
            <h2>Optional Gmail connector</h2>
            <p className="subtle">Gmail is a connector surface, not a requirement for the local product.</p>
          </div>
          <span className={connectorBadge(connector?.status)}>{connector?.status ?? "not_configured"}</span>
        </div>
        <div className="grid two">
          <div className="tile">
            <span className="label">Gmail not connected</span>
            <strong>{connector?.status === "connected" ? "Connected" : "Optional placeholder"}</strong>
            <small>{connector?.message ?? "Connectors remain disabled until configured."}</small>
          </div>
          <div className="tile">
            <span className="label">Connector needs attention</span>
            <strong>{connector?.status === "needs_attention" ? "Action needed" : "No active issue"}</strong>
            <small>Health problems are shown as notifications and settings state, separate from local data.</small>
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
          <h2>Import jobs</h2>
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
