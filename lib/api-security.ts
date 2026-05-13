import { NextResponse } from "next/server";

const csrfMessage =
  "Request blocked. Local state-changing actions must come from the CareerOS app origin.";

export function isLocalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized)
  );
}

function hostFromRequest(request: Request) {
  const headerHost = request.headers.get("host");
  if (headerHost) return headerHost.toLowerCase();

  try {
    return new URL(request.url).host.toLowerCase();
  } catch {
    return undefined;
  }
}

export function rejectUnsafeLocalMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return undefined;

  try {
    const originUrl = new URL(origin);
    const requestHost = hostFromRequest(request);
    if (requestHost && originUrl.host.toLowerCase() === requestHost) {
      return undefined;
    }

    const requestUrl = new URL(request.url);
    if (isLocalHostname(originUrl.hostname) && isLocalHostname(requestUrl.hostname)) {
      return undefined;
    }
  } catch {
    return NextResponse.json({ error: csrfMessage }, { status: 403 });
  }

  return NextResponse.json({ error: csrfMessage }, { status: 403 });
}

export function isOllamaCloudEndpoint(endpoint: string) {
  try {
    const parsed = new URL(endpoint);
    return parsed.protocol === "https:" && parsed.hostname === "ollama.com";
  } catch {
    return false;
  }
}

export function isAllowedOllamaModelEndpoint(endpoint: string) {
  return isOllamaCloudEndpoint(endpoint);
}
