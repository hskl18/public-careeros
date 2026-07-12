import { execFile } from "node:child_process";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { promisify } from "node:util";
import fixtures from "../eval/pipeline-fixtures.json";
import { processLocalImport } from "../lib/pipeline";
import { createEmptyState } from "../lib/seed";
import type { ApplicationStage, LocalImportRecord } from "../lib/types";

type ExpectedAction = "apply" | "review" | "ignore";

type EvalFixture = {
  id: string;
  dataset: string;
  category: string;
  record: LocalImportRecord;
  expected: {
    action: ExpectedAction;
    stage?: ApplicationStage;
  };
};

type EvalCaseResult = {
  id: string;
  dataset: string;
  category: string;
  expectedAction: ExpectedAction;
  actualAction: ExpectedAction;
  expectedStage?: ApplicationStage;
  actualStage?: ApplicationStage;
  actionPass: boolean;
  stagePass: boolean;
  reviewGatePass: boolean;
  mutationSafetyPass: boolean;
  passed: boolean;
  latencyMs: number;
  notes: string[];
};

const repoRoot = process.cwd();
const evalDir = path.join(repoRoot, "eval");
const mediaDir = path.join(repoRoot, "docs", "media");
const execFileAsync = promisify(execFile);

function percent(value: number) {
  return Number((value * 100).toFixed(1));
}

