import { NextResponse } from "next/server";
import {
  disconnectGmailPlaceholder,
  startGmailConnectPlaceholder,
  syncGmailPlaceholder
} from "@/lib/connectors";
import { updateState } from "@/lib/store";

type GmailAction = "connect" | "disconnect" | "sync";

function isGmailAction(value: string): value is GmailAction {
  return value === "connect" || value === "disconnect" || value === "sync";
}

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!isGmailAction(action)) {
    return NextResponse.json({ error: "Unknown Gmail connector action." }, { status: 404 });
  }

  let result;
  await updateState((state) => {
    const output =
      action === "connect"
        ? startGmailConnectPlaceholder(state)
        : action === "disconnect"
          ? disconnectGmailPlaceholder(state)
          : syncGmailPlaceholder(state);
    result = output.result;
    return output.state;
  });

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return NextResponse.json(result);
  }

  return NextResponse.redirect(new URL("/settings", request.url), 303);
}
