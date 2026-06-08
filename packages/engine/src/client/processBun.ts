import { Effect, FileSystem, Option, Path, Result, Scope, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import type {
  ChildProcessHandle,
  ChildProcessSpawner,
} from "effect/unstable/process/ChildProcessSpawner";
import { resolveEnginePath } from "@guerillaglass/engine/client/config/paths";
import {
  EngineClientError,
  messageFromUnknownError,
} from "@guerillaglass/engine/client/errors/clientErrors";
import { RpcClientDefect, RpcClientError } from "effect/unstable/rpc/RpcClientError";

export type EngineSocketProcessOptions = {
  readonly enginePath?: string;
};

export type EngineSocketAddress = {
  readonly host: string;
  readonly port: number;
};

export type EngineSocketProcess = {
  readonly process: ChildProcessHandle;
  readonly address: EngineSocketAddress;
  readonly authToken: string;
};

function protocolDefect(message: string, cause: unknown): RpcClientError {
  return new RpcClientError({ reason: new RpcClientDefect({ message, cause }) });
}

function makeSocketAuthToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseReadyLine(line: string): EngineSocketAddress | undefined {
  try {
    const value = JSON.parse(line) as {
      readonly type?: unknown;
      readonly host?: unknown;
      readonly port?: unknown;
    };
    if (
      value.type === "guerillaglass.engine.ready" &&
      typeof value.host === "string" &&
      typeof value.port === "number" &&
      Number.isInteger(value.port) &&
      value.port > 0
    ) {
      return { host: value.host, port: value.port };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function resolveEngineCommand(
  enginePath: string,
): Effect.Effect<readonly [string, readonly string[]], EngineClientError, FileSystem.FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const exists = yield* fs.exists(enginePath).pipe(
      Effect.mapError(
        (cause) =>
          new EngineClientError({
            code: "ENGINE_PROCESS_UNAVAILABLE",
            description: messageFromUnknownError(
              cause,
              `Unable to inspect engine path ${enginePath}.`,
            ),
            cause,
          }),
      ),
    );
    if (!exists) {
      return yield* new EngineClientError({
        code: "ENGINE_PROCESS_UNAVAILABLE",
        description: `Engine executable not found at ${enginePath}. Run bun run swift:build or set GG_ENGINE_PATH.`,
      });
    }
    return enginePath.endsWith(".ts")
      ? (["bun", [enginePath]] as const)
      : ([enginePath, []] as const);
  }).pipe(
    Effect.withSpan("engine.process.resolve-command", {
      attributes: { "engine.path": enginePath },
    }),
  );
}

function drainStderr(process: ChildProcessHandle): Effect.Effect<void, never> {
  return process.stderr.pipe(
    Stream.decodeText,
    Stream.splitLines,
    Stream.runForEach((line) => {
      const trimmed = line.trimEnd();
      if (trimmed.length === 0) return Effect.void;
      return Effect.logWarning("engine stderr", { line: trimmed });
    }),
    Effect.catchCause(() => Effect.void),
    Effect.withSpan("engine.process.stderr"),
  );
}

function waitForProcessExit(process: ChildProcessHandle): Effect.Effect<never, RpcClientError> {
  return process.exitCode.pipe(
    Effect.flatMap((exitCode) =>
      Effect.fail(
        protocolDefect(
          `Engine process exited before readiness with code ${Number(exitCode)}`,
          undefined,
        ),
      ),
    ),
    Effect.mapError((cause) => protocolDefect("Engine process exited before readiness", cause)),
  );
}

function waitForReady(
  process: ChildProcessHandle,
): Effect.Effect<EngineSocketAddress, RpcClientError> {
  const readReadyLine = process.stdout.pipe(
    Stream.decodeText,
    Stream.splitLines,
    Stream.filterMap((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return Result.fail(undefined);
      const ready = parseReadyLine(trimmed);
      return ready ? Result.succeed(ready) : Result.fail(undefined);
    }),
    Stream.runHead,
    Effect.flatMap((ready) =>
      Option.match(ready, {
        onNone: () =>
          Effect.fail(protocolDefect("Engine process closed stdout before readiness", undefined)),
        onSome: Effect.succeed,
      }),
    ),
  );

  return readReadyLine.pipe(
    Effect.mapError((cause) => protocolDefect("Error reading engine readiness", cause)),
    Effect.raceFirst(waitForProcessExit(process)),
    Effect.timeoutOrElse({
      duration: "10 seconds",
      orElse: () =>
        Effect.fail(protocolDefect("Timed out waiting for engine socket readiness", undefined)),
    }),
    Effect.tap((address) =>
      Effect.logInfo("engine socket ready", { host: address.host, port: address.port }),
    ),
    Effect.withSpan("engine.process.wait-ready"),
  );
}

function spawnEngineProcess(
  command: string,
  args: readonly string[],
  authToken: string,
): Effect.Effect<ChildProcessHandle, RpcClientError, Scope.Scope | ChildProcessSpawner> {
  return Effect.acquireRelease(
    ChildProcess.make(command, args, {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      extendEnv: true,
      env: {
        GG_ENGINE_RPC_TRANSPORT: "socket",
        GG_ENGINE_RPC_AUTH_TOKEN: authToken,
      },
      forceKillAfter: "2 seconds",
    }).pipe(
      Effect.mapError((cause) => protocolDefect("Failed to spawn engine process", cause)),
      Effect.tap((process) =>
        Effect.logInfo("engine process spawned", { pid: Number(process.pid) }),
      ),
    ),
    (process) =>
      Effect.gen(function* () {
        yield* Effect.logInfo("shutting down engine process", { pid: Number(process.pid) });
        yield* process
          .kill({ forceKillAfter: "2 seconds" })
          .pipe(Effect.catchCause(() => Effect.void));
      }),
  ).pipe(
    Effect.withSpan("engine.process.spawn", {
      attributes: {
        "engine.command": command,
        "engine.arg_count": args.length,
      },
    }),
  );
}

export function makeEngineSocketProcess(
  options: EngineSocketProcessOptions = {},
): Effect.Effect<
  EngineSocketProcess,
  RpcClientError,
  FileSystem.FileSystem | Path.Path | Scope.Scope | ChildProcessSpawner
> {
  return Effect.gen(function* () {
    const enginePath =
      options.enginePath ??
      (yield* resolveEnginePath().pipe(
        Effect.mapError((cause) => protocolDefect("Failed to resolve engine path", cause)),
      ));
    const [command, args] = yield* resolveEngineCommand(enginePath).pipe(
      Effect.mapError((cause) => protocolDefect("Engine process unavailable", cause)),
    );
    const authToken = makeSocketAuthToken();
    const childProcess = yield* spawnEngineProcess(command, args, authToken);
    yield* drainStderr(childProcess).pipe(Effect.forkScoped);
    const address = yield* waitForReady(childProcess);
    return { process: childProcess, address, authToken };
  }).pipe(
    Effect.annotateLogs({ component: "engine-client", transport: "socket" }),
    Effect.withSpan("engine.process.start"),
  );
}
