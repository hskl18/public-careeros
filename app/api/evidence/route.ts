import { NextResponse } from "next/server";
import { deriveEvidenceRelationshipViews } from "@/lib/evidence-queries";
import { readState } from "@/lib/store";

export async function GET() {
  return NextResponse.json(deriveEvidenceRelationshipViews(await readState()));
}
