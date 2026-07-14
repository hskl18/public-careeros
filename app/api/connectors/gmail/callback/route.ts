import { NextResponse } from "next/server";
import { appendAuditEvent } from "@/lib/audit";
import { exchangeGmailCode, gmailConnectorAccount, gmailOAuthState } from "@/lib/gmail-local";
import { canTransitionGmailSync, transitionGmailSync } from "@/lib/gmail-sync";
import { updateState } from "@/lib/store";

function redirectToGmailSettings(request: Request, status: string) {
  return NextResponse.redirect(new URL(`/settings?section=gmail&gmail=${status}`, request.url), 303);
}

async function recordCallbackFailure(status: "disconnected" | "reconnect_required", diagnosticCode: "oauth_denied") {
  await updateState((state) => {
    if (!canTransitionGmailSync(state.gmailSync.status, status)) return state;
    const transition = transitionGmailSync(state.gmailSync, status, {
      diagnosticCode,
      summary:
        status === "disconnected"
          ? "Gmail authorization was cancelled without changing local data."
          : "Gmail authorization callback failed validation and reconnect is required."
    });
    return appendAuditEvent({ ...state, gmailSync: transition.sync }, transition.audit);
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  if (error) {
    await recordCallbackFailure("disconnected", "oauth_denied");
    return redirectToGmailSettings(request, "oauth_denied");
  }
  if (state !== gmailOAuthState) {
    return redirectToGmailSettings(request, "oauth_state_invalid");
  }
  if (!code) {
    return redirectToGmailSettings(request, "missing_code");
  }

  try {
    await exchangeGmailCode(code, request.url);
    const account = await gmailConnectorAccount();
    await updateState((state) => {
      const transition = transitionGmailSync(state.gmailSync, "idle", {
        lastSuccessfulAt: new Date().toISOString(),
        summary: "Gmail readonly authorization completed and the token envelope was stored."
      });
      return appendAuditEvent(
        {
          ...state,
          gmailSync: transition.sync,
          connectorAccounts: [account, ...state.connectorAccounts.filter((item) => item.provider !== "gmail")]
        },
        transition.audit
      );
    });
    return redirectToGmailSettings(request, "connected");
  } catch {
    await recordCallbackFailure("reconnect_required", "oauth_denied");
    return redirectToGmailSettings(request, "exchange_failed");
  }
}
