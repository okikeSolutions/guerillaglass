import {
  Clock,
  Context,
  Crypto,
  Effect,
  FileSystem,
  Layer,
  Option,
  Path,
  Ref,
  Schema,
} from "effect";
import type { CapturePreviewFrameResult } from "@guerillaglass/engine-contract/domains/capture";
import { messageFromUnknownError } from "@guerillaglass/engine-client/errors";
import { MediaServerError } from "../../shared/errors/desktopErrors";
import { isSupportedMediaPath } from "./policy";

export const mediaTokenAbsoluteTtlMs = 5 * 60 * 1000;
export const mediaTokenIdleTtlMs = 60 * 1000;
export const maxMediaTokens = 512;

/** File snapshot authorized for tokenized loopback playback. */
export const MediaTokenEntry = Schema.Struct({
  kind: Schema.Literal("file"),
  filePath: Schema.String,
  createdAt: Schema.Finite,
  lastAccessedAt: Schema.Finite,
});
/** Validated file-token state. */
export interface MediaTokenEntry extends Schema.Schema.Type<typeof MediaTokenEntry> {}

export type PreviewTokenEntry = {
  readonly kind: "capturePreview";
  readonly createdAt: number;
  readonly lastAccessedAt: number;
  readonly loadPreviewFrame: () => Effect.Effect<CapturePreviewFrameResult, unknown>;
  readonly cachedFrameId: number | null;
  readonly cachedJPEGBytes: Uint8Array | null;
};

export type TokenEntry = MediaTokenEntry | PreviewTokenEntry;

type MediaRegistryService = {
  readonly registerMediaFile: (
    filePath: string,
  ) => Effect.Effect<string, MediaServerError, FileSystem.FileSystem>;
  readonly registerCapturePreview: (
    loadPreviewFrame: () => Effect.Effect<CapturePreviewFrameResult, unknown>,
  ) => Effect.Effect<string, MediaServerError>;
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
    if (!firstToken) {
      break;
    }
    next.delete(firstToken);
  }
  return next;
}

const normalizeMediaPath = Effect.fn("MediaRegistry.normalizeMediaPath")(function (
  path: Path.Path,
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
    if (!isSupportedMediaPath(path, normalizedPath)) {
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
});

export const makeMediaRegistryService = Effect.gen(function* () {
  const crypto = yield* Crypto.Crypto;
  const path = yield* Path.Path;
  const tokensRef = yield* Ref.make(new Map<string, TokenEntry>());

  // This map is the authority for issued media leases. Missing tokens cannot be loaded,
  // and successful reads renew idle expiry without changing absolute expiry.
  const insertToken = Effect.fn("MediaRegistry.insertToken")(function* (entry: TokenEntry) {
    const token = yield* crypto.randomUUIDv4.pipe(
      Effect.mapError(
        (cause) =>
          new MediaServerError({
            code: "MEDIA_TOKEN_GENERATION_FAILED",
            description: messageFromUnknownError(cause, "Could not create a media access token."),
            cause,
          }),
      ),
    );
    const now = yield* Clock.currentTimeMillis;
    yield* Ref.update(tokensRef, (tokens) => {
      const next = pruneTokenMap(tokens, now);
      next.set(token, entry);
      return next;
    });
    return token;
  });

  return MediaRegistry.of({
    registerMediaFile: Effect.fn("MediaRegistry.registerMediaFile")(function* (filePath: string) {
      const normalizedPath = yield* normalizeMediaPath(path, filePath);
      const now = yield* Clock.currentTimeMillis;
      return yield* insertToken({
        kind: "file",
        filePath: normalizedPath,
        createdAt: now,
        lastAccessedAt: now,
      });
    }),
    registerCapturePreview: Effect.fn("MediaRegistry.registerCapturePreview")(function* (
      loadPreviewFrame: () => Effect.Effect<CapturePreviewFrameResult, unknown>,
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* insertToken({
        kind: "capturePreview",
        createdAt: now,
        lastAccessedAt: now,
        loadPreviewFrame,
        cachedFrameId: null,
        cachedJPEGBytes: null,
      });
    }),
    resolveToken: Effect.fn("MediaRegistry.resolveToken")(function* (token: string) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Ref.modify(tokensRef, (tokens) => {
        const next = pruneTokenMap(tokens, now);
        const entry = next.get(token);
        if (!entry || isTokenExpired(entry, now)) {
          next.delete(token);
          return [Option.none<TokenEntry>(), next];
        }
        const refreshedEntry: TokenEntry = { ...entry, lastAccessedAt: now };
        next.set(token, refreshedEntry);
        return [Option.some(refreshedEntry), next];
      });
    }),
    updatePreviewCache: Effect.fn("MediaRegistry.updatePreviewCache")(
      (token: string, frameId: number, jpegBytes: Uint8Array) =>
        Ref.update(tokensRef, (tokens) => {
          const entry = tokens.get(token);
          if (!entry || entry.kind !== "capturePreview") {
            return tokens;
          }
          const next = new Map(tokens);
          next.set(token, { ...entry, cachedFrameId: frameId, cachedJPEGBytes: jpegBytes });
          return next;
        }),
    ),
  });
});

export const layerMediaRegistry = Layer.effect(MediaRegistry, makeMediaRegistryService);
