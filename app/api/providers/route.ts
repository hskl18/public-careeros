import { NextResponse } from "next/server";
import { listProviderAdapters } from "@/lib/providers";

export const dynamic = "force-static";

/**
 * Returns the static provider-adapter registry: every model path CareerOS
 * knows about, plus its implementation status, trust boundary, and unlock
 * gate. Judge demos and external integrators can use this to verify that
 * roadmap adapters are *not* presented as shipped.
 */
export async function GET() {
  return NextResponse.json({
    adapters: listProviderAdapters(),
    note: "Implementation status is metadata only. Roadmap adapters do not run model code from CareerOS."
  });
}
