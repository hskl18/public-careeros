import { NextResponse } from "next/server";
import { rejectUnsafeLocalMutation } from "@/lib/api-security";
import { disconnectGmailLocal, syncGmailPlaceholder } from "@/lib/connectors";
import { gmailConnectUrl, gmailIsConfigured, syncGmailRecruitingMail } from "@/lib/gmail-local";
import { processLocalImportWithModel } from "@/lib/pipeline";
import { updateState } from "@/lib/store";

type GmailAction = "connect" | "disconnect" | "sync";

function isGmailAction(value: string): value is GmailAction {
  return value === "connect" || value === "disconnect" || value === "sync";
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
    const url = gmailConnectUrl(request.url);
    if (!url) {
      await updateState((state) => {
        const output = syncGmailPlaceholder(state);
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
        const knownThreadIds = new Set(state.mailboxThreads.map((thread) => thread.id));
        const withThreads = {
          ...state,
          mailboxThreads: [
            ...synced.threads.filter((thread) => !knownThreadIds.has(thread.id)),
            ...state.mailboxThreads
          ],
          connectorAccounts: [synced.account, ...state.connectorAccounts.filter((account) => account.provider !== "gmail")]
        };
        const next = await processLocalImportWithModel(withThreads, synced.records);
        result = {
          account: synced.account,
          status: synced.account.status,
          message: synced.account.message,
          importJob: next.importJobs[0]
        };
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gmail sync failed.";
      await updateState((state) => {
        const output = syncGmailPlaceholder(state);
        result = {
          ...output.result,
          message
        };
        return output.state;
      });
    }
  }

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return NextResponse.json(result);
  }

  return NextResponse.redirect(new URL("/settings", request.url), 303);
}
