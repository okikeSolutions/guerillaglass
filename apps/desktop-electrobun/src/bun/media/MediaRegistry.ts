import path from "node:path";
import { randomUUID } from "node:crypto";
import { Context, Effect, FileSystem, Layer, Option, Ref } from "effect";
import type { CapturePreviewFrameResult } from "@guerillaglass/engine-contract/domains/capture";
import { messageFromUnknownError } from "@guerillaglass/engine-client/errors";
import { MediaServerError } from "../../shared/errors/desktopErrors";
import { isSupportedMediaPath } from "./policy";

export const mediaTokenAbsoluteTtlMs = 5 * 60 * 1000;
export const mediaTokenIdleTtlMs = 60 * 1000;
export const maxMediaTokens = 512;

export type MediaTokenEntry = {
  readonly kind: "file";
  readonly filePath: string;
  readonly createdAt: number;
  readonly lastAccessedAt: number;
};

export type PreviewTokenEntry = {
  readonly kind: "capturePreview";
  readonly createdAt: number;
  readonly lastAccessedAt: number;
  readonly loadPreviewFrame: Effect.Effect<CapturePreviewFrameResult, unknown>;
  readonly cachedFrameId: number | null;
  readonly cachedJPEGBytes: Uint8Array | null;
};

export type TokenEntry = MediaTokenEntry | PreviewTokenEntry;

type MediaRegistryService = {
  readonly registerMediaFile: (
    filePath: string,
  ) => Effect.Effect<string, MediaServerError, FileSystem.FileSystem>;
  readonly registerCapturePreview: (
    loadPreviewFrame: Effect.Effect<CapturePreviewFrameResult, unknown>,
  ) => Effect.Effect<string>;
  readonly resolveToken: (token: string) => Effect.Effect<Option.Option<TokenEntry>>;
  readonly updatePreviewCache: (
    token: string,
    frameId: number,
    jpegBytes: Uint8Array,
  ) => Effect.Effect<void>;
};

export class MediaRegistry extends Context.Service<MediaRegistry, MediaRegistryService>()(
  "@guerillaglass/desktop/MediaRegistry",
) {}

function isTokenExpired(entry: TokenEntry, now: number): boolean {
  if (entry.kind === "capturePreview") {
    return now - entry.lastAccessedAt > mediaTokenIdleTtlMs;
  }
  return (
    now - entry.createdAt > mediaTokenAbsoluteTtlMs ||
    now - entry.lastAccessedAt > mediaTokenIdleTtlMs
  );
}

function pruneTokenMap(tokens: Map<string, TokenEntry>, now: number): Map<string, TokenEntry> {
  const next = new Map(tokens);
  for (const [token, entry] of next) {
    if (isTokenExpired(entry, now)) {
      next.delete(token);
    }
  }
  while (next.size > maxMediaTokens) {
    const firstToken = next.keys().next().value;
    if (!firstToken) break;
    next.delete(firstToken);
  }
  return next;
}

function normalizeMediaPath(
  filePath: string,
): Effect.Effect<string, MediaServerError, FileSystem.FileSystem> {
  return Effect.gen(function* () {
    if (typeof filePath !== "string" || filePath.trim().length === 0) {
      return yield* new MediaServerError({
        code: "MEDIA_PATH_REQUIRED",
        description: "A media file path is required.",
      });
    }

    const trimmedPath = filePath.trim();
    if (!path.isAbsolute(trimmedPath)) {
      return yield* new MediaServerError({
        code: "MEDIA_PATH_NOT_ABSOLUTE",
        description: "Media source path must be an absolute local file path.",
      });
    }

    const normalizedPath = path.resolve(trimmedPath);
    if (!isSupportedMediaPath(normalizedPath)) {
      return yield* new MediaServerError({
        code: "MEDIA_TYPE_UNSUPPORTED",
        description: "Unsupported media file format.",
      });
    }

    const fs = yield* FileSystem.FileSystem;
    const exists = yield* fs.exists(normalizedPath).pipe(
      Effect.mapError(
        (cause) =>
          new MediaServerError({
            code: "MEDIA_FILE_MISSING",
            description: messageFromUnknownError(cause, "Media file not found."),
            cause,
          }),
      ),
    );
    if (!exists) {
      return yield* new MediaServerError({
        code: "MEDIA_FILE_MISSING",
        description: "Media file not found.",
      });
    }

    return normalizedPath;
  });
}

export const makeMediaRegistryService: Effect.Effect<MediaRegistryService> = Effect.gen(
  function* () {
    const tokensRef = yield* Ref.make(new Map<string, TokenEntry>());

    const insertToken = (entry: TokenEntry) =>
      Effect.gen(function* () {
        const token = randomUUID();
        const now = Date.now();
        yield* Ref.update(tokensRef, (tokens) => {
          const next = pruneTokenMap(tokens, now);
          next.set(token, entry);
          return next;
        });
        return token;
      });

    return MediaRegistry.of({
      registerMediaFile: (filePath) =>
        normalizeMediaPath(filePath).pipe(
          Effect.flatMap((normalizedPath) => {
            const now = Date.now();
            return insertToken({
              kind: "file",
              filePath: normalizedPath,
              createdAt: now,
              lastAccessedAt: now,
            });
          }),
        ),

      registerCapturePreview: (loadPreviewFrame) => {
        const now = Date.now();
        return insertToken({
          kind: "capturePreview",
          createdAt: now,
          lastAccessedAt: now,
          loadPreviewFrame,
          cachedFrameId: null,
          cachedJPEGBytes: null,
        });
      },

      resolveToken: (token) =>
        Ref.modify(tokensRef, (tokens) => {
          const now = Date.now();
          const next = pruneTokenMap(tokens, now);
          const entry = next.get(token);
          if (!entry || isTokenExpired(entry, now)) {
            next.delete(token);
            return [Option.none<TokenEntry>(), next];
          }
          const refreshedEntry = { ...entry, lastAccessedAt: now } as TokenEntry;
          next.set(token, refreshedEntry);
          return [Option.some(refreshedEntry), next];
        }),

      updatePreviewCache: (token, frameId, jpegBytes) =>
        Ref.update(tokensRef, (tokens) => {
          const entry = tokens.get(token);
          if (!entry || entry.kind !== "capturePreview") return tokens;
          const next = new Map(tokens);
          next.set(token, {
            ...entry,
            cachedFrameId: frameId,
            cachedJPEGBytes: jpegBytes,
          });
          return next;
        }),
    });
  },
);

export const layerMediaRegistry = Layer.effect(MediaRegistry, makeMediaRegistryService);
