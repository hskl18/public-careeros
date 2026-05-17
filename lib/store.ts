import { deriveNotifications } from "./notifications";
import { withConnectorAccounts } from "./connectors";
import {
  createDefaultStateRepository,
  deleteDefaultLocalDataDir,
  isDefaultLocalDataDir,
  JsonFileStateRepository
} from "./persistence";
import { createEmptyCandidateContext, createEmptyState } from "./seed";
import type { CareerOSState } from "./types";
import type { StateRepository } from "./persistence";

export const currentWorkspaceSchemaVersion = 1;

let writeLock = Promise.resolve();
let repository: StateRepository = createDefaultStateRepository();

export function setStateRepository(nextRepository: StateRepository) {
  repository = nextRepository;
  writeLock = Promise.resolve();
}

function normalizeState(state: CareerOSState): CareerOSState {
  const emptyContext = createEmptyCandidateContext();
  return {
    ...state,
    schemaVersion: state.schemaVersion ?? currentWorkspaceSchemaVersion,
    mailboxThreads: state.mailboxThreads ?? [],
    candidateContext: {
      ...emptyContext,
      ...(state.candidateContext ?? {}),
      feedbackFacts: state.candidateContext?.feedbackFacts ?? []
    },
    agentRuns: state.agentRuns ?? [],
    auditEvents: state.auditEvents ?? [],
    modelRuntime: state.modelRuntime ?? {
      provider: "ollama",
      enabled: process.env.CAREEROS_OLLAMA_ENABLED === "true",
      endpoint: process.env.CAREEROS_OLLAMA_BASE_URL ?? "https://ollama.com",
      modelTag: process.env.CAREEROS_GEMMA_MODEL ?? "gemma4:31b",
      updatedAt: new Date().toISOString()
    },
    evidenceSnippets: (state.evidenceSnippets ?? []).map((snippet) => ({
      ...snippet,
      sourceMessageIds: snippet.sourceMessageIds ?? [],
      sourceRelationships: snippet.sourceRelationships ?? {
        mailboxMessageIds: snippet.sourceMessageIds ?? [],
        applicationId: snippet.applicationId
      },
      reason: snippet.reason ?? "Bounded evidence snippet carried forward from local state."
    }))
  };
}

function isLegacySeedOnlyState(state: CareerOSState) {
  const hasLegacySeedMarker =
    state.importJobs.some((job) => job.id === "job_seed" || job.source === "seed") ||
    state.applications.some((application) => application.id === "app_atlas" || application.id === "app_northstar") ||
    state.mailboxThreads.some((thread) => thread.id === "thread_atlas_oa" || thread.id === "thread_northstar_follow_up");

  if (!hasLegacySeedMarker) return false;

  const hasRealWorkspaceData =
    state.applications.some((application) => application.source !== "seed") ||
    state.events.some((event) => event.source !== "seed") ||
    state.mailboxThreads.some((thread) => thread.source !== "seed") ||
    state.importJobs.some((job) => job.source !== "seed") ||
    state.reviewItems.some((review) => !review.sourceLabel.startsWith("seed:")) ||
    state.evidenceSnippets.some((snippet) => !snippet.sourceLabel.startsWith("seed:")) ||
    state.resumeDocuments.some((document) => document.id !== "resume_seed") ||
    state.resumeEvaluations.some((evaluation) => evaluation.id !== "resume_eval_seed");

  return !hasRealWorkspaceData;
}

function clearLegacySeedState(state: CareerOSState): CareerOSState {
  const empty = createEmptyState();
  return {
    ...empty,
    schemaVersion: state.schemaVersion ?? empty.schemaVersion,
    workspaceUser: state.workspaceUser ?? empty.workspaceUser,
    modelRuntime: state.modelRuntime ?? empty.modelRuntime,
    connectorAccounts: state.connectorAccounts ?? empty.connectorAccounts
  };
}

function withDerivedNotifications(state: CareerOSState): CareerOSState {
  const normalized = normalizeState(state);
  const connectorNormalized = withConnectorAccounts(normalized);
  return {
    ...connectorNormalized,
    notifications: deriveNotifications(connectorNormalized)
  };
}

async function writeState(state: CareerOSState) {
  const nextState = withDerivedNotifications(state);
  return repository.write(nextState);
}

export async function readState(): Promise<CareerOSState> {
  const parsed = await repository.read();
  if (!parsed) {
    return writeState(createEmptyState());
  }

  const normalized = normalizeState(parsed);
  if (repository.kind === "json-file" && isLegacySeedOnlyState(normalized)) {
    return writeState(clearLegacySeedState(normalized));
  }

  return withDerivedNotifications(parsed);
}

export async function resetState(): Promise<CareerOSState> {
  return writeState(createEmptyState());
}

export async function updateState(
  updater: (state: CareerOSState) => CareerOSState | Promise<CareerOSState>
): Promise<CareerOSState> {
  const run = writeLock.then(async () => {
    const current = await readState();
    const next = await updater(current);
    return writeState(next);
  });

  writeLock = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}

export function getDataDir() {
  return repository.location;
}

export function getStateRepositoryKind() {
  return repository.kind;
}

export function canDeleteLocalWorkspaceData() {
  return isDefaultLocalDataDir(repository.dataDir);
}

export async function deleteLocalWorkspaceData() {
  const run = writeLock.then(async () => {
    const current = repository;
    await deleteDefaultLocalDataDir(repository.dataDir);
    repository =
      current.kind === "json-file" && current.dataDir
        ? new JsonFileStateRepository(current.dataDir)
        : createDefaultStateRepository();
    return readState();
  });

  writeLock = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}
