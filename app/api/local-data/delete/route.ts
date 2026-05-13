import { NextResponse } from "next/server";
import { rejectUnsafeLocalMutation } from "@/lib/api-security";
import { canDeleteLocalWorkspaceData, deleteLocalWorkspaceData } from "@/lib/store";

const confirmationText = "DELETE LOCAL DATA";

async function readConfirmation(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { confirm?: unknown };
    return String(body.confirm ?? "");
  }

  const form = await request.formData();
  return String(form.get("confirm") ?? "");
}

export async function POST(request: Request) {
  const unsafe = rejectUnsafeLocalMutation(request);
  if (unsafe) return unsafe;

  const accept = request.headers.get("accept") ?? "";
  const wantsJson = accept.includes("application/json");
  const confirm = await readConfirmation(request);

  if (confirm !== confirmationText) {
    return NextResponse.json(
      { error: `Confirmation required. Submit confirm="${confirmationText}".` },
      { status: 400 }
    );
  }

  if (!canDeleteLocalWorkspaceData()) {
    return NextResponse.json(
      { error: "Delete is only allowed for the default .careeros-data directory." },
      { status: 409 }
    );
  }

  const state = await deleteLocalWorkspaceData();
  if (wantsJson) {
    return NextResponse.json({
      deleted: true,
      dataDir: ".careeros-data",
      workspaceApplications: state.applications.length
    });
  }

  return NextResponse.redirect(new URL("/settings?localData=deleted", request.url), 303);
}
