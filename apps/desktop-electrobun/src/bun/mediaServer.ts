import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import path from "node:path";
import { isSupportedMediaPath, mediaTypeForPath } from "./mediaPolicy";

const mediaTokenAbsoluteTtlMs = 5 * 60 * 1000;
const mediaTokenIdleTtlMs = 60 * 1000;
const maxMediaTokens = 512;
const maxTokenPathSegmentLength = 160;
const mediaSessionCookieName = "gg_media_session";
const mediaSessionCookieMaxAgeSeconds = Math.max(1, Math.floor(mediaTokenAbsoluteTtlMs / 1000));
const mediaServerPortFloor = 49_152;
const mediaServerPortCeiling = 65_535;
const mediaServerMaxBindAttempts = 10;
const mediaRoutePrefix = "/media/";

const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ByteRange = {
  start: number;
  end: number;
};

type MediaTokenEntry = {
  filePath: string;
  createdAt: number;
  lastAccessedAt: number;
  sessionCookieValue: string | null;
};

type TokenPathResult = { token: string; response: null } | { token: null; response: Response };

type SessionAuthResult =
  | { setCookieHeader: string | null; response: null }
  | { setCookieHeader: null; response: Response };

function parseByteRange(rangeHeader: string, size: number): ByteRange | null {
  if (rangeHeader.includes(",")) {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const rawStart = match[1] ?? "";
  const rawEnd = match[2] ?? "";
  if (rawStart.length === 0 && rawEnd.length === 0) {
    return null;
  }

  if (rawStart.length === 0) {
    const suffixLength = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }
    const start = Math.max(size - suffixLength, 0);
    const end = size - 1;
    return start <= end ? { start, end } : null;
  }

  const start = Number.parseInt(rawStart, 10);
  const end = rawEnd.length > 0 ? Number.parseInt(rawEnd, 10) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
    return null;
  }
  if (start >= size) {
    return null;
  }
  return {
    start,
    end: Math.min(end, size - 1),
  };
}

function isAddressInUse(error: unknown): boolean {
  const typedError = error as { code?: string; message?: string };
  if (typedError?.code === "EADDRINUSE") {
    return true;
  }
  return (
    typeof typedError?.message === "string" &&
    typedError.message.toUpperCase().includes("EADDRINUSE")
  );
}

function isUnsupportedPortZeroError(error: unknown): boolean {
  const typedError = error as { code?: string; message?: string };
  if (typedError?.code === "EINVAL") {
    return true;
  }
  return typeof typedError?.message === "string" && typedError.message.includes("port 0");
}

function randomLoopbackPort(): number {
  const span = mediaServerPortCeiling - mediaServerPortFloor + 1;
  return mediaServerPortFloor + Math.floor(Math.random() * span);
}

async function reserveLoopbackPort(host: string): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen({ host, port: 0 }, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to reserve loopback media server port.")));
        return;
      }
      const { port } = address;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function mediaSecurityHeaders(): Record<string, string> {
  return {
    "cache-control": "no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  };
}

function cookieValue(cookieHeader: string | null, key: string): string | null {
  if (!cookieHeader) {
    return null;
  }
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [name, ...rawValueParts] = cookie.trim().split("=");
    if (name !== key) {
      continue;
    }
    const rawValue = rawValueParts.join("=");
    if (!rawValue) {
      return null;
    }
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }
  return null;
}

function mediaSessionCookieHeader(value: string): string {
  return `${mediaSessionCookieName}=${encodeURIComponent(value)}; Path=/media; HttpOnly; SameSite=Strict; Max-Age=${mediaSessionCookieMaxAgeSeconds}`;
}

export class MediaServer {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private origin: string | null = null;
  private readonly tokens = new Map<string, MediaTokenEntry>();

  private response(status: number, body: string, headers: Record<string, string> = {}): Response {
    return new Response(body, {
      status,
      headers: {
        ...mediaSecurityHeaders(),
        ...headers,
      },
    });
  }

  private isTokenExpired(entry: MediaTokenEntry, now: number): boolean {
    return (
      now - entry.createdAt > mediaTokenAbsoluteTtlMs ||
      now - entry.lastAccessedAt > mediaTokenIdleTtlMs
    );
  }

  private handleServerError(error: Error): Response {
    console.warn(`Media server request failed (${error.name})`);
    return this.response(500, "Internal server error");
  }

  private startServer(host: string, port: number): ReturnType<typeof Bun.serve> {
    return Bun.serve({
      hostname: host,
      port,
      fetch: (request) => this.handleRequest(request),
      error: (error) => this.handleServerError(error),
    });
  }

  private async ensureServer(): Promise<void> {
    if (this.server && this.origin) {
      return;
    }

    const host = "127.0.0.1";
    let lastError: unknown;

    try {
      this.server = this.startServer(host, 0);
      this.origin = `http://${host}:${this.server.port}`;
      return;
    } catch (error) {
      lastError = error;
      if (!isUnsupportedPortZeroError(error) && !isAddressInUse(error)) {
        throw error;
      }
    }

    for (let attempt = 0; attempt < mediaServerMaxBindAttempts; attempt += 1) {
      let port: number;
      try {
        port = await reserveLoopbackPort(host);
      } catch {
        port = randomLoopbackPort();
      }
      try {
        this.server = this.startServer(host, port);
        this.origin = `http://${host}:${this.server.port}`;
        return;
      } catch (error) {
        lastError = error;
        if (!isAddressInUse(error)) {
          throw error;
        }
      }
    }

    throw lastError ?? new Error("Unable to bind media playback server.");
  }

