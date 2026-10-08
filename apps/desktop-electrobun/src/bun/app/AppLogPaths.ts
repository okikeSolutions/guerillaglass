import { Config, Effect, Option, Schema } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

const defaultDiagnosticsLogFileName = "desktop-electrobun.log";

function parsePackageName(packageJson: string): string | null {
  try {
    const parsed = Schema.decodeUnknownOption(Schema.Struct({ name: Schema.String }))(
      JSON.parse(packageJson),
    );
    return Option.isSome(parsed) ? parsed.value.name : null;
  } catch {
    return null;
  }
}

const isRepoRoot = Effect.fn("AppLogPaths.isRepoRoot")(function (
  directory: string,
): Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const packageJsonPath = path.join(directory, "package.json");
    const exists = yield* fs.exists(packageJsonPath).pipe(Effect.orElseSucceed(() => false));
    if (!exists) {
      return false;
    }
    const packageJson = yield* fs
      .readFileString(packageJsonPath)
      .pipe(Effect.orElseSucceed(() => ""));
    return parsePackageName(packageJson) === "guerillaglass";
  });
});

const findRepoRoot = Effect.fn("AppLogPaths.findRepoRoot")(function (
  startPath: string,
): Effect.Effect<string | null, never, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    let directory = path.resolve(startPath);
    const exists = yield* fs.exists(directory).pipe(Effect.orElseSucceed(() => false));
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
});

const resolveRepoDiagnosticsLogPath = Effect.fn("AppLogPaths.resolveRepoDiagnosticsLogPath")(
  function (): Effect.Effect<string | null, Config.ConfigError, FileSystem.FileSystem | Path.Path> {
    return Effect.gen(function* () {
      const path = yield* Path.Path;
      const configured = Option.getOrNull(
        yield* Config.option(Config.String("GG_DESKTOP_REPO_LOG_PATH")),
      )?.trim();
      if (configured) {
        return configured;
      }
      const repoLog = yield* Config.String("GG_DESKTOP_REPO_LOG").pipe(Config.withDefault(""));
      const nodeEnv = yield* Config.String("NODE_ENV").pipe(Config.withDefault("development"));
      if (repoLog === "0" || nodeEnv === "production") {
        return null;
      }

      const candidates = [
        Option.getOrNull(yield* Config.option(Config.String("GG_ENGINE_PATH"))),
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
  },
);

const ensureWritableLogPath = Effect.fn("AppLogPaths.ensureWritableLogPath")(function (
  logPath: string,
): Effect.Effect<Option.Option<string>, never, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return yield* fs.makeDirectory(path.dirname(logPath), { recursive: true }).pipe(
      Effect.as(Option.some(logPath)),
      Effect.orElseSucceed(() => Option.none<string>()),
    );
  });
});

export const resolveDesktopDiagnosticsLogPaths: Effect.Effect<
  readonly string[],
  Config.ConfigError,
  FileSystem.FileSystem | Path.Path
> = Effect.gen(function* () {
  const path = yield* Path.Path;
  const configuredLogPath = Option.getOrNull(
    yield* Config.option(Config.String("GG_DESKTOP_DIAGNOSTICS_LOG")),
  )?.trim();
  const home = yield* Config.String("HOME").pipe(Config.withDefault("/tmp"));
  const primaryLogPath =
    configuredLogPath ||
    path.join(home, "Library", "Logs", "Guerillaglass", defaultDiagnosticsLogFileName);
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
