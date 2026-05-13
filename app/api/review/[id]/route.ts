import { NextResponse } from "next/server";
import { rejectUnsafeLocalMutation } from "@/lib/api-security";
import { acceptReviewItem, correctReviewItem, dismissReviewItem } from "@/lib/review";
import { updateState } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unsafe = rejectUnsafeLocalMutation(request);
  if (unsafe) return unsafe;

  const { id } = await context.params;
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  await updateState((state) => {
    if (intent === "accept") return acceptReviewItem(state, id);
    if (intent === "dismiss") return dismissReviewItem(state, id);
    if (intent === "correct") {
      const rawDeadline = String(form.get("deadlineAt") || "").trim();
      let deadlineAt: string | undefined;
      if (rawDeadline) {
        const parsed = new Date(rawDeadline);
        deadlineAt = Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
      }
      return correctReviewItem(state, id, {
        deadlineAt,
        eventSummary: String(form.get("eventSummary") || "User corrected review item")
      });
    }
    return state;
  });

  return NextResponse.redirect(new URL("/review", request.url), 303);
}
