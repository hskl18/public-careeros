import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { existsSync } from "fs";
import { mkdir, mkdtemp, readFile, rm } from "fs/promises";
import { createConnection } from "net";
import { tmpdir } from "os";
import path from "path";
import { chromium, type Browser, type Page } from "playwright-core";

const repoRoot = process.cwd();
const appPort = Number(process.env.CAREEROS_GMAIL_E2E_PORT ?? 4520 + Math.floor(Math.random() * 300));
const fakePort = Number(process.env.CAREEROS_FAKE_GMAIL_PORT ?? appPort + 500);
const baseUrl = `http://localhost:${appPort}`;
const fakeUrl = `http://127.0.0.1:${fakePort}`;
const resultsDir = path.join(repoRoot, "test-results", "gmail-e2e");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function chromeExecutablePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium"
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => existsSync(candidate));
}

async function waitForUrl(url: string, child?: ChildProcessWithoutNullStreams) {
  const deadline = Date.now() + 25_000;
  let lastError = "not started";
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

function portIsOpen(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(400, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function startFakeServer() {
  return spawn("pnpm", ["exec", "tsx", "tools/fake-gmail-server.ts"], {
    cwd: repoRoot,
    env: { ...process.env, CAREEROS_FAKE_GMAIL_PORT: String(fakePort) },
    detached: true,
    stdio: "pipe"
  });
}

function startApp(dataDir: string) {
  return spawn("pnpm", ["exec", "next", "start", "-H", "127.0.0.1", "-p", String(appPort)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CAREEROS_DATA_DIR: dataDir,
      CAREEROS_DEBUG_STATE_ENABLED: "true",
      CAREEROS_GMAIL_CONNECTOR_ENABLED: "true",
      CAREEROS_GMAIL_CLIENT_ID: "fixture-client",
      CAREEROS_GMAIL_CLIENT_SECRET: "fixture-client-secret",
      CAREEROS_TOKEN_SECRET: "fixture-token-secret",
      CAREEROS_TOKEN_KEY_ID: "fixture-key",
      CAREEROS_GMAIL_REDIRECT_URI: `${baseUrl}/api/connectors/gmail/callback`,
      CAREEROS_GMAIL_FAKE_MODE: "true",
      CAREEROS_GMAIL_AUTH_URL: `${fakeUrl}/authorize`,
      CAREEROS_GMAIL_TOKEN_URL: `${fakeUrl}/token`,
      CAREEROS_GMAIL_API_BASE_URL: `${fakeUrl}/gmail/v1`,
      CAREEROS_GMAIL_MAX_RESULTS: "2",
      CAREEROS_OLLAMA_ENABLED: "false"
    },
    detached: true,
    stdio: "pipe"
  });
}

async function stop(child?: ChildProcessWithoutNullStreams) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 2_000);
    child.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function bodyText(page: Page) {
  await page.waitForLoadState("networkidle");
  return (await page.locator("body").innerText()).toLowerCase();
}

async function expectCopy(page: Page, copy: string) {
  const body = await bodyText(page);
  assert(body.includes(copy.toLowerCase()), `Expected page to contain "${copy}".`);
}

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 2, `Page has ${overflow}px horizontal overflow.`);
}

async function connect(page: Page) {
  await page.goto(`${baseUrl}/settings?section=gmail`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Connect Gmail" }).click();
  await page.waitForURL(/gmail=connected/);
  await expectCopy(page, "Gmail readonly authorization connected");
}

async function debugState(page: Page) {
  const response = await page.request.get(`${baseUrl}/api/local-data/export`);
  assert(response.ok(), `Local state export returned HTTP ${response.status()}.`);
  return (await response.json()) as {
    mailboxThreads: Array<{ messages: Array<{ id: string }> }>;
    reviewItems: Array<{ status: string }>;
    applications: unknown[];
    gmailSync: {
      status: string;
      diagnosticCode?: string;
      progress?: { pagesCompleted: number; importedRecords: number; duplicateRecords: number };
    };
  };
}

async function runBackfillAndLocalDataFlow(browser: Browser, dataDir: string) {
  let app = startApp(dataDir);
  await waitForUrl(baseUrl, app);
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await connect(page);
    await page.getByRole("button", { name: "Sync recruiting mail" }).click();
    await expectCopy(page, "catching up");
    await expectCopy(page, "Messages checked");
    const firstCheckpoint = await debugState(page);
    assert(firstCheckpoint.gmailSync.progress?.pagesCompleted === 1, "First bounded page was not checkpointed.");
    await page.screenshot({ path: path.join(resultsDir, "desktop-catching-up.png"), fullPage: true });

    await page.getByRole("button", { name: "Pause backfill" }).click();
    await expectCopy(page, "paused");
    await stop(app);
    app = startApp(dataDir);
    await waitForUrl(baseUrl, app);
    await page.reload({ waitUntil: "networkidle" });
    await expectCopy(page, "paused");
    await page.getByRole("button", { name: "Continue from checkpoint" }).click();
    await expectCopy(page, "idle");

    const state = await debugState(page);
    const messageIds = state.mailboxThreads.flatMap((thread) => thread.messages.map((message) => message.id));
    assert(new Set(messageIds).size === 3, `Expected exactly three unique fake messages, received ${messageIds.join(", ")}.`);
    assert(messageIds.length === 3, "Duplicate message merge was not exactly once.");
    assert(state.gmailSync.progress?.pagesCompleted === 2, "Expected two persisted page checkpoints.");
    assert(state.gmailSync.progress?.duplicateRecords === 1, "Expected one duplicate record to be suppressed.");

    await page.goto(`${baseUrl}/review`, { waitUntil: "networkidle" });
    const accept = page.getByRole("button", { name: "Accept update" });
    assert((await accept.count()) > 0, "Expected a review item generated from fake Gmail evidence.");
    await accept.first().click();
    await page.waitForLoadState("networkidle");
    const dismiss = page.getByRole("button", { name: "Dismiss", exact: true });
    if ((await dismiss.count()) > 0) {
      await dismiss.first().click();
      await page.waitForLoadState("networkidle");
    }
    const reviewed = await debugState(page);
    assert(reviewed.reviewItems.some((item) => item.status === "accepted"), "Accepted review decision was not persisted.");
    assert(
      reviewed.reviewItems.some((item) => item.status === "dismissed") || reviewed.reviewItems.filter((item) => item.status === "accepted").length > 1,
      "Expected a second persisted review decision."
    );

    await page.goto(`${baseUrl}/settings?section=local-data`, { waitUntil: "networkidle" });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export JSON" }).click();
    const download = await downloadPromise;
    const exportPath = path.join(resultsDir, "careeros-export.json");
    await download.saveAs(exportPath);
    const exported = await readFile(exportPath, "utf8");
    assert(exported.includes('"gmailSync"'), "Local export omitted Gmail sync state.");
    assert(!/access_token|refresh_token|fixture-token-secret/.test(exported), "Local export contained token material.");

    await page.getByPlaceholder("DELETE LOCAL DATA").fill("DELETE LOCAL DATA");
    await page.getByRole("button", { name: "Delete local data" }).click();
    await page.waitForLoadState("networkidle");
    const deleted = await debugState(page);
    assert(deleted.applications.length === 0, "Local delete did not clear applications.");
    assert(deleted.mailboxThreads.length === 0, "Local delete did not clear mailbox threads.");

    assert(consoleErrors.length === 0, `Browser console errors: ${consoleErrors.join(" | ")}`);
    console.log("gmail-e2e backfill, restart, review, export, and delete ok");
  } finally {
    await page.close();
    await stop(app);
  }
}

