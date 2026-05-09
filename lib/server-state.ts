import { cache } from "react";
import { checkOllamaStatus } from "@/lib/model-status";
import { readState } from "@/lib/store";

export const readServerState = cache(readState);
export const checkServerOllamaStatus = cache(checkOllamaStatus);
