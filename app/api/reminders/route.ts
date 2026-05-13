import { NextResponse } from "next/server";
import { deriveApplicationTimeline, queryOpenReminders, queryReminderHistory } from "@/lib/reminder-queries";
import { readState } from "@/lib/store";

function parseStatus(value: string | null) {
  if (value === "done" || value === "dismissed" || value === "all") return value;
  return "all";
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const applicationId = searchParams.get("applicationId") ?? undefined;
  const state = await readState();
  return NextResponse.json({
    open: queryOpenReminders(state, { applicationId }),
    history: queryReminderHistory(state, { applicationId, status: parseStatus(searchParams.get("status")) }),
    timeline: applicationId ? deriveApplicationTimeline(state, applicationId) : undefined
  });
}
