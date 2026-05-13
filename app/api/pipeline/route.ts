import { NextResponse } from "next/server";
import { deriveAgentPipelineSnapshot } from "@/lib/agent-pipeline";
import { checkOllamaStatus, modelRuntimeOptions } from "@/lib/model-status";
import { readState } from "@/lib/store";

export async function GET() {
  const state = await readState();
  const modelStatus = await checkOllamaStatus(modelRuntimeOptions(state.modelRuntime));
  return NextResponse.json(deriveAgentPipelineSnapshot(state, modelStatus));
}
