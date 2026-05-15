import { NextResponse } from "next/server";
import { exchangeGmailCode, gmailConnectorAccount, gmailOAuthState } from "@/lib/gmail-local";
import { updateState } from "@/lib/store";

function redirectToGmailSettings(request: Request, status: string) {
  return NextResponse.redirect(new URL(`/settings?section=gmail&gmail=${status}`, request.url), 303);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  if (error) {
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
    await updateState((state) => ({
      ...state,
      connectorAccounts: [account, ...state.connectorAccounts.filter((item) => item.provider !== "gmail")]
    }));
    return redirectToGmailSettings(request, "connected");
  } catch {
    return redirectToGmailSettings(request, "exchange_failed");
  }
}
