import { performance } from "perf_hooks";
import { isAllowedOllamaModelEndpoint, isOllamaCloudEndpoint } from "./api-security";
import { stableId, nowIso } from "./id";
import type { ModelProviderStatus, ModelRuntimeSettings, ModelTrace } from "./types";

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
  settings?: ModelRuntimeSettings;
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

function resolveRuntimeOptions(options: ModelRuntimeOptions = {}) {
  return {
    enabled: options.enabled ?? options.settings?.enabled ?? process.env.CAREEROS_OLLAMA_ENABLED === "true",
    endpoint: options.endpoint ?? options.settings?.endpoint ?? process.env.CAREEROS_OLLAMA_BASE_URL ?? "https://ollama.com",
    modelTag: options.modelTag ?? options.settings?.modelTag ?? process.env.CAREEROS_GEMMA_MODEL ?? "gemma4:e4b",
    apiKey: options.apiKey ?? process.env.OLLAMA_API_KEY ?? process.env.CAREEROS_OLLAMA_API_KEY,
    fetchFn: options.fetchFn ?? fetch,
    timeoutMs: options.timeoutMs ?? 45_000
  };
}

export function modelRuntimeOptions(settings: ModelRuntimeSettings): Pick<ModelRuntimeOptions, "enabled" | "endpoint" | "modelTag"> {
  return {
    enabled: settings.enabled,
    endpoint: settings.endpoint,
    modelTag: settings.modelTag
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

export function ollamaApiUrl(endpoint: string, path: `/${string}`) {
  const normalized = endpoint.replace(/\/$/, "");
  const base = normalized.endsWith("/api") ? normalized : `${normalized}/api`;
  return `${base}${path}`;
}

export function ollamaHeaders(endpoint: string, apiKey?: string, json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["content-type"] = "application/json";
  if (isOllamaCloudEndpoint(endpoint) && apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

export async function checkOllamaStatus(options: ModelRuntimeOptions = {}): Promise<ModelStatusReport> {
  const { enabled, endpoint, modelTag, apiKey, fetchFn, timeoutMs } = resolveRuntimeOptions(options);

  if (!enabled) {
    return {
      status: "disabled",
      endpoint,
      modelTag,
      installedModels: [],
      diagnostic:
        "Ollama Cloud is disabled. Deterministic processing remains available. Next step: keep this disabled for first run, or add OLLAMA_API_KEY and enable model checks in Settings."
    };
  }

  if (!isAllowedOllamaModelEndpoint(endpoint)) {
    return {
      status: "health_check_failed",
      endpoint,
      modelTag,
      installedModels: [],
      diagnostic:
        "Model endpoint is blocked. CareerOS only connects to Ollama Cloud at https://ollama.com."
    };
  }

  if (isOllamaCloudEndpoint(endpoint) && !apiKey) {
    return {
      status: "health_check_failed",
      endpoint,
      modelTag,
      installedModels: [],
      diagnostic:
        "Ollama Cloud requires OLLAMA_API_KEY. Add it to .env.local, keep the endpoint as https://ollama.com, then retry Save and check."
    };
  }

  const started = performance.now();
  try {
    const response = await fetchFn(ollamaApiUrl(endpoint, "/tags"), {
      headers: ollamaHeaders(endpoint, apiKey),
      signal: timeoutSignal(timeoutMs)
    });
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) {
      return {
        status: "health_check_failed",
        endpoint,
        modelTag,
        installedModels: [],
        diagnostic: `Ollama tags endpoint returned HTTP ${response.status}. Next step: verify OLLAMA_API_KEY, the endpoint, or save Settings with model checks disabled.`,
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
        diagnostic: `Ollama is reachable but ${modelTag} is not listed for this endpoint/account. Next step: choose an available Ollama Cloud model tag in Settings.`,
        latencyMs
      };
    }

    let healthResponse: Response;
    try {
      healthResponse = await fetchFn(ollamaApiUrl(endpoint, "/generate"), {
        method: "POST",
        headers: ollamaHeaders(endpoint, apiKey, true),
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
    } catch {
      return {
        status: "health_check_failed",
        endpoint,
        modelTag,
        installedModels,
        diagnostic: `Ollama is reachable and ${modelTag} is available, but the bounded health prompt did not finish within ${Math.round(timeoutMs / 1000)}s. Next step: try a smaller model tag or retry Save and check.`,
        latencyMs: Math.round(performance.now() - started)
      };
    }
    const totalLatencyMs = Math.round(performance.now() - started);
    if (!healthResponse.ok) {
      return {
        status: "health_check_failed",
        endpoint,
        modelTag,
        installedModels,
        diagnostic: `Ollama health prompt returned HTTP ${healthResponse.status}. Next step: verify ${modelTag} is available to this Ollama Cloud account, or save Settings with model checks disabled.`,
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
        ? "Ollama Cloud is reachable, the configured model is available, and the bounded health prompt passed. Next step: model-backed import analysis can run, but output still goes to review first."
        : "Ollama responded, but the bounded health prompt did not return the expected JSON. Next step: verify the selected model and retry, or use deterministic mode.",
      latencyMs: totalLatencyMs
    };
  } catch {
    return {
      status: "unavailable",
      endpoint,
      modelTag,
      installedModels: [],
      diagnostic: `Ollama is not reachable at ${endpoint}. Next step: verify network/API key, or leave model checks disabled for deterministic mode.`
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
