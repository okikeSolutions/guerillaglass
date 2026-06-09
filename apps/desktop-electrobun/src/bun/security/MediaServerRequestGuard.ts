import type { HttpServerRequest } from "effect/unstable/http/HttpServerRequest";

type MediaServerRequestGuardResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly status: 403 | 400; readonly body: string };

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function hostHeaderHostname(hostHeader: string): string {
  if (hostHeader.startsWith("[")) {
    const closingBracketIndex = hostHeader.indexOf("]");
    return closingBracketIndex === -1 ? "" : hostHeader.slice(1, closingBracketIndex);
  }
  return hostHeader.split(":")[0] ?? "";
}

function requestUsesLoopbackHost(request: HttpServerRequest): boolean {
  try {
    const url = new URL(request.originalUrl);
    return isLoopbackHost(url.hostname);
  } catch {
    const hostHeader = request.headers.host;
    if (!hostHeader) {
      return true;
    }
    return isLoopbackHost(hostHeaderHostname(hostHeader));
  }
}

function originIsAllowed(origin: string | undefined): boolean {
  if (!origin || origin === "null") {
    return true;
  }
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

function secFetchSiteIsAllowed(value: string | undefined): boolean {
  return !value || value === "same-origin" || value === "same-site" || value === "none";
}

/** Validates loopback media-server request metadata before token lookup or file serving. */
export function guardMediaServerRequest(request: HttpServerRequest): MediaServerRequestGuardResult {
  if (!requestUsesLoopbackHost(request)) {
    return { allowed: false, status: 403, body: "Forbidden" };
  }
  if (!originIsAllowed(request.headers.origin)) {
    return { allowed: false, status: 403, body: "Forbidden" };
  }
  if (!secFetchSiteIsAllowed(request.headers["sec-fetch-site"])) {
    return { allowed: false, status: 403, body: "Forbidden" };
  }
  return { allowed: true };
}
