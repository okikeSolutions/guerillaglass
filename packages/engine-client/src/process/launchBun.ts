import { stat } from "node:fs/promises";
import { Effect, Option, Redacted, Scope } from "effect";
import { EngineProcessError } from "../errors";
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
};

/**
 * Scoped native process and connection details for a ready v2 HTTP engine.
 */
export type EngineHttpProcess = {
  /**
   * Bun subprocess handle for the native engine.
   */
  readonly process: Bun.Subprocess;
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
    const configuredPath = enginePath === undefined
      ? yield* EnginePathConfig.pipe(
        Effect.mapError((cause) =>
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
 * @returns Command tuple for `Bun.spawn`.
 */
function resolveEngineCommand(enginePath: string): readonly [string, readonly string[]] {
  return [enginePath, []] as const;
}

/**
 * Reads stdout until a valid HTTP readiness envelope is found.
 *
 * @param subprocess - Bun subprocess whose stdout emits readiness.
 * @param timeoutMs - Maximum readiness wait duration in milliseconds.
 * @returns A promise for the validated engine HTTP address.
 */
async function waitForReady(subprocess: Bun.Subprocess, timeoutMs: number): Promise<EngineHttpAddress> {
  const stdout = subprocess.stdout;
  if (!stdout || typeof stdout === "number") {
    throw new EngineProcessError({
      code: "ENGINE_READINESS_INVALID",
      message: "Engine process stdout is unavailable for readiness.",
    });
  }

  const decoder = new TextDecoder();
  const reader = stdout.getReader();
  let buffer = "";
  const timeout = AbortSignal.timeout(timeoutMs);

  while (!timeout.aborted) {
    const exited = subprocess.exited.then((exitCode) => ({ type: "exit" as const, exitCode }));
    const read = reader.read().then((result) => ({ type: "read" as const, result }));
    const abort = new Promise<{ readonly type: "timeout" }>((resolve) =>
      timeout.addEventListener("abort", () => resolve({ type: "timeout" }), { once: true }),
    );
    const outcome = await Promise.race([exited, read, abort]);

    if (outcome.type === "timeout") {
      throw new EngineProcessError({
        code: "ENGINE_READINESS_TIMEOUT",
        message: "Timed out waiting for engine HTTP readiness.",
      });
    }
    if (outcome.type === "exit") {
      throw new EngineProcessError({
        code: "ENGINE_EXITED_BEFORE_READINESS",
        message: `Engine process exited before HTTP readiness with code ${outcome.exitCode}`,
      });
    }
    if (outcome.result.done) {
      throw new EngineProcessError({
        code: "ENGINE_READINESS_INVALID",
        message: "Engine process closed stdout before HTTP readiness.",
      });
    }

    buffer += decoder.decode(outcome.result.value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const ready = parseEngineHttpReadyLine(line.trim());
      if (ready) return ready;
    }
  }

  throw new EngineProcessError({
    code: "ENGINE_READINESS_TIMEOUT",
    message: "Timed out waiting for engine HTTP readiness.",
  });
}

/**
 * Starts logging native engine stderr without treating it as readiness.
 *
 * @param subprocess - Engine subprocess.
 */
function drainStderr(subprocess: Bun.Subprocess): void {
  const stderr = subprocess.stderr;
  if (!stderr || typeof stderr === "number") return;
  void new Response(stderr).text().then((text) => {
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trimEnd();
      if (trimmed.length > 0) console.warn("engine stderr", trimmed);
    }
  }).catch(() => undefined);
}

/**
 * Launches a scoped v2 HTTP native engine process and waits for readiness.
 *
 * @param options - Process launch options.
 * @returns A scoped effect containing process and HTTP connection details.
 */
export function makeEngineHttpProcess(
  options: EngineHttpProcessOptions = {},
): Effect.Effect<EngineHttpProcess, EngineProcessError, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.gen(function* () {
      const processConfig = yield* EngineProcessConfig.pipe(
        Effect.mapError((cause) =>
          new EngineProcessError({
            code: "ENGINE_READINESS_INVALID",
            message: "Unable to load engine process configuration.",
            cause,
          }),
        ),
      );
      const enginePath = yield* resolveEnginePath(options.enginePath ?? Option.getOrUndefined(processConfig.enginePath));
      yield* validateEngineExecutableTrust(enginePath, options.trustPolicy);
      const [command, args] = resolveEngineCommand(enginePath);
      const bearerToken = makeEngineBearerToken();
      const subprocess = Bun.spawn([command, ...args], {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          ...options.env,
          GG_ENGINE_TRANSPORT: "http",
          GG_ENGINE_HTTP_AUTH_TOKEN: Redacted.value(bearerToken),
        },
      });
      drainStderr(subprocess);
      const address = yield* Effect.tryPromise({
        try: () => waitForReady(subprocess, options.readinessTimeoutMs ?? processConfig.readinessTimeoutMs),
        catch: (cause) =>
          cause instanceof EngineProcessError
            ? cause
            : new EngineProcessError({
                code: "ENGINE_READINESS_INVALID",
                message: "Unable to read engine HTTP readiness.",
                cause,
              }),
      });
      return { process: subprocess, address, baseUrl: engineHttpBaseUrl(address), bearerToken };
    }),
    (engineProcess) =>
      Effect.sync(() => {
        engineProcess.process.kill();
      }),
  );
}
