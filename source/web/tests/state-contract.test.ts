import assert from "node:assert/strict";
import test from "node:test";
import {
  applications,
  notifications,
  reviewItems,
  resumeState,
  stateVariants,
} from "../lib/demo-data";

test("demo applications are routeable and evidence-backed", () => {
  assert.ok(applications.length >= 4);

  for (const application of applications) {
    assert.match(application.id, /^[a-z0-9-]+$/);
    assert.ok(application.company);
    assert.ok(application.role);
    assert.ok(application.stage);
    assert.ok(application.evidence.length > 0);
    assert.ok(application.nextAction);
  }
});

test("required local-first states are represented", () => {
  const requiredStateIds = [
    "seeded",
    "empty",
    "ollama-disabled",
    "ollama-unreachable",
    "model-missing",
    "model-healthy",
    "gmail-unconnected",
    "gmail-attention",
    "review-blocked",
    "resume-uploaded",
    "resume-complete",
  ];
  const ids = new Set(stateVariants.map((state) => state.id));

  for (const stateId of requiredStateIds) {
    assert.ok(ids.has(stateId), `missing state ${stateId}`);
  }
});

test("notifications deep-link to owning surfaces", () => {
  const validPrefixes = ["/applications/", "/review", "/resume", "/settings"];

  for (const notification of notifications) {
    assert.ok(notification.message);
    assert.ok(notification.source);
    assert.ok(notification.destinationLabel);
    assert.ok(
      validPrefixes.some((prefix) => notification.destination.startsWith(prefix)),
      `unexpected destination ${notification.destination}`,
    );
  }
});

test("review queue blocks application mutations explicitly", () => {
  assert.ok(reviewItems.length >= 1);

  for (const item of reviewItems) {
    assert.ok(item.proposedChange);
    assert.ok(item.currentState);
    assert.ok(item.evidenceSnippet);
    assert.ok(item.reviewReason);
    assert.ok(item.fallbackPath);
    assert.ok(applications.some((application) => application.id === item.applicationId));
  }
});

test("resume demo state covers uploaded and analyzed paths", () => {
  assert.equal(resumeState.uploaded, true);
  assert.equal(resumeState.analyzed, true);
  assert.ok(resumeState.sections.length > 0);
  assert.ok(resumeState.corrections.length > 0);
});
