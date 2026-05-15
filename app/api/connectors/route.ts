import { NextResponse } from "next/server";
import { listConnectorAccountsAsync } from "@/lib/connectors";
import { gmailOAuthSetupDiagnostic } from "@/lib/gmail-local";
import { readState } from "@/lib/store";

export async function GET(request: Request) {
  const state = await readState();
  return NextResponse.json({
    connectors: await listConnectorAccountsAsync(state),
    gmailOAuth: gmailOAuthSetupDiagnostic(request.url)
  });
}
