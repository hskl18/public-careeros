export interface GmailListMessage {
  id: string;
  threadId: string;
}

export interface GmailListResponse {
  messages?: GmailListMessage[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface GmailMessageResponse {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
  };
}

export type GmailAdapterErrorCode =
  | "rate_limited"
  | "provider_unavailable"
  | "malformed_response"
  | "reconnect_required";

export class GmailAdapterError extends Error {
  constructor(
    readonly code: GmailAdapterErrorCode,
    readonly retryAfterSeconds?: number
  ) {
    super(`Gmail adapter request failed: ${code}.`);
    this.name = "GmailAdapterError";
  }
}

export interface GmailAdapter {
  listMessages(input: {
    accessToken: string;
    query: string;
    maxResults: number;
    pageToken?: string;
  }): Promise<GmailListResponse>;
  getMessage(input: { accessToken: string; messageId: string }): Promise<GmailMessageResponse>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseListResponse(value: unknown): GmailListResponse {
  if (!isRecord(value)) throw new GmailAdapterError("malformed_response");
  if (value.messages !== undefined && !Array.isArray(value.messages)) {
    throw new GmailAdapterError("malformed_response");
  }
  const messages = (value.messages ?? []).map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.threadId !== "string") {
      throw new GmailAdapterError("malformed_response");
    }
    return { id: item.id, threadId: item.threadId };
  });
  if (value.nextPageToken !== undefined && typeof value.nextPageToken !== "string") {
    throw new GmailAdapterError("malformed_response");
  }
  if (value.resultSizeEstimate !== undefined && typeof value.resultSizeEstimate !== "number") {
    throw new GmailAdapterError("malformed_response");
  }
  return {
    messages,
    nextPageToken: value.nextPageToken,
    resultSizeEstimate: value.resultSizeEstimate
  };
}

function parseMessageResponse(value: unknown): GmailMessageResponse {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.threadId !== "string") {
    throw new GmailAdapterError("malformed_response");
  }
  const payload = value.payload;
  if (payload !== undefined && !isRecord(payload)) throw new GmailAdapterError("malformed_response");
  const headers = payload?.headers;
  if (headers !== undefined && !Array.isArray(headers)) throw new GmailAdapterError("malformed_response");
  if (
    Array.isArray(headers) &&
    headers.some(
      (item) =>
        !isRecord(item) ||
        (item.name !== undefined && typeof item.name !== "string") ||
        (item.value !== undefined && typeof item.value !== "string")
    )
  ) {
    throw new GmailAdapterError("malformed_response");
  }
  return {
    id: value.id,
    threadId: value.threadId,
    snippet: typeof value.snippet === "string" ? value.snippet : undefined,
    internalDate: typeof value.internalDate === "string" ? value.internalDate : undefined,
    payload: Array.isArray(headers)
      ? { headers: headers.map((item) => ({ name: item.name as string | undefined, value: item.value as string | undefined })) }
      : undefined
  };
}

function configuredApiBaseUrl() {
  const candidate = process.env.CAREEROS_GMAIL_API_BASE_URL?.trim();
  if (!candidate) return "https://gmail.googleapis.com/gmail/v1";
  const url = new URL(candidate);
  const fakeMode = process.env.CAREEROS_GMAIL_FAKE_MODE === "true";
  if (!fakeMode || !["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("Custom Gmail API endpoints require fake mode and a loopback URL.");
  }
  return url.toString().replace(/\/$/, "");
}

async function providerJson(response: Response) {
  if (response.status === 401 || response.status === 403) throw new GmailAdapterError("reconnect_required");
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new GmailAdapterError("rate_limited", Number.isFinite(retryAfter) ? retryAfter : undefined);
  }
  if (!response.ok) throw new GmailAdapterError("provider_unavailable");
  try {
    return await response.json();
  } catch {
    throw new GmailAdapterError("malformed_response");
  }
}

export class FetchGmailAdapter implements GmailAdapter {
  async listMessages(input: {
    accessToken: string;
    query: string;
    maxResults: number;
    pageToken?: string;
  }): Promise<GmailListResponse> {
    const url = new URL(`${configuredApiBaseUrl()}/users/me/messages`);
    url.searchParams.set("maxResults", String(input.maxResults));
    url.searchParams.set("q", input.query);
    if (input.pageToken) url.searchParams.set("pageToken", input.pageToken);
    const response = await fetch(url, { headers: { authorization: `Bearer ${input.accessToken}` } });
    return parseListResponse(await providerJson(response));
  }

  async getMessage(input: { accessToken: string; messageId: string }): Promise<GmailMessageResponse> {
    const url = new URL(`${configuredApiBaseUrl()}/users/me/messages/${encodeURIComponent(input.messageId)}`);
    url.searchParams.set("format", "metadata");
    url.searchParams.append("metadataHeaders", "Subject");
    url.searchParams.append("metadataHeaders", "From");
    url.searchParams.append("metadataHeaders", "Date");
    const response = await fetch(url, { headers: { authorization: `Bearer ${input.accessToken}` } });
    return parseMessageResponse(await providerJson(response));
  }
}
