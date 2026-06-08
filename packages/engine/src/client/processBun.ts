import { createHash } from "node:crypto";
import { lstat, readFile, stat } from "node:fs/promises";
import { Effect, FileSystem, Option, Path, Redacted, Result, Scope, Stream } from "effect";
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

export type EngineExecutableTrustPolicy = {
  readonly enabled?: boolean;
  readonly expectedSha256?: string | null;
  readonly rejectSymlinkExecutable?: boolean;
  readonly rejectWorldWritable?: boolean;
  readonly requireCurrentUserOwner?: boolean;
  readonly macosCodeSignatureHelperPath?: string | null;
  readonly macosExpectedTeamId?: string | null;
  readonly macosSigningRequirement?: string | null;
  readonly windowsAuthenticodeHelperPath?: string | null;
  readonly windowsExpectedPublisherSha256Thumbprint?: string | null;
  readonly windowsExpectedPublisherSubject?: string | null;
  readonly windowsAllowOfflineRevocation?: boolean;
};

export type EngineSocketProcessOptions = {
  readonly enginePath?: string;
  readonly trustPolicy?: EngineExecutableTrustPolicy;
};

export type EngineSocketAddress = {
  readonly host: string;
  readonly port: number;
};

export type EngineSocketProcess = {
  readonly process: ChildProcessHandle;
  readonly address: EngineSocketAddress;
  readonly authToken: Redacted.Redacted<string>;
};

function protocolDefect(message: string, cause: unknown): RpcClientError {
  return new RpcClientError({ reason: new RpcClientDefect({ message, cause }) });
}

function makeSocketAuthToken(): Redacted.Redacted<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Redacted.make(
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""),
    { label: "engine-socket-auth-token" },
  );
}

