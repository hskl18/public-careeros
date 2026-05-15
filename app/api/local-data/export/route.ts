import { NextResponse } from "next/server";
import { readState } from "@/lib/store";
import type { CareerOSState } from "@/lib/types";

function exportableState(state: CareerOSState): CareerOSState {
  return {
    schemaVersion: state.schemaVersion,
    workspaceUser: state.workspaceUser,
    mailboxThreads: state.mailboxThreads,
    candidateContext: state.candidateContext,
    agentRuns: state.agentRuns,
    applications: state.applications,
    events: state.events,
    evidenceSnippets: state.evidenceSnippets,
    reviewItems: state.reviewItems,
    reminders: state.reminders,
    notifications: state.notifications,
    resumeDocuments: state.resumeDocuments,
    resumeEvaluations: state.resumeEvaluations,
    modelRuntime: state.modelRuntime,
    modelTraces: state.modelTraces,
    importJobs: state.importJobs,
    connectorAccounts: state.connectorAccounts.map((account) => ({
      id: account.id,
      provider: account.provider,
      label: account.label,
      status: account.status,
      message: account.message,
      updatedAt: account.updatedAt
    })),
    auditEvents: state.auditEvents
  };
}

export async function GET() {
  const state = exportableState(await readState());
  return new NextResponse(`${JSON.stringify(state, null, 2)}\n`, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": "attachment; filename=\"careeros-local-state.json\"",
      "cache-control": "no-store"
    }
  });
}
