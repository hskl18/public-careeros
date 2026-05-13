import { NextResponse } from "next/server";
import { listConnectorAccountsAsync } from "@/lib/connectors";
import { readState } from "@/lib/store";

export async function GET() {
  const state = await readState();
  return NextResponse.json({ connectors: await listConnectorAccountsAsync(state) });
}
