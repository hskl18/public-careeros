import { NextResponse } from "next/server";
import { isAllowedOllamaModelEndpoint, rejectUnsafeLocalMutation } from "@/lib/api-security";
import { checkOllamaStatus, modelRuntimeOptions, modelStatusTrace } from "@/lib/model-status";
import { readState, updateState } from "@/lib/store";
import { nowIso } from "@/lib/id";

function cleanEndpoint(value: FormDataEntryValue | null) {
  const endpoint = String(value ?? "").trim();
  return endpoint || "https://ollama.com";
}

function cleanModelTag(value: FormDataEntryValue | null) {
  const modelTag = String(value ?? "").trim();
  return modelTag || "gemma4:31b";
}

export async function GET() {
  const state = await readState();
  return NextResponse.json(await checkOllamaStatus(modelRuntimeOptions(state.modelRuntime)));
}

export async function POST(request: Request) {
  const unsafe = rejectUnsafeLocalMutation(request);
  if (unsafe) return unsafe;

  const formData = await request.formData();
  const shouldCheck = formData.get("intent") !== "save";
  const nextRuntime = {
    provider: "ollama" as const,
    enabled: formData.get("enabled") === "on",
    endpoint: cleanEndpoint(formData.get("endpoint")),
    modelTag: cleanModelTag(formData.get("modelTag")),
    updatedAt: nowIso()
  };

  if (nextRuntime.enabled && !isAllowedOllamaModelEndpoint(nextRuntime.endpoint)) {
    return NextResponse.json(
      {
        error:
          "Model endpoint must be Ollama Cloud at https://ollama.com."
      },
      { status: 400 }
    );
  }

  const report = shouldCheck ? await checkOllamaStatus(modelRuntimeOptions(nextRuntime)) : undefined;
  await updateState((state) => ({
    ...state,
    modelRuntime: nextRuntime,
    modelTraces: report ? [modelStatusTrace(report), ...state.modelTraces] : state.modelTraces
  }));
  return NextResponse.redirect(new URL("/settings", request.url), 303);
}
