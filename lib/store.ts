import { deriveNotifications } from "./notifications";
import { withConnectorAccounts } from "./connectors";
import { createDefaultStateRepository } from "./persistence";
import { createSeedState } from "./seed";
import type { CareerOSState } from "./types";
import type { StateRepository } from "./persistence";

let writeLock = Promise.resolve();
let repository: StateRepository = createDefaultStateRepository();

export function setStateRepository(nextRepository: StateRepository) {
  repository = nextRepository;
  writeLock = Promise.resolve();
}

function withDerivedNotifications(state: CareerOSState): CareerOSState {
  const connectorNormalized = withConnectorAccounts(state);
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
    const seeded = createSeedState();
    return writeState(seeded);
  }

  return withDerivedNotifications(parsed);
}

export async function resetState(): Promise<CareerOSState> {
  return writeState(createSeedState());
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
