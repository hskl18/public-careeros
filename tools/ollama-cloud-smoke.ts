import { checkOllamaStatus } from "@/lib/model-status";

async function main() {
  const report = await checkOllamaStatus({
    enabled: true,
    endpoint: process.env.CAREEROS_OLLAMA_BASE_URL ?? "https://ollama.com",
    modelTag: process.env.CAREEROS_GEMMA_MODEL ?? "gemma4:e4b",
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
