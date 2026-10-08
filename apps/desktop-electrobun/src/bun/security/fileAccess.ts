import { Config, Effect, FileSystem, Path } from "effect";
import { FileAccessPolicyError } from "../../shared/errors/desktopErrors";
import { isSupportedMediaPath } from "../media/policy";
import { NoFollowFileIO } from "./NoFollowFileIO";

const defaultMaxTextReadBytes = 5 * 1024 * 1024;
const defaultMaxMediaSnapshotBytes = 20 * 1024 * 1024 * 1024;
const mediaTempFilePrefix = "guerillaglass-";

type ReadTextFileOptions = {
  currentProjectPath?: string | null;
  maxBytes?: number;
  tempDirectory?: string;
};
type ResolveAllowedMediaFileOptions = Omit<ReadTextFileOptions, "maxBytes">;
type CopySafeFileSnapshotOptions = { maxBytes?: number };

const canonicalizePath = Effect.fn("FileAccess.canonicalizePath")(function* (candidate: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.realPath(candidate).pipe(Effect.orElseSucceed(() => path.resolve(candidate)));
});

const normalizeLocalFilePathInput = Effect.fn("FileAccess.normalizeLocalFilePathInput")(function* (
  filePath: string,
) {
  const trimmed = filePath.trim();
  if (!/^file:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const url = yield* Effect.try({
    try: () => new URL(trimmed),
    catch: (cause) =>
      new FileAccessPolicyError({
        code: "LOCAL_FILE_PATH_INVALID",
        description: "A valid local file path is required.",
        cause,
      }),
  });
  if (url.protocol !== "file:" || (url.hostname && url.hostname.toLowerCase() !== "localhost")) {
    return yield* new FileAccessPolicyError({
      code: "LOCAL_FILE_URL_UNSUPPORTED",
      description: "Only local file URLs are supported.",
    });
  }
  const path = yield* Path.Path;
  return yield* path.fromFileUrl(url).pipe(
    Effect.mapError(
      (cause) =>
        new FileAccessPolicyError({
          code: "LOCAL_FILE_PATH_INVALID",
          description: "A valid local file path is required.",
          cause,
        }),
    ),
  );
});

function isPathWithinRoot(path: Path.Path, target: string, root: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

const resolveRoots = Effect.fn("FileAccess.resolveRoots")(function* (
  options: ResolveAllowedMediaFileOptions,
) {
  const tempDirectory =
    options.tempDirectory ?? (yield* Config.String("TMPDIR").pipe(Config.withDefault("/tmp")));
  const tempRoot = yield* canonicalizePath(tempDirectory);
  const projectPath = options.currentProjectPath?.trim();
  const projectRoot = projectPath ? yield* canonicalizePath(projectPath) : null;
  return { tempRoot, projectRoot };
});

const resolveAllowedPath = Effect.fn("FileAccess.resolveAllowedPath")(function* (
  filePath: string,
  options: ResolveAllowedMediaFileOptions,
  media: boolean,
) {
  if (filePath.trim().length === 0) {
    return yield* new FileAccessPolicyError({
      code: "FILE_PATH_REQUIRED",
      description: "A file path is required.",
    });
  }
  const path = yield* Path.Path;
  const resolved = path.resolve(yield* normalizeLocalFilePathInput(filePath));
  if (
    media ? !isSupportedMediaPath(path, resolved) : path.extname(resolved).toLowerCase() !== ".json"
  ) {
    return yield* new FileAccessPolicyError({
      code: media ? "MEDIA_FILE_TYPE_UNSUPPORTED" : "TEXT_FILE_TYPE_UNSUPPORTED",
      description: media
        ? "Only video media files can be read through the desktop bridge."
        : "Only .json files can be read through the desktop bridge.",
    });
  }
  const { tempRoot, projectRoot } = yield* resolveRoots(options);
  const canonicalTarget = yield* canonicalizePath(resolved);
  const insideProject =
    projectRoot !== null && isPathWithinRoot(path, canonicalTarget, projectRoot);
  if (!insideProject && !isPathWithinRoot(path, canonicalTarget, tempRoot)) {
    return yield* new FileAccessPolicyError({
      code: "FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS",
      description: "Access denied: file path is outside allowed project and temp directories.",
    });
  }
  if (
    media &&
    !insideProject &&
    !path.basename(resolved).toLowerCase().startsWith(mediaTempFilePrefix)
  ) {
    return yield* new FileAccessPolicyError({
      code: "TEMP_MEDIA_PREFIX_REQUIRED",
      description:
        "Access denied: temporary media file must use the Guerillaglass temp naming prefix.",
    });
  }
  return resolved;
});

/** Resolves and validates a JSON text file path for bridge reads. */
export const resolveAllowedTextFilePath = Effect.fn("FileAccess.resolveAllowedTextFilePath")(
  (filePath: string, options: ReadTextFileOptions = {}) =>
    resolveAllowedPath(filePath, options, false),
);

/** Resolves and validates a supported media file path for bridge reads. */
export const resolveAllowedMediaFilePath = Effect.fn("FileAccess.resolveAllowedMediaFilePath")(
  (filePath: string, options: ResolveAllowedMediaFileOptions = {}) =>
    resolveAllowedPath(filePath, options, true),
);

/** Copies a file through no-follow handles into a private serving snapshot. */
export const copySafeFileSnapshot = Effect.fn("FileAccess.copySafeFileSnapshot")(function* (
  source: string,
  destination: string,
  options: CopySafeFileSnapshotOptions = {},
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const io = yield* NoFollowFileIO;
  yield* fs.makeDirectory(path.dirname(destination), { recursive: true, mode: 0o700 });
  return yield* io.copySnapshot(
    source,
    destination,
    options.maxBytes ?? defaultMaxMediaSnapshotBytes,
  );
});

/** Reads a validated JSON text file with size and root constraints applied. */
export const readAllowedTextFile = Effect.fn("FileAccess.readAllowedTextFile")(function* (
  filePath: string,
  options: ReadTextFileOptions = {},
) {
  const resolved = yield* resolveAllowedTextFilePath(filePath, options);
  const io = yield* NoFollowFileIO;
  return yield* io.readText(resolved, options.maxBytes ?? defaultMaxTextReadBytes);
});
