import Link from "next/link";
import { headers } from "next/headers";
import { gmailOAuthSetupDiagnostic } from "@/lib/gmail-local";
import { checkServerOllamaStatus, readServerState } from "@/lib/server-state";
import { canDeleteLocalWorkspaceData, getStateRepositoryKind } from "@/lib/store";

type SettingsSection = "model" | "local-data" | "gmail" | "imports";

const SECTIONS: ReadonlyArray<{ key: SettingsSection; label: string }> = [
  { key: "model", label: "Model" },
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
      body: `${modelTag} passed the readiness check. Model-backed proposals still go to review before state changes.`
    };
  }
  if (status === "model_missing") {
    return {
      title: "Model tag is not available",
      body: `Choose an available Ollama Cloud model tag, then run the check again.`
    };
  }
  if (status === "unavailable") {
    return {
      title: "Ollama Cloud is not reachable",
      body: "Check the API key, endpoint, and network. The app still runs in deterministic mode."
    };
  }
  if (status === "disabled") {
    return {
      title: "Optional Ollama Cloud is disabled",
      body: "First run needs no model. Read the README when you are ready to add Gemma."
    };
  }
  return {
    title: "Check model setup",
    body: "Save the endpoint and model tag, then run a readiness check."
  };
}

function localStateLocation(kind: string) {
  if (kind === "json-file") return ".careeros-data/state.json";
  return "in-memory local state";
}

