import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import path from "node:path";
import { Effect } from "effect";
import {
  MediaServerError,
  messageFromUnknownError,
  runEffectPromise,
  runEffectSync,
} from "@shared/errors";
import { isSupportedMediaPath, mediaTypeForPath } from "./policy";

const mediaTokenAbsoluteTtlMs = 5 * 60 * 1000;
const mediaTokenIdleTtlMs = 60 * 1000;
const maxMediaTokens = 512;
const maxTokenPathSegmentLength = 160;
const mediaServerPortFloor = 49_152;
const mediaServerPortCeiling = 65_535;
const mediaServerMaxBindAttempts = 10;
const mediaRoutePrefix = "/media/";
const mediaServerDebugLoggingEnabled = process.env.GG_MEDIA_SERVER_DEBUG === "1";

const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ByteRange = {
  start: number;
  end: number;
};

type MediaTokenEntry = {
  filePath: string;
  createdAt: number;
  lastAccessedAt: number;
};

type TokenPathResult = { token: string; response: null } | { token: null; response: Response };
type StartedMediaServer = {
  server: ReturnType<typeof Bun.serve>;
  origin: string;
};

function parseByteRange(rangeHeader: string, size: number): ByteRange | null {
  const trimmedRangeHeader = rangeHeader.trim();
  const firstRangeHeader = trimmedRangeHeader.includes(",")
    ? `${trimmedRangeHeader.split(",")[0]?.trim() ?? ""}`
    : trimmedRangeHeader;
  const match = /^bytes=(\d*)-(\d*)$/.exec(firstRangeHeader);
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

function normalizeMediaBindError(error: unknown): MediaServerError {
  if (error instanceof MediaServerError) {
    return error;
  }
  return new MediaServerError({
    code: "MEDIA_SERVER_BIND_FAILED",
    description: messageFromUnknownError(error, "Unable to bind media playback server."),
    cause: error,
  });
}

function reserveLoopbackPortEffect(host: string): Effect.Effect<number, MediaServerError> {
  return Effect.tryPromise({
    try: () =>
      new Promise<number>((resolve, reject) => {
        const server = createServer();
        server.once("error", (cause) =>
          reject(
            new MediaServerError({
              code: "MEDIA_SERVER_PORT_RESERVATION_FAILED",
              description: "Unable to reserve loopback media server port.",
              cause,
            }),
          ),
        );
        server.listen({ host, port: 0 }, () => {
          const address = server.address();
          if (!address || typeof address === "string") {
            server.close(() =>
              reject(
                new MediaServerError({
                  code: "MEDIA_SERVER_PORT_RESERVATION_FAILED",
                  description: "Unable to reserve loopback media server port.",
                }),
              ),
            );
            return;
          }
          const { port } = address;
          server.close((closeError) => {
            if (closeError) {
              reject(
                new MediaServerError({
                  code: "MEDIA_SERVER_PORT_RESERVATION_FAILED",
                  description: "Unable to reserve loopback media server port.",
                  cause: closeError,
                }),
              );
              return;
            }
            resolve(port);
          });
        });
      }),
    catch: (cause) =>
      cause instanceof MediaServerError
        ? cause
        : new MediaServerError({
            code: "MEDIA_SERVER_PORT_RESERVATION_FAILED",
            description: "Unable to reserve loopback media server port.",
            cause,
          }),
  });
}

/** Loopback-only media server that mints temporary file-backed playback URLs. */
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

  private startServerEffect(
    host: string,
    port: number,
  ): Effect.Effect<StartedMediaServer, unknown> {
    return Effect.try({
      try: () => {
        const server = this.startServer(host, port);
        return {
          server,
          origin: `http://${host}:${server.port}`,
        };
      },
      catch: (cause) => cause,
    });
  }

  private bindReservedServerEffect(host: string): Effect.Effect<StartedMediaServer, unknown> {
    return Effect.catchAll(reserveLoopbackPortEffect(host), () => Effect.sync(randomLoopbackPort))
      .pipe(Effect.flatMap((port) => this.startServerEffect(host, port)))
      .pipe(
        Effect.retry({
          times: mediaServerMaxBindAttempts - 1,
          while: (error) => isAddressInUse(error),
        }),
      );
  }

  private ensureServerEffect(): Effect.Effect<void, MediaServerError> {
    return Effect.suspend(() => {
      if (this.server && this.origin) {
        return Effect.void;
      }

      const host = "127.0.0.1";
      return Effect.catchAll(this.startServerEffect(host, 0), (error) => {
        if (!isUnsupportedPortZeroError(error) && !isAddressInUse(error)) {
          return Effect.fail(error);
        }
        return this.bindReservedServerEffect(host);
      }).pipe(
        Effect.mapError(normalizeMediaBindError),
        Effect.tap((started) =>
          Effect.sync(() => {
            this.server = started.server;
            this.origin = started.origin;
          }),
        ),
        Effect.asVoid,
      );
    });
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

  private mediaHeaders(filePath: string): Record<string, string> {
    return {
      ...mediaSecurityHeaders(),
      "accept-ranges": "bytes",
      "content-type": mediaTypeForPath(filePath),
    };
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
      if (mediaServerDebugLoggingEnabled) {
        console.info(`Media server rejected path: ${request.method} ${url.pathname}`);
      }
      return tokenResponse;
    }
    if (!token) {
      return this.response(400, "Bad request");
    }

    this.pruneTokens();
    const entry = this.tokens.get(token);
    if (!entry) {
      if (mediaServerDebugLoggingEnabled) {
        console.warn(`Media token not found (${token.slice(0, 8)}...)`);
      }
      return this.response(404, "Not found");
    }

    const now = Date.now();
    if (this.isTokenExpired(entry, now)) {
      this.tokens.delete(token);
      if (mediaServerDebugLoggingEnabled) {
        console.warn(`Media token expired (${token.slice(0, 8)}...)`);
      }
      return this.response(404, "Not found");
    }

    const file = Bun.file(entry.filePath);
    if (!(await file.exists())) {
      if (mediaServerDebugLoggingEnabled) {
        console.warn(`Media file missing: ${entry.filePath}`);
      }
      return this.response(404, "Not found");
    }

    entry.lastAccessedAt = now;
    const size = file.size;
    const commonHeaders = this.mediaHeaders(entry.filePath);

    const rangeHeader = request.headers.get("range");
    if (!rangeHeader) {
      if (mediaServerDebugLoggingEnabled) {
        console.info(`Media served 200 (${token.slice(0, 8)}...) full file`);
      }
      return new Response(request.method === "HEAD" ? null : file, {
        status: 200,
        headers: {
          ...commonHeaders,
          "content-length": String(size),
        },
      });
    }

    const isMultiRangeRequest = rangeHeader.includes(",");
    const parsedRange = parseByteRange(rangeHeader, size);
    if (!parsedRange) {
      if (mediaServerDebugLoggingEnabled) {
        console.warn(`Media invalid range 416 (${token.slice(0, 8)}...) range="${rangeHeader}"`);
      }
      return this.response(416, "Requested Range Not Satisfiable", {
        "accept-ranges": "bytes",
        "content-range": `bytes */${size}`,
      });
    }

    const { start, end } = parsedRange;
    const chunkSize = end - start + 1;
    const chunk = file.slice(start, end + 1);

    if (mediaServerDebugLoggingEnabled && isMultiRangeRequest) {
      console.info(
        `Media multi-range served first segment 206 (${token.slice(0, 8)}...) range="${rangeHeader}"`,
      );
    }

    return new Response(request.method === "HEAD" ? null : chunk, {
      status: 206,
      headers: {
        ...commonHeaders,
        "content-length": String(chunkSize),
        "content-range": `bytes ${start}-${end}/${size}`,
      },
    });
  }

  private resolveMediaPathEffect(filePath: string): Effect.Effect<string, MediaServerError> {
    return Effect.gen(function* () {
      if (typeof filePath !== "string" || filePath.trim().length === 0) {
        return yield* Effect.fail(
          new MediaServerError({
            code: "MEDIA_PATH_REQUIRED",
            description: "A media file path is required.",
          }),
        );
      }

      const trimmedPath = filePath.trim();
      if (!path.isAbsolute(trimmedPath)) {
        return yield* Effect.fail(
          new MediaServerError({
            code: "MEDIA_PATH_NOT_ABSOLUTE",
            description: "Media source path must be an absolute local file path.",
          }),
        );
      }

      const normalizedPath = path.resolve(trimmedPath);
      if (!isSupportedMediaPath(normalizedPath)) {
        return yield* Effect.fail(
          new MediaServerError({
            code: "MEDIA_TYPE_UNSUPPORTED",
            description: "Unsupported media file format.",
          }),
        );
      }

      const mediaFile = Bun.file(normalizedPath);
      const exists = yield* Effect.tryPromise({
        try: () => mediaFile.exists(),
        catch: (cause) =>
          new MediaServerError({
            code: "MEDIA_FILE_MISSING",
            description: messageFromUnknownError(cause, "Media file not found."),
            cause,
          }),
      });
      if (!exists) {
        return yield* Effect.fail(
          new MediaServerError({
            code: "MEDIA_FILE_MISSING",
            description: "Media file not found.",
          }),
        );
      }

      return normalizedPath;
    });
  }

  private resolveMediaSourceURLEffect(filePath: string): Effect.Effect<string, MediaServerError> {
    return this.resolveMediaPathEffect(filePath).pipe(
      Effect.flatMap((normalizedPath) =>
        this.ensureServerEffect().pipe(
          Effect.flatMap(() =>
            Effect.try({
              try: () => {
                this.pruneTokens();
                const origin = this.origin;
                if (!origin) {
                  throw new MediaServerError({
                    code: "MEDIA_SERVER_BIND_FAILED",
                    description: "Unable to bind media playback server.",
                  });
                }

                const token = randomUUID();
                const now = Date.now();
                this.tokens.set(token, {
                  filePath: normalizedPath,
                  createdAt: now,
                  lastAccessedAt: now,
                });

                return `${origin}/media/${encodeURIComponent(token)}`;
              },
              catch: (cause) => normalizeMediaBindError(cause),
            }),
          ),
        ),
      ),
    );
  }

  async resolveMediaSourceURL(filePath: string): Promise<string> {
    return await runEffectPromise(this.resolveMediaSourceURLEffect(filePath));
  }

  private stopEffect(): Effect.Effect<void> {
    return Effect.sync(() => {
      this.server?.stop();
      this.server = null;
      this.origin = null;
      this.tokens.clear();
    });
  }

  stop(): void {
    runEffectSync(this.stopEffect());
  }
}
