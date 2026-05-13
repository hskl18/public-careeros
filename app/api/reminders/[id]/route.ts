import { NextResponse } from "next/server";
import { rejectUnsafeLocalMutation } from "@/lib/api-security";
import { updateReminderStatus } from "@/lib/review";
import { updateState } from "@/lib/store";

function parseReminderStatus(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "done" || normalized === "completed") return "done";
  if (normalized === "dismiss" || normalized === "dismissed") return "dismissed";
  return undefined;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unsafe = rejectUnsafeLocalMutation(request);
  if (unsafe) return unsafe;

  const { id } = await context.params;
  const contentType = request.headers.get("content-type") ?? "";
  let intent = "done";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { status?: string; intent?: string };
    intent = body.status ?? body.intent ?? intent;
  } else {
    const form = await request.formData();
    intent = String(form.get("status") ?? form.get("intent") ?? intent);
  }

  const status = parseReminderStatus(intent);
  if (!status) {
    return NextResponse.json(
      { error: "Unsupported reminder status. Use done, completed, dismiss, or dismissed." },
      { status: 400 }
    );
  }

  const state = await updateState((current) => updateReminderStatus(current, id, status));

  if (contentType.includes("application/json")) {
    return NextResponse.json({ reminder: state.reminders.find((item) => item.id === id) });
  }

  return NextResponse.redirect(new URL("/", request.url), 303);
}
