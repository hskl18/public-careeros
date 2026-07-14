import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { FakeGmailAdapter } from "@/lib/fake-gmail";
import {
  exchangeGmailCode,
  gmailConnectorAccount,
  gmailTokenDiagnostic,
  gmailTokenPath,
  hasGmailToken,
  syncGmailRecruitingMail
} from "@/lib/gmail-local";
import { createDisconnectedGmailSyncState, transitionGmailSync } from "@/lib/gmail-sync";
import { GET as getVersion } from "@/app/api/version/route";

const originalFetch = globalThis.fetch;
const trackedEnv = [
  "CAREEROS_DATA_DIR",
  "CAREEROS_GMAIL_CONNECTOR_ENABLED",
  "CAREEROS_GMAIL_CLIENT_ID",
  "CAREEROS_GMAIL_CLIENT_SECRET",
  "CAREEROS_TOKEN_SECRET",
  "CAREEROS_TOKEN_KEY_ID",
  "CAREEROS_TOKEN_PREVIOUS_SECRET",
  "CAREEROS_TOKEN_PREVIOUS_KEY_ID"
] as const;
const originalEnv = Object.fromEntries(trackedEnv.map((name) => [name, process.env[name]]));

function restoreEnv() {
  for (const name of trackedEnv) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function configureTokenTest(dataDir: string) {
  process.env.CAREEROS_DATA_DIR = dataDir;
  process.env.CAREEROS_GMAIL_CONNECTOR_ENABLED = "true";
  process.env.CAREEROS_GMAIL_CLIENT_ID = "fixture-client";
  process.env.CAREEROS_GMAIL_CLIENT_SECRET = "fixture-client-secret";
  process.env.CAREEROS_TOKEN_SECRET = "fixture-old-secret";
  process.env.CAREEROS_TOKEN_KEY_ID = "old-key";
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
  vi.restoreAllMocks();
});