function requestUrlFromHeaders(headerList: Headers) {
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}/settings`;
}

function setupTone(status: "ready" | "optional" | "attention") {
  if (status === "ready") return "settings-setup-card settings-setup-card--ready";
  if (status === "attention") return "settings-setup-card settings-setup-card--attention";
  return "settings-setup-card";
}

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const rawSection = typeof params.section === "string" ? params.section : undefined;
  const activeSection = resolveSection(rawSection);
  const requestHeaders = await headers();
  const gmailSetup = gmailOAuthSetupDiagnostic(requestUrlFromHeaders(requestHeaders));
  const [state, modelStatus] = await Promise.all([readServerState(), checkServerOllamaStatus()]);
  const connector = state.connectorAccounts.find((item) => item.provider === "gmail");
  const gmailConnected = connector?.status === "connected";
  const lastImport = state.importJobs[0];
  const latestTrace = state.modelTraces[0];
  const modelRuntime = state.modelRuntime;
  const repositoryKind = getStateRepositoryKind();
  const deleteAvailable = canDeleteLocalWorkspaceData();
  const nextModelStep = modelNextStep(modelStatus.status, modelStatus.modelTag);
  const importStatus = typeof params.import === "string" ? params.import : undefined;
  const gmailStatus = typeof params.gmail === "string" ? params.gmail : undefined;

  return (
    <main className="app-scroll-main settings-scroll-main">
      <div className="workspace-shell fixed-workspace settings-workspace mx-auto flex w-full max-w-[104rem] flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6">
      <header className="card app-workspace-panel workspace-fixed-top app-page-header p-4 sm:p-5">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)] sm:text-xl">Settings</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            Runtime controls for Gmail, Gemma, and local workspace data. Full setup lives in the README.
          </p>
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

      <div className="settings-setup-panel" aria-label="Current setup status">
        <article className={setupTone("ready")}>
          <span>Runs now</span>
          <strong>Deterministic mode</strong>
          <small>No Gmail, API key, hosted DB, or model download required.</small>
        </article>
        <article className={setupTone(gmailConnected ? "ready" : "optional")}>
          <span>Gmail</span>
          <strong>{gmailConnected ? "Readonly sync connected" : "Optional connector"}</strong>
          <small>{gmailConnected ? "Recruiting snippets can feed review-gated records." : "Use only when you want real inbox evidence."}</small>
          <Link href="/settings?section=gmail">Configure</Link>
        </article>
        <article className={setupTone(modelStatus.status === "ready" ? "ready" : modelStatus.status === "disabled" ? "optional" : "attention")}>
          <span>Gemma</span>
          <strong>{modelStatus.status === "ready" ? `${modelStatus.modelTag} ready` : nextModelStep.title}</strong>
          <small>{modelStatus.status === "ready" ? "Model-backed proposals still require review." : "Optional model-backed proposals."}</small>
          <Link href="/settings">Configure</Link>
        </article>
        <article className={setupTone(deleteAvailable ? "ready" : "optional")}>
          <span>Local data</span>
          <strong>{localStateLocation(repositoryKind)}</strong>
          <small>Export/import/delete this workspace only.</small>
          <Link href="/settings?section=local-data">Manage</Link>
        </article>
      </div>

      <section className="settings-first-run-strip" aria-label="First run setup checklist">
        <div>
          <span>Run locally</span>
          <code>pnpm install && pnpm dev</code>
        </div>
        <div>
          <span>Configure env</span>
          <code>.env.local</code>
        </div>
        <div>
          <span>Gmail</span>
          <strong>Readonly OAuth only</strong>
        </div>
        <div>
          <span>Gemma</span>
          <strong>Ollama Cloud API key</strong>
        </div>
        <p>No desktop Ollama server and no local model download are required for this public demo.</p>
      </section>

      <div className="workspace-scroll-region shell-scroll-region">
        {activeSection === "model" ? (
          <section className="section model-connect-section" id="settings-model">
        <div className="section-title">
          <div>
            <h2>Gemma model checks</h2>
            <p className="subtle">
              {modelStatus.status === "ready"
                ? `Gemma (${modelStatus.modelTag}) is ready. Review gates still protect every model-backed update.`
                : "Optional. The app works now in deterministic mode; use README for env setup when you want Gemma-backed proposals."}
            </p>
          </div>
          <span className={modelBadge(modelStatus.status)}>{modelStatus.status}</span>
        </div>
        <div className="model-connect-layout">
          <form className="model-connect-form" action="/api/model-status" method="post">
            <label>
              <span className="label">Connection mode</span>
              <select name="enabled" defaultValue={modelRuntime.enabled ? "on" : "off"}>
                <option value="off">Disabled - deterministic fallback</option>
                <option value="on">Enabled - use Ollama Cloud API</option>
              </select>
            </label>
            <label>
              <span className="label">Ollama Cloud endpoint</span>
              <input name="endpoint" defaultValue={modelRuntime.endpoint} placeholder="https://ollama.com" />
            </label>
            <label>
              <span className="label">Gemma model tag</span>
              <input name="modelTag" defaultValue={modelRuntime.modelTag} placeholder="gemma4:31b" />
            </label>
            <div className="model-connect-actions">
              <button className="button secondary" name="intent" type="submit" value="save">
                Save setup
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
            <a
              className="button secondary"
              href="https://github.com/hskl18/public-careeros#optional-gemma4-through-ollama-cloud"
              target="_blank"
              rel="noreferrer"
            >
              Read README setup
            </a>
          </div>
        </div>
        <div className="state-matrix settings-status-grid">
          <div className="state-cell">
            <span className="label">Fallback</span>
            <strong>{modelStatus.status === "disabled" ? "Active" : "Available"}</strong>
            <small>Works without Ollama Cloud.</small>
          </div>
          <div className="state-cell">
            <span className="label">Latest check</span>
            <strong>{modelStatus.latencyMs ? `${modelStatus.latencyMs}ms` : "Not connected"}</strong>
            <small>{modelStatus.status === "disabled" ? "No check runs while disabled." : modelStatus.diagnostic}</small>
          </div>
          <div className="state-cell">
            <span className="label">Latest trace</span>
            <strong>{latestTrace?.status ?? "none"}</strong>
            <small>{latestTrace ? latestTrace.task : "Appears after a model-backed action."}</small>
          </div>
        </div>
          </section>
        ) : null}

        {activeSection === "local-data" ? (
          <section className="section" id="settings-local-data">
        <div className="section-title">
          <div>
            <h2>Workspace storage</h2>
            <p className="subtle">Export, import, and delete only affect this local workspace.</p>
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
            <span className="label">Google callback URL</span>
            <strong className="code">{gmailSetup.redirectUri}</strong>
            <small>Paste this exact value into Google OAuth Authorized redirect URIs.</small>
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
        {gmailStatus ? (
          <div className="connector-diagnostic connector-diagnostic--warn">
            <strong>
              {gmailStatus === "redirect_uri_mismatch_local"
                ? "Gmail redirect URI needs attention"
                : "Gmail OAuth returned to settings"}
            </strong>
            <p>
              {gmailStatus === "redirect_uri_mismatch_local"
                ? gmailSetup.nextStep
                : "The Gmail OAuth result was sanitized. Recheck the callback URL below, then retry when the Google client is configured."}
            </p>
          </div>
        ) : null}
        <div className={gmailSetup.status === "ready" ? "connector-diagnostic" : "connector-diagnostic connector-diagnostic--warn"}>
          <div>
            <span className="label">OAuth setup diagnostic</span>
            <strong>{gmailSetup.status.replace("_", " ")}</strong>
            <p>{gmailSetup.nextStep}</p>
          </div>
          <dl>
            <div>
              <dt>Current app origin</dt>
              <dd>{gmailSetup.requestedOrigin}</dd>
            </div>
            <div>
              <dt>Callback origin</dt>
              <dd>{gmailSetup.redirectOrigin ?? "invalid callback URL"}</dd>
            </div>
            <div>
              <dt>Origin match</dt>
              <dd>{gmailSetup.originMatchesRequest ? "yes" : "no"}</dd>
            </div>
          </dl>
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
              <button className="button primary" type="submit">
                {connector?.status === "needs_attention" ? "Reconnect Gmail" : "Connect Gmail"}
              </button>
            </form>
            {gmailConnected ? (
              <>
                <form action="/api/connectors/gmail/sync" method="post">
                  <button className="button primary" type="submit">
                    Sync recruiting mail
                  </button>
                </form>
                <form action="/api/connectors/gmail/disconnect" method="post">
                  <button className="button secondary" type="submit">
                    Disconnect
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
          </section>
        ) : null}

        {activeSection === "imports" ? (
          <section className="section" id="settings-imports">
        <div className="section-title">
          <div>
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
