import Link from "next/link";
import { listByokRoadmapAdapters, listImplementedAdapters, listLocalRoadmapAdapters } from "@/lib/providers";
import { checkServerOllamaStatus, readServerState } from "@/lib/server-state";
import { canDeleteLocalWorkspaceData, getStateRepositoryKind } from "@/lib/store";

type SettingsSection = "model" | "runtime" | "local-data" | "gmail" | "imports";

const SECTIONS: ReadonlyArray<{ key: SettingsSection; label: string }> = [
  { key: "model", label: "Model" },
  { key: "runtime", label: "Runtime" },
  { key: "local-data", label: "Local data" },
  { key: "gmail", label: "Gmail" },
  { key: "imports", label: "Imports" }
];

function resolveSection(raw: string | undefined): SettingsSection {
  return SECTIONS.find((entry) => entry.key === raw)?.key ?? "model";
}

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

function modelNextStep(status: string, modelTag: string) {
  if (status === "ready") {
    return {
      title: "Ollama Cloud is ready",
      body: `${modelTag} is available through Ollama Cloud and the bounded health prompt passed. Model-backed proposals still go through review.`
    };
  }
  if (status === "model_missing") {
    return {
      title: "Choose an available Ollama Cloud model",
      body: `${modelTag} was not listed for this Ollama Cloud account. Update CAREEROS_GEMMA_MODEL or the model tag, then check again.`
    };
  }
  if (status === "unavailable") {
    return {
      title: "Check Ollama Cloud API key or network",
      body: "CareerOS cannot reach Ollama Cloud. Verify OLLAMA_API_KEY in .env.local, keep the endpoint as https://ollama.com, then check again."
    };
  }
  if (status === "disabled") {
    return {
      title: "Optional Ollama Cloud is disabled",
      body: "First run needs no model. Add OLLAMA_API_KEY to .env.local, choose Enabled, save the endpoint/model tag, then check."
    };
  }
  return {
    title: "Check Ollama Cloud setup",
    body: "Save the Ollama Cloud endpoint and Gemma tag, then run a readiness check."
  };
}

