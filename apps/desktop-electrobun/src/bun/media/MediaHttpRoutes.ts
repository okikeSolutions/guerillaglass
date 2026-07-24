import { Buffer } from "node:buffer";
import { Effect, FileSystem, Layer, Option, Path } from "effect";
import {
  HttpPlatform,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import type { CapturePreviewFrameResult } from "@guerillaglass/engine-contract/domains/capture";
import { messageFromUnknownError } from "@guerillaglass/engine-client/errors";
import { MediaServerError } from "../../shared/errors/desktopErrors";
import { AppConfig } from "../app/AppConfig";
import { guardMediaServerRequest } from "../security/MediaServerRequestGuard";
import { mediaTypeForPath } from "./policy";
import { MediaRegistry, type MediaTokenEntry, type PreviewTokenEntry } from "./MediaRegistry";

const maxTokenPathSegmentLength = 160;
const mediaRoutePrefix = "/media/";
const livePreviewMimeType = "image/jpeg";
const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ByteRange = {
  start: number;
  end: number;
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
  return { start, end: Math.min(end, size - 1) };
}

function mediaSecurityHeaders(): Record<string, string> {
  return {
    "cache-control": "no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  };
}

function textResponse(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): HttpServerResponse.HttpServerResponse {
  return HttpServerResponse.text(body, {
    status,
    headers: {
      ...mediaSecurityHeaders(),
      ...headers,
    },
  });
}

function mediaHeaders(path: Path.Path, filePath: string): Record<string, string> {
  return {
    ...mediaSecurityHeaders(),
    "accept-ranges": "bytes",
    "content-type": mediaTypeForPath(path, filePath),
  };
}

function previewHeaders(contentLength: number): Record<string, string> {
  return {
    ...mediaSecurityHeaders(),
    "content-type": livePreviewMimeType,
    "content-length": String(contentLength),
  };
}

function decodePreviewFrame(frame: NonNullable<CapturePreviewFrameResult["frame"]>): Uint8Array {
  return Uint8Array.from(Buffer.from(frame.bytesBase64, "base64"));
}

function logDebugEffect(message: string): Effect.Effect<void> {
  return Effect.gen(function* () {
    const config = yield* Effect.serviceOption(AppConfig);
    if (Option.isSome(config) && config.value.mediaServerDebugLoggingEnabled) {
      yield* Effect.logInfo(message);
    }
  });
}

function logDebugWarningEffect(message: string): Effect.Effect<void> {
  return Effect.gen(function* () {
    const config = yield* Effect.serviceOption(AppConfig);
    if (Option.isSome(config) && config.value.mediaServerDebugLoggingEnabled) {
      yield* Effect.logWarning(message);
    }
  });
}

function validateToken(rawToken: string): string | null {
  if (rawToken.length === 0 || rawToken.length > maxTokenPathSegmentLength) {
    return null;
  }
  let token: string;
  try {
    token = decodeURIComponent(rawToken);
  } catch {
    return null;
  }
  return tokenPattern.test(token) ? token : null;
}

function handlePreviewRequest(
  token: string,
  entry: PreviewTokenEntry,
): Effect.Effect<HttpServerResponse.HttpServerResponse, MediaServerError, MediaRegistry> {
  return Effect.gen(function* () {
    const registry = yield* MediaRegistry;
    const frame = yield* entry.loadPreviewFrame.pipe(
      Effect.mapError(
        (cause) =>
          new MediaServerError({
            code: "MEDIA_SERVER_BIND_FAILED",
            description: messageFromUnknownError(cause, "Unable to read live capture preview."),
            cause,
          }),
      ),
    );

    const previewFrame = frame.frame;
    if (!previewFrame) {
      if (entry.cachedJPEGBytes) {
        yield* logDebugEffect(
          `Live preview served cached frame (${token.slice(0, 8)}...) frame=${entry.cachedFrameId ?? 0}`,
        );
        return HttpServerResponse.uint8Array(entry.cachedJPEGBytes, {
          status: 200,
          headers: previewHeaders(entry.cachedJPEGBytes.byteLength),
        });
      }

      yield* logDebugWarningEffect(`Live preview frame unavailable (${token.slice(0, 8)}...)`);
      return textResponse(404, "Not found");
    }

    const jpegBytes = decodePreviewFrame(previewFrame);
    yield* registry.updatePreviewCache(token, previewFrame.frameId, jpegBytes);
    yield* logDebugEffect(
      `Live preview served 200 (${token.slice(0, 8)}...) frame=${previewFrame.frameId}`,
    );

    return HttpServerResponse.uint8Array(jpegBytes, {
      status: 200,
      headers: previewHeaders(jpegBytes.byteLength),
    });
  });
}

function handleFileRequest(
  request: HttpServerRequest.HttpServerRequest,
  token: string,
  entry: MediaTokenEntry,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  MediaServerError,
  FileSystem.FileSystem | HttpPlatform.HttpPlatform | Path.Path
> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const info = yield* fs.stat(entry.filePath).pipe(
      Effect.mapError(
        (cause) =>
          new MediaServerError({
            code: "MEDIA_FILE_MISSING",
            description: messageFromUnknownError(cause, "Media file not found."),
            cause,
          }),
      ),
    );
    if (info.type !== "File") {
      yield* logDebugWarningEffect(`Media file missing: ${entry.filePath}`);
      return textResponse(404, "Not found");
    }

    const size = Number(info.size);
    const commonHeaders = mediaHeaders(path, entry.filePath);
    const rangeHeader = request.headers.range;

    if (!rangeHeader) {
      yield* logDebugEffect(`Media served 200 (${token.slice(0, 8)}...) full file`);
      return yield* HttpServerResponse.file(entry.filePath, {
        status: 200,
        headers: commonHeaders,
      }).pipe(
        Effect.mapError(
          (cause) =>
            new MediaServerError({
              code: "MEDIA_FILE_MISSING",
              description: messageFromUnknownError(cause, "Media file not found."),
              cause,
            }),
        ),
      );
    }

    const isMultiRangeRequest = rangeHeader.includes(",");
    const parsedRange = parseByteRange(rangeHeader, size);
    if (!parsedRange) {
      yield* logDebugWarningEffect(
        `Media invalid range 416 (${token.slice(0, 8)}...) range="${rangeHeader}"`,
      );
      return textResponse(416, "Requested Range Not Satisfiable", {
        "accept-ranges": "bytes",
        "content-range": `bytes */${size}`,
      });
    }

    const { start, end } = parsedRange;
    const chunkSize = end - start + 1;
    if (isMultiRangeRequest) {
      yield* logDebugEffect(
        `Media multi-range served first segment 206 (${token.slice(0, 8)}...) range="${rangeHeader}"`,
      );
    }

    return yield* HttpServerResponse.file(entry.filePath, {
      status: 206,
      offset: start,
      bytesToRead: chunkSize,
      headers: {
        ...commonHeaders,
        "content-range": `bytes ${start}-${end}/${size}`,
      },
    }).pipe(
      Effect.mapError(
        (cause) =>
          new MediaServerError({
            code: "MEDIA_FILE_MISSING",
            description: messageFromUnknownError(cause, "Media file not found."),
            cause,
          }),
      ),
    );
  });
}

