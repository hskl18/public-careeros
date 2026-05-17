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
  record: LocalImportRecord;
  expected: {
    action: ExpectedAction;
    stage?: ApplicationStage;
  };
};

type EvalCaseResult = {
  id: string;
  dataset: string;
  expectedAction: ExpectedAction;
  actualAction: ExpectedAction;
  expectedStage?: ApplicationStage;
  actualStage?: ApplicationStage;
  actionPass: boolean;
  stagePass: boolean;
  reviewGatePass: boolean;
  mutationSafetyPass: boolean;
  passed: boolean;
  notes: string[];
};

const repoRoot = process.cwd();
const evalDir = path.join(repoRoot, "eval");
const mediaDir = path.join(repoRoot, "docs", "media");
const execFileAsync = promisify(execFile);

function percent(value: number) {
  return Number((value * 100).toFixed(1));
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
        : Boolean(application);
  const notes: string[] = [];

  if (!actionPass) notes.push(`action expected ${fixture.expected.action}, got ${actualAction}`);
  if (!stagePass) notes.push(`stage expected ${fixture.expected.stage}, got ${actualStage ?? "none"}`);
  if (!reviewGatePass) notes.push("review gate expectation failed");
  if (!mutationSafetyPass) notes.push("mutation safety expectation failed");

  return {
    id: fixture.id,
    dataset: fixture.dataset,
    expectedAction: fixture.expected.action,
    actualAction,
    expectedStage: fixture.expected.stage,
    actualStage,
    actionPass,
    stagePass,
    reviewGatePass,
    mutationSafetyPass,
    passed: actionPass && stagePass && reviewGatePass && mutationSafetyPass,
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
  const stageScoped = results.filter((item) => item.expectedStage);
  const stagePass = stageScoped.filter((item) => item.stagePass).length;
  const reviewPass = results.filter((item) => item.reviewGatePass).length;
  const safetyPass = results.filter((item) => item.mutationSafetyPass).length;
  const passed = results.filter((item) => item.passed).length;

  return {
    generatedAt: new Date().toISOString(),
    totalCases: results.length,
    passed,
    passRate: percent(passed / results.length),
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
    byDataset
  };
}

async function main() {
  const typedFixtures = fixtures as EvalFixture[];
  const results = typedFixtures.map(evaluateFixture);
  const summary = aggregate(results);
  const output = {
    ...summary,
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
  console.log(JSON.stringify({ passRate: summary.passRate, passed: summary.passed, total: summary.totalCases, failures }, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
