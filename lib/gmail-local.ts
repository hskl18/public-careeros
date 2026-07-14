import { Buffer } from "buffer";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import path from "path";
import { FetchGmailAdapter, GmailAdapterError, type GmailAdapter, type GmailMessageResponse } from "./gmail-adapter";
import { nowIso, stableId } from "./id";
import { defaultRuntimeDataDir } from "./persistence";
import type { ConnectorAccount, LocalImportRecord, MailboxThread } from "./types";

interface GmailTokenFile {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
  token_type?: string;
}

interface GmailTokenEnvelopeV1 {
  version: 1;
  type: "careeros.gmail.oauth";
  algorithm: "aes-256-gcm";
  keySource: "CAREEROS_TOKEN_SECRET" | "CAREEROS_SECRET_KEY" | "CAREEROS_GMAIL_CLIENT_SECRET";
  iv: string;
  tag: string;
  ciphertext: string;
}

interface GmailTokenEnvelopeV2 {
  version: 2;
  type: "careeros.gmail.oauth";
  algorithm: "aes-256-gcm";
  keyId: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

type GmailTokenEnvelope = GmailTokenEnvelopeV1 | GmailTokenEnvelopeV2;
type GmailFailureCode =
  | "rate_limited"
  | "provider_unavailable"
  | "malformed_response"
  | "reconnect_required"
  | "token_corrupt"
  | "token_key_missing"
  | "token_expired";

export class GmailLocalError extends Error {
  constructor(readonly code: GmailFailureCode) {
    super(`Gmail operation could not complete: ${code}.`);
    this.name = "GmailLocalError";
  }
}

export interface GmailSyncResult {
  records: LocalImportRecord[];
  threads: MailboxThread[];
  account: ConnectorAccount;
  stats: {
    pagesFetched: number;
    listedMessages: number;
    fetchedMessages: number;
    resultSizeEstimate?: number;
    hasMore: boolean;
    nextPageToken?: string;
  };
}

export interface GmailSyncOptions {
  limit?: number;
  pageToken?: string;
  maxPages?: number;
  adapter?: GmailAdapter;
  accessToken?: string;
}

export interface GmailOAuthSetupDiagnostic {
  enabled: boolean;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  configured: boolean;
  redirectUri: string;
  requestedOrigin: string;
  redirectOrigin?: string;
  redirectUriValid: boolean;
  originMatchesRequest: boolean;
  status: "disabled" | "not_configured" | "ready" | "needs_attention";
  nextStep: string;
}

export interface GmailTokenDiagnostic {
  status: "missing" | "ready" | "recovered" | "corrupt" | "key_missing";
  keyId?: string;
}

export const gmailOAuthState = "careeros-local-gmail";

function dataDir() {
  return defaultRuntimeDataDir();
}

export function gmailTokenPath() {
  return path.join(dataDir(), "gmail-oauth.json");
}

function gmailEnabled() {
  return process.env.CAREEROS_GMAIL_CONNECTOR_ENABLED === "true";
}

function gmailClientId() {
  return process.env.CAREEROS_GMAIL_CLIENT_ID?.trim();
}

function gmailClientSecret() {
  return process.env.CAREEROS_GMAIL_CLIENT_SECRET?.trim();
}

function currentTokenSecret() {
  if (process.env.CAREEROS_TOKEN_SECRET?.trim()) return process.env.CAREEROS_TOKEN_SECRET.trim();
  if (process.env.CAREEROS_SECRET_KEY?.trim()) return process.env.CAREEROS_SECRET_KEY.trim();
  return gmailClientSecret();
}

function currentTokenKey() {
  const secret = currentTokenSecret();
  if (!secret) return undefined;
  return {
    id: process.env.CAREEROS_TOKEN_KEY_ID?.trim() || "primary",
    secret,
    current: true
  };
}

function previousTokenKey() {
  const secret = process.env.CAREEROS_TOKEN_PREVIOUS_SECRET?.trim();
  if (!secret) return undefined;
  return {
    id: process.env.CAREEROS_TOKEN_PREVIOUS_KEY_ID?.trim() || "previous",
    secret,
    current: false
  };
}

function tokenKeys() {
  return [currentTokenKey(), previousTokenKey()].filter(Boolean) as Array<{
    id: string;
    secret: string;
    current: boolean;
  }>;
}

function tokenKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function tokenAad(keyId: string) {
  return Buffer.from(`careeros.gmail.oauth:2:${keyId}`, "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTokenEnvelope(value: unknown): value is GmailTokenEnvelope {
  if (!isRecord(value)) return false;
  return (
    (value.version === 1 || value.version === 2) &&
    value.type === "careeros.gmail.oauth" &&
    value.algorithm === "aes-256-gcm" &&
    typeof value.iv === "string" &&
    typeof value.tag === "string" &&
    typeof value.ciphertext === "string" &&
    (value.version === 1 || typeof value.keyId === "string")
  );
}

function isTokenFile(value: unknown): value is GmailTokenFile {
  if (!isRecord(value)) return false;
  return (
    typeof value.access_token === "string" &&
    value.access_token.length > 0 &&
    typeof value.expires_at === "number" &&
    (value.refresh_token === undefined || typeof value.refresh_token === "string")
  );
}

function encryptTokenFile(token: GmailTokenFile): GmailTokenEnvelopeV2 {
  const key = currentTokenKey();
  if (!key) throw new GmailLocalError("token_key_missing");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(key.secret), iv);
  cipher.setAAD(tokenAad(key.id));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(token), "utf8"), cipher.final()]);
  return {
    version: 2,
    type: "careeros.gmail.oauth",
    algorithm: "aes-256-gcm",
    keyId: key.id,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url")
  };
}

