import { NextResponse } from "next/server";
import { rejectUnsafeLocalMutation } from "@/lib/api-security";
import { updateState } from "@/lib/store";
import {
  maxWorkspaceImportBytes,
  validateWorkspaceImport,
  withWorkspaceImportJob,
  workspaceImportConfirmation
} from "@/lib/workspace-import";

function wantsJson(request: Request) {
  return (request.headers.get("accept") ?? "").includes("application/json");
}

function sanitizedFailure(code: string) {
  return {
    imported: false,
    code,
    error: "Workspace import failed validation. Export a fresh CareerOS JSON file and try again."
  };
}

function stateValueFromJson(value: unknown) {
  if (typeof value === "object" && value !== null && "state" in value) {
    return (value as { state?: unknown }).state;
  }

  return value;
}

function confirmationFromJson(value: unknown, request: Request) {
  if (typeof value === "object" && value !== null && "confirm" in value) {
    return String((value as { confirm?: unknown }).confirm ?? "");
  }

  return new URL(request.url).searchParams.get("confirm") ?? "";
}

async function readFileText(form: FormData) {
  const file = form.get("file");
  if (!file || typeof file === "string" || typeof (file as { text?: unknown }).text !== "function") {
    return undefined;
  }

  const size = typeof (file as { size?: unknown }).size === "number" ? (file as { size: number }).size : undefined;
  if (size !== undefined && size > maxWorkspaceImportBytes) {
    throw new Error("too_large");
  }

  const text = await (file as { text: () => Promise<string> }).text();
  if (text.length > maxWorkspaceImportBytes) {
    throw new Error("too_large");
  }

  return text;
}

export async function POST(request: Request) {
  const unsafe = rejectUnsafeLocalMutation(request);
  if (unsafe) return unsafe;

  const contentType = request.headers.get("content-type") ?? "";
  let confirm = "";
  let stateValue: unknown;

  try {
    if (contentType.includes("application/json")) {
      const raw = await request.text();
      if (raw.length > maxWorkspaceImportBytes) {
        const body = sanitizedFailure("dangerous_content");
        return NextResponse.json(body, { status: 400 });
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const body = sanitizedFailure("malformed_json");
        return NextResponse.json(body, { status: 400 });
      }

      confirm = confirmationFromJson(parsed, request);
      stateValue = stateValueFromJson(parsed);
    } else {
      const form = await request.formData();
      confirm = String(form.get("confirm") ?? "");
      const fileText = await readFileText(form);
      if (!fileText) {
        const body = sanitizedFailure("invalid_shape");
        if (wantsJson(request)) return NextResponse.json(body, { status: 400 });
        return NextResponse.redirect(new URL("/settings?section=local-data&import=failed&reason=invalid_shape", request.url), 303);
      }

      try {
        stateValue = JSON.parse(fileText);
      } catch {
        const body = sanitizedFailure("malformed_json");
        if (wantsJson(request)) return NextResponse.json(body, { status: 400 });
        return NextResponse.redirect(new URL("/settings?section=local-data&import=failed&reason=malformed_json", request.url), 303);
      }
    }
  } catch {
    const body = sanitizedFailure("dangerous_content");
    if (wantsJson(request)) return NextResponse.json(body, { status: 400 });
    return NextResponse.redirect(new URL("/settings?section=local-data&import=failed&reason=dangerous_content", request.url), 303);
  }

  if (confirm !== workspaceImportConfirmation) {
    const body = {
      imported: false,
      code: "confirmation_required",
      error: `Confirmation required. Submit confirm="${workspaceImportConfirmation}".`
    };
    if (wantsJson(request) || contentType.includes("application/json")) {
      return NextResponse.json(body, { status: 400 });
    }
    return NextResponse.redirect(new URL("/settings?section=local-data&import=confirm_required", request.url), 303);
  }

  const validation = validateWorkspaceImport(stateValue);
  if (!validation.ok) {
    const body = sanitizedFailure(validation.code);
    if (wantsJson(request) || contentType.includes("application/json")) {
      return NextResponse.json(body, { status: 400 });
    }
    return NextResponse.redirect(new URL(`/settings?section=local-data&import=failed&reason=${validation.code}`, request.url), 303);
  }

  const state = await updateState(() => withWorkspaceImportJob(validation.state));
  const latestImport = state.importJobs[0];
  if (wantsJson(request) || contentType.includes("application/json")) {
    return NextResponse.json({
      imported: true,
      schemaVersion: state.schemaVersion,
      applications: state.applications.length,
      importJob: latestImport
    });
  }

  return NextResponse.redirect(new URL("/settings?section=local-data&import=success", request.url), 303);
}
