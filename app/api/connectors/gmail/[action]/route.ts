import { NextResponse } from "next/server";
import { rejectUnsafeLocalMutation } from "@/lib/api-security";
import { appendAuditEvent, createAuditEvent } from "@/lib/audit";
import { disconnectGmailLocal, startGmailConnectPlaceholder, syncGmailPlaceholder } from "@/lib/connectors";
import { newId, nowIso } from "@/lib/id";
import { gmailConnectUrl, gmailIsConfigured, gmailOAuthSetupDiagnostic, syncGmailRecruitingMail } from "@/lib/gmail-local";
import { processLocalImportWithModel } from "@/lib/pipeline";
import { updateState } from "@/lib/store";
import type { CareerOSState, ImportJob, MailboxThread } from "@/lib/types";

type GmailAction = "connect" | "disconnect" | "sync";
const gmailSyncFailureMessage =
  "Gmail sync could not complete. Reconnect Gmail or try again later; local CareerOS data was not blocked.";

function isGmailAction(value: string): value is GmailAction {
  return value === "connect" || value === "disconnect" || value === "sync";
}

function mergeGmailThreads(existing: MailboxThread[], incoming: MailboxThread[]) {
  const byId = new Map(existing.map((thread) => [thread.id, thread]));
  for (const thread of incoming) {
    const current = byId.get(thread.id);
    if (!current) {
      byId.set(thread.id, thread);
      continue;
    }

    const seenMessages = new Set(current.messages.map((message) => message.id));
    const newMessages = thread.messages.filter((message) => !seenMessages.has(message.id));
    byId.set(thread.id, {
      ...current,
      subject: current.subject || thread.subject,
      companyHint: current.companyHint ?? thread.companyHint,
      roleHint: current.roleHint ?? thread.roleHint,
      messages: [...newMessages, ...current.messages].sort((left, right) => right.receivedAt.localeCompare(left.receivedAt))
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

function gmailNoopImportJob(message: string): ImportJob {
  const now = nowIso();
  return {
    id: newId("job"),
    source: "gmail",
    status: "processed",
    attempts: 1,
    error: message,
    createdAt: now,
    processedAt: now
  };
}

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  const unsafe = rejectUnsafeLocalMutation(request);
  if (unsafe) return unsafe;

  const { action } = await context.params;
  if (!isGmailAction(action)) {
    return NextResponse.json({ error: "Unknown Gmail connector action." }, { status: 404 });
  }

  let result;
  if (action === "connect") {
    const setup = gmailOAuthSetupDiagnostic(request.url);
    if (setup.status === "needs_attention") {
      await updateState((state) => {
        const output = startGmailConnectPlaceholder(state);
        result = {
          ...output.result,
          status: "needs_attention",
          message: setup.nextStep,
          oauthSetup: setup
        };
        return output.state;
      });
      const accept = request.headers.get("accept") ?? "";
      if (accept.includes("application/json")) {
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
      return NextResponse.redirect(url, 303);
    }
  } else if (action === "disconnect") {
    await updateState(async (state) => {
      const output = await disconnectGmailLocal(state);
      result = output.result;
      return output.state;
    });
  } else if (!gmailIsConfigured()) {
    await updateState((state) => {
      const output = syncGmailPlaceholder(state);
      result = output.result;
      return output.state;
    });
  } else {
    try {
      const synced = await syncGmailRecruitingMail(Number(process.env.CAREEROS_GMAIL_MAX_RESULTS ?? 10));
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
                importJobs: [
                  gmailNoopImportJob("Gmail sync found no new recruiting messages to import."),
                  ...withThreads.importJobs
                ]
              };
        const audited = appendAuditEvent(
          next,
          createAuditEvent({
            action: "gmail.sync",
            status: "succeeded",
            summary: `Gmail sync fetched ${synced.stats.fetchedMessages} message${synced.stats.fetchedMessages === 1 ? "" : "s"} and imported ${freshRecords.length} new record${freshRecords.length === 1 ? "" : "s"}.`,
            actor: "system",
            sourceType: "connector",
            sourceId: "connector_gmail",
            metadata: {
              pagesFetched: synced.stats.pagesFetched,
              fetchedMessages: synced.stats.fetchedMessages,
              importedRecords: freshRecords.length,
              duplicateRecords: duplicateCount,
              hasMore: synced.stats.hasMore
            }
          })
        );
        result = {
          account: synced.account,
          status: synced.account.status,
          message: `Gmail sync fetched ${synced.stats.fetchedMessages} bounded snippet${synced.stats.fetchedMessages === 1 ? "" : "s"}; ${freshRecords.length} new, ${duplicateCount} already known.`,
          importJob: audited.importJobs[0],
          stats: {
            ...synced.stats,
            importedRecords: freshRecords.length,
            duplicateRecords: duplicateCount
          }
        };
        return audited;
      });
    } catch (error) {
      await updateState((state) => {
        const output = syncGmailPlaceholder(state);
        result = {
          ...output.result,
          message: gmailSyncFailureMessage
        };
        return appendAuditEvent(
          output.state,
          createAuditEvent({
            action: "gmail.sync",
            status: "failed",
            summary: "Gmail sync failed with a sanitized diagnostic.",
            actor: "system",
            sourceType: "connector",
            sourceId: "connector_gmail"
          })
        );
      });
    }
  }

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return NextResponse.json(result);
  }

  return NextResponse.redirect(new URL("/settings", request.url), 303);
}
