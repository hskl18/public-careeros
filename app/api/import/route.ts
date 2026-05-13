import { NextResponse } from "next/server";
import { rejectUnsafeLocalMutation } from "@/lib/api-security";
import { processLocalImportWithModel } from "@/lib/pipeline";
import { updateState } from "@/lib/store";
import type { LocalImportRecord } from "@/lib/types";

function isImportRecord(value: unknown): value is LocalImportRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const optionalStringFields = [
    "applicationId",
    "receivedAt",
    "jobDescriptionUrl",
    "resumeVersion",
    "coverLetterVersion",
    "applicationSource",
    "recruiterContactName",
    "recruiterContactEmail",
    "location",
    "salaryRange",
    "notes"
  ];

  return (
    typeof record.company === "string" &&
    typeof record.role === "string" &&
    typeof record.sourceLabel === "string" &&
    typeof record.text === "string" &&
    optionalStringFields.every((field) => record[field] === undefined || typeof record[field] === "string") &&
    (record.sourceMessageIds === undefined ||
      (Array.isArray(record.sourceMessageIds) && record.sourceMessageIds.every((item) => typeof item === "string")))
  );
}

function formString(form: FormData, key: keyof LocalImportRecord) {
  const value = form.get(key);
  return typeof value === "string" ? value : undefined;
}

export async function POST(request: Request) {
  const unsafe = rejectUnsafeLocalMutation(request);
  if (unsafe) return unsafe;

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
        text: String(form.get("text") ?? ""),
        applicationId: formString(form, "applicationId"),
        receivedAt: formString(form, "receivedAt"),
        jobDescriptionUrl: formString(form, "jobDescriptionUrl"),
        resumeVersion: formString(form, "resumeVersion"),
        coverLetterVersion: formString(form, "coverLetterVersion"),
        applicationSource: formString(form, "applicationSource"),
        recruiterContactName: formString(form, "recruiterContactName"),
        recruiterContactEmail: formString(form, "recruiterContactEmail"),
        location: formString(form, "location"),
        salaryRange: formString(form, "salaryRange"),
        notes: formString(form, "notes")
      }
    ];
  }

  const cleanRecords = records
    .map((record) => ({
      company: record.company.trim(),
      role: record.role.trim(),
      sourceLabel: record.sourceLabel.trim(),
      text: record.text.trim(),
      applicationId: record.applicationId?.trim(),
      sourceMessageIds: record.sourceMessageIds,
      receivedAt: record.receivedAt,
      jobDescriptionUrl: record.jobDescriptionUrl?.trim(),
      resumeVersion: record.resumeVersion?.trim(),
      coverLetterVersion: record.coverLetterVersion?.trim(),
      applicationSource: record.applicationSource?.trim(),
      recruiterContactName: record.recruiterContactName?.trim(),
      recruiterContactEmail: record.recruiterContactEmail?.trim(),
      location: record.location?.trim(),
      salaryRange: record.salaryRange?.trim(),
      notes: record.notes?.trim()
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
