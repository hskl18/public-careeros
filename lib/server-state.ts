import { cache } from "react";
import { checkOllamaStatus, modelRuntimeOptions } from "@/lib/model-status";
import { readState } from "@/lib/store";

export const readServerState = cache(readState);
export const checkServerOllamaStatus = cache(async () => {
  const state = await readState();
  return checkOllamaStatus(modelRuntimeOptions(state.modelRuntime));
});
