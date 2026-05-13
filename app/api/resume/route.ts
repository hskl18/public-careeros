import { NextResponse } from "next/server";
import { rejectUnsafeLocalMutation } from "@/lib/api-security";
import { newId, nowIso } from "@/lib/id";
import { evaluateResumeTextWithModel } from "@/lib/pipeline";
import { updateState } from "@/lib/store";

export async function POST(request: Request) {
  const unsafe = rejectUnsafeLocalMutation(request);
  if (unsafe) return unsafe;

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "analyze");
  const title = String(form.get("title") ?? "Pasted resume");
  const text = String(form.get("text") ?? "");

  if (text.trim().length < 20) {
    return NextResponse.json({ error: "Resume text must be at least 20 characters." }, { status: 400 });
  }

  if (intent === "save") {
    await updateState((state) => ({
      ...state,
      resumeDocuments: [
        {
          id: newId("resume"),
          workspaceUserId: state.workspaceUser.id,
          title: title.trim() || "Pasted resume",
          text: text.trim().slice(0, 6000),
          sections: ["Pending analysis"],
          createdAt: nowIso()
        },
        ...state.resumeDocuments
      ]
    }));
  } else {
    await updateState((state) => evaluateResumeTextWithModel(state, title, text));
  }

  return NextResponse.redirect(new URL("/resume", request.url), 303);
}
