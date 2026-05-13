import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { Buffer } from "buffer";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { hashText, nowIso, stableId } from "./id";
import type { ConnectorAccount, LocalImportRecord, MailboxThread } from "./types";

interface GmailTokenFile {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
  token_type?: string;
}

interface GmailTokenEnvelope {
  version: 1;
  type: "careeros.gmail.oauth";
  algorithm: "aes-256-gcm";
  keySource: "CAREEROS_TOKEN_SECRET" | "CAREEROS_SECRET_KEY" | "CAREEROS_GMAIL_CLIENT_SECRET";
  iv: string;
  tag: string;
  ciphertext: string;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    mimeType?: string;
    body?: { data?: string };
    headers?: Array<{ name?: string; value?: string }>;
    parts?: GmailMessageResponse["payload"][];
  };
}

export interface GmailSyncResult {
  records: LocalImportRecord[];
  threads: MailboxThread[];
  account: ConnectorAccount;
}

function dataDir() {
  return process.env.CAREEROS_DATA_DIR ?? ".careeros-data";
}

function tokenPath() {
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

function tokenSecret() {
  if (process.env.CAREEROS_TOKEN_SECRET?.trim()) {
    return { value: process.env.CAREEROS_TOKEN_SECRET.trim(), source: "CAREEROS_TOKEN_SECRET" as const };
  }
  if (process.env.CAREEROS_SECRET_KEY?.trim()) {
    return { value: process.env.CAREEROS_SECRET_KEY.trim(), source: "CAREEROS_SECRET_KEY" as const };
  }
  const clientSecret = gmailClientSecret();
  return clientSecret ? { value: clientSecret, source: "CAREEROS_GMAIL_CLIENT_SECRET" as const } : undefined;
}

function tokenKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function isTokenEnvelope(value: unknown): value is GmailTokenEnvelope {
  const record = value as Partial<GmailTokenEnvelope>;
  return (
    Boolean(record) &&
    record.version === 1 &&
    record.type === "careeros.gmail.oauth" &&
    record.algorithm === "aes-256-gcm" &&
    typeof record.iv === "string" &&
    typeof record.tag === "string" &&
    typeof record.ciphertext === "string"
  );
}

function encryptTokenFile(token: GmailTokenFile): GmailTokenEnvelope {
  const secret = tokenSecret();
  if (!secret) throw new Error("Gmail token encryption requires CAREEROS_GMAIL_CLIENT_SECRET or CAREEROS_TOKEN_SECRET.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(secret.value), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(token), "utf8"), cipher.final()]);
  return {
    version: 1,
    type: "careeros.gmail.oauth",
    algorithm: "aes-256-gcm",
    keySource: secret.source,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url")
  };
}

function decryptTokenFile(envelope: GmailTokenEnvelope): GmailTokenFile {
  const secret = tokenSecret();
  if (!secret) throw new Error("Gmail token encryption key is missing.");
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(secret.value), Buffer.from(envelope.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
    decipher.final()
  ]).toString("utf8");
  return JSON.parse(plaintext) as GmailTokenFile;
}

export function gmailRedirectUri(requestUrl: string) {
  return process.env.CAREEROS_GMAIL_REDIRECT_URI?.trim() || new URL("/api/connectors/gmail/callback", requestUrl).toString();
}

export function gmailIsConfigured() {
  return Boolean(gmailEnabled() && gmailClientId() && gmailClientSecret());
}

export function gmailConnectUrl(requestUrl: string) {
  if (!gmailIsConfigured()) return undefined;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", gmailClientId()!);
  url.searchParams.set("redirect_uri", gmailRedirectUri(requestUrl));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.readonly");
  url.searchParams.set("state", "careeros-local-gmail");
  return url.toString();
}

async function readTokenFile() {
  try {
    const parsed = JSON.parse(await readFile(tokenPath(), "utf8")) as unknown;
    return isTokenEnvelope(parsed) ? decryptTokenFile(parsed) : (parsed as GmailTokenFile);
  } catch {
    return undefined;
  }
}

async function writeTokenFile(token: GmailTokenFile) {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(tokenPath(), JSON.stringify(encryptTokenFile(token), null, 2), { mode: 0o600 });
}

export async function deleteGmailToken() {
  await rm(tokenPath(), { force: true });
}

export async function hasGmailToken() {
  return Boolean(await readTokenFile());
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
  if (await hasGmailToken()) {
    return tokenAccount("connected", "Gmail OAuth token is encrypted under .careeros-data and can sync recruiting mail.");
  }
  return tokenAccount("disconnected", "Gmail OAuth is configured. Connect once, then sync recent recruiting mail into the local pipeline.");
}

export async function exchangeGmailCode(code: string, requestUrl: string) {
  if (!gmailIsConfigured()) throw new Error("Gmail connector is not configured.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
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
  if (!response.ok) throw new Error(`Google OAuth token exchange failed with HTTP ${response.status}.`);
  const body = (await response.json()) as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string };
  await writeTokenFile({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Date.now() + (body.expires_in ?? 3600) * 1000,
    scope: body.scope,
    token_type: body.token_type
  });
}

async function accessToken() {
  const token = await readTokenFile();
  if (!token) throw new Error("Gmail OAuth token is missing. Connect Gmail first.");
  if (token.expires_at > Date.now() + 60_000) return token.access_token;
  if (!token.refresh_token) throw new Error("Gmail token is expired and no refresh token is available. Connect Gmail again.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: gmailClientId()!,
      client_secret: gmailClientSecret()!,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) throw new Error(`Google OAuth refresh failed with HTTP ${response.status}.`);
  const body = (await response.json()) as { access_token: string; expires_in?: number; scope?: string; token_type?: string };
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

function decodeBody(data?: string): string {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function plainText(payload: GmailMessageResponse["payload"]): string {
  if (!payload) return "";
  const own = payload.mimeType?.includes("text/plain") ? decodeBody(payload.body?.data) : "";
  const child = (payload.parts ?? []).map(plainText).join("\n");
  return `${own}\n${child}`.trim();
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
  const body = plainText(message.payload).slice(0, 1800);
  const snippet = message.snippet ?? "";
  const text = [`Subject: ${subject}`, `From: ${from}`, date ? `Date: ${date}` : "", snippet, body].filter(Boolean).join("\n").slice(0, 2400);
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

export async function syncGmailRecruitingMail(limit = 10): Promise<GmailSyncResult> {
  const token = await accessToken();
  const query = process.env.CAREEROS_GMAIL_QUERY?.trim() || 'newer_than:90d (recruiter OR application OR assessment OR interview OR "next steps" OR offer OR OA)';
  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("maxResults", String(limit));
  listUrl.searchParams.set("q", query);
  const listResponse = await fetch(listUrl, { headers: { authorization: `Bearer ${token}` } });
  if (!listResponse.ok) throw new Error(`Gmail message search failed with HTTP ${listResponse.status}.`);
  const list = (await listResponse.json()) as GmailListResponse;
  const messages = await Promise.all(
    (list.messages ?? []).map(async (item) => {
      const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}`);
      url.searchParams.set("format", "full");
      const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Gmail message fetch failed with HTTP ${response.status}.`);
      return (await response.json()) as GmailMessageResponse;
    })
  );
  const records = messages.map(toImportRecord);
  const threads = messages.map((message, index): MailboxThread => {
    const subject = header(message, "Subject") || records[index].company;
    const from = header(message, "From") || "unknown sender";
    return {
      id: stableId("thread", ["gmail", message.threadId]),
      source: "gmail",
      subject,
      companyHint: records[index].company,
      roleHint: records[index].role,
      messages: [
        {
          id: message.id,
          threadId: stableId("thread", ["gmail", message.threadId]),
          fromLabel: from.slice(0, 120),
          subject,
          snippet: records[index].text.slice(0, 360),
          receivedAt: records[index].receivedAt ?? nowIso(),
          sourceLabel: records[index].sourceLabel
        }
      ],
      createdAt: records[index].receivedAt ?? nowIso()
    };
  });
  return {
    records,
    threads,
    account: tokenAccount("connected", `Synced ${records.length} recent recruiting message${records.length === 1 ? "" : "s"} from Gmail into the local pipeline.`)
  };
}
