import { NextResponse } from "next/server";
import { exchangeGmailCode, gmailConnectorAccount } from "@/lib/gmail-local";
import { updateState } from "@/lib/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?section=gmail&gmail=error`, request.url), 303);
  }
  if (!code) {
    return NextResponse.json({ error: "Missing Gmail OAuth code." }, { status: 400 });
  }

  try {
    await exchangeGmailCode(code, request.url);
    const account = await gmailConnectorAccount();
    await updateState((state) => ({
      ...state,
      connectorAccounts: [account, ...state.connectorAccounts.filter((item) => item.provider !== "gmail")]
    }));
    return NextResponse.redirect(new URL("/settings?section=gmail&gmail=connected", request.url), 303);
  } catch (exchangeError) {
    const message = exchangeError instanceof Error ? exchangeError.message : "Gmail OAuth failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
