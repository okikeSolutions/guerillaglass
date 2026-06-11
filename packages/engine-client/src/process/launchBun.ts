import { stat } from "node:fs/promises";
import { Deferred, Duration, Effect, Metric, Option, Redacted, Scope, Stream } from "effect";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import type {
  ChildProcessHandle,
  ChildProcessSpawner,
} from "effect/unstable/process/ChildProcessSpawner";
import { EngineProcessError } from "../errors";
import { engineLaunchDuration, engineLaunchFailuresTotal } from "../metrics";
import { EnginePathConfig, EngineProcessConfig } from "./config";
import { engineHttpBaseUrl, parseEngineHttpReadyLine, type EngineHttpAddress } from "./readiness";
import { validateEngineExecutableTrust, type EngineExecutableTrustPolicy } from "./trust";

/**
 * Options for launching a native engine process that exposes the v2 HTTP API.
 */
export type EngineHttpProcessOptions = {
  /**
   * Absolute path to the native engine executable.
   */
  readonly enginePath?: string;
  /**
   * Optional production trust policy applied before spawning the native engine executable.
   */
  readonly trustPolicy?: EngineExecutableTrustPolicy;
  /**
   * Maximum duration to wait for the readiness envelope.
   *
   * @defaultValue 10000
   */
  readonly readinessTimeoutMs?: number;
  /**
   * Extra environment variables for the engine subprocess.
   *
   * @remarks Values override inherited `process.env` entries.
   */
  readonly env?: NodeJS.ProcessEnv;
  /**
   * Terminates stale engine processes launched from the same executable path before spawning.
   *
   * @remarks Useful for desktop app relaunches after an ungraceful shutdown left an orphaned
   * ScreenCaptureKit process active.
   */
  readonly cleanupStaleProcesses?: boolean;
};

/**
 * Scoped native process and connection details for a ready v2 HTTP engine.
 */
export type EngineHttpProcess = {
  /**
   * Scoped child process handle for the native engine.
   */
  readonly process: ChildProcessHandle;
  /**
   * Validated loopback address emitted by readiness.
   */
  readonly address: EngineHttpAddress;
  /**
   * Base URL for the engine HTTP API.
   */
  readonly baseUrl: URL;
  /**
   * Per-process bearer token required by the engine HTTP API.
   */
  readonly bearerToken: Redacted.Redacted<string>;
};

/**
 * Generates a redacted bearer token for one native engine process.
 *
 * @returns A random bearer token wrapped in `Redacted`.
 */
export function makeEngineBearerToken(): Redacted.Redacted<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Redacted.make(Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""), {
    label: "engine-http-bearer-token",
  });
}

/**
 * Resolves the native engine path from explicit options or `GG_ENGINE_PATH`.
 *
 * @param enginePath - Explicit engine path supplied by the caller.
 * @returns An effect that succeeds with an executable path.
 */
export function resolveEnginePath(enginePath?: string): Effect.Effect<string, EngineProcessError> {
  return Effect.gen(function* () {
    const configuredPath =
      enginePath === undefined
        ? yield* EnginePathConfig.pipe(
            Effect.mapError(
              (cause) =>
                new EngineProcessError({
                  code: "ENGINE_PATH_UNAVAILABLE",
                  message: "Unable to load engine executable path configuration.",
                  cause,
                }),
            ),
          )
        : Option.none<string>();
    const resolved = enginePath ?? Option.getOrUndefined(configuredPath);
    if (!resolved?.trim()) {
      return yield* new EngineProcessError({
        code: "ENGINE_PATH_UNAVAILABLE",
        message: "Engine executable path is required. Pass enginePath or set GG_ENGINE_PATH.",
      });
    }
    const path = resolved.trim();
    const fileStat = yield* Effect.tryPromise({
      try: () => stat(path),
      catch: (cause) =>
        cause instanceof EngineProcessError
          ? cause
          : new EngineProcessError({
              code: "ENGINE_PATH_UNAVAILABLE",
              message: "Unable to resolve engine executable path.",
              cause,
            }),
    });
    if (!fileStat.isFile()) {
      return yield* new EngineProcessError({
        code: "ENGINE_PATH_UNAVAILABLE",
        message: `Engine executable path does not point to a regular file: ${path}`,
      });
    }
    return path;
  });
}