function statusForMediaError(error: MediaServerError): number {
  switch (error.code) {
    case "MEDIA_FILE_MISSING":
      return 404;
    case "MEDIA_PATH_REQUIRED":
    case "MEDIA_PATH_NOT_ABSOLUTE":
    case "MEDIA_TYPE_UNSUPPORTED":
      return 400;
    case "MEDIA_SERVER_BIND_FAILED":
    case "MEDIA_SERVER_PORT_RESERVATION_FAILED":
      return 500;
  }
}

const mediaRouteHandler = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return textResponse(405, "Method not allowed", { allow: "GET, HEAD" });
  }

  const guardResult = guardMediaServerRequest(request);
  if (!guardResult.allowed) {
    return textResponse(guardResult.status, guardResult.body);
  }

  const requestPath = request.url.split(/[?#]/u, 1)[0] ?? "";
  if (!requestPath.startsWith(mediaRoutePrefix)) {
    return textResponse(404, "Not found");
  }

  const rawToken = requestPath.slice(mediaRoutePrefix.length);
  const token = validateToken(rawToken);
  if (!token) {
    yield* logDebugEffect(`Media server rejected path: ${request.method} ${request.url}`);
    return textResponse(rawToken.length > maxTokenPathSegmentLength ? 400 : 404, "Not found");
  }

  const registry = yield* MediaRegistry;
  const entryOption = yield* registry.resolveToken(token);
  if (Option.isNone(entryOption)) {
    yield* logDebugWarningEffect(`Media token not found (${token.slice(0, 8)}...)`);
    return textResponse(404, "Not found");
  }

  const entry = entryOption.value;
  if (entry.kind === "capturePreview") {
    return yield* handlePreviewRequest(token, entry);
  }
  return yield* handleFileRequest(request, token, entry);
}).pipe(
  Effect.catch((error) => {
    const status = error instanceof MediaServerError ? statusForMediaError(error) : 500;
    const body =
      status === 404 ? "Not found" : status === 400 ? "Bad request" : "Internal server error";
    return Effect.logWarning("Media server request failed", error).pipe(
      Effect.andThen(Effect.succeed(textResponse(status, body))),
    );
  }),
);

export const layerMediaHttpRoutes = Layer.mergeAll(
  HttpRouter.add("*", "/media/*", mediaRouteHandler),
  HttpRouter.add("GET", "/health", HttpServerResponse.text("ok", { status: 200 })),
);
