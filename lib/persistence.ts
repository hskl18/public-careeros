import { randomUUID } from "crypto";
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import path from "path";
import type { CareerOSState } from "./types";

export interface StateRepository {
  readonly kind: string;
  readonly location: string;
  readonly dataDir?: string;
  read(): Promise<CareerOSState | undefined>;
  write(state: CareerOSState): Promise<CareerOSState>;
}

function parseStateSnapshot(raw: string): CareerOSState | undefined {
  try {
    return JSON.parse(raw) as CareerOSState;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.warn("CareerOS local state snapshot is invalid; recreating an empty local workspace.");
      return undefined;
    }
    throw error;
  }
}

export class JsonFileStateRepository implements StateRepository {
  readonly kind = "json-file";
  readonly location: string;
  readonly dataDir: string;

  constructor(dataDir = process.env.CAREEROS_DATA_DIR ?? path.join(process.cwd(), ".careeros-data")) {
    this.dataDir = dataDir;
    this.location = path.join(dataDir, "state.json");
  }

  async read() {
    try {
      const raw = await readFile(this.location, "utf8");
      return parseStateSnapshot(raw);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
      if (code === "ENOENT") return undefined;
      throw error;
    }
  }

  async write(state: CareerOSState) {
    await mkdir(this.dataDir, { recursive: true });
    const tmpPath = `${this.location}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(tmpPath, this.location);
    return state;
  }
}

export class MemoryStateRepository implements StateRepository {
  readonly kind = "memory";
  readonly location = "memory://careeros-state";
  readonly dataDir = undefined;
  private state?: CareerOSState;

  constructor(initialState?: CareerOSState) {
    this.state = initialState;
  }

  async read() {
    return this.state ? structuredClone(this.state) : undefined;
  }

  async write(state: CareerOSState) {
    this.state = structuredClone(state);
    return structuredClone(state);
  }
}

export function createDefaultStateRepository(): StateRepository {
  return new JsonFileStateRepository();
}

export function defaultLocalDataDir() {
  return path.join(process.cwd(), ".careeros-data");
}

export function isDefaultLocalDataDir(dataDir: string | undefined) {
  if (!dataDir) return false;
  const resolved = path.resolve(dataDir);
  return path.basename(resolved) === ".careeros-data" && resolved !== path.parse(resolved).root;
}

export async function deleteDefaultLocalDataDir(dataDir: string | undefined) {
  if (!isDefaultLocalDataDir(dataDir)) {
    throw new Error("Refusing to delete local data outside .careeros-data.");
  }

  await rm(path.resolve(dataDir as string), { recursive: true, force: true });
}
