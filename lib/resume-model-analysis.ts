import { performance } from "perf_hooks";
import { boundedAgentText, modelPromptConstraints, strictJsonPromptPrefix } from "./agent-constraints";
import { checkOllamaStatus, ollamaApiUrl, ollamaHeaders, type ModelRuntimeOptions, type ModelStatusReport } from "./model-status";

export interface ModelResumeSuggestion {
  confidence: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  sections: string[];
  reason: string;
  riskLevel: "low" | "medium" | "high";
}

export interface ModelResumeAnalysis {
  statusReport: ModelStatusReport;
  suggestion?: ModelResumeSuggestion;
  diagnostic: string;
  latencyMs?: number;
}

interface OllamaGenerateResponse {
  response?: string;
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

function boundedString(value: unknown, maxLength: number) {
  return typeof value === "string" ? boundedAgentText(value, maxLength) : undefined;
}

function boundedStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => boundedString(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
  return items.length ? items : undefined;
}

export function validateModelResumeSuggestion(value: unknown): ModelResumeSuggestion | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const confidence = record.confidence;
  const summary = boundedString(record.summary, 220);
  const reason = boundedString(record.reason, 180);
  const strengths = boundedStringArray(record.strengths, 6, 120);
  const gaps = boundedStringArray(record.gaps, 6, 120);
  const sections = boundedStringArray(record.sections, 8, 48);
  const riskLevel = record.riskLevel;

  if (
    typeof confidence !== "number" ||
    confidence < 0 ||
    confidence > 1 ||
    !summary ||
    !reason ||
    !strengths ||
    !gaps ||
    !sections ||
    (riskLevel !== "low" && riskLevel !== "medium" && riskLevel !== "high")
  ) {
    return undefined;
  }

  return {
    confidence: Number(confidence.toFixed(2)),
    summary,
    strengths,
    gaps,
    sections,
    reason,
    riskLevel
  };
}

export async function analyzeResumeWithModel(
  title: string,
  text: string,
  statusReport?: ModelStatusReport,
  options: ModelRuntimeOptions = {}
): Promise<ModelResumeAnalysis> {
  const report = statusReport ?? (await checkOllamaStatus(options));
  if (report.status !== "ready") {
    return {
      statusReport: report,
      diagnostic: `Resume model analysis skipped because provider status is ${report.status}.`
    };
  }

  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? modelPromptConstraints.timeoutMs.resume;
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
            "resume/context agent",
            "{confidence,summary,strengths,gaps,sections,reason,riskLevel}"
          ),
          "Arrays must be short. riskLevel is low|medium|high. Do not repeat raw resume.",
          `Title: ${boundedAgentText(title, modelPromptConstraints.resumeTitleLimit)}`,
          `Resume: ${boundedAgentText(text, modelPromptConstraints.resumeTextLimit)}`
        ].join("\n"),
        options: {
          temperature: 0,
          num_predict: modelPromptConstraints.resumeMaxTokens
        }
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) {
      return {
        statusReport: report,
        diagnostic: `Resume model analysis returned HTTP ${response.status}.`,
        latencyMs
      };
    }

    const body = (await response.json()) as OllamaGenerateResponse;
    const suggestion = validateModelResumeSuggestion(extractJsonObject(body.response));
    if (!suggestion) {
      return {
        statusReport: report,
        diagnostic: "Invalid resume model output rejected by schema validation.",
        latencyMs
      };
    }

    return {
      statusReport: report,
      suggestion,
      diagnostic: "Resume model output accepted by schema validation.",
      latencyMs
    };
  } catch {
    return {
      statusReport: {
        ...report,
        status: "health_check_failed",
        diagnostic: "Resume model analysis request failed or timed out."
      },
      diagnostic: "Resume model analysis request failed or timed out."
    };
  }
}