async function setScenario(scenario: string) {
  const response = await fetch(`${fakeUrl}/control?scenario=${scenario}`, { method: "POST" });
  assert(response.ok, `Could not set fake Gmail scenario ${scenario}.`);
}

async function runFailureAndMobileFlow(browser: Browser, dataDir: string) {
  const app = startApp(dataDir);
  await waitForUrl(baseUrl, app);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await setScenario("backfill");
    await connect(page);
    await setScenario("rate_limit_once");
    await page.getByRole("button", { name: "Sync recruiting mail" }).click();
    await expectCopy(page, "degraded");
    await expectCopy(page, "rate limited");
    await assertNoOverflow(page);
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    assert(focusedTag === "a" || focusedTag === "button", "Keyboard navigation did not reach an interactive control.");

    await page.getByRole("button", { name: "Continue from checkpoint" }).click();
    await expectCopy(page, "catching up");
    await setScenario("reconnect_required");
    await page.getByRole("button", { name: "Continue from checkpoint" }).click();
    await expectCopy(page, "reconnect required");
    await expectCopy(page, "Reconnect Gmail to continue");
    await assertNoOverflow(page);
    await page.screenshot({ path: path.join(resultsDir, "mobile-reconnect-required.png"), fullPage: true });

    const state = await debugState(page);
    assert(state.gmailSync.status === "reconnect_required", "Reconnect-required state was not persisted.");
    assert(state.gmailSync.diagnosticCode === "reconnect_required", "Reconnect diagnostic was not redacted and typed.");
    assert(consoleErrors.length === 0, `Browser console errors: ${consoleErrors.join(" | ")}`);
    console.log("gmail-e2e rate-limit retry, reconnect, keyboard, and mobile layout ok");
  } finally {
    await page.close();
    await stop(app);
  }
}

async function main() {
  const executablePath = chromeExecutablePath();
  if (!executablePath) throw new Error("No Chrome or Chromium executable found. Set CHROME_PATH to run Gmail E2E tests.");
  assert(!(await portIsOpen(appPort)), `App port ${appPort} is already in use.`);
  assert(!(await portIsOpen(fakePort)), `Fake Gmail port ${fakePort} is already in use.`);
  await rm(resultsDir, { recursive: true, force: true });
  await mkdir(resultsDir, { recursive: true });
  const parent = await mkdtemp(path.join(tmpdir(), "careeros-gmail-e2e-"));
  const firstDataDir = path.join(parent, "first", ".careeros-data");
  const secondDataDir = path.join(parent, "second", ".careeros-data");
  await mkdir(firstDataDir, { recursive: true });
  await mkdir(secondDataDir, { recursive: true });
  const fake = startFakeServer();
  const fakeErrors: string[] = [];
  fake.stderr.on("data", (chunk) => fakeErrors.push(String(chunk)));

  try {
    await waitForUrl(`${fakeUrl}/health`, fake);
    const browser = await chromium.launch({ executablePath, headless: true, args: ["--disable-gpu", "--no-sandbox"] });
    try {
      await runBackfillAndLocalDataFlow(browser, firstDataDir);
      await runFailureAndMobileFlow(browser, secondDataDir);
    } finally {
      await browser.close();
    }
  } finally {
    await stop(fake);
    await rm(parent, { recursive: true, force: true });
    if (fakeErrors.length) console.error(fakeErrors.join(""));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