describe("persisted Gmail synchronization", () => {
  it("reports the server-owned v0.2.0 package version", async () => {
    const response = await getVersion();
    expect(await response.json()).toEqual({ name: "careeros", version: "0.2.0" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("enforces typed state transitions and emits redacted audit metadata", () => {
    const disconnected = createDisconnectedGmailSyncState("2026-07-14T00:00:00.000Z");
    const authorizing = transitionGmailSync(disconnected, "authorizing", {
      diagnosticCode: "authorization_pending",
      summary: "Authorization started."
    });
    const idle = transitionGmailSync(authorizing.sync, "idle", {
      summary: "Authorization completed."
    });
    const catchingUp = transitionGmailSync(idle.sync, "catching_up", {
      summary: "Backfill started."
    });

    expect(catchingUp.sync.status).toBe("catching_up");
    expect(catchingUp.audit.action).toBe("gmail.sync_state.catching_up");
    expect(JSON.stringify(catchingUp.audit)).not.toMatch(/access[_-]?token|refresh[_-]?token|secret/i);
    expect(() =>
      transitionGmailSync(disconnected, "paused", { summary: "Invalid transition." })
    ).toThrow("Unsupported Gmail sync transition");
  });

  it("supports bounded pages, duplicate fixtures, thread updates, and partial metadata", async () => {
    const adapter = new FakeGmailAdapter("backfill");
    const first = await syncGmailRecruitingMail({ accessToken: "fixture", adapter, limit: 2, maxPages: 1 });
    const second = await syncGmailRecruitingMail({
      accessToken: "fixture",
      adapter,
      limit: 2,
      maxPages: 1,
      pageToken: first.stats.nextPageToken
    });
    const partial = await syncGmailRecruitingMail({
      accessToken: "fixture",
      adapter: new FakeGmailAdapter("partial"),
      limit: 2,
      maxPages: 1
    });

    expect(first.stats).toMatchObject({ pagesFetched: 1, fetchedMessages: 2, hasMore: true, nextPageToken: "page-2" });
    expect(second.records.map((record) => record.sourceLabel)).toEqual(["gmail:fake-message-2", "gmail:fake-message-3"]);
    expect(first.threads).toHaveLength(1);
    expect(first.threads[0].messages).toHaveLength(2);
    expect(partial.records[0].text).not.toContain("Date:");
    expect(JSON.stringify([...first.records, ...second.records])).not.toContain("fixture");
  });

  it("returns typed rate-limit, malformed-response, and reconnect failures", async () => {
    await expect(
      syncGmailRecruitingMail({ accessToken: "fixture", adapter: new FakeGmailAdapter("rate_limit_once"), maxPages: 1 })
    ).rejects.toMatchObject({ code: "rate_limited" });
    await expect(
      syncGmailRecruitingMail({ accessToken: "fixture", adapter: new FakeGmailAdapter("malformed"), maxPages: 1 })
    ).rejects.toMatchObject({ code: "malformed_response" });
    await expect(
      syncGmailRecruitingMail({ accessToken: "fixture", adapter: new FakeGmailAdapter("reconnect_required"), maxPages: 1 })
    ).rejects.toMatchObject({ code: "reconnect_required" });
  });
});

describe("versioned Gmail token envelope", () => {
  it("requires reconnect when an expired token cannot be refreshed", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "careeros-token-expired-"));
    configureTokenTest(dir);
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      return calls === 1
        ? Response.json({ access_token: "expired-access", refresh_token: "expired-refresh", expires_in: 0 })
        : Response.json({ error: "invalid_grant" }, { status: 400 });
    }) as typeof fetch;

    try {
      await exchangeGmailCode("fixture-code", "http://localhost/api/connectors/gmail/callback");
      await expect(
        syncGmailRecruitingMail({ adapter: new FakeGmailAdapter("backfill"), maxPages: 1 })
      ).rejects.toMatchObject({ code: "token_expired" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("atomically rotates a previous-key envelope without exposing token plaintext", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "careeros-token-rotation-"));
    configureTokenTest(dir);
    globalThis.fetch = vi.fn(async () =>
      Response.json({ access_token: "private-access", refresh_token: "private-refresh", expires_in: 3600 })
    ) as typeof fetch;

    try {
      await exchangeGmailCode("fixture-code", "http://localhost/api/connectors/gmail/callback");
      const before = await readFile(gmailTokenPath(), "utf8");
      expect(JSON.parse(before)).toMatchObject({ version: 2, keyId: "old-key", algorithm: "aes-256-gcm" });
      expect(before).not.toMatch(/private-access|private-refresh/);

      process.env.CAREEROS_TOKEN_SECRET = "fixture-new-secret";
      process.env.CAREEROS_TOKEN_KEY_ID = "new-key";
      process.env.CAREEROS_TOKEN_PREVIOUS_SECRET = "fixture-old-secret";
      process.env.CAREEROS_TOKEN_PREVIOUS_KEY_ID = "old-key";

      expect(await gmailTokenDiagnostic()).toEqual({ status: "recovered", keyId: "new-key" });
      expect(await hasGmailToken()).toBe(true);
      const after = await readFile(gmailTokenPath(), "utf8");
      expect(JSON.parse(after)).toMatchObject({ version: 2, keyId: "new-key" });
      expect((await readdir(dir)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("distinguishes missing keys and corruption with reconnect-safe diagnostics", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "careeros-token-corrupt-"));
    configureTokenTest(dir);
    globalThis.fetch = vi.fn(async () =>
      Response.json({ access_token: "private-access", refresh_token: "private-refresh", expires_in: 3600 })
    ) as typeof fetch;

    try {
      await exchangeGmailCode("fixture-code", "http://localhost/api/connectors/gmail/callback");
      process.env.CAREEROS_TOKEN_SECRET = "unrelated-secret";
      process.env.CAREEROS_TOKEN_KEY_ID = "unrelated-key";
      expect(await gmailTokenDiagnostic()).toEqual({ status: "key_missing" });

      process.env.CAREEROS_TOKEN_SECRET = "fixture-old-secret";
      process.env.CAREEROS_TOKEN_KEY_ID = "old-key";
      const envelope = JSON.parse(await readFile(gmailTokenPath(), "utf8")) as { ciphertext: string };
      envelope.ciphertext = `${envelope.ciphertext.slice(0, -2)}xx`;
      await writeFile(gmailTokenPath(), `${JSON.stringify(envelope)}\n`, "utf8");

      expect(await gmailTokenDiagnostic()).toEqual({ status: "corrupt" });
      const account = await gmailConnectorAccount();
      expect(account.status).toBe("needs_attention");
      expect(account.message).toBe("Gmail token recovery failed because the local envelope is corrupt. Reconnect Gmail.");
      expect(JSON.stringify(account)).not.toMatch(/private-access|private-refresh|fixture-old-secret/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