function decryptWithKey(envelope: GmailTokenEnvelope, secret: string) {
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(secret), Buffer.from(envelope.iv, "base64url"));
  if (envelope.version === 2) decipher.setAAD(tokenAad(envelope.keyId));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
    decipher.final()
  ]).toString("utf8");
  const token = JSON.parse(plaintext) as unknown;
  if (!isTokenFile(token)) throw new GmailLocalError("token_corrupt");
  return token;
}

async function writeTokenFile(token: GmailTokenFile) {
  await mkdir(dataDir(), { recursive: true });
  const destination = gmailTokenPath();
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(encryptTokenFile(token), null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function readTokenFile(): Promise<{ token: GmailTokenFile; recovered: boolean; keyId: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(gmailTokenPath(), "utf8")) as unknown;
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;
    if (code === "ENOENT") throw new GmailLocalError("reconnect_required");
    throw new GmailLocalError("token_corrupt");
  }
  if (!isTokenEnvelope(parsed)) throw new GmailLocalError("token_corrupt");
  const keys = tokenKeys();
  if (!keys.length) throw new GmailLocalError("token_key_missing");
  const candidates = parsed.version === 2 ? keys.filter((key) => key.id === parsed.keyId) : keys;
  if (!candidates.length) throw new GmailLocalError("token_key_missing");

  for (const key of candidates) {
    try {
      const token = decryptWithKey(parsed, key.secret);
      const recovered = parsed.version === 1 || !key.current;
      if (recovered) await writeTokenFile(token);
      return { token, recovered, keyId: currentTokenKey()?.id ?? key.id };
    } catch (error) {
      if (error instanceof GmailLocalError) throw error;
    }
  }
  throw new GmailLocalError("token_corrupt");
}

