import { NextResponse } from "next/server";
import { deriveAnalyticsSummary } from "@/lib/analytics";
import { readState } from "@/lib/store";

export async function GET() {
  return NextResponse.json(deriveAnalyticsSummary(await readState()));
}