function rounded(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

function wilson95(successes: number, total: number) {
  if (total === 0) return { lower: 0, upper: 0 };
  const z = 1.96;
  const rate = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (rate + (z * z) / (2 * total)) / denominator;
  const margin =
    (z * Math.sqrt((rate * (1 - rate)) / total + (z * z) / (4 * total * total))) /
    denominator;
  return {
    lower: percent(Math.max(0, center - margin)),
    upper: percent(Math.min(1, center + margin)),
  };
}

function percentile(values: number[], quantile: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
  return rounded(sorted[index]);
}

function perClassMetrics<T extends string>(labels: readonly T[], expected: T[], actual: T[]) {
  return labels.map((label) => {
    const truePositive = expected.filter((value, index) => value === label && actual[index] === label).length;
    const falsePositive = expected.filter((value, index) => value !== label && actual[index] === label).length;
    const falseNegative = expected.filter((value, index) => value === label && actual[index] !== label).length;
    const support = expected.filter((value) => value === label).length;
    const precision = truePositive + falsePositive === 0 ? 0 : truePositive / (truePositive + falsePositive);
    const recall = truePositive + falseNegative === 0 ? 0 : truePositive / (truePositive + falseNegative);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return {
      label,
      support,
      truePositive,
      falsePositive,
      falseNegative,
      precision: percent(precision),
      recall: percent(recall),
      f1: percent(f1),
      recall95Ci: wilson95(truePositive, support),
    };
  });
}

function classifyAction(result: {
  applicationStage?: ApplicationStage;
  reviewStage?: ApplicationStage;
  hasReview: boolean;
  hasApplication: boolean;
}): ExpectedAction {
  if (result.hasReview) return "review";
  if (result.hasApplication) return "apply";
  return "ignore";
}

function evaluateFixture(fixture: EvalFixture): EvalCaseResult {
  const started = performance.now();
  const state = processLocalImport(createEmptyState(), [fixture.record]);
  const review = state.reviewItems.find((item) => item.sourceLabel === fixture.record.sourceLabel);
  const application = state.applications.find(
    (item) =>
      item.company.toLowerCase() === fixture.record.company.toLowerCase() &&
      item.role.toLowerCase() === fixture.record.role.toLowerCase()
  );
  const evidence = state.evidenceSnippets.find((item) => item.sourceLabel === fixture.record.sourceLabel);
  const event = state.events.find((item) => item.summary.includes(fixture.record.sourceLabel));

  const actualAction = classifyAction({
    applicationStage: application?.stage,
    reviewStage: review?.proposedChange.stage,
    hasReview: Boolean(review),
    hasApplication: Boolean(application)
  });
  const actualStage = review?.proposedChange.stage ?? application?.stage;
  const actionPass = actualAction === fixture.expected.action;
  const stagePass = fixture.expected.stage ? actualStage === fixture.expected.stage : true;
  const reviewGatePass =
    fixture.expected.action === "review" ? Boolean(review && review.status === "open") : !review;
  const mutationSafetyPass =
    fixture.expected.action === "review"
      ? !application || application.source !== "import"
      : fixture.expected.action === "ignore"
        ? !application && !review && !evidence && !event
        : actualAction === "apply"
          ? Boolean(application)
          : true;
  const notes: string[] = [];

  if (!actionPass) notes.push(`action expected ${fixture.expected.action}, got ${actualAction}`);
  if (!stagePass) notes.push(`stage expected ${fixture.expected.stage}, got ${actualStage ?? "none"}`);
  if (!reviewGatePass) notes.push("review gate expectation failed");
  if (!mutationSafetyPass) notes.push("mutation safety expectation failed");

  return {
    id: fixture.id,
    dataset: fixture.dataset,
    category: fixture.category,
    expectedAction: fixture.expected.action,
    actualAction,
    expectedStage: fixture.expected.stage,
    actualStage,
    actionPass,
    stagePass,
    reviewGatePass,
    mutationSafetyPass,
    passed: actionPass && stagePass && reviewGatePass && mutationSafetyPass,
    latencyMs: rounded(performance.now() - started),
    notes
  };
}

function aggregate(results: EvalCaseResult[]) {
  const byDataset = Array.from(new Set(results.map((item) => item.dataset))).map((dataset) => {
    const subset = results.filter((item) => item.dataset === dataset);
    return {
      dataset,
      cases: subset.length,
      passed: subset.filter((item) => item.passed).length,
      passRate: percent(subset.filter((item) => item.passed).length / subset.length)
    };
  });
  const actionPass = results.filter((item) => item.actionPass).length;
  const byCategory = Array.from(new Set(results.map((item) => item.category))).map((category) => {
    const subset = results.filter((item) => item.category === category);
    const categoryPassed = subset.filter((item) => item.passed).length;
    return {
      category,
      cases: subset.length,
      passed: categoryPassed,
      passRate: percent(categoryPassed / subset.length),
    };
  });
  const stageScoped = results.filter((item) => item.expectedStage);
  const stagePass = stageScoped.filter((item) => item.stagePass).length;
  const reviewPass = results.filter((item) => item.reviewGatePass).length;
  const safetyPass = results.filter((item) => item.mutationSafetyPass).length;
  const passed = results.filter((item) => item.passed).length;
  const actionLabels = ["apply", "review", "ignore"] as const;
  const expectedActions = results.map((item) => item.expectedAction);
  const actualActions = results.map((item) => item.actualAction);
  const stageLabels = ["applied", "recruiter_reply", "assessment", "interview", "offer", "rejected"] as const;
  const stageResults = results.filter((item) => item.expectedStage);
  const expectedStages = stageResults.map((item) => item.expectedStage!);
  const actualStages = stageResults.map((item) => item.actualStage ?? "unknown");
  const reviewExpected = results.filter((item) => item.expectedAction === "review");
  const unsafeAutomaticMutations = reviewExpected.filter((item) => item.actualAction === "apply").length;
  const latencies = results.map((item) => item.latencyMs);

  return {
    generatedAt: new Date().toISOString(),
    totalCases: results.length,
    passed,
    passRate: percent(passed / results.length),
    passRate95Ci: wilson95(passed, results.length),
    metrics: [
      { label: "Overall", value: percent(passed / results.length), numerator: passed, denominator: results.length },
      { label: "Action", value: percent(actionPass / results.length), numerator: actionPass, denominator: results.length },
      {
        label: "Stage",
        value: percent(stagePass / stageScoped.length),
        numerator: stagePass,
        denominator: stageScoped.length
      },
      { label: "Review gate", value: percent(reviewPass / results.length), numerator: reviewPass, denominator: results.length },
      { label: "Mutation safety", value: percent(safetyPass / results.length), numerator: safetyPass, denominator: results.length }
    ],
    perClass: {
      action: perClassMetrics(actionLabels, expectedActions, actualActions),
      stage: perClassMetrics(
        stageLabels,
        expectedStages,
        actualStages as (typeof stageLabels)[number][],
      ),
    },
    operational: {
      reviewRoutingRate: percent(results.filter((item) => item.actualAction === "review").length / results.length),
      unsafeAutomaticMutationRate: percent(unsafeAutomaticMutations / reviewExpected.length),
      abstentionRate: percent(results.filter((item) => item.actualAction === "ignore").length / results.length),
      latencyMs: {
        mean: rounded(latencies.reduce((sum, value) => sum + value, 0) / latencies.length),
        p50: percentile(latencies, 0.5),
        p95: percentile(latencies, 0.95),
      },
      providerCalls: 0,
      observedCostUsd: 0,
    },
    byDataset,
    byCategory,
  };
}

async function main() {
  const typedFixtures = fixtures as EvalFixture[];
  const results = typedFixtures.map(evaluateFixture);
  const summary = aggregate(results);
  const qualityGate = {
    minimumOverallPassRate: 90,
    maximumUnsafeAutomaticMutationRate: 0,
    passed:
      summary.passRate >= 90 &&
      summary.operational.unsafeAutomaticMutationRate === 0,
  };
  const output = {
    schemaVersion: "1.0",
    fixtureVersion: "sanitized-synthetic-v1",
    runMode: "deterministic_fixture",
    liveModelResults: null,
    ...summary,
    qualityGate,
    publicDatasetComponents: [
      {
        name: "Enron Email Dataset",
        url: "https://www.kaggle.com/datasets/wcukierski/enron-email-dataset",
        use: "mailbox parsing, noisy non-recruiting email, thread-style evidence"
      },
      {
        name: "SpamAssassin Email Classification",
        url: "https://www.kaggle.com/datasets/ganiyuolalekan/spam-assassin-email-classification-dataset",
        use: "spam/noise filtering before workflow extraction"
      },
      {
        name: "LinkedIn Job Postings 2023-2024",
        url: "https://www.kaggle.com/datasets/arshkon/linkedin-job-postings/data",
        use: "company, role, JD link, source, salary, location, and skills fields"
      },
      {
        name: "Resume dataset",
        url: "https://www.kaggle.com/datasets/haidermaseeh/resume-dataset",
        use: "resume/context agent component validation"
      },
      {
        name: "Fake vs Real Job Postings",
        url: "https://www.kaggle.com/datasets/khushikyad001/fake-vs-real-job-postings-synthetic-nlp-dataset",
        use: "suspicious job evidence routed to review instead of trusted mutation"
      }
    ],
    errorAnalysis: {
      observedFailures: results
        .filter((item) => !item.passed)
        .map((item) => ({ id: item.id, category: item.category, notes: item.notes })),
      interpretation:
        "Failures remain in the artifact for error analysis. This deterministic regression run does not estimate live-model or open-domain accuracy.",
    },
    cases: results
  };

  await mkdir(evalDir, { recursive: true });
  await mkdir(mediaDir, { recursive: true });
  await writeFile(path.join(evalDir, "results.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
  await execFileAsync("python3", [
    path.join(repoRoot, "tools", "render_eval_graph.py"),
    path.join(evalDir, "results.json"),
    path.join(mediaDir, "eval-results.png")
  ]);

  const failures = results.filter((item) => !item.passed);
  console.log(
    JSON.stringify(
      {
        passRate: summary.passRate,
        passed: summary.passed,
        total: summary.totalCases,
        unsafeAutomaticMutationRate:
          summary.operational.unsafeAutomaticMutationRate,
        qualityGate,
        failures,
      },
      null,
      2,
    ),
  );
  if (!qualityGate.passed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
