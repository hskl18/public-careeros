import { newId, nowIso } from "./id";
import { deleteGmailToken, gmailConnectorAccount } from "./gmail-local";
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

function gmailBaseStatus(): Pick<ConnectorAccount, "status" | "message"> {
  if (!gmailConnectorEnabled()) {
    return {
      status: "disabled",
      message: "Gmail connector is disabled. Local console, imports, and processing are unaffected."
    };
  }

  if (!process.env.CAREEROS_GMAIL_CLIENT_ID || !process.env.CAREEROS_GMAIL_CLIENT_SECRET) {
    return {
      status: "not_configured",
      message: "Gmail sync is enabled, but CAREEROS_GMAIL_CLIENT_ID and CAREEROS_GMAIL_CLIENT_SECRET are missing."
    };
  }

  return {
    status: "disconnected",
    message: "Gmail OAuth is configured. Connect once, then sync recent recruiting mail into the local pipeline."
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

export async function listConnectorAccountsAsync(state: CareerOSState): Promise<ConnectorAccount[]> {
  const gmail = await gmailConnectorAccount();
  const stored = state.connectorAccounts.find((account) => account.provider === "gmail");
  const merged = {
    ...gmail,
    updatedAt: stored?.updatedAt ?? gmail.updatedAt
  };
  const others = state.connectorAccounts.filter((account) => account.provider !== "gmail");
  return [merged, ...others];
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
      : "Gmail OAuth is configured. Use the Connect action in the local app to authorize Gmail readonly access.",
    updatedAt: nowIso()
  };

  return {
    state: upsertGmailAccount(state, resultAccount),
    result: {
      account: resultAccount,
      status: resultAccount.status,
      message: resultAccount.message ?? "Gmail connector connect state updated."
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
        : "Gmail connector disconnected. Remove .careeros-data/gmail-oauth.json to clear the local OAuth token.",
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

export async function disconnectGmailLocal(state: CareerOSState): Promise<{ state: CareerOSState; result: ConnectorActionResult }> {
  await deleteGmailToken();
  const account = await gmailConnectorAccount();
  const resultAccount: ConnectorAccount = {
    ...account,
    status: account.status === "connected" ? "disconnected" : account.status,
    message:
      account.status === "connected"
        ? "Gmail disconnected and the local OAuth token file was removed."
        : account.message,
    updatedAt: nowIso()
  };
  return {
    state: upsertGmailAccount(state, resultAccount),
    result: {
      account: resultAccount,
      status: resultAccount.status,
      message: resultAccount.message ?? "Gmail disconnected."
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
        : "Gmail sync needs a local OAuth token. Click Connect Gmail, finish Google OAuth, then retry sync.",
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
      message: importJob.error ?? "Gmail sync returned no work.",
      importJob
    }
  };
}
