import { NextResponse } from "next/server";
import { checkOllamaStatus, modelStatusTrace } from "@/lib/model-status";
import { updateState } from "@/lib/store";

export async function GET() {
  return NextResponse.json(await checkOllamaStatus());
}

export async function POST(request: Request) {
  const report = await checkOllamaStatus();
  await updateState((state) => ({
    ...state,
    modelTraces: [modelStatusTrace(report), ...state.modelTraces]
  }));
  return NextResponse.redirect(new URL("/settings", request.url), 303);
}