function fakeEndpoint(name: "CAREEROS_GMAIL_AUTH_URL" | "CAREEROS_GMAIL_TOKEN_URL", fallback: string) {
  const candidate = process.env[name]?.trim();
  if (!candidate) return fallback;
  const url = new URL(candidate);
  const fakeMode = process.env.CAREEROS_GMAIL_FAKE_MODE === "true";
  if (!fakeMode || !["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("Custom Gmail OAuth endpoints require fake mode and a loopback URL.");
  }
  return url.toString();
}

function gmailAuthUrl() {
  return fakeEndpoint("CAREEROS_GMAIL_AUTH_URL", "https://accounts.google.com/o/oauth2/v2/auth");
}

function gmailTokenUrl() {
  return fakeEndpoint("CAREEROS_GMAIL_TOKEN_URL", "https://oauth2.googleapis.com/token");
}

export function gmailRedirectUri(requestUrl: string) {
  return process.env.CAREEROS_GMAIL_REDIRECT_URI?.trim() || new URL("/api/connectors/gmail/callback", requestUrl).toString();
}

export function gmailIsConfigured() {
  return Boolean(gmailEnabled() && gmailClientId() && gmailClientSecret());
}

export function gmailOAuthSetupDiagnostic(requestUrl: string): GmailOAuthSetupDiagnostic {
  const enabled = gmailEnabled();
  const clientIdConfigured = Boolean(gmailClientId());
  const clientSecretConfigured = Boolean(gmailClientSecret());
  const configured = Boolean(enabled && clientIdConfigured && clientSecretConfigured);
  const requestedOrigin = new URL(requestUrl).origin;
  const redirectUri = gmailRedirectUri(requestUrl);
  let redirectOrigin: string | undefined;
  let redirectUriValid = false;

  try {
    redirectOrigin = new URL(redirectUri).origin;
    redirectUriValid = true;
  } catch {
    redirectOrigin = undefined;
  }

  const originMatchesRequest = Boolean(redirectOrigin && redirectOrigin === requestedOrigin);
  if (!enabled) {
    return {
      enabled,
      clientIdConfigured,
      clientSecretConfigured,
      configured,
      redirectUri,
      requestedOrigin,
      redirectOrigin,
      redirectUriValid,
      originMatchesRequest,
      status: "disabled",
      nextStep: "Set CAREEROS_GMAIL_CONNECTOR_ENABLED=true only when you want the optional readonly Gmail connector."
    };
  }
  if (!clientIdConfigured || !clientSecretConfigured) {
    return {
      enabled,
      clientIdConfigured,
      clientSecretConfigured,
      configured,
      redirectUri,
      requestedOrigin,
      redirectOrigin,
      redirectUriValid,
      originMatchesRequest,
      status: "not_configured",
      nextStep: "Add CAREEROS_GMAIL_CLIENT_ID and CAREEROS_GMAIL_CLIENT_SECRET to .env.local, then restart the dev server."
    };
  }
  if (!redirectUriValid || !originMatchesRequest) {
    return {
      enabled,
      clientIdConfigured,
      clientSecretConfigured,
      configured,
      redirectUri,
      requestedOrigin,
      redirectOrigin,
      redirectUriValid,
      originMatchesRequest,
      status: "needs_attention",
      nextStep:
        "Set CAREEROS_GMAIL_REDIRECT_URI to this app origin and paste that exact callback URL into Google OAuth Authorized redirect URIs."
    };
  }
  return {
    enabled,
    clientIdConfigured,
    clientSecretConfigured,
    configured,
    redirectUri,
    requestedOrigin,
    redirectOrigin,
    redirectUriValid,
    originMatchesRequest,
    status: "ready",
    nextStep: "Paste this exact callback URL into Google OAuth Authorized redirect URIs, then retry Connect Gmail."
  };
}

export function gmailConnectUrl(requestUrl: string) {
  if (!gmailIsConfigured()) return undefined;
  const url = new URL(gmailAuthUrl());
  url.searchParams.set("client_id", gmailClientId()!);
  url.searchParams.set("redirect_uri", gmailRedirectUri(requestUrl));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.readonly");
  url.searchParams.set("state", gmailOAuthState);
  return url.toString();
}

export async function gmailTokenDiagnostic(): Promise<GmailTokenDiagnostic> {
  try {
    const result = await readTokenFile();
    return { status: result.recovered ? "recovered" : "ready", keyId: result.keyId };
  } catch (error) {
    if (error instanceof GmailLocalError) {
      if (error.code === "reconnect_required") return { status: "missing" };
      if (error.code === "token_key_missing") return { status: "key_missing" };
    }
    return { status: "corrupt" };
  }
}

export async function deleteGmailToken() {
  await rm(gmailTokenPath(), { force: true });
}

export async function hasGmailToken() {
  const diagnostic = await gmailTokenDiagnostic();
  return diagnostic.status === "ready" || diagnostic.status === "recovered";
}

function tokenAccount(status: ConnectorAccount["status"], message: string): ConnectorAccount {
  return {
    id: "connector_gmail",
    provider: "gmail",
    status,
    label: "Gmail local sync",
    message,
    updatedAt: nowIso()
  };
}

export async function gmailConnectorAccount(): Promise<ConnectorAccount> {
  if (!gmailEnabled()) {
    return tokenAccount("disabled", "Gmail sync is disabled. Set CAREEROS_GMAIL_CONNECTOR_ENABLED=true to use the local demo connector.");
  }
  if (!gmailClientId() || !gmailClientSecret()) {
    return tokenAccount("not_configured", "Gmail sync is enabled, but CAREEROS_GMAIL_CLIENT_ID and CAREEROS_GMAIL_CLIENT_SECRET are missing.");
  }
  const diagnostic = await gmailTokenDiagnostic();
  if (diagnostic.status === "ready" || diagnostic.status === "recovered") {
    return tokenAccount(
      "connected",
      diagnostic.status === "recovered"
        ? "Gmail token was recovered with the previous key and rotated to the current key."
        : "Gmail token envelope is ready for readonly sync."
    );
  }
  if (diagnostic.status === "corrupt") {
    return tokenAccount("needs_attention", "Gmail token recovery failed because the local envelope is corrupt. Reconnect Gmail.");
  }
  if (diagnostic.status === "key_missing") {
    return tokenAccount("needs_attention", "Gmail token recovery failed because its encryption key is unavailable. Restore the previous key or reconnect Gmail.");
  }
  return tokenAccount("disconnected", "Gmail OAuth is configured. Connect once, then sync recent recruiting mail into the local pipeline.");
}

export async function exchangeGmailCode(code: string, requestUrl: string) {
  if (!gmailIsConfigured()) throw new Error("Gmail connector is not configured.");
  const response = await fetch(gmailTokenUrl(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: gmailClientId()!,
      client_secret: gmailClientSecret()!,
      redirect_uri: gmailRedirectUri(requestUrl),
      grant_type: "authorization_code"
    })
  });
  if (!response.ok) throw new GmailLocalError("reconnect_required");
  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  if (!body.access_token) throw new GmailLocalError("malformed_response");
  await writeTokenFile({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Date.now() + (body.expires_in ?? 3600) * 1000,
    scope: body.scope,
    token_type: body.token_type
  });
}

