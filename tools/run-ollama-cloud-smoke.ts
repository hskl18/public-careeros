import { existsSync, readFileSync } from "fs";
import { checkOllamaStatus } from "@/lib/model-status";

function loadLocalEnv() {
  if (!existsSync(".env.local")) return;
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!key || process.env[key] !== undefined) continue;
    const value = rest.join("=").replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

async function main() {
  loadLocalEnv();
  if (!process.env.OLLAMA_API_KEY) {
    console.log(
      JSON.stringify(
        {
          status: "skipped_no_key",
          endpoint: process.env.CAREEROS_OLLAMA_BASE_URL ?? "https://ollama.com",
          modelTag: process.env.CAREEROS_GEMMA_MODEL ?? "gemma4:31b",
          diagnostic:
            "OLLAMA_API_KEY is not configured. This is a pass for the public no-key gate; add OLLAMA_API_KEY to .env.local to run the live Ollama Cloud smoke."
        },
        null,
        2
      )
    );
    return;
  }

  const report = await checkOllamaStatus({
    enabled: true,
    endpoint: process.env.CAREEROS_OLLAMA_BASE_URL ?? "https://ollama.com",
    modelTag: process.env.CAREEROS_GEMMA_MODEL ?? "gemma4:31b",
    timeoutMs: 45_000
  });

  const output = {
    status: report.status,
    endpoint: report.endpoint,
    modelTag: report.modelTag,
    latencyMs: report.latencyMs,
    diagnostic: report.diagnostic
  };

  console.log(JSON.stringify(output, null, 2));
  if (report.status !== "ready") {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