function localStateLocation(kind: string) {
  if (kind === "json-file") return ".careeros-data/state.json";
  return "in-memory local state";
}

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const rawSection = typeof params.section === "string" ? params.section : undefined;
  const activeSection = resolveSection(rawSection);
  const [state, modelStatus] = await Promise.all([readServerState(), checkServerOllamaStatus()]);
  const connector = state.connectorAccounts.find((item) => item.provider === "gmail");
  const lastImport = state.importJobs[0];
  const latestTrace = state.modelTraces[0];
  const modelRuntime = state.modelRuntime;
  const repositoryKind = getStateRepositoryKind();
  const deleteAvailable = canDeleteLocalWorkspaceData();
  const localMode = modelRuntime.enabled ? "model checks enabled" : "deterministic default";
  const nextModelStep = modelNextStep(modelStatus.status, modelStatus.modelTag);
  const importStatus = typeof params.import === "string" ? params.import : undefined;
  const implementedAdapters = listImplementedAdapters();
  const localRoadmapAdapters = listLocalRoadmapAdapters();
  const byokRoadmapAdapters = listByokRoadmapAdapters();

  return (
    <main className="app-scroll-main settings-scroll-main">
      <div className="workspace-shell fixed-workspace settings-workspace mx-auto flex w-full max-w-[104rem] flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6">
      <header className="card app-workspace-panel workspace-fixed-top app-page-header p-4 sm:p-5">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 className="mt-2 text-base font-semibold text-[var(--text-primary)] sm:text-xl">Runtime settings</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            CareerOS starts as a clean local workspace. Use this page to connect readonly Gmail, optional Ollama
            Cloud/Gemma, deterministic fallback, and local-only storage.
          </p>
        </div>
        <div className="actions settings-header-actions">
          <form action="/api/model-status" method="post">
            <input type="hidden" name="enabled" value={modelRuntime.enabled ? "on" : ""} />
            <input type="hidden" name="endpoint" value={modelRuntime.endpoint} />
            <input type="hidden" name="modelTag" value={modelRuntime.modelTag} />
            <input type="hidden" name="intent" value="check" />
            <button className="button" type="submit">
              Check model
            </button>
          </form>
        </div>
      </header>

      <nav className="tab-strip settings-subnav workspace-fixed-top" aria-label="Settings sections" role="tablist">
        {SECTIONS.map((section) => (
          <Link
            key={section.key}
            href={section.key === "model" ? "/settings" : `/settings?section=${section.key}`}
            aria-current={section.key === activeSection ? "page" : undefined}
            aria-selected={section.key === activeSection}
            role="tab"
            className={section.key === activeSection ? "is-active" : undefined}
            prefetch={false}
          >
            {section.label}
          </Link>
        ))}
      </nav>

      <div className="fact-strip settings-release-strip" aria-label="Local setup guardrails">
        <span>Ollama Cloud API key from env</span>
        <span>Gmail readonly sync</span>
        <span>BYOK roadmap only</span>
        <span>OAuth token stays local</span>
        <span>DELETE LOCAL DATA confirmation</span>
      </div>

      <div className="workspace-scroll-region shell-scroll-region">
        {activeSection === "model" ? (
          <section className="section model-connect-section" id="settings-model">
        <div className="section-title">
          <div>
            <p className="eyebrow">Optional Ollama Cloud</p>
            <h2>Connect Gemma for model-backed proposals</h2>
            <p className="subtle">
              {modelStatus.status === "ready"
                ? `Gemma (${modelStatus.modelTag}) is reachable through Ollama Cloud and passed the bounded health prompt. Model-backed proposals still go through the review gate before they touch application state.`
                : "Deterministic fallback is active right now. To connect Gemma, add OLLAMA_API_KEY to .env.local, keep endpoint https://ollama.com, set the model tag, then run a readiness check."}
            </p>
          </div>
          <span className={modelBadge(modelStatus.status)}>{modelStatus.status}</span>
        </div>
        <div className="model-connect-layout">
          <div className="model-connection-guide" aria-label="How CareerOS connects to Ollama Cloud">
            <article>
              <span>1. Cloud API key</span>
              <strong>OLLAMA_API_KEY in .env.local</strong>
              <code>OLLAMA_API_KEY=...</code>
              <small>Key is read from env only; it is not saved in workspace state, UI forms, exports, or traces.</small>
            </article>
            <article>
              <span>2. Web app</span>
              <strong>CareerOS calls Ollama Cloud</strong>
              <code>https://ollama.com/api/generate</code>
              <small>Next.js API routes send bounded prompts server-side; the browser never sees the key.</small>
            </article>
            <article>
              <span>3. Review gate</span>
              <strong>Save endpoint + tag</strong>
              <code>{modelRuntime.endpoint} · {modelRuntime.modelTag}</code>
              <small>Choose Enabled, then Save and check. Ready means model-backed proposals can run through review.</small>
            </article>
          </div>
          <form className="model-connect-form" action="/api/model-status" method="post">
            <label>
              <span className="label">Connection mode</span>
              <select name="enabled" defaultValue={modelRuntime.enabled ? "on" : "off"}>
                <option value="off">Disabled - deterministic fallback</option>
                <option value="on">Enabled - check Ollama Cloud</option>
              </select>
            </label>
            <label>
              <span className="label">Ollama Cloud endpoint</span>
              <input name="endpoint" defaultValue={modelRuntime.endpoint} placeholder="https://ollama.com" />
            </label>
            <label>
              <span className="label">Gemma model tag</span>
              <input name="modelTag" defaultValue={modelRuntime.modelTag} placeholder="gemma4:e4b" />
            </label>
            <div className="model-connect-actions">
              <button className="button secondary" name="intent" type="submit" value="save">
                Save model setup
              </button>
              <button className="button primary" name="intent" type="submit" value="check">
                Save and check
              </button>
            </div>
          </form>
          <div className="model-next-step">
            <div>
              <p className="eyebrow">Next step</p>
              <strong>{nextModelStep.title}</strong>
              <span>{nextModelStep.body}</span>
            </div>
            <code>OLLAMA_API_KEY=...</code>
          </div>
          <div className="model-command-card">
            <p className="eyebrow">Env setup</p>
            <code>CAREEROS_OLLAMA_BASE_URL=https://ollama.com</code>
            <span>No key is required for first run. Key is only read server-side when model checks are enabled.</span>
          </div>
        </div>
        <div className="state-matrix settings-status-grid">
          <div className="state-cell">
            <span className="label">Fallback</span>
            <strong>{modelStatus.status === "disabled" ? "Active" : "Available"}</strong>
            <small>Rules and review gates work without Ollama Cloud.</small>
          </div>
          <div className="state-cell">
            <span className="label">Latest check</span>
            <strong>{modelStatus.latencyMs ? `${modelStatus.latencyMs}ms` : "Not connected"}</strong>
            <small>{modelStatus.diagnostic}</small>
          </div>
          <div className="state-cell">
            <span className="label">Latest trace</span>
            <strong>{latestTrace?.status ?? "none"}</strong>
            <small>{latestTrace?.diagnostic ?? "Trace metadata appears after processing or status checks."}</small>
          </div>
        </div>
        <div className="settings-provider-panel" aria-label="Provider adapter boundaries">
          <div className="section-title compact">
            <div>
              <p className="eyebrow">Model router boundary</p>
              <h3>Implemented paths stay separate from roadmap adapters</h3>
              <p className="subtle">
                The public app only runs deterministic fallback and optional Gemma via Ollama Cloud. BYOK providers are
                roadmap labels until encrypted local credential storage exists.
              </p>
            </div>
          </div>
          <div className="settings-provider-grid">
            <article>
              <span>Implemented now</span>
              <strong>{implementedAdapters.map((adapter) => adapter.label).join(" · ")}</strong>
              <small>The app can open as a clean workspace; Gmail sync starts real pipeline data, and Ollama Cloud is only required for model-backed runs.</small>
            </article>
            <article>
              <span>Advanced runtime roadmap</span>
              <strong>{localRoadmapAdapters.map((adapter) => adapter.label).join(" · ")}</strong>
              <small>Adapter metadata only. These do not execute code or call local processes.</small>
            </article>
            <article>
              <span>BYOK roadmap only</span>
              <strong>{byokRoadmapAdapters.map((adapter) => adapter.label).join(" · ")}</strong>
              <small>Blocked on encrypted credential storage, redaction rules, and adapter tests.</small>
            </article>
          </div>
        </div>
          </section>
        ) : null}

        {activeSection === "runtime" ? (
          <section className="grid three settings-runtime-summary" id="settings-runtime">
        <article className="runtime-card">
          <p className="eyebrow">Persistence</p>
          <strong>{repositoryKind}</strong>
          <span>{state.applications.length} applications in local state</span>
        </article>
        <article className="runtime-card runtime-card--featured">
          <p className="eyebrow">Model mode</p>
          <strong>{modelStatus.status}</strong>
          <span>{localMode}. Save and check above to connect Gemma.</span>
        </article>
        <article className="runtime-card">
          <p className="eyebrow">Connector mode</p>
          <strong>{connector?.status ?? "not_configured"}</strong>
          <span>Gmail is optional; readonly tokens stay local under .careeros-data</span>
        </article>
          </section>
        ) : null}

        {activeSection === "local-data" ? (
          <section className="section" id="settings-local-data">
        <div className="section-title">
          <div>
            <p className="eyebrow">Local data</p>
            <h2>Workspace storage</h2>
            <p className="subtle">Reset, export, import, and delete only affect this local workspace.</p>
          </div>
          <span className="badge ok">{repositoryKind}</span>
        </div>
        <div className="grid three">
          <div className="tile">
            <span className="label">Data directory</span>
            <strong>{localStateLocation(repositoryKind)}</strong>
            <small>Shown as a repo-relative path; JSON file storage is the default public demo persistence.</small>
          </div>
          <div className="tile">
            <span className="label">Workspace state</span>
            <strong>{state.applications.length || state.mailboxThreads.length ? "Pipeline data loaded" : "Empty workspace"}</strong>
            <small>New users connect Gmail first; sanitized judge data stays on `/judge-demo`.</small>
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
              Reset workspace
            </button>
          </form>
          <a className="button secondary" href="/api/local-data/export">
            Export JSON
          </a>
          <form className="inline-confirm-form" action="/api/local-data/import" method="post" encType="multipart/form-data">
            <label>
              <span className="label">CareerOS JSON export</span>
              <input name="file" type="file" accept="application/json,.json" required />
            </label>
            <label>
              <span className="label">Type IMPORT LOCAL DATA to replace this workspace</span>
              <input
                name="confirm"
                placeholder="IMPORT LOCAL DATA"
                pattern="IMPORT LOCAL DATA"
                title="Type IMPORT LOCAL DATA exactly to enable import"
                required
              />
            </label>
            <button className="button secondary" type="submit">
              Import JSON
            </button>
          </form>
          <form className="inline-confirm-form" action="/api/local-data/delete" method="post">
            <label>
              <span className="label">Type DELETE LOCAL DATA to confirm</span>
              <input
                name="confirm"
                placeholder="DELETE LOCAL DATA"
                pattern="DELETE LOCAL DATA"
                title="Type DELETE LOCAL DATA exactly to enable deletion"
                disabled={!deleteAvailable}
                required
              />
            </label>
            <button className="button danger" disabled={!deleteAvailable} type="submit">
              Delete local data
            </button>
          </form>
        </div>
        {importStatus === "success" ? (
          <p className="alert">Workspace import completed. CareerOS replaced local state after schema and safety validation.</p>
        ) : null}
        {importStatus === "failed" || importStatus === "confirm_required" ? (
          <p className="alert alert-warning">
            Workspace import was not applied. Use a normalized CareerOS export and type the confirmation phrase exactly.
          </p>
        ) : null}
        <p className="subtle">
          Export returns the current normalized state as JSON. Import accepts only validated CareerOS workspace exports,
          replaces state after full validation, and rejects private paths, secret-looking values, OAuth fields, raw
          provider output, and raw inbox bodies. Delete is only enabled for the default `.careeros-data` directory and
          recreates an empty workspace on next read.
        </p>
          </section>
        ) : null}

        {activeSection === "gmail" ? (
          <section className="section" id="settings-gmail">
        <div className="section-title">
          <div>
            <p className="eyebrow">Optional Gmail connector</p>
            <h2>Gmail readonly sync</h2>
            <p className="subtle">
              Connect a local Google OAuth client, then sync recent recruiting mail into the Gemma/review pipeline.
              OAuth tokens are stored only under the local `.careeros-data` directory.
            </p>
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
            <strong>Local token file</strong>
            <small>Readonly OAuth token stays under `.careeros-data` and is excluded from git.</small>
          </div>
          <div className="tile">
            <span className="label">Pipeline path</span>
            <strong>Sync then review</strong>
            <small>Gmail snippets flow through triage, extraction, Ollama Cloud/Gemma, and the review gate.</small>
          </div>
        </div>
        <div className="connector-demo-actions">
          <div className="inline-between">
            <strong>Gmail sync actions</strong>
            <span className="badge">Gmail pipeline</span>
          </div>
          <p className="subtle">
            Connect opens Google OAuth with the readonly Gmail scope. Sync fetches bounded recruiting message snippets and
            passes them through the same mailbox triage, workflow extraction, Ollama Cloud/Gemma, and review-gate path.
          </p>
          <div className="actions">
            <form action="/api/connectors/gmail/connect" method="post">
              <button className="button secondary" type="submit">
                Connect Gmail
              </button>
            </form>
            <form action="/api/connectors/gmail/sync" method="post">
              <button className="button secondary" type="submit">
                Sync recruiting mail
              </button>
            </form>
            <form action="/api/connectors/gmail/disconnect" method="post">
              <button className="button secondary" type="submit">
                Disconnect
              </button>
            </form>
          </div>
        </div>
          </section>
        ) : null}

        {activeSection === "imports" ? (
          <section className="section" id="settings-imports">
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
          <div className="empty-state">No import jobs yet. Connect Gmail or import validated JSON to start processing pipeline data.</div>
        )}
          </section>
        ) : null}
      </div>
      </div>
    </main>
  );
}
