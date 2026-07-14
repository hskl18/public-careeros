import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { fakeGmailList, fakeGmailMessage, type FakeGmailScenario } from "../lib/fake-gmail";

const host = "127.0.0.1";
const port = Number(process.env.CAREEROS_FAKE_GMAIL_PORT ?? 4399);
let scenario: FakeGmailScenario = "backfill";
let rateLimitConsumed = false;
let listRequests = 0;
let messageRequests = 0;
let tokenRequests = 0;

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(value)}\n`);
}

function redirect(response: ServerResponse, location: string) {
  response.writeHead(302, { location });
  response.end();
}

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (url.pathname === "/health") return json(response, 200, { ok: true, scenario });
  if (url.pathname === "/stats") {
    return json(response, 200, { scenario, listRequests, messageRequests, tokenRequests });
  }
  if (url.pathname === "/control" && request.method === "POST") {
    const next = url.searchParams.get("scenario") as FakeGmailScenario | null;
    if (!next || !["backfill", "rate_limit_once", "expired_token", "partial", "malformed", "reconnect_required"].includes(next)) {
      return json(response, 400, { error: "unsupported_scenario" });
    }
    scenario = next;
    rateLimitConsumed = false;
    return json(response, 200, { scenario });
  }
  if (url.pathname === "/authorize") {
    const callback = new URL(url.searchParams.get("redirect_uri") ?? "http://127.0.0.1/invalid");
    callback.searchParams.set("code", "fake-authorization-code");
    callback.searchParams.set("state", url.searchParams.get("state") ?? "");
    return redirect(response, callback.toString());
  }
  if (url.pathname === "/token" && request.method === "POST") {
    tokenRequests += 1;
    const body = new URLSearchParams(await readBody(request));
    if (body.get("grant_type") === "refresh_token" && scenario === "expired_token") {
      return json(response, 400, { error: "invalid_grant" });
    }
    return json(response, 200, {
      access_token: `fake-access-${tokenRequests}`,
      refresh_token: body.get("grant_type") === "authorization_code" ? "fake-refresh" : undefined,
      expires_in: scenario === "expired_token" ? 0 : 3600,
      scope: "https://www.googleapis.com/auth/gmail.readonly",
      token_type: "Bearer"
    });
  }
  if (url.pathname === "/gmail/v1/users/me/messages") {
    listRequests += 1;
    if (scenario === "reconnect_required") return json(response, 401, { error: "invalid_token" });
    if (scenario === "rate_limit_once" && !rateLimitConsumed) {
      rateLimitConsumed = true;
      response.writeHead(429, { "content-type": "application/json", "retry-after": "1" });
      return response.end('{"error":"rate_limited"}\n');
    }
    if (scenario === "malformed") return json(response, 200, { messages: "invalid" });
    if (scenario === "partial") {
      return json(response, 200, { messages: [{ id: "fake-message-2", threadId: "fake-thread-1" }], resultSizeEstimate: 1 });
    }
    return json(response, 200, fakeGmailList(url.searchParams.get("pageToken") ?? undefined));
  }
  const messageMatch = url.pathname.match(/^\/gmail\/v1\/users\/me\/messages\/([^/]+)$/);
  if (messageMatch) {
    messageRequests += 1;
    if (scenario === "reconnect_required") return json(response, 401, { error: "invalid_token" });
    if (scenario === "malformed") return json(response, 200, { id: messageMatch[1] });
    const message = fakeGmailMessage(decodeURIComponent(messageMatch[1]));
    return message ? json(response, 200, message) : json(response, 404, { error: "not_found" });
  }
  return json(response, 404, { error: "not_found" });
});

server.listen(port, host, () => {
  process.stdout.write(`${JSON.stringify({ ready: true, host, port })}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