async function accessToken() {
  const { token } = await readTokenFile();
  if (token.expires_at > Date.now() + 60_000) return token.access_token;
  if (!token.refresh_token) throw new GmailLocalError("token_expired");
  const response = await fetch(gmailTokenUrl(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: gmailClientId()!,
      client_secret: gmailClientSecret()!,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) throw new GmailLocalError("token_expired");
  const body = (await response.json()) as { access_token?: string; expires_in?: number; scope?: string; token_type?: string };
  if (!body.access_token) throw new GmailLocalError("malformed_response");
  const next = {
    ...token,
    access_token: body.access_token,
    expires_at: Date.now() + (body.expires_in ?? 3600) * 1000,
    scope: body.scope ?? token.scope,
    token_type: body.token_type ?? token.token_type
  };
  await writeTokenFile(next);
  return next.access_token;
}

function header(message: GmailMessageResponse, name: string) {
  return message.payload?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function inferCompany(subject: string, from: string) {
  const subjectMatch = subject.match(/\b(?:from|at|with)\s+([A-Z][A-Za-z0-9 .&-]{2,48}?)(?=\s+(?:for|about|regarding)\b|$)/);
  if (subjectMatch) return subjectMatch[1].trim();
  const domain = from.match(/@([A-Za-z0-9.-]+)/)?.[1]?.split(".")[0];
  return domain ? domain.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown company";
}

function inferRole(subject: string, body: string) {
  return (
    subject.match(/\b(?:for|re:)\s+([A-Z][A-Za-z0-9 /+-]{3,48}(?:Engineer|Intern|Developer|Scientist|Manager|Designer))/)?.[1] ??
    body.match(/\b([A-Z][A-Za-z0-9 /+-]{3,48}(?:Engineer|Intern|Developer|Scientist|Manager|Designer))\b/)?.[1] ??
    "Candidate pipeline update"
  ).trim();
}

function toImportRecord(message: GmailMessageResponse): LocalImportRecord {
  const subject = header(message, "Subject") || "(no subject)";
  const from = header(message, "From") || "unknown sender";
  const date = header(message, "Date");
  const snippet = (message.snippet ?? "").slice(0, 500);
  const text = [`Subject: ${subject}`, `From: ${from}`, date ? `Date: ${date}` : "", snippet]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1200);
  return {
    company: inferCompany(subject, from),
    role: inferRole(subject, text),
    sourceLabel: `gmail:${message.id}`,
    text,
    sourceMessageIds: [message.id],
    receivedAt: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : undefined,
    recruiterContactEmail: from.match(/<([^>]+)>/)?.[1] ?? from.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0],
    applicationSource: "Gmail"
  };
}

