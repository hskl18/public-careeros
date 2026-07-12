import { describe, expect, it } from "vitest";
import fixtures from "@/eval/pipeline-fixtures.json";
import results from "@/eval/results.json";

describe("versioned deterministic evaluation artifact", () => {
  it("contains at least 100 unique sanitized synthetic cases", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(100);
    expect(new Set(fixtures.map((fixture) => fixture.id)).size).toBe(fixtures.length);
    expect(
      fixtures.every(
        (fixture) =>
          fixture.dataset === "sanitized_synthetic_recruiting_v1" &&
          fixture.record.sourceLabel.startsWith("eval:v1:"),
      ),
    ).toBe(true);
  });

  it("covers the ten documented workflow categories", () => {
    expect(new Set(fixtures.map((fixture) => fixture.category))).toEqual(
      new Set([
        "application_receipt",
        "recruiter_reply",
        "assessment",
        "interview",
        "offer",
        "rejection",
        "ambiguous_update",
        "suspicious_job",
        "adversarial_content",
        "non_recruiting_noise",
      ]),
    );
  });

  it("keeps deterministic and live-model results separate", () => {
    expect(results.runMode).toBe("deterministic_fixture");
    expect(results.liveModelResults).toBeNull();
    expect(results.operational.providerCalls).toBe(0);
    expect(results.operational.observedCostUsd).toBe(0);
    expect(results.qualityGate.passed).toBe(true);
    expect(results.errorAnalysis.observedFailures.length).toBeGreaterThan(0);
  });
});
