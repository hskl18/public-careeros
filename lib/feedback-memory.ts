import { nowIso } from "./id";
import type { CandidateContext, LocalImportRecord, ProposedMutation, ReviewItem } from "./types";

const maxFeedbackFacts = 24;
const maxFactLength = 180;

function compact(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxFactLength);
}

function changed(before: string | undefined, after: string | undefined) {
  return Boolean(after && before !== after);
}

export function buildReviewCorrectionFeedback(review: ReviewItem, corrected: ProposedMutation) {
  const before = review.proposedChange;
  const facts: string[] = [];
  const source = review.sourceLabel;

  if (changed(before.company, corrected.company)) {
    facts.push(`Correction memory: ${source} company should be ${corrected.company}, not ${before.company ?? "unknown"}.`);
  }
  if (changed(before.role, corrected.role)) {
    facts.push(`Correction memory: ${source} role should be ${corrected.role}, not ${before.role ?? "unknown"}.`);
  }
  if (changed(before.stage, corrected.stage)) {
    facts.push(`Correction memory: ${source} workflow stage should be ${corrected.stage}, not ${before.stage ?? "unknown"}.`);
  }
  if (changed(before.deadlineAt, corrected.deadlineAt)) {
    facts.push(`Correction memory: ${source} trusted deadline is ${corrected.deadlineAt}.`);
  }
  if (changed(before.followUpAt, corrected.followUpAt)) {
    facts.push(`Correction memory: ${source} trusted follow-up is ${corrected.followUpAt}.`);
  }
  if (changed(before.contactName ?? before.recruiterContactName, corrected.contactName ?? corrected.recruiterContactName)) {
    facts.push(`Correction memory: ${source} trusted recruiter contact is ${corrected.contactName ?? corrected.recruiterContactName}.`);
  }

  return facts.map(compact);
}

export function appendFeedbackFacts(context: CandidateContext, facts: string[]): CandidateContext {
  const cleaned = facts.map(compact).filter(Boolean);
  if (!cleaned.length) return context;

  const merged = [...cleaned, ...(context.feedbackFacts ?? [])];
  const unique: string[] = [];
  for (const fact of merged) {
    if (!unique.some((item) => item.toLowerCase() === fact.toLowerCase())) unique.push(fact);
  }

  return {
    ...context,
    feedbackFacts: unique.slice(0, maxFeedbackFacts),
    updatedAt: nowIso()
  };
}

export function feedbackHintsForRecord(context: CandidateContext, record: LocalImportRecord, limit = 5) {
  const facts = context.feedbackFacts ?? [];
  if (!facts.length) return [];

  const haystack = [record.company, record.role, record.sourceLabel, record.text].join(" ").toLowerCase();
  const scored = facts.map((fact, index) => {
    const normalized = fact.toLowerCase();
    const sourceHit = record.sourceLabel && normalized.includes(record.sourceLabel.toLowerCase());
    const companyHit = record.company && normalized.includes(record.company.toLowerCase());
    const roleHit = record.role && normalized.includes(record.role.toLowerCase());
    const textHit = normalized
      .split(/[^a-z0-9]+/i)
      .filter((word) => word.length > 4)
      .some((word) => haystack.includes(word));
    return {
      fact,
      score: Number(sourceHit) * 4 + Number(companyHit) * 3 + Number(roleHit) * 2 + Number(textHit) - index * 0.01
    };
  });

  return scored
    .filter((item) => item.score > -0.001)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.fact);
}
