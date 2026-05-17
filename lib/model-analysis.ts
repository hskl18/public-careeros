import { performance } from "perf_hooks";
import { boundedAgentText, modelPromptConstraints, strictJsonPromptPrefix } from "./agent-constraints";
import { checkOllamaStatus, ollamaApiUrl, ollamaHeaders, type ModelRuntimeOptions, type ModelStatusReport } from "./model-status";
import type { ApplicationStage, LocalImportRecord } from "./types";

export interface ModelImportSuggestion {
  confidence: number;
  summary: string;
  reason: string;
  stage?: ApplicationStage;
  deadlineAt?: string;
  followUpAt?: string;
  contactName?: string;
}

export interface ModelImportAnalysis {
  statusReport: ModelStatusReport;
  suggestion?: ModelImportSuggestion;
  diagnostic: string;
  latencyMs?: number;
}

interface OllamaGenerateResponse {
  response?: string;
}

const allowedStages: ReadonlySet<ApplicationStage> = new Set([
  "wishlist",
  "applied",
  "recruiter_reply",
  "assessment",
  "interview",
  "offer",
  "rejected"
]);

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function optionalString(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "string" ? boundedAgentText(value, maxLength) : undefined;
}

function extractJsonObject(text: string | undefined) {
  if (!text) return undefined;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function validateModelImportSuggestion(value: unknown): ModelImportSuggestion | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const confidence = record.confidence;
  const summary = optionalString(record.summary, 180);
  const reason = optionalString(record.reason, 180);
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1 || !summary || !reason) {
    return undefined;
  }

  const stage = optionalString(record.stage, 32);
  if (stage && !allowedStages.has(stage as ApplicationStage)) {
    return undefined;
  }

  const deadlineAt = record.deadlineAt === undefined || record.deadlineAt === null ? undefined : record.deadlineAt;
  const followUpAt = record.followUpAt === undefined || record.followUpAt === null ? undefined : record.followUpAt;
  if (deadlineAt !== undefined && !isIsoDate(deadlineAt)) return undefined;
  if (followUpAt !== undefined && !isIsoDate(followUpAt)) return undefined;

  return {
    confidence: Number(confidence.toFixed(2)),
    summary,
    reason,
    stage: stage as ApplicationStage | undefined,
    deadlineAt,
    followUpAt,
    contactName: optionalString(record.contactName, 80)
  };
}

export async function analyzeImportRecordWithModel(
  record: LocalImportRecord,
  statusReport?: ModelStatusReport,
  options: ModelRuntimeOptions = {},
  feedbackHints: string[] = []
): Promise<ModelImportAnalysis> {
  const report = statusReport ?? (await checkOllamaStatus(options));
  if (report.status !== "ready") {
    return {
      statusReport: report,
      diagnostic: `Model analysis skipped because provider status is ${report.status}.`
    };
  }

  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? modelPromptConstraints.timeoutMs.workflow;
  const started = performance.now();
  try {
    const response = await fetchFn(ollamaApiUrl(report.endpoint, "/generate"), {
      method: "POST",
      headers: ollamaHeaders(report.endpoint, options.apiKey ?? process.env.OLLAMA_API_KEY ?? process.env.CAREEROS_OLLAMA_API_KEY, true),
      body: JSON.stringify({
        model: report.modelTag,
        stream: false,
        prompt: [
          strictJsonPromptPrefix(
            "workflow extraction agent",
            "{confidence,summary,reason,stage,deadlineAt,followUpAt,contactName}"
          ),
          "Dates must be ISO strings or null.",
          `Company: ${boundedAgentText(record.company, modelPromptConstraints.workflowCompanyLimit)}`,
          `Role: ${boundedAgentText(record.role, modelPromptConstraints.workflowRoleLimit)}`,
          `Source: ${boundedAgentText(record.sourceLabel, modelPromptConstraints.workflowSourceLimit)}`,
          `Snippet: ${boundedAgentText(record.text, modelPromptConstraints.workflowSnippetLimit)}`,
          feedbackHints.length
            ? `Local correction memory:\n${feedbackHints.map((hint) => `- ${boundedAgentText(hint, 180)}`).join("\n")}`
            : "Local correction memory: none"
        ].join("\n"),
        options: {
          temperature: 0,
          num_predict: modelPromptConstraints.workflowMaxTokens
        }
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) {
      return {
        statusReport: report,
        diagnostic: `Model analysis returned HTTP ${response.status}.`,
        latencyMs
      };
    }

    const body = (await response.json()) as OllamaGenerateResponse;
    const suggestion = validateModelImportSuggestion(extractJsonObject(body.response));
    if (!suggestion) {
      return {
        statusReport: report,
        diagnostic: "Invalid model output rejected by schema validation.",
        latencyMs
      };
    }

    return {
      statusReport: report,
      suggestion,
      diagnostic: "Model output accepted by schema validation and queued for review.",
      latencyMs
    };
  } catch {
    return {
      statusReport: { ...report, status: "health_check_failed", diagnostic: "Model analysis request failed or timed out." },
      diagnostic: "Model analysis request failed or timed out."
    };
  }
}
