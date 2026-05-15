import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { existsSync } from "fs";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { createConnection } from "net";
import { tmpdir } from "os";
import path from "path";
import { chromium, type Browser } from "playwright-core";
import { createEmptyState, createSeedState } from "../lib/seed";

const repoRoot = process.cwd();
const smokePort = Number(process.env.CAREEROS_SMOKE_PORT ?? 3210 + Math.floor(Math.random() * 1000));
const baseUrl = process.env.CAREEROS_SMOKE_BASE_URL ?? `http://127.0.0.1:${smokePort}`;
const screenshotDir = path.join(repoRoot, "test-results", "browser-smoke");

type SmokeRoute = {
  path: string;
  copy: string[];
};

type SmokeScenario = {
  name: "seeded" | "empty" | "external";
  routes: SmokeRoute[];
  dataDir?: string;
};

const seededRoutes: SmokeRoute[] = [
  {
    path: "/",
    copy: [
      "Mailbox pipeline console",
      "Recruiting mail becomes review-gated application state"
    ]
  },
  {
    path: "/judge-demo",
    copy: [
      "CareerOS public demo",
      "sanitized sample",
      "Gemma via Ollama Cloud",
      "review gates",
      "not the full hosted Other Candidate source"
    ]
  },
  { path: "/applications", copy: ["Job pipeline", "Atlas Robotics", "Evidence-first records"] },
  {
    path: "/applications/app_atlas",
    copy: ["Atlas Robotics", "Structured application state", "Application timeline", "Bounded evidence snippets"]
  },
  { path: "/review", copy: ["Review queue", "Accept update", "Correct"] },
  { path: "/resume", copy: ["Candidate context path", "Deterministic fallback", "Gemma via Ollama Cloud"] },
  { path: "/agents", copy: ["CareerOS agent contracts", "Memory boundary", "Mailbox triage agent"] },
  { path: "/settings", copy: ["Settings", "pnpm install", ".env.local", "Ollama Cloud API key"] },
  { path: "/notifications", copy: ["Action queue", "Notification rows"] }
];

const emptyRoutes: SmokeRoute[] = [
  {
    path: "/",
    copy: ["Mailbox pipeline console", "No applications loaded yet", "Open judge demo", "Connect Gmail", "Set up Gemma"]
  },
  {
    path: "/judge-demo",
    copy: ["CareerOS public demo", "sanitized sample", "no Gmail or model key", "Gemma via Ollama Cloud"]
  },
  {
    path: "/applications",
    copy: ["Job pipeline", "No application records yet", "Connect Gmail", "View judge demo", "Set up Gemma"]
  },
  { path: "/review", copy: ["Review queue", "No review work yet", "Inspect sample review gate", "Connect Gmail"] },
  { path: "/resume", copy: ["Candidate context path", "Open judge demo", "Set up Gemma"] },
  { path: "/agents", copy: ["CareerOS agent contracts", "Memory boundary", "Mailbox triage agent"] },
  {
    path: "/settings?section=gmail",
    copy: ["Settings", "Gmail sync actions", "Connect Gmail", "Readonly OAuth", "OAuth setup diagnostic"]
  },
  { path: "/notifications", copy: ["Action queue", "No active notifications", "Open judge demo", "Connect Gmail"] }
];

const viewports = [
  { name: "desktop", width: 1440, height: 950 },
  { name: "mobile", width: 390, height: 844 }
];

function chromeExecutablePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => existsSync(candidate));
}