function isLoopbackReadyHost(host: string): boolean {
  const normalizedHost = host.toLowerCase();
  return (
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "localhost" ||
    normalizedHost === "::1" ||
    normalizedHost === "[::1]"
  );
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
      isLoopbackReadyHost(value.host) &&
      typeof value.port === "number" &&
      Number.isInteger(value.port) &&
      value.port > 0 &&
      value.port <= 65_535
    ) {
      return { host: value.host, port: value.port };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function normalizeSha256(value: string): string {
  return value.trim().toLowerCase().replace(/^sha256:/, "");
}

function timingSafeEqualHex(left: string, right: string): boolean {
  const normalizedLeft = normalizeSha256(left);
  const normalizedRight = normalizeSha256(right);
  if (!/^[0-9a-f]{64}$/.test(normalizedLeft) || !/^[0-9a-f]{64}$/.test(normalizedRight)) {
    return false;
  }
  return normalizedLeft === normalizedRight;
}

export function configuredMacosCodeSignatureTrust(policy: EngineExecutableTrustPolicy | undefined): boolean {
  return Boolean(policy?.macosExpectedTeamId?.trim() || policy?.macosSigningRequirement?.trim());
}

function configuredWindowsAuthenticodeTrust(policy: EngineExecutableTrustPolicy | undefined): boolean {
  return Boolean(
    policy?.windowsExpectedPublisherSha256Thumbprint?.trim() ||
      policy?.windowsExpectedPublisherSubject?.trim(),
  );
}

function runNativeTrustHelper(params: {
  readonly helperPath: string | null | undefined;
  readonly args: readonly string[];
  readonly missingHelperDescription: string;
  readonly failurePrefix: string;
}): Effect.Effect<void, EngineClientError> {
  return Effect.tryPromise({
    try: async () => {
      const helperPath = params.helperPath?.trim();
      if (!helperPath) {
        throw new EngineClientError({
          code: "ENGINE_PROCESS_UNAVAILABLE",
          description: params.missingHelperDescription,
        });
      }
      const process = Bun.spawn([helperPath, ...params.args], {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(process.stdout).text(),
        new Response(process.stderr).text(),
        process.exited,
      ]);
      if (exitCode !== 0) {
        throw new EngineClientError({
          code: "ENGINE_PROCESS_UNAVAILABLE",
          description: `${params.failurePrefix}: ${stdout.trim() || stderr.trim() || `exit ${exitCode}`}`,
        });
      }
    },
    catch: (error) =>
      error instanceof EngineClientError
        ? error
        : new EngineClientError({
            code: "ENGINE_PROCESS_UNAVAILABLE",
            description: messageFromUnknownError(error, params.failurePrefix),
            cause: error,
          }),
  });
}

function verifyMacosCodeSignatureTrust(
  enginePath: string,
  policy: EngineExecutableTrustPolicy | undefined,
): Effect.Effect<void, EngineClientError> {
  if (
    policy?.enabled !== true ||
    process.platform !== "darwin" ||
    !configuredMacosCodeSignatureTrust(policy)
  ) {
    return Effect.void;
  }

  const args = ["--path", enginePath];
  const requirement = policy.macosSigningRequirement?.trim();
  const teamId = policy.macosExpectedTeamId?.trim();
  if (requirement) args.push("--requirement", requirement);
  if (teamId) args.push("--team-id", teamId);
  return runNativeTrustHelper({
    helperPath: policy.macosCodeSignatureHelperPath,
    args,
    missingHelperDescription:
      "macOS code-signature helper path is required when macOS engine signature trust is configured.",
    failurePrefix: "macOS engine code-signature verification failed",
  });
}

function verifyWindowsAuthenticodeTrust(
  enginePath: string,
  policy: EngineExecutableTrustPolicy | undefined,
): Effect.Effect<void, EngineClientError> {
  if (
    policy?.enabled !== true ||
    process.platform !== "win32" ||
    !configuredWindowsAuthenticodeTrust(policy)
  ) {
    return Effect.void;
  }

  const args = ["--verify-authenticode", "--path", enginePath];
  const thumbprint = policy.windowsExpectedPublisherSha256Thumbprint?.trim();
  const subject = policy.windowsExpectedPublisherSubject?.trim();
  if (thumbprint) args.push("--sha256-thumbprint", thumbprint);
  if (subject) args.push("--subject-contains", subject);
  if (policy.windowsAllowOfflineRevocation === true) args.push("--offline-revocation");
  return runNativeTrustHelper({
    helperPath: policy.windowsAuthenticodeHelperPath,
    args,
    missingHelperDescription:
      "Windows Authenticode helper path is required when Windows engine publisher trust is configured.",
    failurePrefix: "Windows engine Authenticode verification failed",
  });
}

export function validateEngineExecutableTrust(
  enginePath: string,
  policy: EngineExecutableTrustPolicy | undefined,
): Effect.Effect<void, EngineClientError> {
  if (policy?.enabled !== true) return Effect.void;

  return Effect.tryPromise({
    try: async () => {
      const linkStat = await lstat(enginePath);
      if ((policy.rejectSymlinkExecutable ?? true) && linkStat.isSymbolicLink()) {
        throw new EngineClientError({
          code: "ENGINE_PROCESS_UNAVAILABLE",
          description: "Engine executable must not be a symbolic link in trusted production mode.",
        });
      }

      const fileStat = await stat(enginePath);
      if (!fileStat.isFile()) {
        throw new EngineClientError({
          code: "ENGINE_PROCESS_UNAVAILABLE",
          description: "Engine executable path must point to a regular file.",
        });
      }

      if ((policy.rejectWorldWritable ?? true) && (fileStat.mode & 0o022) !== 0) {
        throw new EngineClientError({
          code: "ENGINE_PROCESS_UNAVAILABLE",
          description: "Engine executable must not be group- or world-writable in trusted production mode.",
        });
      }

      if (policy.requireCurrentUserOwner === true && typeof process.getuid === "function") {
        const currentUid = process.getuid();
        if (fileStat.uid !== currentUid) {
          throw new EngineClientError({
            code: "ENGINE_PROCESS_UNAVAILABLE",
            description: "Engine executable must be owned by the current user in trusted production mode.",
          });
        }
      }

      const expectedSha256 = policy.expectedSha256?.trim();
      if (expectedSha256) {
        const actualSha256 = createHash("sha256").update(await readFile(enginePath)).digest("hex");
        if (!timingSafeEqualHex(actualSha256, expectedSha256)) {
          throw new EngineClientError({
            code: "ENGINE_PROCESS_UNAVAILABLE",
            description: "Engine executable SHA-256 digest does not match the trusted production allowlist.",
          });
        }
      }
    },
    catch: (error) =>
      error instanceof EngineClientError
        ? error
        : new EngineClientError({
            code: "ENGINE_PROCESS_UNAVAILABLE",
            description: messageFromUnknownError(error, "Unable to verify engine executable trust."),
            cause: error,
          }),
  }).pipe(
    Effect.flatMap(() => verifyMacosCodeSignatureTrust(enginePath, policy)),
    Effect.flatMap(() => verifyWindowsAuthenticodeTrust(enginePath, policy)),
    Effect.withSpan("engine.process.verify-executable-trust", {
      attributes: {
        "engine.path": enginePath,
        "engine.trust.sha256_required": Boolean(policy.expectedSha256?.trim()),
      },
    }),
  );
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
  authToken: Redacted.Redacted<string>,
): Effect.Effect<ChildProcessHandle, RpcClientError, Scope.Scope | ChildProcessSpawner> {
  return Effect.acquireRelease(
    ChildProcess.make(command, args, {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      extendEnv: true,
      env: {
        GG_ENGINE_RPC_TRANSPORT: "socket",
        GG_ENGINE_RPC_AUTH_TOKEN: Redacted.value(authToken),
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
    yield* validateEngineExecutableTrust(enginePath, options.trustPolicy).pipe(
      Effect.mapError((cause) => protocolDefect("Engine executable trust check failed", cause)),
    );
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
