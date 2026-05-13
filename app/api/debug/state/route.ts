import { NextResponse } from "next/server";
import { readState } from "@/lib/store";

function debugStateEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.CAREEROS_DEBUG_STATE_ENABLED === "true";
}

export async function GET() {
  if (!debugStateEnabled()) {
    return NextResponse.json({ error: "Debug state endpoint is disabled." }, { status: 404 });
  }

  return NextResponse.json(await readState(), {
    headers: {
      "cache-control": "no-store"
    }
  });
}
