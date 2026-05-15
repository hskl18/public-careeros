import { NextResponse } from "next/server";
import { rejectUnsafeLocalMutation } from "@/lib/api-security";
import { processLocalImportWithModel } from "@/lib/pipeline";
import { updateState } from "@/lib/store";
import type { LocalImportRecord } from "@/lib/types";

const maxImportBodyBytes = 250_000;
const maxImportRecords = 20;
const maxImportTextChars = 4_000;
const maxImportFieldChars = 400;
const maxSourceLabelChars = 160;
const maxSourceMessageIds = 20;

function contentLengthTooLarge(request: Request) {
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > maxImportBodyBytes;
}

function isBoundedString(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function isOptionalBoundedString(value: unknown, max: number) {
  return value === undefined || (typeof value === "string" && value.length <= max);
}

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
    isBoundedString(record.company, maxImportFieldChars) &&
    isBoundedString(record.role, maxImportFieldChars) &&
    isBoundedString(record.sourceLabel, maxSourceLabelChars) &&
    isBoundedString(record.text, maxImportTextChars) &&
    optionalStringFields.every((field) => isOptionalBoundedString(record[field], maxImportFieldChars)) &&
    (record.sourceMessageIds === undefined ||
      (Array.isArray(record.sourceMessageIds) &&
        record.sourceMessageIds.length <= maxSourceMessageIds &&
        record.sourceMessageIds.every((item) => isBoundedString(item, maxImportFieldChars))))
  );
}

function formString(form: FormData, key: keyof LocalImportRecord) {
  const value = form.get(key);
  return typeof value === "string" ? value : undefined;
}

function formStringFromParams(params: URLSearchParams, key: keyof LocalImportRecord) {
  return params.get(key) ?? undefined;
}

function trimRecord(record: LocalImportRecord): LocalImportRecord {
  return {
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
  };
}

export async function POST(request: Request) {
  const unsafe = rejectUnsafeLocalMutation(request);
  if (unsafe) return unsafe;
  if (contentLengthTooLarge(request)) {
    return NextResponse.json({ error: "Import body is too large." }, { status: 413 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let records: LocalImportRecord[] = [];

  if (contentType.includes("application/json")) {
    const raw = await request.text();
    if (raw.length > maxImportBodyBytes) {
      return NextResponse.json({ error: "Import body is too large." }, { status: 413 });
    }

    let body: { records?: unknown };
    try {
      body = JSON.parse(raw) as { records?: unknown };
    } catch {
      return NextResponse.json({ error: "Import JSON is malformed." }, { status: 400 });
    }

    if (Array.isArray(body.records) && body.records.length <= maxImportRecords && body.records.every(isImportRecord)) {
      records = body.records.map(trimRecord);
    }
  } else if (contentType.includes("application/x-www-form-urlencoded") || !contentType) {
    const raw = await request.text();
    if (raw.length > maxImportBodyBytes) {
      return NextResponse.json({ error: "Import body is too large." }, { status: 413 });
    }

    const params = new URLSearchParams(raw);
    const record = {
      company: String(params.get("company") ?? ""),
      role: String(params.get("role") ?? ""),
      sourceLabel: String(params.get("sourceLabel") ?? "manual-import"),
      text: String(params.get("text") ?? ""),
      applicationId: formStringFromParams(params, "applicationId"),
      receivedAt: formStringFromParams(params, "receivedAt"),
      jobDescriptionUrl: formStringFromParams(params, "jobDescriptionUrl"),
      resumeVersion: formStringFromParams(params, "resumeVersion"),
      coverLetterVersion: formStringFromParams(params, "coverLetterVersion"),
      applicationSource: formStringFromParams(params, "applicationSource"),
      recruiterContactName: formStringFromParams(params, "recruiterContactName"),
      recruiterContactEmail: formStringFromParams(params, "recruiterContactEmail"),
      location: formStringFromParams(params, "location"),
      salaryRange: formStringFromParams(params, "salaryRange"),
      notes: formStringFromParams(params, "notes")
    };
    if (isImportRecord(record)) {
      records = [trimRecord(record)];
    }
  } else {
    const form = await request.formData();
    const record = {
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
    };
    if (isImportRecord(record)) {
      records = [trimRecord(record)];
    }
  }

  const cleanRecords = records.filter((record) => record.company && record.role && record.sourceLabel && record.text);

  if (!cleanRecords.length) {
    return NextResponse.json({ error: "No valid import records supplied." }, { status: 400 });
  }

  const state = await updateState((current) => processLocalImportWithModel(current, cleanRecords));
  if (contentType.includes("application/json")) {
    return NextResponse.json({ importJobs: state.importJobs.slice(0, 1), reviewItems: state.reviewItems });
  }

  return NextResponse.redirect(new URL("/applications", request.url), 303);
}