/**
 * Resolves the command and arguments needed to launch an engine path.
 *
 * @param enginePath - Resolved engine path.
 * @returns Command tuple for process spawning.
 */
function resolveEngineCommand(enginePath: string): readonly [string, readonly string[]] {
  return [enginePath, []] as const;
}

function commandText(command: string, args: readonly string[]): string {
  return [command, ...args].join(" ");
}

function writeEngineStderrLine(line: string): void {
  const trimmed = line.trimEnd();
  if (trimmed.length > 0) {
    process.stderr.write(`engine stderr ${trimmed}\n`);
  }
}

function drainStderr(handle: ChildProcessHandle): Effect.Effect<void, never, Scope.Scope> {
  return handle.stderr.pipe(
    Stream.decodeText(),
    Stream.splitLines,
    Stream.runForEach((line) => Effect.sync(() => writeEngineStderrLine(line))),
    Effect.catch(() => Effect.void),
    Effect.forkScoped,
    Effect.asVoid,
  );
}

function waitForReady(
  handle: ChildProcessHandle,
  timeoutMs: number,
): Effect.Effect<EngineHttpAddress, EngineProcessError, Scope.Scope> {
  return Effect.gen(function* () {
    const ready = yield* Deferred.make<EngineHttpAddress, EngineProcessError>();

    const failReady = (error: EngineProcessError) =>
      Deferred.fail(ready, error).pipe(Effect.ignore);

    yield* handle.stdout.pipe(
      Stream.decodeText(),
      Stream.splitLines,
      Stream.runForEach((line) => {
        const parsed = parseEngineHttpReadyLine(line.trim());
        return parsed ? Deferred.succeed(ready, parsed).pipe(Effect.ignore) : Effect.void;
      }),
      Effect.andThen(
        failReady(
          new EngineProcessError({
            code: "ENGINE_READINESS_INVALID",
            message: "Engine process closed stdout before HTTP readiness.",
          }),
        ),
      ),
      Effect.catch((error) =>
        failReady(
          new EngineProcessError({
            code: "ENGINE_READINESS_INVALID",
            message: "Unable to read engine stdout for readiness.",
            cause: error,
          }),
        ),
      ),
      Effect.forkScoped,
    );

    yield* handle.exitCode.pipe(
      Effect.flatMap((exitCode) =>
        failReady(
          new EngineProcessError({
            code: "ENGINE_EXITED_BEFORE_READINESS",
            message: `Engine process exited before HTTP readiness with code ${exitCode}`,
          }),
        ),
      ),
      Effect.catch((error) =>
        failReady(
          new EngineProcessError({
            code: "ENGINE_EXITED_BEFORE_READINESS",
            message: "Engine process exited before HTTP readiness.",
            cause: error,
          }),
        ),
      ),
      Effect.forkScoped,
    );

    return yield* Deferred.await(ready).pipe(
      Effect.timeoutOrElse({
        duration: Duration.millis(timeoutMs),
        orElse: () =>
          Effect.fail(
            new EngineProcessError({
              code: "ENGINE_READINESS_TIMEOUT",
              message: "Timed out waiting for engine HTTP readiness.",
            }),
          ),
      }),
    );
  });
}

function parsePsPids(output: string, enginePath: string): number[] {
  const pids: number[] = [];
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    if (!match) {
      continue;
    }
    const pid = Number(match[1]);
    const command = match[2] ?? "";
    if (!Number.isSafeInteger(pid) || pid === process.pid || !command.includes(enginePath)) {
      continue;
    }
    pids.push(pid);
  }
  return pids;
}

