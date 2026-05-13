import { NextResponse } from "next/server";
import { parseReviewQueueFilters, queryReviewQueue } from "@/lib/review-queries";
import { readState } from "@/lib/store";

export async function GET(request: Request) {
  const filters = parseReviewQueueFilters(new URL(request.url).searchParams);
  return NextResponse.json(queryReviewQueue(await readState(), filters));
}
