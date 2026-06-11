import { Effect, Option } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

const defaultDiagnosticsLogFileName = "desktop-electrobun.log";

function parsePackageName(packageJson: string): string | null {
  try {
    const parsed = JSON.parse(packageJson) as { name?: unknown };
    return typeof parsed.name === "string" ? parsed.name : null;
  } catch {
    return null;
  }
}

function isRepoRoot(
  directory: string,
): Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const packageJsonPath = path.join(directory, "package.json");
    const exists = yield* fs
      .exists(packageJsonPath)
      .pipe(Effect.catchCause(() => Effect.succeed(false)));
    if (!exists) {
      return false;
    }
    const packageJson = yield* fs
      .readFileString(packageJsonPath)
      .pipe(Effect.catchCause(() => Effect.succeed("")));
    return parsePackageName(packageJson) === "guerillaglass";
  });
}

function findRepoRoot(
  startPath: string,
): Effect.Effect<string | null, never, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    let directory = path.resolve(startPath);
    const exists = yield* fs.exists(directory).pipe(Effect.catchCause(() => Effect.succeed(false)));
    if (!exists) {
      directory = path.dirname(directory);
    }

    for (;;) {
      if (yield* isRepoRoot(directory)) {
        return directory;
      }
      const parent = path.dirname(directory);
      if (parent === directory) {
        return null;
      }
      directory = parent;
    }
  });
}

function resolveRepoDiagnosticsLogPath(): Effect.Effect<
  string | null,
  never,
  FileSystem.FileSystem | Path.Path
> {
  return Effect.gen(function* () {
    const path = yield* Path.Path;
    const configured = process.env.GG_DESKTOP_REPO_LOG_PATH?.trim();
    if (configured) {
      return configured;
    }
    if (process.env.GG_DESKTOP_REPO_LOG === "0" || process.env.NODE_ENV === "production") {
      return null;
    }

    const candidates = [
      process.env.GG_ENGINE_PATH,
      process.execPath,
      process.argv[1],
      process.cwd(),
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }
      const repoRoot = yield* findRepoRoot(candidate);
      if (repoRoot) {
        return path.join(repoRoot, ".tmp", defaultDiagnosticsLogFileName);
      }
    }
    return null;
  });
}

function ensureWritableLogPath(
  logPath: string,
): Effect.Effect<Option.Option<string>, never, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return yield* fs.makeDirectory(path.dirname(logPath), { recursive: true }).pipe(
      Effect.as(Option.some(logPath)),
      Effect.catchCause(() => Effect.succeed(Option.none<string>())),
    );
  });
}

export const resolveDesktopDiagnosticsLogPaths: Effect.Effect<
  readonly string[],
  never,
  FileSystem.FileSystem | Path.Path
> = Effect.gen(function* () {
  const path = yield* Path.Path;
  const configuredLogPath = process.env.GG_DESKTOP_DIAGNOSTICS_LOG?.trim();
  const primaryLogPath =
    configuredLogPath ||
    path.join(
      process.env.HOME ?? "/tmp",
      "Library",
      "Logs",
      "Guerillaglass",
      defaultDiagnosticsLogFileName,
    );
  const paths = [primaryLogPath];
  const repoLogPath = yield* resolveRepoDiagnosticsLogPath();
  if (repoLogPath && !paths.includes(repoLogPath)) {
    paths.push(repoLogPath);
  }

  const writablePaths: string[] = [];
  for (const targetPath of paths) {
    const writablePath = yield* ensureWritableLogPath(targetPath);
    if (Option.isSome(writablePath)) {
      writablePaths.push(writablePath.value);
    }
  }

  return writablePaths.length > 0
    ? writablePaths
    : [path.join("/tmp", "guerillaglass-desktop-electrobun.log")];
});
