import { NextResponse } from "next/server";
import { rejectUnsafeLocalMutation } from "@/lib/api-security";
import { newId, nowIso } from "@/lib/id";
import { evaluateResumeTextWithModel } from "@/lib/pipeline";
import { updateState } from "@/lib/store";

const maxResumeBodyBytes = 80_000;
const maxResumeTextChars = 6_000;
const maxResumeTitleChars = 120;

function contentLengthTooLarge(request: Request) {
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > maxResumeBodyBytes;
}

async function readResumeForm(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded") || !contentType) {
    const raw = await request.text();
    if (raw.length > maxResumeBodyBytes) return { tooLarge: true as const };
    const params = new URLSearchParams(raw);
    return { tooLarge: false as const, get: (key: string) => params.get(key) };
  }

  const form = await request.formData();
  return { tooLarge: false as const, get: (key: string) => form.get(key) };
}

export async function POST(request: Request) {
  const unsafe = rejectUnsafeLocalMutation(request);
  if (unsafe) return unsafe;
  if (contentLengthTooLarge(request)) {
    return NextResponse.json({ error: "Resume form body is too large." }, { status: 413 });
  }

  const form = await readResumeForm(request);
  if (form.tooLarge) {
    return NextResponse.json({ error: "Resume form body is too large." }, { status: 413 });
  }

  const intent = String(form.get("intent") ?? "analyze");
  const title = String(form.get("title") ?? "Pasted resume").trim().slice(0, maxResumeTitleChars);
  const text = String(form.get("text") ?? "").trim();

  if (text.length < 20) {
    return NextResponse.json({ error: "Resume text must be at least 20 characters." }, { status: 400 });
  }
  if (text.length > maxResumeTextChars) {
    return NextResponse.json({ error: `Resume text must be ${maxResumeTextChars} characters or less.` }, { status: 413 });
  }

  if (intent === "save") {
    await updateState((state) => ({
      ...state,
      resumeDocuments: [
        {
          id: newId("resume"),
          workspaceUserId: state.workspaceUser.id,
          title: title || "Pasted resume",
          text,
          sections: ["Pending analysis"],
          createdAt: nowIso()
        },
        ...state.resumeDocuments
      ]
    }));
  } else {
    await updateState((state) => evaluateResumeTextWithModel(state, title || "Pasted resume", text));
  }

  return NextResponse.redirect(new URL("/resume", request.url), 303);
}
