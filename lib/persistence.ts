import { randomUUID } from "crypto";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import type { CareerOSState } from "./types";
import { DatabaseSync } from "node:sqlite";

export interface StateRepository {
  readonly kind: string;
  readonly location: string;
  read(): Promise<CareerOSState | undefined>;
  write(state: CareerOSState): Promise<CareerOSState>;
}

export class JsonFileStateRepository implements StateRepository {
  readonly kind = "json-file";
  readonly location: string;
  private readonly dataDir: string;

  constructor(dataDir = process.env.CAREEROS_DATA_DIR ?? path.join(process.cwd(), ".careeros-data")) {
    this.dataDir = dataDir;
    this.location = path.join(dataDir, "state.json");
  }

  async read() {
    try {
      const raw = await readFile(this.location, "utf8");
      return JSON.parse(raw) as CareerOSState;
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

export class SQLiteStateRepository implements StateRepository {
  readonly kind = "sqlite";
  readonly location: string;
  private initialized = false;

  constructor(dataDir = process.env.CAREEROS_DATA_DIR ?? path.join(process.cwd(), ".careeros-data")) {
    this.location = path.join(dataDir, "careeros.sqlite");
  }

  private async ensureParentDir() {
    await mkdir(path.dirname(this.location), { recursive: true });
  }

  private open() {
    const db = new DatabaseSync(this.location);
    if (!this.initialized) {
      db.exec(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS local_state (
          key TEXT PRIMARY KEY,
          state_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT OR IGNORE INTO schema_migrations (id, applied_at)
        VALUES ('0001_local_state_snapshot', datetime('now'));
      `);
      this.initialized = true;
    }
    return db;
  }

  async read() {
    await this.ensureParentDir();
    const db = this.open();
    try {
      const row = db.prepare("SELECT state_json FROM local_state WHERE key = ?").get("default") as
        | { state_json: string }
        | undefined;
      return row ? (JSON.parse(row.state_json) as CareerOSState) : undefined;
    } finally {
      db.close();
    }
  }

  async write(state: CareerOSState) {
    await this.ensureParentDir();
    const db = this.open();
    try {
      db.prepare(
        `INSERT INTO local_state (key, state_json, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
           state_json = excluded.state_json,
           updated_at = excluded.updated_at`
      ).run("default", JSON.stringify(state));
      return state;
    } finally {
      db.close();
    }
  }
}

export class MemoryStateRepository implements StateRepository {
  readonly kind = "memory";
  readonly location = "memory://careeros-state";
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
  if (process.env.CAREEROS_PERSISTENCE === "json") {
    return new JsonFileStateRepository();
  }

  return new SQLiteStateRepository();
}