export function gmailFailureCode(error: unknown): GmailFailureCode {
  if (error instanceof GmailLocalError) return error.code;
  if (error instanceof GmailAdapterError) return error.code;
  return "provider_unavailable";
}

export async function syncGmailRecruitingMail(input: number | GmailSyncOptions = 10): Promise<GmailSyncResult> {
  const options = typeof input === "number" ? { limit: input } : input;
  const token = options.accessToken ?? (await accessToken());
  const adapter = options.adapter ?? new FetchGmailAdapter();
  const query =
    process.env.CAREEROS_GMAIL_QUERY?.trim() ||
    'newer_than:90d (recruiter OR application OR assessment OR interview OR "next steps" OR offer OR OA)';
  const boundedLimit = Math.max(1, Math.min(options.limit ?? 10, 50));
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 5, 5));
  const listedMessages: Array<{ id: string; threadId: string }> = [];
  const seenMessageIds = new Set<string>();
  let pageToken = options.pageToken;
  let pagesFetched = 0;
  let resultSizeEstimate: number | undefined;

  while (listedMessages.length < boundedLimit && pagesFetched < maxPages) {
    const list = await adapter.listMessages({
      accessToken: token,
      query,
      maxResults: Math.min(25, boundedLimit - listedMessages.length),
      pageToken
    });
    pagesFetched += 1;
    resultSizeEstimate = list.resultSizeEstimate ?? resultSizeEstimate;
    for (const message of list.messages ?? []) {
      if (seenMessageIds.has(message.id)) continue;
      seenMessageIds.add(message.id);
      listedMessages.push(message);
      if (listedMessages.length >= boundedLimit) break;
    }
    pageToken = list.nextPageToken;
    if (!pageToken || !(list.messages ?? []).length) break;
  }

  const messages = await Promise.all(
    listedMessages.map((item) => adapter.getMessage({ accessToken: token, messageId: item.id }))
  );
  const records = messages.map(toImportRecord);
  const threadsById = new Map<string, MailboxThread>();
  messages.forEach((message, index) => {
    const subject = header(message, "Subject") || records[index].company;
    const from = header(message, "From") || "unknown sender";
    const threadId = stableId("thread", ["gmail", message.threadId]);
    const mailboxMessage = {
      id: message.id,
      threadId,
      fromLabel: from.slice(0, 120),
      subject,
      snippet: records[index].text.slice(0, 360),
      receivedAt: records[index].receivedAt ?? nowIso(),
      sourceLabel: records[index].sourceLabel
    };
    const existing = threadsById.get(threadId);
    if (existing) {
      if (!existing.messages.some((item) => item.id === mailboxMessage.id)) existing.messages.push(mailboxMessage);
      return;
    }
    threadsById.set(threadId, {
      id: threadId,
      source: "gmail",
      subject,
      companyHint: records[index].company,
      roleHint: records[index].role,
      messages: [mailboxMessage],
      createdAt: records[index].receivedAt ?? nowIso()
    });
  });
  return {
    records,
    threads: [...threadsById.values()],
    account: tokenAccount(
      "connected",
      pageToken
        ? `Imported a bounded Gmail page. More recruiting messages remain.`
        : `Gmail backfill is up to date after ${records.length} bounded snippet${records.length === 1 ? "" : "s"}.`
    ),
    stats: {
      pagesFetched,
      listedMessages: listedMessages.length,
      fetchedMessages: messages.length,
      resultSizeEstimate,
      hasMore: Boolean(pageToken),
      nextPageToken: pageToken
    }
  };
}
