import { NextResponse } from "next/server";
import { processLocalImportWithModel } from "@/lib/pipeline";
import { updateState } from "@/lib/store";
import type { LocalImportRecord } from "@/lib/types";

function isImportRecord(value: unknown): value is LocalImportRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "company" in value &&
    "role" in value &&
    "sourceLabel" in value &&
    "text" in value
  );
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let records: LocalImportRecord[] = [];

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { records?: unknown };
    if (Array.isArray(body.records) && body.records.every(isImportRecord)) {
      records = body.records;
    }
  } else {
    const form = await request.formData();
    records = [
      {
        company: String(form.get("company") ?? ""),
        role: String(form.get("role") ?? ""),
        sourceLabel: String(form.get("sourceLabel") ?? "manual-import"),
        text: String(form.get("text") ?? "")
      }
    ];
  }

  const cleanRecords = records
    .map((record) => ({
      company: record.company.trim(),
      role: record.role.trim(),
      sourceLabel: record.sourceLabel.trim(),
      text: record.text.trim(),
      receivedAt: record.receivedAt
    }))
    .filter((record) => record.company && record.role && record.sourceLabel && record.text);

  if (!cleanRecords.length) {
    return NextResponse.json({ error: "No valid import records supplied." }, { status: 400 });
  }

  const state = await updateState((current) => processLocalImportWithModel(current, cleanRecords));
  if (contentType.includes("application/json")) {
    return NextResponse.json({ importJobs: state.importJobs.slice(0, 1), reviewItems: state.reviewItems });
  }

  return NextResponse.redirect(new URL("/applications", request.url), 303);
}