function cleanupStaleEngineProcesses(
  enginePath: string,
): Effect.Effect<number[], EngineProcessError, ChildProcessSpawner | Scope.Scope> {
  if (process.platform === "win32") {
    return Effect.succeed([]);
  }

  return Effect.gen(function* () {
    const handle = yield* ChildProcess.make("ps", ["-axo", "pid=,command="], {
      stdin: "ignore",
      stderr: "pipe",
    });
    const output = yield* handle.stdout.pipe(
      Stream.decodeText(),
      Stream.runFold(
        () => "",
        (accumulator, chunk) => accumulator + chunk,
      ),
    );
    const exitCode = yield* handle.exitCode;
    if (exitCode !== 0) {
      return [];
    }

    const killed: number[] = [];
    for (const pid of parsePsPids(output, enginePath)) {
      const killedPid = yield* Effect.sync(() => {
        try {
          process.kill(pid, "SIGTERM");
          return pid;
        } catch {
          // Best-effort cleanup only. If a stale process exits concurrently, launch can continue.
          return null;
        }
      });
      if (killedPid !== null) {
        killed.push(killedPid);
      }
    }
    return killed;
  }).pipe(
    Effect.mapError(
      (cause) =>
        new EngineProcessError({
          code: "ENGINE_SPAWN_FAILED",
          message: "Unable to enumerate stale engine processes.",
          cause,
        }),
    ),
  );
}

/**
 * Launches a scoped v2 HTTP native engine process and waits for readiness.
 *
 * @param options - Process launch options.
 * @returns A scoped effect containing process and HTTP connection details.
 */
export function makeEngineHttpProcess(
  options: EngineHttpProcessOptions = {},
): Effect.Effect<EngineHttpProcess, EngineProcessError, ChildProcessSpawner | Scope.Scope> {
  return Effect.gen(function* () {
    const processConfig = yield* EngineProcessConfig.pipe(
      Effect.mapError(
        (cause) =>
          new EngineProcessError({
            code: "ENGINE_READINESS_INVALID",
            message: "Unable to load engine process configuration.",
            cause,
          }),
      ),
    );
    const enginePath = yield* resolveEnginePath(
      options.enginePath ?? Option.getOrUndefined(processConfig.enginePath),
    );
    yield* validateEngineExecutableTrust(enginePath, options.trustPolicy);
    if (options.cleanupStaleProcesses) {
      const killedPids = yield* cleanupStaleEngineProcesses(enginePath);
      if (killedPids.length > 0) {
        yield* Effect.logWarning("terminated stale engine processes").pipe(
          Effect.annotateLogs({ enginePath, killedPids }),
        );
      }
    }
    const [command, args] = resolveEngineCommand(enginePath);
    const bearerToken = makeEngineBearerToken();
    yield* Effect.logInfo("spawning engine process").pipe(
      Effect.annotateLogs({
        command: commandText(command, args),
        enginePath,
        transport: "http",
      }),
    );

    const handle = yield* ChildProcess.make(command, args, {
      env: {
        ...process.env,
        ...options.env,
        GG_ENGINE_TRANSPORT: "http",
        GG_ENGINE_HTTP_AUTH_TOKEN: Redacted.value(bearerToken),
      },
      extendEnv: false,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      forceKillAfter: "2 seconds",
    }).pipe(
      Effect.mapError(
        (cause) =>
          new EngineProcessError({
            code: "ENGINE_SPAWN_FAILED",
            message: "Unable to spawn engine process.",
            cause,
          }),
      ),
    );
    yield* drainStderr(handle);

    const address = yield* waitForReady(
      handle,
      options.readinessTimeoutMs ?? processConfig.readinessTimeoutMs,
    );
    yield* Effect.logInfo("engine process ready").pipe(
      Effect.annotateLogs({
        enginePath,
        host: address.host,
        port: address.port,
      }),
    );
    return { process: handle, address, baseUrl: engineHttpBaseUrl(address), bearerToken };
  }).pipe(
    Effect.tapError(() => Metric.update(engineLaunchFailuresTotal, 1)),
    Effect.trackDuration(engineLaunchDuration),
    Effect.annotateLogs({ component: "engine-process", transport: "http" }),
    Effect.withLogSpan("engine-launch"),
    Effect.withSpan("engine-launch", { attributes: { "engine.transport": "http" } }),
  );
}