  private pruneTokens(): void {
    const now = Date.now();
    for (const [token, entry] of this.tokens) {
      if (this.isTokenExpired(entry, now)) {
        this.tokens.delete(token);
      }
    }
    while (this.tokens.size > maxMediaTokens) {
      const firstToken = this.tokens.keys().next().value;
      if (!firstToken) {
        break;
      }
      this.tokens.delete(firstToken);
    }
  }

  private tokenFromPath(pathname: string): TokenPathResult {
    if (!pathname.startsWith(mediaRoutePrefix)) {
      return { token: null, response: this.response(404, "Not found") };
    }

    const encodedToken = pathname.slice(mediaRoutePrefix.length);
    if (encodedToken.length === 0 || encodedToken.length > maxTokenPathSegmentLength) {
      return { token: null, response: this.response(400, "Bad request") };
    }

    let token: string;
    try {
      token = decodeURIComponent(encodedToken);
    } catch {
      return { token: null, response: this.response(400, "Bad request") };
    }

    if (!tokenPattern.test(token)) {
      return { token: null, response: this.response(404, "Not found") };
    }

    return { token, response: null };
  }

  private authorizeSession(entry: MediaTokenEntry, request: Request): SessionAuthResult {
    const requestSessionCookie = cookieValue(request.headers.get("cookie"), mediaSessionCookieName);
    if (entry.sessionCookieValue) {
      if (requestSessionCookie !== entry.sessionCookieValue) {
        return { setCookieHeader: null, response: this.response(404, "Not found") };
      }
      return { setCookieHeader: null, response: null };
    }

    entry.sessionCookieValue = randomUUID();
    return {
      setCookieHeader: mediaSessionCookieHeader(entry.sessionCookieValue),
      response: null,
    };
  }

  private mediaHeaders(filePath: string, setCookieHeader: string | null): Record<string, string> {
    const headers: Record<string, string> = {
      ...mediaSecurityHeaders(),
      "accept-ranges": "bytes",
      "content-type": mediaTypeForPath(filePath),
    };
    if (setCookieHeader) {
      headers["set-cookie"] = setCookieHeader;
    }
    return headers;
  }

  private async handleRequest(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return this.response(405, "Method not allowed", { allow: "GET, HEAD" });
    }

    const url = new URL(request.url);
    if (!isLoopbackHost(url.hostname)) {
      return this.response(403, "Forbidden");
    }

    const { token, response: tokenResponse } = this.tokenFromPath(url.pathname);
    if (tokenResponse) {
      return tokenResponse;
    }
    if (!token) {
      return this.response(400, "Bad request");
    }

    this.pruneTokens();
    const entry = this.tokens.get(token);
    if (!entry) {
      return this.response(404, "Not found");
    }

    const now = Date.now();
    if (this.isTokenExpired(entry, now)) {
      this.tokens.delete(token);
      return this.response(404, "Not found");
    }

    const file = Bun.file(entry.filePath);
    if (!(await file.exists())) {
      return this.response(404, "Not found");
    }

    const { setCookieHeader, response: sessionResponse } = this.authorizeSession(entry, request);
    if (sessionResponse) {
      return sessionResponse;
    }

    entry.lastAccessedAt = now;
    const size = file.size;
    const commonHeaders = this.mediaHeaders(entry.filePath, setCookieHeader);

    const rangeHeader = request.headers.get("range");
    if (!rangeHeader) {
      return new Response(request.method === "HEAD" ? null : file, {
        status: 200,
        headers: {
          ...commonHeaders,
          "content-length": String(size),
        },
      });
    }

    const parsedRange = parseByteRange(rangeHeader, size);
    if (!parsedRange) {
      return this.response(416, "Requested Range Not Satisfiable", {
        ...(setCookieHeader ? { "set-cookie": setCookieHeader } : {}),
        "accept-ranges": "bytes",
        "content-range": `bytes */${size}`,
      });
    }

    const { start, end } = parsedRange;
    const chunkSize = end - start + 1;
    const chunk = file.slice(start, end + 1);

    return new Response(request.method === "HEAD" ? null : chunk, {
      status: 206,
      headers: {
        ...commonHeaders,
        "content-length": String(chunkSize),
        "content-range": `bytes ${start}-${end}/${size}`,
      },
    });
  }

  async resolveMediaSourceURL(filePath: string): Promise<string> {
    if (typeof filePath !== "string" || filePath.trim().length === 0) {
      throw new Error("A media file path is required.");
    }

    const trimmedPath = filePath.trim();
    if (!path.isAbsolute(trimmedPath)) {
      throw new Error("Media source path must be an absolute local file path.");
    }
    const normalizedPath = path.resolve(trimmedPath);
    if (!isSupportedMediaPath(normalizedPath)) {
      throw new Error("Unsupported media file format.");
    }

    const mediaFile = Bun.file(normalizedPath);
    if (!(await mediaFile.exists())) {
      throw new Error("Media file not found.");
    }

    await this.ensureServer();
    this.pruneTokens();

    const token = randomUUID();
    this.tokens.set(token, {
      filePath: normalizedPath,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      sessionCookieValue: null,
    });

    return `${this.origin}/media/${encodeURIComponent(token)}`;
  }

  stop(): void {
    this.server?.stop();
    this.server = null;
    this.origin = null;
    this.tokens.clear();
  }
}