async function waitForServer(url: string, child?: ChildProcessWithoutNullStreams) {
  const deadline = Date.now() + 20_000;
  let lastError = "";
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new Error(`next start exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

function portIsOpen(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = createConnection({ host, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function createSmokeDataDir(scenario: "seeded" | "empty") {
  const dataDir = await mkdtemp(path.join(tmpdir(), "careeros-browser-smoke-"));
  const state = scenario === "seeded" ? createSeedState() : createEmptyState();
  const now = new Date().toISOString();

  state.applications = state.applications.map((application) => ({
    ...application,
    source: "import",
    updatedAt: application.updatedAt ?? now
  }));
  state.mailboxThreads = state.mailboxThreads.map((thread) => ({
    ...thread,
    source: "gmail"
  }));
  state.events = state.events.map((event) => ({
    ...event,
    source: event.source === "seed" ? "import" : event.source
  }));
  state.importJobs = state.importJobs.map((job) => ({
    ...job,
    source: job.source === "seed" ? "json" : job.source
  }));
  state.evidenceSnippets = state.evidenceSnippets.map((snippet) => ({
    ...snippet,
    sourceLabel: snippet.sourceLabel.replace(/^seed:/, "smoke:")
  }));
  state.reviewItems = state.reviewItems.map((review) => ({
    ...review,
    sourceLabel: review.sourceLabel.replace(/^seed:/, "smoke:")
  }));

  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, "state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return dataDir;
}

function startServer(dataDir: string) {
  return spawn("pnpm", ["exec", "next", "start", "-H", "127.0.0.1", "-p", String(smokePort)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CAREEROS_DATA_DIR: dataDir,
      CAREEROS_GMAIL_CONNECTOR_ENABLED: "false",
      CAREEROS_OLLAMA_ENABLED: "false"
    },
    detached: true,
    stdio: "pipe"
  });
}

function screenshotName(scenario: SmokeScenario["name"], viewportName: string, routePath: string) {
  const routeName =
    routePath === "/"
      ? "home"
      : routePath
          .replace(/^\//, "")
          .replace(/[^a-z0-9_-]+/gi, "-")
          .replace(/-+$/g, "");
  return `${scenario}-${viewportName}-${routeName}.png`;
}

async function stopServer(child?: ChildProcessWithoutNullStreams) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // Process already exited.
    }
  }
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2_000);
    child.once("close", () => {
      clearTimeout(timer);
      resolve(undefined);
    });
  });
}

async function assertPage(
  browser: Browser,
  scenario: SmokeScenario["name"],
  route: SmokeRoute,
  viewport: (typeof viewports)[number]
) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: "networkidle" });
  if (!response || response.status() >= 400) {
    throw new Error(`${scenario} ${viewport.name} ${route.path} returned ${response?.status() ?? "no response"}`);
  }

  const bodyText = (await page.locator("body").innerText()).toLowerCase();
  const missing = route.copy.filter((item) => !bodyText.includes(item.toLowerCase()));
  if (missing.length) {
    throw new Error(`${scenario} ${viewport.name} ${route.path} missing copy: ${missing.join(", ")}`);
  }

  const overflow = await page.evaluate(() => ({
    documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyOverflow: document.body.scrollWidth - document.body.clientWidth
  }));
  if (overflow.documentOverflow > 2 || overflow.bodyOverflow > 2) {
    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            className: element.className,
            text: (element.textContent ?? "").trim().slice(0, 80),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width)
          };
        })
        .filter((item) => item.right > document.documentElement.clientWidth + 2 || item.left < -2)
        .slice(0, 8)
    );
    throw new Error(
      `${scenario} ${viewport.name} ${route.path} has horizontal overflow: ${JSON.stringify({ overflow, offenders })}`
    );
  }

  const legacyLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .map((anchor) => anchor.getAttribute("href") ?? "")
      .filter((href) => /\/analytics|\/app\/|\/tech|\/one-page/.test(href))
  );
  if (legacyLinks.length) {
    throw new Error(`${scenario} ${viewport.name} ${route.path} contains legacy links: ${legacyLinks.join(", ")}`);
  }

  await page.screenshot({
    path: path.join(screenshotDir, screenshotName(scenario, viewport.name, route.path)),
    fullPage: false
  });
  await page.close();
}

async function main() {
  const executablePath = chromeExecutablePath();
  if (!executablePath) {
    throw new Error("No Chrome/Chromium executable found. Set CHROME_PATH to run browser smoke.");
  }

  await rm(screenshotDir, { recursive: true, force: true });
  await mkdir(screenshotDir, { recursive: true });

  const shouldStartServer = !process.env.CAREEROS_SMOKE_BASE_URL;
  const scenarios: SmokeScenario[] = shouldStartServer
    ? [
        { name: "seeded", routes: seededRoutes, dataDir: await createSmokeDataDir("seeded") },
        { name: "empty", routes: emptyRoutes, dataDir: await createSmokeDataDir("empty") }
      ]
    : [{ name: "external", routes: seededRoutes }];

  for (const scenario of scenarios) {
    if (shouldStartServer && (await portIsOpen("127.0.0.1", smokePort))) {
      throw new Error(`Port ${smokePort} is already in use. Stop the process or set CAREEROS_SMOKE_PORT.`);
    }

    const child = scenario.dataDir ? startServer(scenario.dataDir) : undefined;
    const stdout: string[] = [];
    const stderr: string[] = [];
    child?.stdout.on("data", (chunk) => stdout.push(String(chunk)));
    child?.stderr.on("data", (chunk) => stderr.push(String(chunk)));

    try {
      await waitForServer(baseUrl, child || undefined);
      const browser = await chromium.launch({
        executablePath,
        headless: true,
        args: ["--disable-gpu", "--no-sandbox"]
      });
      try {
        for (const viewport of viewports) {
          for (const route of scenario.routes) {
            await assertPage(browser, scenario.name, route, viewport);
            console.log(`${scenario.name} ${viewport.name} ${route.path} ok`);
          }
        }
      } finally {
        await browser.close();
      }
    } finally {
      await stopServer(child || undefined);
      if (scenario.dataDir) await rm(scenario.dataDir, { recursive: true, force: true });
      if (stderr.length && process.env.CAREEROS_SMOKE_DEBUG === "true") {
        if (stdout.length) console.error(stdout.join(""));
        console.error(stderr.join(""));
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
