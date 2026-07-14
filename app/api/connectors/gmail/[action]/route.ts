import { NextResponse } from "next/server";
import { rejectUnsafeLocalMutation } from "@/lib/api-security";
import { appendAuditEvent } from "@/lib/audit";
import { disconnectGmailLocal, startGmailConnectPlaceholder, syncGmailPlaceholder } from "@/lib/connectors";
import { newId, nowIso } from "@/lib/id";
import {
  gmailConnectUrl,
  gmailFailureCode,
  gmailIsConfigured,
  gmailOAuthSetupDiagnostic,
  syncGmailRecruitingMail
} from "@/lib/gmail-local";
import { createGmailSyncProgress, transitionGmailSync } from "@/lib/gmail-sync";
import { processLocalImportWithModel } from "@/lib/pipeline";
import { updateState } from "@/lib/store";
import type { CareerOSState, ConnectorAccount, GmailSyncProgress, ImportJob, MailboxThread } from "@/lib/types";

type GmailAction = "connect" | "disconnect" | "sync" | "pause";
const gmailSyncFailureMessage =
  "Gmail sync could not complete. The diagnostic below is redacted; retry or reconnect without changing local CareerOS data.";

function isGmailAction(value: string): value is GmailAction {
  return value === "connect" || value === "disconnect" || value === "sync" || value === "pause";
}

