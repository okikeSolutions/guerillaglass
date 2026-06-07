import { Effect, FileSystem, Path, Scope } from "effect";
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
  readonly process: Bun.Subprocess<"ignore", "pipe", "pipe">;
  readonly address: EngineSocketAddress;
  readonly authToken: string;
};

const decoder = new TextDecoder();
const stderrDecoder = new TextDecoder();

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
): Effect.Effect<string[], EngineClientError, FileSystem.FileSystem> {
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
    return enginePath.endsWith(".ts") ? ["bun", enginePath] : [enginePath];
  });
}

function drainStderr(
  process: Bun.Subprocess<"ignore", "pipe", "pipe">,
): Effect.Effect<void, never> {
  return Effect.acquireUseRelease(
    Effect.sync(() => process.stderr!.getReader()),
    (reader) =>
      Effect.promise(async () => {
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += stderrDecoder.decode(value, { stream: true });
          while (true) {
            const newline = buffer.indexOf("\n");
            if (newline === -1) break;
            const line = buffer.slice(0, newline).trimEnd();
            buffer = buffer.slice(newline + 1);
            if (line.length > 0) console.error(`[engine:stderr] ${line}`);
          }
        }
        const tail = buffer.trimEnd();
        if (tail.length > 0) console.error(`[engine:stderr] ${tail}`);
      }).pipe(Effect.catchCause(() => Effect.void)),
    (reader) => Effect.sync(() => reader.releaseLock()),
  );
}

function waitForProcessExit(
  process: Bun.Subprocess<"ignore", "pipe", "pipe">,
): Effect.Effect<never, RpcClientError> {
  return Effect.promise(() => process.exited).pipe(
    Effect.flatMap((exitCode) =>
      Effect.fail(protocolDefect(`Engine process exited before readiness with code ${exitCode}`, undefined)),
    ),
  );
}

function waitForReady(
  process: Bun.Subprocess<"ignore", "pipe", "pipe">,
): Effect.Effect<EngineSocketAddress, RpcClientError> {
  return Effect.acquireUseRelease(
    Effect.sync(() => process.stdout!.getReader()),
    (reader) =>
      Effect.callback<EngineSocketAddress, RpcClientError>((resume) => {
        let buffer = "";
        const read = (): void => {
          reader
            .read()
            .then(({ value, done }) => {
              if (done) {
                resume(
                  Effect.fail(
                    protocolDefect("Engine process closed stdout before readiness", undefined),
                  ),
                );
                return;
              }
              buffer += decoder.decode(value, { stream: true });
              while (true) {
                const newline = buffer.indexOf("\n");
                if (newline === -1) {
                  break;
                }
                const line = buffer.slice(0, newline).trim();
                buffer = buffer.slice(newline + 1);
                const ready = parseReadyLine(line);
                if (ready) {
                  resume(Effect.succeed(ready));
                  return;
                }
                if (line.length > 0) {
                  console.error(`[engine] ${line}`);
                }
              }
              read();
            })
            .catch((cause) =>
              resume(Effect.fail(protocolDefect("Error reading engine readiness", cause))),
            );
        };
        read();
      }).pipe(
        Effect.raceFirst(waitForProcessExit(process)),
        Effect.timeoutOrElse({
          duration: "10 seconds",
          orElse: () =>
            Effect.fail(protocolDefect("Timed out waiting for engine socket readiness", undefined)),
        }),
      ),
    (reader) => Effect.sync(() => reader.releaseLock()),
  );
}

export function makeEngineSocketProcess(
  options: EngineSocketProcessOptions = {},
): Effect.Effect<EngineSocketProcess, RpcClientError, FileSystem.FileSystem | Path.Path | Scope.Scope> {
  return Effect.gen(function* () {
    const enginePath =
      options.enginePath ??
      (yield* resolveEnginePath().pipe(
        Effect.mapError((cause) => protocolDefect("Failed to resolve engine path", cause)),
      ));
    const command = yield* resolveEngineCommand(enginePath).pipe(
      Effect.mapError((cause) => protocolDefect("Engine process unavailable", cause)),
    );
    const authToken = makeSocketAuthToken();
    const childProcess = yield* Effect.acquireRelease(
      Effect.try({
        try: () =>
          Bun.spawn({
            cmd: command,
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
            env: {
              ...globalThis.process.env,
              GG_ENGINE_RPC_TRANSPORT: "socket",
              GG_ENGINE_RPC_AUTH_TOKEN: authToken,
            },
          }),
        catch: (cause) => protocolDefect("Failed to spawn engine process", cause),
      }),
      (childProcess) =>
        Effect.sync(() => {
          childProcess.kill();
        }),
    );
    yield* drainStderr(childProcess).pipe(Effect.forkScoped);
    const address = yield* waitForReady(childProcess);
    return { process: childProcess, address, authToken };
  });
}
