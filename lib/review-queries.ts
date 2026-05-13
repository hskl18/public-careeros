import type { Application, CareerOSState, ReviewItem, ReviewStatus } from "./types";

export type ReviewSort = "newest" | "oldest" | "confidence_high" | "confidence_low";

export interface ReviewQueueFilters {
  status?: ReviewStatus | "all";
  minConfidence?: number;
  maxConfidence?: number;
  source?: string;
  provider?: "model" | "deterministic";
  company?: string;
  applicationId?: string;
  sort?: ReviewSort;
}

export interface ReviewQueueItem {
  review: ReviewItem;
  application?: Pick<Application, "id" | "company" | "role" | "stage">;
  modelBacked: boolean;
  evidenceCount: number;
}

export interface ReviewQueueResult {
  total: number;
  filters: Required<Pick<ReviewQueueFilters, "sort">> & Omit<ReviewQueueFilters, "sort">;
  items: ReviewQueueItem[];
}

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase() || undefined;
}

function numberOrUndefined(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isReviewStatus(value: string | null): value is ReviewStatus | "all" {
  return value === "all" || value === "open" || value === "accepted" || value === "dismissed" || value === "corrected";
}

function isProvider(value: string | null): value is "model" | "deterministic" {
  return value === "model" || value === "deterministic";
}

function isSort(value: string | null): value is ReviewSort {
  return value === "newest" || value === "oldest" || value === "confidence_high" || value === "confidence_low";
}

export function parseReviewQueueFilters(searchParams: URLSearchParams): ReviewQueueFilters {
  const status = searchParams.get("status");
  const provider = searchParams.get("provider") ?? searchParams.get("modelBacked");
  const sort = searchParams.get("sort");
  return {
    status: isReviewStatus(status) ? status : undefined,
    minConfidence: numberOrUndefined(searchParams.get("minConfidence")),
    maxConfidence: numberOrUndefined(searchParams.get("maxConfidence")),
    source: searchParams.get("source") ?? undefined,
    provider: isProvider(provider) ? provider : provider === "true" ? "model" : provider === "false" ? "deterministic" : undefined,
    company: searchParams.get("company") ?? undefined,
    applicationId: searchParams.get("applicationId") ?? undefined,
    sort: isSort(sort) ? sort : undefined
  };
}

function isModelBacked(review: ReviewItem) {
  return review.sourceLabel.startsWith("model:") || /(^|[^a-z])model([^a-z]|$)|ollama|gemma/i.test(review.traceSummary);
}

function sortReviews(left: ReviewQueueItem, right: ReviewQueueItem, sort: ReviewSort) {
  if (sort === "oldest") return left.review.createdAt.localeCompare(right.review.createdAt);
  if (sort === "confidence_high") return right.review.confidence - left.review.confidence || right.review.createdAt.localeCompare(left.review.createdAt);
  if (sort === "confidence_low") return left.review.confidence - right.review.confidence || right.review.createdAt.localeCompare(left.review.createdAt);
  return right.review.createdAt.localeCompare(left.review.createdAt);
}

export function queryReviewQueue(state: CareerOSState, filters: ReviewQueueFilters = {}): ReviewQueueResult {
  const sort = filters.sort ?? "newest";
  const status = filters.status ?? "open";
  const source = normalize(filters.source);
  const company = normalize(filters.company);
  const applicationId = filters.applicationId?.trim();
  const provider = filters.provider;

  const items = state.reviewItems
    .map((review): ReviewQueueItem => {
      const application = state.applications.find((item) => item.id === review.proposedChange.applicationId);
      return {
        review,
        application: application
          ? {
              id: application.id,
              company: application.company,
              role: application.role,
              stage: application.stage
            }
          : undefined,
        modelBacked: isModelBacked(review),
        evidenceCount: review.evidenceSnippetIds.length
      };
    })
    .filter((item) => status === "all" || item.review.status === status)
    .filter((item) => filters.minConfidence === undefined || item.review.confidence >= filters.minConfidence)
    .filter((item) => filters.maxConfidence === undefined || item.review.confidence <= filters.maxConfidence)
    .filter((item) => !source || item.review.sourceLabel.toLowerCase().includes(source))
    .filter((item) => !applicationId || item.review.proposedChange.applicationId === applicationId)
    .filter((item) => !company || item.application?.company.toLowerCase().includes(company) || item.review.proposedChange.company?.toLowerCase().includes(company))
    .filter((item) => !provider || (provider === "model" ? item.modelBacked : !item.modelBacked))
    .sort((left, right) => sortReviews(left, right, sort));

  return {
    total: items.length,
    filters: { ...filters, sort },
    items
  };
}