function mergeGmailThreads(existing: MailboxThread[], incoming: MailboxThread[]) {
  const byId = new Map(existing.map((thread) => [thread.id, thread]));
  for (const thread of incoming) {
    const current = byId.get(thread.id);
    if (!current) {
      byId.set(thread.id, thread);
      continue;
    }
    const messages = new Map(current.messages.map((message) => [message.id, message]));
    for (const message of thread.messages) messages.set(message.id, { ...messages.get(message.id), ...message });
    byId.set(thread.id, {
      ...current,
      subject: thread.subject || current.subject,
      companyHint: thread.companyHint ?? current.companyHint,
      roleHint: thread.roleHint ?? current.roleHint,
      messages: [...messages.values()].sort((left, right) => right.receivedAt.localeCompare(left.receivedAt))
    });
  }
  return [...byId.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function knownGmailSourceLabels(state: CareerOSState) {
  return new Set([
    ...state.evidenceSnippets.map((snippet) => snippet.sourceLabel),
    ...state.mailboxThreads.flatMap((thread) => thread.messages.map((message) => message.sourceLabel))
  ]);
}

function gmailImportJob(status: ImportJob["status"], message?: string): ImportJob {
  const now = nowIso();
  return {
    id: newId("job"),
    source: "gmail",
    status,
    attempts: 1,
    error: message,
    createdAt: now,
    processedAt: now
  };
}

function withTransition(
  state: CareerOSState,
  status: Parameters<typeof transitionGmailSync>[1],
  options: Parameters<typeof transitionGmailSync>[2]
) {
  const transition = transitionGmailSync(state.gmailSync, status, options);
  return appendAuditEvent({ ...state, gmailSync: transition.sync }, transition.audit);
}

function startProgress(state: CareerOSState) {
  if (["catching_up", "paused", "degraded"].includes(state.gmailSync.status) && state.gmailSync.progress) {
    return createGmailSyncProgress(state.gmailSync.progress);
  }
  return createGmailSyncProgress();
}

function updatedProgress(
  previous: GmailSyncProgress,
  synced: Awaited<ReturnType<typeof syncGmailRecruitingMail>>,
  importedRecords: number,
  duplicateRecords: number
): GmailSyncProgress {
  return {
    ...previous,
    checkpointPageToken: synced.stats.nextPageToken,
    pagesCompleted: previous.pagesCompleted + synced.stats.pagesFetched,
    messagesListed: previous.messagesListed + synced.stats.listedMessages,
    messagesFetched: previous.messagesFetched + synced.stats.fetchedMessages,
    importedRecords: previous.importedRecords + importedRecords,
    duplicateRecords: previous.duplicateRecords + duplicateRecords,
    resultSizeEstimate: synced.stats.resultSizeEstimate ?? previous.resultSizeEstimate,
    hasMore: synced.stats.hasMore
  };
}

function accountForFailure(code: string): ConnectorAccount {
  return {
    id: "connector_gmail",
    provider: "gmail",
    status: "needs_attention",
    label: "Gmail local sync",
    message:
      code === "rate_limited"
        ? "Gmail rate limited this bounded window. The checkpoint is safe; retry later."
        : code === "reconnect_required" || code.startsWith("token_")
          ? "The saved Gmail authorization cannot be recovered. Reconnect Gmail to continue."
          : "Gmail returned an invalid or unavailable response. The checkpoint is safe; retry when ready.",
    updatedAt: nowIso()
  };
}

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  const unsafe = rejectUnsafeLocalMutation(request);
  if (unsafe) return unsafe;
  const { action } = await context.params;
  if (!isGmailAction(action)) {
    return NextResponse.json({ error: "Unknown Gmail connector action." }, { status: 404 });
  }

  let result: unknown;
  if (action === "connect") {
    const setup = gmailOAuthSetupDiagnostic(request.url);
    if (setup.status === "needs_attention") {
      await updateState((state) => {
        const output = startGmailConnectPlaceholder(state);
        result = { ...output.result, status: "needs_attention", message: setup.nextStep, oauthSetup: setup };
        return output.state;
      });
      if ((request.headers.get("accept") ?? "").includes("application/json")) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.redirect(new URL("/settings?section=gmail&gmail=redirect_uri_mismatch_local", request.url), 303);
    }

    const url = gmailConnectUrl(request.url);
    if (!url) {
      await updateState((state) => {
        const output = startGmailConnectPlaceholder(state);
        result = output.result;
        return output.state;
      });
    } else {
      await updateState((state) =>
        withTransition(state, "authorizing", {
          diagnosticCode: "authorization_pending",
          summary: "Gmail readonly authorization started."
        })
      );
      return NextResponse.redirect(url, 303);
    }
  } else if (action === "disconnect") {
    await updateState(async (state) => {
      const output = await disconnectGmailLocal(state);
      const disconnected = withTransition(output.state, "disconnected", {
        summary: "Gmail was disconnected and its local token envelope was removed."
      });
      result = output.result;
      return { ...disconnected, gmailSync: { ...disconnected.gmailSync, progress: undefined } };
    });
  } else if (action === "pause") {
    await updateState((state) => {
      const paused = withTransition(state, "paused", {
        progress: state.gmailSync.progress,
        summary: "Gmail backfill paused at its persisted checkpoint."
      });
      result = {
        status: "paused",
        message: "Gmail backfill is paused. Continue when ready; no checkpoint or imported record was removed.",
        progress: paused.gmailSync.progress
      };
      return paused;
    });
  } else if (!gmailIsConfigured()) {
    await updateState((state) => {
      const output = syncGmailPlaceholder(state);
      result = output.result;
      return output.state;
    });
  } else {
    let progress: GmailSyncProgress | undefined;
    await updateState((state) => {
      progress = startProgress(state);
      return withTransition(state, "catching_up", {
        progress,
        summary: "Gmail started a bounded backfill window."
      });
    });

    try {
      const synced = await syncGmailRecruitingMail({
        limit: Number(process.env.CAREEROS_GMAIL_MAX_RESULTS ?? 10),
        pageToken: progress?.checkpointPageToken,
        maxPages: 1
      });
      await updateState(async (state) => {
        const knownLabels = knownGmailSourceLabels(state);
        const freshRecords = synced.records.filter((record) => !knownLabels.has(record.sourceLabel));
        const duplicateCount = synced.records.length - freshRecords.length;
        const withThreads = {
          ...state,
          mailboxThreads: mergeGmailThreads(state.mailboxThreads, synced.threads),
          connectorAccounts: [synced.account, ...state.connectorAccounts.filter((account) => account.provider !== "gmail")]
        };
        const next =
          freshRecords.length > 0
            ? await processLocalImportWithModel(withThreads, freshRecords, {}, "gmail")
            : {
                ...withThreads,
                importJobs: [gmailImportJob("processed", "Gmail sync found no new recruiting messages to import."), ...withThreads.importJobs]
              };
        const nextProgress = updatedProgress(progress ?? createGmailSyncProgress(), synced, freshRecords.length, duplicateCount);
        const status = synced.stats.hasMore ? "catching_up" : "idle";
        const transitioned = withTransition(next, status, {
          progress: nextProgress,
          lastSuccessfulAt: nowIso(),
          summary: synced.stats.hasMore
            ? "Gmail persisted a bounded page and checkpointed the next page."
            : "Gmail completed the bounded backfill window."
        });
        result = {
          account: synced.account,
          status,
          message: synced.stats.hasMore
            ? `Imported this bounded page. ${nextProgress.messagesFetched} messages checked so far; continue or pause.`
            : `Gmail is up to date. ${nextProgress.importedRecords} new records imported and ${nextProgress.duplicateRecords} duplicates suppressed.`,
          importJob: transitioned.importJobs[0],
          stats: {
            ...synced.stats,
            importedRecords: freshRecords.length,
            duplicateRecords: duplicateCount
          },
          progress: nextProgress
        };
        return transitioned;
      });
    } catch (error) {
      const code = gmailFailureCode(error);
      const reconnect = code === "reconnect_required" || code.startsWith("token_");
      await updateState((state) => {
        const account = accountForFailure(code);
        const failedState = {
          ...state,
          connectorAccounts: [account, ...state.connectorAccounts.filter((candidate) => candidate.provider !== "gmail")],
          importJobs: [gmailImportJob("failed", gmailSyncFailureMessage), ...state.importJobs]
        };
        const transitioned = withTransition(failedState, reconnect ? "reconnect_required" : "degraded", {
          diagnosticCode: code,
          progress: state.gmailSync.progress,
          summary: reconnect
            ? "Gmail authorization recovery failed and reconnect is required."
            : "Gmail backfill stopped with a redacted recoverable diagnostic."
        });
        result = {
          account,
          status: transitioned.gmailSync.status,
          diagnosticCode: code,
          message: gmailSyncFailureMessage,
          progress: transitioned.gmailSync.progress
        };
        return transitioned;
      });
    }
  }

  if ((request.headers.get("accept") ?? "").includes("application/json")) return NextResponse.json(result);
  return NextResponse.redirect(new URL("/settings?section=gmail", request.url), 303);
}
