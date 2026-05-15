import { NextResponse } from "next/server";
import { deriveAnalyticsSummary } from "@/lib/metrics";
import { readState } from "@/lib/store";

export async function GET() {
  return NextResponse.json(deriveAnalyticsSummary(await readState()));
}
