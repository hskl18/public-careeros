import { NextResponse } from "next/server";
import { processLocalImportWithModel } from "@/lib/pipeline";
import { updateState } from "@/lib/store";

export async function POST(request: Request) {
  await updateState((state) =>
    processLocalImportWithModel(state, [
      {
        company: "Cedar Systems",
        role: "Full Stack Engineer",
        sourceLabel: "manual-run:cedar",
        text: "Recruiter reply detected for Full Stack Engineer. Follow-up is due on 2026-05-12."
      },
      {
        company: "Atlas Robotics",
        role: "Product Engineer",
        sourceLabel: "manual-run:atlas-deadline",
        text: "Assessment deadline might be 2026-05-15 or 2026-05-16, wording is unclear."
      }
    ])
  );

  return NextResponse.redirect(new URL("/", request.url), 303);
}
