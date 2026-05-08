import { newId, nowIso } from "./id";
import type { CareerOSState, ConnectorAccount, ConnectorStatus, ImportJob } from "./types";

export interface ConnectorActionResult {
  account: ConnectorAccount;
  status: ConnectorStatus;
  message: string;
  importJob?: ImportJob;
}

function gmailConnectorEnabled() {
  return process.env.CAREEROS_GMAIL_CONNECTOR_ENABLED === "true";
}

function gmailConfigured() {
  return Boolean(process.env.CAREEROS_GMAIL_CLIENT_ID && process.env.CAREEROS_GMAIL_CLIENT_SECRET);
}

function gmailBaseStatus(): Pick<ConnectorAccount, "status" | "message"> {
  if (!gmailConnectorEnabled()) {
    return {
      status: "disabled",
      message: "Gmail connector is disabled. Local dashboard, imports, and processing are unaffected."
    };
  }

  if (!gmailConfigured()) {
    return {
      status: "not_configured",
      message: "Gmail connector is enabled but OAuth client placeholders are not configured."
    };
  }

  return {
    status: "disconnected",
    message: "Gmail connector configuration is present, but OAuth connect flow is not implemented yet."
  };
}

export function normalizeGmailConnector(account?: ConnectorAccount): ConnectorAccount {
  const base = gmailBaseStatus();
  const storedStatus = account?.status;
  const status =
    base.status === "disconnected" && (storedStatus === "connected" || storedStatus === "needs_attention")
      ? storedStatus
      : base.status;

  return {
    id: account?.id ?? "connector_gmail",
    provider: "gmail",
    status,
    label: "Gmail connector optional",
    message: status === base.status ? base.message : account?.message ?? base.message,
    updatedAt: account?.updatedAt ?? nowIso()
  };
}

export function listConnectorAccounts(state: CareerOSState): ConnectorAccount[] {
  const gmail = normalizeGmailConnector(state.connectorAccounts.find((account) => account.provider === "gmail"));
  const others = state.connectorAccounts.filter((account) => account.provider !== "gmail");
  return [gmail, ...others];
}

export function withConnectorAccounts(state: CareerOSState): CareerOSState {
  return {
    ...state,
    connectorAccounts: listConnectorAccounts(state)
  };
}

function upsertGmailAccount(state: CareerOSState, account: ConnectorAccount): CareerOSState {
  return {
    ...state,
    connectorAccounts: [
      account,
      ...state.connectorAccounts.filter((candidate) => candidate.provider !== "gmail")
    ]
  };
}

export function startGmailConnectPlaceholder(state: CareerOSState): { state: CareerOSState; result: ConnectorActionResult } {
  const account = normalizeGmailConnector(state.connectorAccounts.find((candidate) => candidate.provider === "gmail"));
  const resultAccount: ConnectorAccount = {
    ...account,
    status: account.status === "disabled" || account.status === "not_configured" ? account.status : "needs_attention",
    message:
      account.status === "disabled" || account.status === "not_configured"
        ? account.message
      : "OAuth connect flow is intentionally not implemented until encrypted credential storage exists.",
    updatedAt: nowIso()
  };

  return {
    state: upsertGmailAccount(state, resultAccount),
    result: {
      account: resultAccount,
      status: resultAccount.status,
      message: resultAccount.message ?? "Gmail connector connect placeholder completed."
    }
  };
}

export function disconnectGmailPlaceholder(state: CareerOSState): { state: CareerOSState; result: ConnectorActionResult } {
  const account = normalizeGmailConnector(state.connectorAccounts.find((candidate) => candidate.provider === "gmail"));
  const resultAccount: ConnectorAccount = {
    ...account,
    status: account.status === "disabled" || account.status === "not_configured" ? account.status : "disconnected",
    message:
      account.status === "disabled" || account.status === "not_configured"
        ? account.message
        : "Gmail connector disconnected. No OAuth credentials are stored by this local milestone.",
    updatedAt: nowIso()
  };

  return {
    state: upsertGmailAccount(state, resultAccount),
    result: {
      account: resultAccount,
      status: resultAccount.status,
      message: resultAccount.message ?? "Gmail connector disconnected."
    }
  };
}

export function syncGmailPlaceholder(state: CareerOSState): { state: CareerOSState; result: ConnectorActionResult } {
  const account = normalizeGmailConnector(state.connectorAccounts.find((candidate) => candidate.provider === "gmail"));
  const importJob: ImportJob = {
    id: newId("job"),
    source: "gmail",
    status: "failed",
    attempts: 1,
    error:
      account.status === "disabled" || account.status === "not_configured"
        ? account.message
        : "Gmail sync is not implemented until OAuth and encrypted credential storage are added.",
    createdAt: nowIso(),
    processedAt: nowIso()
  };
  const resultAccount: ConnectorAccount = {
    ...account,
    status:
      account.status === "disabled" || account.status === "not_configured" ? account.status : "needs_attention",
    message: importJob.error,
    updatedAt: nowIso()
  };

  return {
    state: {
      ...upsertGmailAccount(state, resultAccount),
      importJobs: [importJob, ...state.importJobs]
    },
    result: {
      account: resultAccount,
      status: resultAccount.status,
      message: importJob.error ?? "Gmail sync placeholder returned no work.",
      importJob
    }
  };
}
