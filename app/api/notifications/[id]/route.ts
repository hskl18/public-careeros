import { NextResponse } from "next/server";
import { rejectUnsafeLocalMutation } from "@/lib/api-security";
import { updateState } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unsafe = rejectUnsafeLocalMutation(request);
  if (unsafe) return unsafe;

  const { id } = await context.params;
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "read");
  await updateState((state) => ({
    ...state,
    notifications: state.notifications.map((notification) =>
      notification.id === id
        ? {
            ...notification,
            status: intent === "dismiss" ? "dismissed" : "read"
          }
        : notification
    )
  }));

  return NextResponse.redirect(new URL("/notifications", request.url), 303);
}
