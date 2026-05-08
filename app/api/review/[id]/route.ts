import { NextResponse } from "next/server";
import { acceptReviewItem, correctReviewItem, dismissReviewItem } from "@/lib/review";
import { updateState } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  await updateState((state) => {
    if (intent === "accept") return acceptReviewItem(state, id);
    if (intent === "dismiss") return dismissReviewItem(state, id);
    if (intent === "correct") {
      return correctReviewItem(state, id, {
        deadlineAt: String(form.get("deadlineAt") || "") || undefined,
        eventSummary: String(form.get("eventSummary") || "User corrected review item")
      });
    }
    return state;
  });

  return NextResponse.redirect(new URL("/review", request.url), 303);
}
