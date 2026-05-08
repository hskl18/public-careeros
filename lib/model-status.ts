import { performance } from "perf_hooks";
import { stableId, nowIso } from "./id";
import type { ModelProviderStatus, ModelTrace } from "./types";

export interface ModelStatusReport {
  status: ModelProviderStatus;
  endpoint: string;
  modelTag: string;
  installedModels: string[];
  diagnostic: string;
  latencyMs?: number;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>;
}

interface OllamaGenerateResponse {
  response?: string;
}

export interface ModelRuntimeOptions {
  enabled?: boolean;
  endpoint?: string;
  modelTag?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

function resolveRuntimeOptions(options: ModelRuntimeOptions = {}) {
  return {
    enabled: options.enabled ?? process.env.CAREEROS_OLLAMA_ENABLED === "true",
    endpoint: options.endpoint ?? process.env.CAREEROS_OLLAMA_BASE_URL ?? "http://localhost:11434",
    modelTag: options.modelTag ?? process.env.CAREEROS_GEMMA_MODEL ?? "gemma3:4b",
    fetchFn: options.fetchFn ?? fetch,
    timeoutMs: options.timeoutMs ?? 1800
  };
}

function timeoutSignal(timeoutMs: number) {
  return AbortSignal.timeout(timeoutMs);
}

function parseHealthResponse(value: string | undefined) {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value.trim()) as { ok?: unknown };
    return parsed.ok === true;
  } catch {
    return false;
  }
}

export async function checkOllamaStatus(options: ModelRuntimeOptions = {}): Promise<ModelStatusReport> {
  const { enabled, endpoint, modelTag, fetchFn, timeoutMs } = resolveRuntimeOptions(options);

  if (!enabled) {
    return {
      status: "disabled",
      endpoint,
      modelTag,
      installedModels: [],
      diagnostic: "Ollama is disabled. Deterministic local processing remains available."
    };
  }

  const started = performance.now();
  try {
    const baseUrl = endpoint.replace(/\/$/, "");
    const response = await fetchFn(`${baseUrl}/api/tags`, {
      signal: timeoutSignal(timeoutMs)
    });
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) {
      return {
        status: "health_check_failed",
        endpoint,
        modelTag,
        installedModels: [],
        diagnostic: `Ollama tags endpoint returned HTTP ${response.status}.`,
        latencyMs
      };
    }

    const body = (await response.json()) as OllamaTagsResponse;
    const installedModels = (body.models ?? []).map((model) => model.name ?? model.model).filter(Boolean) as string[];
    const hasModel = installedModels.includes(modelTag);
    if (!hasModel) {
      return {
        status: "model_missing",
        endpoint,
        modelTag,
        installedModels,
        diagnostic: `Ollama is reachable but ${modelTag} is not installed. Run: ollama pull ${modelTag}`,
        latencyMs
      };
    }

    const healthResponse = await fetchFn(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelTag,
        prompt: "Return exactly this JSON and nothing else: {\"ok\":true}",
        stream: false,
        options: {
          temperature: 0,
          num_predict: 20
        }
      }),
      signal: timeoutSignal(timeoutMs)
    });
    const totalLatencyMs = Math.round(performance.now() - started);
    if (!healthResponse.ok) {
      return {
        status: "health_check_failed",
        endpoint,
        modelTag,
        installedModels,
        diagnostic: `Ollama health prompt returned HTTP ${healthResponse.status}.`,
        latencyMs: totalLatencyMs
      };
    }

    const healthBody = (await healthResponse.json()) as OllamaGenerateResponse;
    const healthy = parseHealthResponse(healthBody.response);
    return {
      status: healthy ? "ready" : "health_check_failed",
      endpoint,
      modelTag,
      installedModels,
      diagnostic: healthy
        ? "Ollama is reachable, the configured model is installed, and the bounded health prompt passed."
        : "Ollama responded, but the bounded health prompt did not return the expected JSON.",
      latencyMs: totalLatencyMs
    };
  } catch {
    return {
      status: "unavailable",
      endpoint,
      modelTag,
      installedModels: [],
      diagnostic: `Ollama is not reachable at ${endpoint}. Leave it disabled or start Ollama before enabling model-backed processing.`
    };
  }
}

export function modelStatusTrace(report: ModelStatusReport): ModelTrace {
  return {
    id: stableId("trace", ["ollama-status", report.status, report.modelTag, nowIso()]),
    provider: "ollama",
    modelTag: report.modelTag,
    status: report.status,
    task: "model-provider-status",
    latencyMs: report.latencyMs,
    fallbackPath: report.status === "ready" ? undefined : "deterministic",
    diagnostic: report.diagnostic,
    createdAt: nowIso()
  };
}
