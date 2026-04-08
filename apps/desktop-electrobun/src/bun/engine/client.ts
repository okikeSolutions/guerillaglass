import { existsSync } from "node:fs";
import path from "node:path";
import { Deferred, Effect, Exit, Scope, Schema } from "effect";
import {
  agentPreflightResultSchema,
  agentRunResultSchema,
  agentStatusResultSchema,
  actionResultSchema,
  capabilitiesResultSchema,
  buildRequest,
  capturePreviewFrameResultSchema,
  captureStatusResultSchema,
  defaultCaptureFrameRate,
  engineResponseSchema,
  exportInfoResultSchema,
  exportRunCutPlanResultSchema,
  exportRunResultSchema,
  permissionsResultSchema,
  projectRecentsResultSchema,
  pingResultSchema,
  projectStateSchema,
  sourcesResultSchema,
  type AgentRunResult,
  type AutoZoomSettings,
  type CapturePreviewFrameResult,
  type CaptureStatusResult,
  type CaptureFrameRate,
  type EngineRequest,
  type EngineRequestEncoded,
  type TranscriptionProvider,
} from "@guerillaglass/engine-protocol";
import {
  ContractDecodeError,
  EngineClientError,
  EngineOperationError,
  EngineRequestValidationError,
  EngineResponseError,
  JsonParseError,
  decodeUnknownWithSchema,
  messageFromUnknownError,
  parseJsonString,
  parseJsonStringSync,
  type EngineClientErrorCode,
  type MutableDeep,
  extractValidationIssues,
  runEffectPromise,
} from "../../shared/errors";

/** Tagged failure union for Effect-based engine client operations. */
export type EngineClientFailure =
  | ContractDecodeError
  | EngineClientError
  | EngineOperationError
  | EngineRequestValidationError
  | EngineResponseError
  | JsonParseError;

type PendingRequest = Deferred.Deferred<unknown, EngineClientFailure>;

type EngineStdin = {
  write: (chunk: Uint8Array) => unknown;
  end: () => unknown;
};

type EngineProcess = Bun.PipedSubprocess;
type EngineSession = {
  process: EngineProcess;
  stdin: EngineStdin;
};
type SessionCloseOptions = {
  maxWaitMs?: number;
  reason: string;
};

/** Supported native and stub engine targets. */
export type EngineTarget =
  | "macos-swift"
  | "windows-native"
  | "linux-native"
  | "windows-stub"
  | "linux-stub";

const WINDOWS_NATIVE_BINARY = "guerillaglass-engine-windows.exe";
const LINUX_NATIVE_BINARY = "guerillaglass-engine-linux";
const retryShutdownGraceMs = 500;
const stopShutdownGraceMs = 1_000;
const forcedShutdownDrainMs = 100;
const textEncoder = new TextEncoder();

type EngineMethodDefinition<TSchema extends Schema.Schema.Any, TArgs extends unknown[]> = {
  method: EngineRequest["method"];
  toParams: (...args: TArgs) => unknown;
  schema: TSchema;
  timeoutMs: number;
  retryableRead: boolean;
};

const emptyParams = () => ({});

const engineMethodDefinitions = {
  ping: {
    method: "system.ping",
    toParams: emptyParams,
    schema: pingResultSchema,
    timeoutMs: 3000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<typeof pingResultSchema, []>,
  capabilities: {
    method: "engine.capabilities",
    toParams: emptyParams,
    schema: capabilitiesResultSchema,
    timeoutMs: 5000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<typeof capabilitiesResultSchema, []>,
  agentPreflight: {
    method: "agent.preflight",
    toParams: (params?: {
      runtimeBudgetMinutes?: number;
      transcriptionProvider?: TranscriptionProvider;
      importedTranscriptPath?: string;
    }) => params ?? {},
    schema: agentPreflightResultSchema,
    timeoutMs: 5000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<
    typeof agentPreflightResultSchema,
    [
      params?: {
        runtimeBudgetMinutes?: number;
        transcriptionProvider?: TranscriptionProvider;
        importedTranscriptPath?: string;
      },
    ]
  >,
  agentRun: {
    method: "agent.run",
    toParams: (params: {
      preflightToken: string;
      runtimeBudgetMinutes?: number;
      transcriptionProvider?: TranscriptionProvider;
      importedTranscriptPath?: string;
      force?: boolean;
    }) => params,
    schema: agentRunResultSchema,
    timeoutMs: 0,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    typeof agentRunResultSchema,
    [
      params: {
        preflightToken: string;
        runtimeBudgetMinutes?: number;
        transcriptionProvider?: TranscriptionProvider;
        importedTranscriptPath?: string;
        force?: boolean;
      },
    ]
  >,
  agentStatus: {
    method: "agent.status",
    toParams: (jobId: string) => ({ jobId }),
    schema: agentStatusResultSchema,
    timeoutMs: 5000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<typeof agentStatusResultSchema, [jobId: string]>,
  agentApply: {
    method: "agent.apply",
    toParams: (params: { jobId: string; destructiveIntent?: boolean }) => params,
    schema: actionResultSchema,
    timeoutMs: 8000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    typeof actionResultSchema,
    [params: { jobId: string; destructiveIntent?: boolean }]
  >,
  getPermissions: {
    method: "permissions.get",
    toParams: emptyParams,
    schema: permissionsResultSchema,
    timeoutMs: 5000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<typeof permissionsResultSchema, []>,
  requestScreenRecordingPermission: {
    method: "permissions.requestScreenRecording",
    toParams: emptyParams,
    schema: actionResultSchema,
    timeoutMs: 10_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<typeof actionResultSchema, []>,
  requestMicrophonePermission: {
    method: "permissions.requestMicrophone",
    toParams: emptyParams,
    schema: actionResultSchema,
    timeoutMs: 10_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<typeof actionResultSchema, []>,
  requestInputMonitoringPermission: {
    method: "permissions.requestInputMonitoring",
    toParams: emptyParams,
    schema: actionResultSchema,
    timeoutMs: 10_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<typeof actionResultSchema, []>,
  openInputMonitoringSettings: {
    method: "permissions.openInputMonitoringSettings",
    toParams: emptyParams,
    schema: actionResultSchema,
    timeoutMs: 5000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<typeof actionResultSchema, []>,
  listSources: {
    method: "sources.list",
    toParams: emptyParams,
    schema: sourcesResultSchema,
    timeoutMs: 8000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<typeof sourcesResultSchema, []>,
  startDisplayCapture: {
    method: "capture.startDisplay",
    toParams: (enableMic: boolean, captureFps: CaptureFrameRate) => ({ enableMic, captureFps }),
    schema: captureStatusResultSchema,
    timeoutMs: 15_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    typeof captureStatusResultSchema,
    [enableMic: boolean, captureFps: CaptureFrameRate]
  >,
  startCurrentWindowCapture: {
    method: "capture.startCurrentWindow",
    toParams: (enableMic: boolean, captureFps: CaptureFrameRate) => ({ enableMic, captureFps }),
    schema: captureStatusResultSchema,
    timeoutMs: 15_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    typeof captureStatusResultSchema,
    [enableMic: boolean, captureFps: CaptureFrameRate]
  >,
  startWindowCapture: {
    method: "capture.startWindow",
    toParams: (windowId: number, enableMic: boolean, captureFps: CaptureFrameRate) => ({
      windowId,
      enableMic,
      captureFps,
    }),
    schema: captureStatusResultSchema,
    // 0 disables timeout: native window picker can remain open while users decide or cancel.
    timeoutMs: 0,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    typeof captureStatusResultSchema,
    [windowId: number, enableMic: boolean, captureFps: CaptureFrameRate]
  >,
  stopCapture: {
    method: "capture.stop",
    toParams: emptyParams,
    schema: captureStatusResultSchema,
    timeoutMs: 10_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<typeof captureStatusResultSchema, []>,
  startRecording: {
    method: "recording.start",
    toParams: (trackInputEvents: boolean) => ({ trackInputEvents }),
    schema: captureStatusResultSchema,
    timeoutMs: 15_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<typeof captureStatusResultSchema, [trackInputEvents: boolean]>,
  stopRecording: {
    method: "recording.stop",
    toParams: emptyParams,
    schema: captureStatusResultSchema,
    timeoutMs: 15_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<typeof captureStatusResultSchema, []>,
  captureStatus: {
    method: "capture.status",
    toParams: emptyParams,
    schema: captureStatusResultSchema,
    timeoutMs: 5000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<typeof captureStatusResultSchema, []>,
  capturePreviewFrame: {
    method: "capture.previewFrame",
    toParams: emptyParams,
    schema: capturePreviewFrameResultSchema,
    timeoutMs: 5000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<typeof capturePreviewFrameResultSchema, []>,
  exportInfo: {
    method: "export.info",
    toParams: emptyParams,
    schema: exportInfoResultSchema,
    timeoutMs: 10_000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<typeof exportInfoResultSchema, []>,
  runExport: {
    method: "export.run",
    toParams: (params: {
      outputURL: string;
      presetId: string;
      trimStartSeconds?: number;
      trimEndSeconds?: number;
    }) => params,
    schema: exportRunResultSchema,
    // 0 disables timeout: exports can legitimately run for long recordings.
    timeoutMs: 0,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    typeof exportRunResultSchema,
    [
      params: {
        outputURL: string;
        presetId: string;
        trimStartSeconds?: number;
        trimEndSeconds?: number;
      },
    ]
  >,
  runCutPlanExport: {
    method: "export.runCutPlan",
    toParams: (params: { outputURL: string; presetId: string; jobId: string }) => params,
    schema: exportRunCutPlanResultSchema,
    timeoutMs: 0,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    typeof exportRunCutPlanResultSchema,
    [params: { outputURL: string; presetId: string; jobId: string }]
  >,
  projectCurrent: {
    method: "project.current",
    toParams: emptyParams,
    schema: projectStateSchema,
    timeoutMs: 5000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<typeof projectStateSchema, []>,
  projectOpen: {
    method: "project.open",
    toParams: (projectPath: string) => ({ projectPath }),
    schema: projectStateSchema,
    timeoutMs: 20_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<typeof projectStateSchema, [projectPath: string]>,
  projectSave: {
    method: "project.save",
    toParams: (params: { projectPath?: string; autoZoom?: AutoZoomSettings }) => params,
    schema: projectStateSchema,
    timeoutMs: 20_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    typeof projectStateSchema,
    [params: { projectPath?: string; autoZoom?: AutoZoomSettings }]
  >,
  projectRecents: {
    method: "project.recents",
    toParams: (limit?: number) => ({ limit }),
    schema: projectRecentsResultSchema,
    timeoutMs: 5000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<typeof projectRecentsResultSchema, [limit?: number]>,
} as const;

const requestMethodPolicy = Object.freeze(
  Object.fromEntries(
    Object.values(engineMethodDefinitions).map((definition) => [
      definition.method,
      { timeoutMs: definition.timeoutMs, retryableRead: definition.retryableRead },
    ]),
  ) as Record<EngineRequest["method"], { timeoutMs: number; retryableRead: boolean }>,
);

const defaultRequestTimeoutByMethod = Object.fromEntries(
  Object.entries(requestMethodPolicy).map(([method, policy]) => [method, policy.timeoutMs]),
) as Readonly<Record<EngineRequest["method"], number>>;

const retryableReadMethods = new Set<EngineRequest["method"]>(
  Object.entries(requestMethodPolicy)
    .filter(([, policy]) => policy.retryableRead)
    .map(([method]) => method as EngineRequest["method"]),
);

const retryableTransportErrors = new Set<EngineClientErrorCode>([
  "ENGINE_PROCESS_UNAVAILABLE",
  "ENGINE_REQUEST_TIMEOUT",
  "ENGINE_STDIO_WRITE_FAILED",
  "ENGINE_PROCESS_EXITED",
  "ENGINE_PROCESS_FAILED",
]);

type EngineClientOptions = {
  requestTimeoutByMethod?: Partial<Record<EngineRequest["method"], number>>;
  restartBackoffMs?: number;
  restartJitterMs?: number;
  maxRestartAttemptsInWindow?: number;
  restartWindowMs?: number;
  restartCircuitOpenMs?: number;
  maxRetryAttempts?: number;
};

type SessionAcquisitionState =
  | { _tag: "session"; session: EngineSession }
  | { _tag: "pending"; pending: Deferred.Deferred<EngineSession, EngineClientFailure> }
  | { _tag: "acquire"; pending: Deferred.Deferred<EngineSession, EngineClientFailure> };

function responseIdFromUnknown(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const responseId = (raw as { id?: unknown }).id;
  return typeof responseId === "string" && responseId.length > 0 ? responseId : null;
}

function toInvalidParamsError(
  method: string,
  error: unknown,
): EngineRequestValidationError | EngineOperationError {
  const issues = extractValidationIssues(error);
  if (issues.length === 0) {
    return new EngineOperationError({
      operation: method,
      description: messageFromUnknownError(error, `${method} request validation failed.`),
    });
  }
  const hint =
    method === "agent.run"
      ? "Call agent.preflight first and pass the returned preflightToken to agent.run."
      : "Check request fields against the engine protocol schema.";
  return new EngineRequestValidationError({
    method,
    issues,
    hint,
    cause: error,
  });
}

function findWorkspaceRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    const hasPackage = existsSync(path.join(current, "Package.swift"));
    const hasDesktopApp = existsSync(path.join(current, "apps/desktop-electrobun"));
    const hasEngines = existsSync(path.join(current, "engines"));
    if (hasPackage && hasDesktopApp && hasEngines) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function resolveByTarget(engineTarget: EngineTarget, baseDir: string): string {
  const workspaceRoot = findWorkspaceRoot(baseDir);
  switch (engineTarget) {
    case "macos-swift":
      if (workspaceRoot) {
        return path.join(workspaceRoot, ".build/debug/guerillaglass-engine");
      }
      return path.resolve(baseDir, "../../../.build/debug/guerillaglass-engine");
    case "windows-native":
      if (workspaceRoot) {
        return path.join(workspaceRoot, "engines/windows-native/bin", WINDOWS_NATIVE_BINARY);
      }
      return path.resolve(baseDir, "../../../../engines/windows-native/bin", WINDOWS_NATIVE_BINARY);
    case "linux-native":
      if (workspaceRoot) {
        return path.join(workspaceRoot, "engines/linux-native/bin", LINUX_NATIVE_BINARY);
      }
      return path.resolve(baseDir, "../../../../engines/linux-native/bin", LINUX_NATIVE_BINARY);
    case "windows-stub":
      if (workspaceRoot) {
        return path.join(
          workspaceRoot,
          "engines/windows-stub/guerillaglass-engine-windows-stub.ts",
        );
      }
      return path.resolve(
        baseDir,
        "../../../../engines/windows-stub/guerillaglass-engine-windows-stub.ts",
      );
    case "linux-stub":
      if (workspaceRoot) {
        return path.join(workspaceRoot, "engines/linux-stub/guerillaglass-engine-linux-stub.ts");
      }
      return path.resolve(
        baseDir,
        "../../../../engines/linux-stub/guerillaglass-engine-linux-stub.ts",
      );
  }
}

function firstExisting(...paths: string[]): string {
  for (const candidate of paths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return paths[0] ?? "";
}

/** Resolves the engine executable path for the current environment. */
export function resolveEnginePath(options?: {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  baseDir?: string;
}): string {
  const env = options?.env ?? process.env;
  const platform = options?.platform ?? process.platform;
  const baseDir = options?.baseDir ?? import.meta.dir;

  if (env.GG_ENGINE_PATH) {
    return env.GG_ENGINE_PATH;
  }

  const engineTarget = (env.GG_ENGINE_TARGET ?? "").trim() as EngineTarget | "";
  if (engineTarget) {
    return resolveByTarget(engineTarget, baseDir);
  }

  if (platform === "win32") {
    return firstExisting(
      resolveByTarget("windows-native", baseDir),
      resolveByTarget("windows-stub", baseDir),
    );
  }
  if (platform === "linux") {
    return firstExisting(
      resolveByTarget("linux-native", baseDir),
      resolveByTarget("linux-stub", baseDir),
    );
  }

  return resolveByTarget("macos-swift", baseDir);
}

/** JSON-RPC client for the native engine stdio transport. */
export class EngineClient {
  private session: EngineSession | null = null;
  private sessionScope: Scope.CloseableScope | null = null;
  private pending = new Map<string, PendingRequest>();
  private sessionDeferred: Deferred.Deferred<EngineSession, EngineClientFailure> | null = null;
  private readonly enginePath: string;
  private readonly requestTimeoutMs: number;
  private readonly requestTimeoutByMethod: Readonly<Record<EngineRequest["method"], number>>;
  private readonly restartBackoffMs: number;
  private readonly restartJitterMs: number;
  private readonly maxRestartAttemptsInWindow: number;
  private readonly restartWindowMs: number;
  private readonly restartCircuitOpenMs: number;
  private readonly maxRetryAttempts: number;
  private restartAllowedAtMs = 0;
  private restartCircuitOpenUntilMs = 0;
  private restartTimestampsMs: number[] = [];
  private isStopping = false;
  private lastKnownCaptureStatus: CaptureStatusResult | null = null;

  constructor(
    enginePath = resolveEnginePath(),
    requestTimeoutMs = 15_000,
    options: EngineClientOptions = {},
  ) {
    this.enginePath = enginePath;
    this.requestTimeoutMs = requestTimeoutMs;
    this.requestTimeoutByMethod = Object.freeze({
      ...defaultRequestTimeoutByMethod,
      ...options.requestTimeoutByMethod,
    });
    this.restartBackoffMs = options.restartBackoffMs ?? 250;
    this.restartJitterMs = Math.max(0, options.restartJitterMs ?? 250);
    this.maxRestartAttemptsInWindow = Math.max(1, options.maxRestartAttemptsInWindow ?? 5);
    this.restartWindowMs = Math.max(1000, options.restartWindowMs ?? 30_000);
    this.restartCircuitOpenMs = Math.max(1000, options.restartCircuitOpenMs ?? 30_000);
    this.maxRetryAttempts = Math.max(0, options.maxRetryAttempts ?? 1);
  }

  startEffect(): Effect.Effect<void, EngineClientFailure> {
    return Effect.asVoid(this.ensureSessionEffect());
  }

  async start(): Promise<void> {
    await runEffectPromise(this.startEffect());
  }

  stopEffect(): Effect.Effect<void, never> {
    return Effect.gen(this, function* () {
      yield* Effect.sync(() => {
        this.isStopping = true;
      });
      yield* this.rejectAllPendingEffect(
        new EngineClientError({
          code: "ENGINE_CLIENT_STOPPED",
          description: "Engine client stopped",
        }),
      );

      const { session, scope } = yield* Effect.sync(() => ({
        session: this.session,
        scope: this.detachSessionScope(),
      }));

      try {
        yield* this.waitForSessionCloseEffect(scope, Exit.succeed(undefined), session, {
          maxWaitMs: stopShutdownGraceMs,
          reason: "client stop",
        });
      } finally {
        yield* Effect.sync(() => {
          this.isStopping = false;
        });
      }
    }).pipe(
      Effect.catchAll((error) =>
        this.isStopping ? Effect.void : Effect.logWarning("Engine client stop failed", error),
      ),
    );
  }

  async stop(): Promise<void> {
    await runEffectPromise(this.stopEffect());
  }

  private methodEffect<TSchema extends Schema.Schema.AnyNoContext, TArgs extends unknown[]>(
    definition: EngineMethodDefinition<TSchema, TArgs>,
    ...args: TArgs
  ): Effect.Effect<MutableDeep<Schema.Schema.Type<TSchema>>, EngineClientFailure> {
    return this.callAndParseEffect(
      definition.method,
      definition.toParams(...args),
      definition.schema,
    );
  }

  private captureMethodEffect<TSchema extends Schema.Schema.AnyNoContext, TArgs extends unknown[]>(
    definition: EngineMethodDefinition<TSchema, TArgs>,
    ...args: TArgs
  ): Effect.Effect<MutableDeep<Schema.Schema.Type<TSchema>>, EngineClientFailure> {
    return this.methodEffect(definition, ...args).pipe(
      Effect.tap((status) =>
        Effect.sync(() => {
          this.rememberCaptureStatus(status as CaptureStatusResult);
        }),
      ),
    );
  }

  pingEffect() {
    const definition = engineMethodDefinitions.ping;
    return this.methodEffect(definition);
  }

  async ping() {
    return await runEffectPromise(this.pingEffect());
  }

  capabilitiesEffect() {
    const definition = engineMethodDefinitions.capabilities;
    return this.methodEffect(definition);
  }

  async capabilities() {
    return await runEffectPromise(this.capabilitiesEffect());
  }

  agentPreflightEffect(params?: {
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: TranscriptionProvider;
    importedTranscriptPath?: string;
  }) {
    const definition = engineMethodDefinitions.agentPreflight;
    return this.methodEffect(definition, params);
  }

  async agentPreflight(params?: {
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: TranscriptionProvider;
    importedTranscriptPath?: string;
  }) {
    return await runEffectPromise(this.agentPreflightEffect(params));
  }

  agentRunEffect(params: {
    preflightToken: string;
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: TranscriptionProvider;
    importedTranscriptPath?: string;
    force?: boolean;
  }) {
    const definition = engineMethodDefinitions.agentRun;
    return this.methodEffect(definition, params);
  }

  async agentRun(params: {
    preflightToken: string;
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: TranscriptionProvider;
    importedTranscriptPath?: string;
    force?: boolean;
  }): Promise<AgentRunResult> {
    return await runEffectPromise(this.agentRunEffect(params));
  }

  /**
   * Sends a raw request payload directly to the engine without protocol request-shape validation.
   *
   * Intended for integration tests and diagnostics where callers need engine-originated errors.
   */
  async sendRaw(method: string, params: unknown, options?: { timeoutMs?: number }) {
    const rawRpcAllowed =
      process.env.NODE_ENV !== "production" || process.env.GG_ENGINE_ALLOW_RAW_RPC === "1";
    if (!rawRpcAllowed) {
      throw new EngineResponseError({
        code: "permission_denied",
        description:
          "sendRaw is disabled in production. Set GG_ENGINE_ALLOW_RAW_RPC=1 for diagnostics.",
      });
    }
    const trimmedMethod = method.trim();
    if (!trimmedMethod) {
      throw new EngineResponseError({
        code: "invalid_params",
        description: "method is required",
      });
    }
    const timeoutMs = this.resolveRawRequestTimeoutMs(trimmedMethod, options?.timeoutMs);
    return await runEffectPromise(this.requestRawEffect(trimmedMethod, params, timeoutMs));
  }

  agentStatusEffect(jobId: string) {
    const definition = engineMethodDefinitions.agentStatus;
    return this.methodEffect(definition, jobId);
  }

  async agentStatus(jobId: string) {
    return await runEffectPromise(this.agentStatusEffect(jobId));
  }

  agentApplyEffect(params: { jobId: string; destructiveIntent?: boolean }) {
    const definition = engineMethodDefinitions.agentApply;
    return this.methodEffect(definition, params);
  }

  async agentApply(params: { jobId: string; destructiveIntent?: boolean }) {
    return await runEffectPromise(this.agentApplyEffect(params));
  }

  getPermissionsEffect() {
    const definition = engineMethodDefinitions.getPermissions;
    return this.methodEffect(definition);
  }

  async getPermissions() {
    return await runEffectPromise(this.getPermissionsEffect());
  }

  requestScreenRecordingPermissionEffect() {
    const definition = engineMethodDefinitions.requestScreenRecordingPermission;
    return this.methodEffect(definition);
  }

  async requestScreenRecordingPermission() {
    return await runEffectPromise(this.requestScreenRecordingPermissionEffect());
  }

  requestMicrophonePermissionEffect() {
    const definition = engineMethodDefinitions.requestMicrophonePermission;
    return this.methodEffect(definition);
  }

  async requestMicrophonePermission() {
    return await runEffectPromise(this.requestMicrophonePermissionEffect());
  }

  requestInputMonitoringPermissionEffect() {
    const definition = engineMethodDefinitions.requestInputMonitoringPermission;
    return this.methodEffect(definition);
  }

  async requestInputMonitoringPermission() {
    return await runEffectPromise(this.requestInputMonitoringPermissionEffect());
  }

  openInputMonitoringSettingsEffect() {
    const definition = engineMethodDefinitions.openInputMonitoringSettings;
    return this.methodEffect(definition);
  }

  async openInputMonitoringSettings() {
    return await runEffectPromise(this.openInputMonitoringSettingsEffect());
  }

  listSourcesEffect() {
    const definition = engineMethodDefinitions.listSources;
    return this.methodEffect(definition);
  }

  async listSources() {
    return await runEffectPromise(this.listSourcesEffect());
  }

  startDisplayCaptureEffect(
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ) {
    const definition = engineMethodDefinitions.startDisplayCapture;
    return this.captureMethodEffect(definition, enableMic, captureFps);
  }

  async startDisplayCapture(
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ) {
    return await runEffectPromise(this.startDisplayCaptureEffect(enableMic, captureFps));
  }

  startCurrentWindowCaptureEffect(
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ) {
    const definition = engineMethodDefinitions.startCurrentWindowCapture;
    return this.captureMethodEffect(definition, enableMic, captureFps);
  }

  async startCurrentWindowCapture(
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ) {
    return await runEffectPromise(this.startCurrentWindowCaptureEffect(enableMic, captureFps));
  }

  startWindowCaptureEffect(
    windowId: number,
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ) {
    const definition = engineMethodDefinitions.startWindowCapture;
    return this.captureMethodEffect(definition, windowId, enableMic, captureFps);
  }

  async startWindowCapture(
    windowId: number,
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ) {
    return await runEffectPromise(this.startWindowCaptureEffect(windowId, enableMic, captureFps));
  }

  stopCaptureEffect() {
    const definition = engineMethodDefinitions.stopCapture;
    return this.captureMethodEffect(definition).pipe(
      Effect.catchAll((error) => {
        if (!(error instanceof EngineClientError) || error.code !== "ENGINE_REQUEST_TIMEOUT") {
          return Effect.fail(error);
        }
        return Effect.gen(this, function* () {
          const liveStatus = yield* this.tryCaptureStatusProbeEffect(750);
          if (liveStatus?.isRecording) {
            return yield* Effect.fail(
              new EngineResponseError({
                code: "recording_abandoned",
                description:
                  "capture.stop timed out while recording was active. " +
                  "The engine was not force-restarted to avoid discarding the in-progress recording. " +
                  "Retry recording.stop or capture.stop.",
              }),
            );
          }
          if (liveStatus && !liveStatus.isRunning) {
            yield* Effect.sync(() => {
              this.rememberCaptureStatus(liveStatus);
            });
            return liveStatus;
          }
          if (!liveStatus) {
            if (this.lastKnownCaptureStatus?.isRecording) {
              return yield* Effect.fail(
                new EngineResponseError({
                  code: "recording_abandoned",
                  description:
                    "capture.stop timed out and capture.status could not confirm stop. " +
                    "The engine was not force-restarted to avoid discarding a potentially active recording. " +
                    "Retry recording.stop or capture.stop.",
                }),
              );
            }
            return yield* Effect.fail(
              new EngineOperationError({
                operation: "capture.stop",
                description:
                  "capture.stop recovery aborted: capture.status probe timed out and recording state is unknown. " +
                  "The engine was not force-restarted to avoid abandoning a potentially in-progress recording. " +
                  "Retry capture.status or capture.stop.",
              }),
            );
          }
          yield* this.resetForRetryEffect();
          yield* this.startEffect();
          const recoveredStatus = yield* this.tryCaptureStatusProbeEffect(5000);
          if (!recoveredStatus) {
            return yield* Effect.fail(
              new EngineOperationError({
                operation: "capture.stop",
                description:
                  "capture.stop recovery failed after engine restart: capture.status probe timed out. " +
                  "Retry capture.status once the engine is responsive.",
              }),
            );
          }
          yield* Effect.sync(() => {
            this.rememberCaptureStatus(recoveredStatus);
          });
          return recoveredStatus;
        });
      }),
    );
  }

  async stopCapture() {
    return await runEffectPromise(this.stopCaptureEffect());
  }

  startRecordingEffect(trackInputEvents: boolean) {
    const definition = engineMethodDefinitions.startRecording;
    return this.captureMethodEffect(definition, trackInputEvents);
  }

  async startRecording(trackInputEvents: boolean) {
    return await runEffectPromise(this.startRecordingEffect(trackInputEvents));
  }

  stopRecordingEffect() {
    const definition = engineMethodDefinitions.stopRecording;
    return this.captureMethodEffect(definition);
  }

  async stopRecording() {
    return await runEffectPromise(this.stopRecordingEffect());
  }

  captureStatusEffect() {
    const definition = engineMethodDefinitions.captureStatus;
    return this.captureMethodEffect(definition);
  }

  async captureStatus() {
    return await runEffectPromise(this.captureStatusEffect());
  }

  capturePreviewFrameEffect() {
    const definition = engineMethodDefinitions.capturePreviewFrame;
    return this.methodEffect(definition);
  }

  async capturePreviewFrame(): Promise<CapturePreviewFrameResult> {
    return await runEffectPromise(this.capturePreviewFrameEffect());
  }

  exportInfoEffect() {
    const definition = engineMethodDefinitions.exportInfo;
    return this.methodEffect(definition);
  }

  async exportInfo() {
    return await runEffectPromise(this.exportInfoEffect());
  }

  runExportEffect(params: {
    outputURL: string;
    presetId: string;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
  }) {
    const definition = engineMethodDefinitions.runExport;
    return this.methodEffect(definition, params);
  }

  async runExport(params: {
    outputURL: string;
    presetId: string;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
  }) {
    return await runEffectPromise(this.runExportEffect(params));
  }

  runCutPlanExportEffect(params: { outputURL: string; presetId: string; jobId: string }) {
    const definition = engineMethodDefinitions.runCutPlanExport;
    return this.methodEffect(definition, params);
  }

  async runCutPlanExport(params: { outputURL: string; presetId: string; jobId: string }) {
    return await runEffectPromise(this.runCutPlanExportEffect(params));
  }

  projectCurrentEffect() {
    const definition = engineMethodDefinitions.projectCurrent;
    return this.methodEffect(definition);
  }

  async projectCurrent() {
    return await runEffectPromise(this.projectCurrentEffect());
  }

  projectOpenEffect(projectPath: string) {
    const definition = engineMethodDefinitions.projectOpen;
    return this.methodEffect(definition, projectPath);
  }

  async projectOpen(projectPath: string) {
    return await runEffectPromise(this.projectOpenEffect(projectPath));
  }

  projectSaveEffect(params: { projectPath?: string; autoZoom?: AutoZoomSettings }) {
    const definition = engineMethodDefinitions.projectSave;
    return this.methodEffect(definition, params);
  }

  async projectSave(params: { projectPath?: string; autoZoom?: AutoZoomSettings }) {
    return await runEffectPromise(this.projectSaveEffect(params));
  }

  projectRecentsEffect(limit?: number) {
    const definition = engineMethodDefinitions.projectRecents;
    return this.methodEffect(definition, limit);
  }

  async projectRecents(limit?: number) {
    return await runEffectPromise(this.projectRecentsEffect(limit));
  }

  private callAndParseEffect<TSchema extends Schema.Schema.AnyNoContext>(
    method: EngineRequest["method"],
    params: unknown,
    schema: TSchema,
  ): Effect.Effect<MutableDeep<Schema.Schema.Type<TSchema>>, EngineClientFailure> {
    return this.requestEffect(method, params, 0).pipe(
      Effect.flatMap((result) => decodeUnknownWithSchema(schema, result, `${method} result`)),
    );
  }

  private requestRawEffect(
    method: string,
    params: unknown,
    timeoutMs: number,
  ): Effect.Effect<unknown, EngineClientFailure> {
    return this.ensureSessionEffect().pipe(
      Effect.flatMap((session) =>
        this.dispatchRawRequestEffect(session, method, params, timeoutMs),
      ),
    );
  }

  private requestEffect(
    method: EngineRequest["method"],
    params: unknown,
    attempt: number,
  ): Effect.Effect<unknown, EngineClientFailure> {
    return this.ensureSessionEffect().pipe(
      Effect.flatMap((session) =>
        this.dispatchRequestEffect(session, method, params, this.resolveRequestTimeoutMs(method)),
      ),
      Effect.catchAll((error) => {
        if (!this.shouldRetryRequest(method, error, attempt)) {
          return Effect.fail(error);
        }
        return this.resetForRetryEffect().pipe(
          Effect.flatMap(() => this.requestEffect(method, params, attempt + 1)),
        );
      }),
    );
  }

  private dispatchPendingPayloadEffect(
    session: EngineSession,
    requestId: string,
    method: string,
    payload: string,
    timeoutMs: number,
  ): Effect.Effect<unknown, EngineClientFailure> {
    return Effect.gen(this, function* () {
      const pending = yield* Deferred.make<unknown, EngineClientFailure>();
      yield* Effect.sync(() => {
        this.pending.set(requestId, pending);
      });

      const awaitPending =
        Number.isFinite(timeoutMs) && timeoutMs > 0
          ? Deferred.await(pending).pipe(
              Effect.timeoutFail({
                duration: `${Math.max(1, Math.round(timeoutMs))} millis`,
                onTimeout: () =>
                  new EngineClientError({
                    code: "ENGINE_REQUEST_TIMEOUT",
                    description: `Engine request timed out: ${method}`,
                  }),
              }),
            )
          : Deferred.await(pending);

      return yield* Effect.try({
        try: () => session.stdin.write(textEncoder.encode(payload)),
        catch: (cause) =>
          new EngineClientError({
            code: "ENGINE_STDIO_WRITE_FAILED",
            description: "Failed to write request to engine stdin",
            cause,
          }),
      }).pipe(
        Effect.zipRight(awaitPending),
        Effect.ensuring(
          Effect.sync(() => {
            if (this.pending.get(requestId) === pending) {
              this.pending.delete(requestId);
            }
          }),
        ),
      );
    });
  }

  private rememberCaptureStatus(status: CaptureStatusResult): void {
    this.lastKnownCaptureStatus = status;
  }

  private tryCaptureStatusProbeEffect(
    timeoutMs: number,
  ): Effect.Effect<CaptureStatusResult | null, never> {
    const definition = engineMethodDefinitions.captureStatus;
    return this.ensureSessionEffect().pipe(
      Effect.flatMap((session) =>
        this.dispatchRequestEffect(session, definition.method, definition.toParams(), timeoutMs),
      ),
      Effect.flatMap((result) =>
        decodeUnknownWithSchema(definition.schema, result, `${definition.method} result`),
      ),
      Effect.catchAll(() => Effect.succeed(null)),
    );
  }

  private dispatchRequestEffect(
    session: EngineSession,
    method: EngineRequest["method"],
    params: unknown,
    timeoutMs: number,
  ): Effect.Effect<unknown, EngineClientFailure> {
    let request: EngineRequest;
    try {
      request = buildRequest(method as EngineRequestEncoded["method"], params as never);
    } catch (error) {
      return Effect.fail(toInvalidParamsError(method, error));
    }
    const payload = `${JSON.stringify(request)}\n`;
    return this.dispatchPendingPayloadEffect(session, request.id, method, payload, timeoutMs);
  }

  private dispatchRawRequestEffect(
    session: EngineSession,
    method: string,
    params: unknown,
    timeoutMs: number,
  ): Effect.Effect<unknown, EngineClientFailure> {
    const requestId = crypto.randomUUID();
    const payload = `${JSON.stringify({ id: requestId, method, params: params ?? {} })}\n`;
    return this.dispatchPendingPayloadEffect(session, requestId, method, payload, timeoutMs);
  }

  private readStdoutEffect(session: EngineSession): Effect.Effect<void, never> {
    if (!session.process.stdout) {
      return Effect.void;
    }

    return Effect.acquireUseRelease(
      Effect.sync(() => ({
        reader: session.process.stdout!.getReader(),
        decoder: new TextDecoder(),
      })),
      ({ reader, decoder }) =>
        this.readLinesEffect(reader, decoder, "", (line) =>
          this.handleResponseLineEffect(line),
        ).pipe(
          Effect.catchAll((error) =>
            this.logSessionWarningEffect(session, "Engine stdout stream failed", error),
          ),
        ),
      ({ reader }) =>
        Effect.sync(() => {
          reader.releaseLock();
        }),
    );
  }

  private readStderrEffect(session: EngineSession): Effect.Effect<void, never> {
    if (!session.process.stderr) {
      return Effect.void;
    }

    return Effect.acquireUseRelease(
      Effect.sync(() => ({
        reader: session.process.stderr!.getReader(),
        decoder: new TextDecoder(),
      })),
      ({ reader, decoder }) =>
        this.readLinesEffect(reader, decoder, "", (line) =>
          this.logEngineStderrLineEffect(session, line),
        ).pipe(
          Effect.catchAll((error) =>
            this.logSessionWarningEffect(session, "Engine stderr stream failed", error),
          ),
        ),
      ({ reader }) =>
        Effect.sync(() => {
          reader.releaseLock();
        }),
    );
  }

  private readLinesEffect(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    buffer: string,
    onLine: (line: string) => Effect.Effect<void, never>,
  ): Effect.Effect<void, EngineOperationError> {
    return Effect.tryPromise({
      try: () => reader.read(),
      catch: (cause) =>
        new EngineOperationError({
          operation: "engine.stream.read",
          description: messageFromUnknownError(cause, "Engine stream read failed."),
        }),
    }).pipe(
      Effect.flatMap(({ value, done }) => {
        if (done) {
          return this.flushBufferedLineEffect(buffer, onLine);
        }
        return this.processBufferedLinesEffect(
          buffer + decoder.decode(value, { stream: true }),
          onLine,
        ).pipe(
          Effect.flatMap((remainingBuffer) =>
            this.readLinesEffect(reader, decoder, remainingBuffer, onLine),
          ),
        );
      }),
    );
  }

  private processBufferedLinesEffect(
    buffer: string,
    onLine: (line: string) => Effect.Effect<void, never>,
  ): Effect.Effect<string, never> {
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex < 0) {
      return Effect.succeed(buffer);
    }

    const line = buffer.slice(0, newlineIndex).trim();
    const remainingBuffer = buffer.slice(newlineIndex + 1);
    const handleLine = line.length > 0 ? onLine(line) : Effect.void;
    return handleLine.pipe(
      Effect.zipRight(this.processBufferedLinesEffect(remainingBuffer, onLine)),
    );
  }

  private flushBufferedLineEffect(
    buffer: string,
    onLine: (line: string) => Effect.Effect<void, never>,
  ): Effect.Effect<void, never> {
    const trailingLine = buffer.trim();
    if (trailingLine.length === 0) {
      return Effect.void;
    }
    return onLine(trailingLine);
  }

  private handleResponseLineEffect(line: string): Effect.Effect<void, never> {
    return Effect.gen(this, function* () {
      const rawResponse = yield* parseJsonString(line, "engine response");
      const response = yield* decodeUnknownWithSchema(
        engineResponseSchema,
        rawResponse,
        "engine response",
      );
      const pending = yield* Effect.sync(() => this.takePendingRequest(response.id));
      if (!pending) {
        return;
      }

      if (response.ok) {
        yield* Deferred.succeed(pending, response.result);
        return;
      }

      yield* Deferred.fail(
        pending,
        new EngineResponseError({
          code: response.error.code,
          description: response.error.message,
        }),
      );
    }).pipe(
      Effect.catchAll((error) =>
        this.rejectPendingForInvalidResponseLineEffect(line, error).pipe(
          Effect.zipRight(Effect.logWarning("Failed to parse engine response", error)),
        ),
      ),
    );
  }

  private watchProcessExitEffect(session: EngineSession): Effect.Effect<void, never> {
    return Effect.tryPromise(() => session.process.exited).pipe(
      Effect.flatMap((exitCode) => this.handleUnexpectedProcessExitEffect(session, exitCode)),
      Effect.catchAll((error) => this.handleUnexpectedProcessFailureEffect(session, error)),
    );
  }

  private handleUnexpectedProcessExitEffect(
    session: EngineSession,
    exitCode: number,
  ): Effect.Effect<void, never> {
    return Effect.gen(this, function* () {
      const { scope, isStopping } = yield* Effect.sync(() => ({
        scope: this.detachSessionScope(session),
        isStopping: this.isStopping,
      }));

      if (scope === null) {
        return;
      }
      if (isStopping) {
        yield* this.closeSessionScopeEffect(scope, Exit.succeed(undefined));
        return;
      }

      yield* Effect.sync(() => {
        this.registerUnexpectedRestart();
      });
      yield* this.rejectAllPendingEffect(
        new EngineClientError({
          code: "ENGINE_PROCESS_EXITED",
          description: `Engine process exited unexpectedly (code ${exitCode})`,
        }),
      );
      yield* this.closeSessionScopeEffect(scope, Exit.succeed(undefined));
    });
  }

  private handleUnexpectedProcessFailureEffect(
    session: EngineSession,
    error: unknown,
  ): Effect.Effect<void, never> {
    return Effect.gen(this, function* () {
      const { scope, isStopping } = yield* Effect.sync(() => ({
        scope: this.detachSessionScope(session),
        isStopping: this.isStopping,
      }));

      if (scope === null) {
        return;
      }
      if (isStopping) {
        yield* this.closeSessionScopeEffect(scope, Exit.succeed(undefined));
        return;
      }

      yield* Effect.sync(() => {
        this.registerUnexpectedRestart();
      });
      yield* this.rejectAllPendingEffect(
        new EngineClientError({
          code: "ENGINE_PROCESS_FAILED",
          description: messageFromUnknownError(error, "Engine process failed."),
          cause: error,
        }),
      );
      yield* this.closeSessionScopeEffect(scope, Exit.succeed(undefined));
    });
  }

  private rejectPendingForInvalidResponseLineEffect(
    line: string,
    error: unknown,
  ): Effect.Effect<void, never> {
    const normalizedError =
      error instanceof ContractDecodeError ||
      error instanceof EngineClientError ||
      error instanceof EngineOperationError ||
      error instanceof EngineRequestValidationError ||
      error instanceof EngineResponseError ||
      error instanceof JsonParseError
        ? error
        : new EngineOperationError({
            operation: "engine.response",
            description: messageFromUnknownError(error, "Invalid engine response."),
          });
    const responseId = this.tryReadResponseId(line);
    if (responseId) {
      return this.rejectPendingRequestEffect(responseId, normalizedError);
    }
    return this.rejectAllPendingEffect(normalizedError);
  }

  private tryReadResponseId(line: string): string | null {
    try {
      return responseIdFromUnknown(parseJsonStringSync(line, "engine response"));
    } catch {
      return null;
    }
  }

  private takePendingRequest(requestId: string): PendingRequest | null {
    const pending = this.pending.get(requestId);
    if (!pending) {
      return null;
    }
    this.pending.delete(requestId);
    return pending;
  }

  private rejectPendingRequestEffect(
    requestId: string,
    error: EngineClientFailure,
  ): Effect.Effect<void, never> {
    return Effect.gen(this, function* () {
      const pending = yield* Effect.sync(() => this.takePendingRequest(requestId));
      if (!pending) {
        return;
      }
      yield* Deferred.fail(pending, error);
    });
  }

  private rejectAllPendingEffect(error: EngineClientFailure): Effect.Effect<void, never> {
    return Effect.gen(this, function* () {
      const pendingRequests = yield* Effect.sync(() => {
        const requests = Array.from(this.pending.values());
        this.pending.clear();
        return requests;
      });
      yield* Effect.forEach(pendingRequests, (pending) => Deferred.fail(pending, error), {
        discard: true,
      });
    });
  }

  private resolveRequestTimeoutMs(method: EngineRequest["method"]): number {
    return this.requestTimeoutByMethod[method] ?? this.requestTimeoutMs;
  }

  private resolveRawRequestTimeoutMs(method: string, explicitTimeoutMs?: number): number {
    if (typeof explicitTimeoutMs === "number") {
      return explicitTimeoutMs;
    }
    if (method in requestMethodPolicy) {
      return this.resolveRequestTimeoutMs(method as EngineRequest["method"]);
    }
    return this.requestTimeoutMs;
  }

  private shouldRetryRequest(
    method: EngineRequest["method"],
    error: unknown,
    attempt: number,
  ): boolean {
    if (attempt >= this.maxRetryAttempts || this.isStopping) {
      return false;
    }
    if (!retryableReadMethods.has(method)) {
      return false;
    }
    if (!(error instanceof EngineClientError)) {
      return false;
    }
    return retryableTransportErrors.has(error.code);
  }

  private resetForRetryEffect(): Effect.Effect<void, never> {
    return Effect.gen(this, function* () {
      yield* Effect.sync(() => {
        this.registerUnexpectedRestart();
      });

      const { session, scope } = yield* Effect.sync(() => ({
        session: this.session,
        scope: this.detachSessionScope(),
      }));
      yield* this.waitForSessionCloseEffect(scope, Exit.succeed(undefined), session, {
        maxWaitMs: retryShutdownGraceMs,
        reason: "request retry",
      });
    });
  }

  private registerUnexpectedRestart(): void {
    const now = Date.now();
    this.restartAllowedAtMs = now + this.computeRestartDelayMs();

    this.restartTimestampsMs = this.restartTimestampsMs.filter(
      (timestamp) => now - timestamp <= this.restartWindowMs,
    );
    this.restartTimestampsMs.push(now);

    if (this.restartTimestampsMs.length > this.maxRestartAttemptsInWindow) {
      this.restartCircuitOpenUntilMs = now + this.restartCircuitOpenMs;
    }
  }

  private computeRestartDelayMs(): number {
    if (this.restartJitterMs === 0) {
      return this.restartBackoffMs;
    }
    return this.restartBackoffMs + Math.floor(Math.random() * (this.restartJitterMs + 1));
  }

  private throwIfRestartCircuitOpen(): void {
    const now = Date.now();
    if (this.restartCircuitOpenUntilMs <= now) {
      return;
    }

    throw new EngineClientError({
      code: "ENGINE_RESTART_CIRCUIT_OPEN",
      description: `Engine restart circuit open until ${new Date(this.restartCircuitOpenUntilMs).toISOString()}`,
    });
  }

  private ensureSessionEffect(): Effect.Effect<EngineSession, EngineClientFailure> {
    return Effect.fiberId.pipe(
      Effect.flatMap((fiberId) =>
        Effect.sync((): SessionAcquisitionState => {
          if (this.session) {
            return { _tag: "session", session: this.session };
          }
          if (this.sessionDeferred) {
            return { _tag: "pending", pending: this.sessionDeferred };
          }
          const pending = Deferred.unsafeMake<EngineSession, EngineClientFailure>(fiberId);
          this.sessionDeferred = pending;
          return { _tag: "acquire", pending };
        }),
      ),
      Effect.flatMap((state) => {
        switch (state._tag) {
          case "session":
            return Effect.succeed(state.session);
          case "pending":
            return Deferred.await(state.pending);
          case "acquire":
            return Effect.zipRight(
              Effect.forkDaemon(
                this.acquireAndStoreSessionEffect().pipe(
                  Effect.intoDeferred(state.pending),
                  Effect.ensuring(
                    Effect.sync(() => {
                      if (this.sessionDeferred === state.pending) {
                        this.sessionDeferred = null;
                      }
                    }),
                  ),
                ),
              ),
              Deferred.await(state.pending),
            );
        }
      }),
    );
  }

  private acquireAndStoreSessionEffect(): Effect.Effect<EngineSession, EngineClientFailure> {
    return Effect.gen(this, function* () {
      const scope = yield* Scope.make();
      const acquisition = yield* Effect.exit(Scope.extend(this.acquireSessionEffect(), scope));
      if (Exit.isFailure(acquisition)) {
        yield* this.closeSessionScopeEffect(scope, acquisition);
        return yield* Effect.failCause(acquisition.cause);
      }

      const session = acquisition.value;
      const stopping = yield* Effect.sync(() => this.isStopping);
      if (stopping) {
        yield* this.closeSessionScopeEffect(scope, Exit.succeed(undefined));
        return yield* Effect.fail(
          new EngineClientError({
            code: "ENGINE_CLIENT_STOPPED",
            description: "Engine client stopped",
          }),
        );
      }

      yield* Effect.sync(() => {
        this.sessionScope = scope;
        this.session = session;
        this.isStopping = false;
      });
      return session;
    });
  }

  private acquireSessionEffect(): Effect.Effect<EngineSession, EngineClientFailure, Scope.Scope> {
    return Effect.gen(this, function* () {
      yield* Effect.sync(() => {
        this.throwIfRestartCircuitOpen();
      });

      const waitMs = Math.max(0, this.restartAllowedAtMs - Date.now());
      if (waitMs > 0) {
        yield* Effect.sleep(`${waitMs} millis`);
      }

      const command = yield* this.resolveEngineCommandEffect();
      const session = yield* Effect.acquireRelease(
        Effect.try({
          try: () => {
            const process: EngineProcess = Bun.spawn({
              cmd: command,
              stdin: "pipe",
              stdout: "pipe",
              stderr: "pipe",
            });
            return {
              process,
              stdin: process.stdin as unknown as EngineStdin,
            } satisfies EngineSession;
          },
          catch: (cause) =>
            new EngineClientError({
              code: "ENGINE_PROCESS_UNAVAILABLE",
              description: messageFromUnknownError(cause, "Failed to spawn engine process."),
              cause,
            }),
        }),
        (session) => this.releaseSessionEffect(session),
      );

      yield* this.watchProcessExitEffect(session).pipe(Effect.forkScoped);
      yield* this.readStdoutEffect(session).pipe(Effect.forkScoped);
      yield* this.readStderrEffect(session).pipe(Effect.forkScoped);

      return session;
    });
  }

  private resolveEngineCommandEffect(): Effect.Effect<string[], EngineClientFailure> {
    if (!existsSync(this.enginePath)) {
      return Effect.fail(
        new EngineClientError({
          code: "ENGINE_PROCESS_UNAVAILABLE",
          description: `Engine executable not found at ${this.enginePath}. Run bun run swift:build or set GG_ENGINE_PATH.`,
        }),
      );
    }
    return Effect.succeed(
      this.enginePath.endsWith(".ts") ? ["bun", this.enginePath] : [this.enginePath],
    );
  }

  private detachSessionScope(expectedSession?: EngineSession): Scope.CloseableScope | null {
    if (expectedSession && this.session !== expectedSession) {
      return null;
    }
    const scope = this.sessionScope;
    this.sessionScope = null;
    this.session = null;
    return scope;
  }

  private waitForSessionCloseEffect(
    scope: Scope.CloseableScope | null,
    exit: Exit.Exit<unknown, unknown>,
    session: EngineSession | null,
    options: SessionCloseOptions,
  ): Effect.Effect<void, never> {
    if (
      !session ||
      options.maxWaitMs === undefined ||
      !Number.isFinite(options.maxWaitMs) ||
      options.maxWaitMs <= 0
    ) {
      return this.closeSessionScopeEffect(scope, exit);
    }

    return this.closeSessionScopeEffect(scope, exit).pipe(
      Effect.zipRight(this.waitForProcessExitEffect(session, options.maxWaitMs)),
      Effect.flatMap((exitedCleanly) => {
        if (exitedCleanly) {
          return Effect.void;
        }
        return this.logScopeWarningEffect(
          `Engine session shutdown exceeded ${options.maxWaitMs}ms during ${options.reason}; sending SIGKILL.`,
        ).pipe(
          Effect.zipRight(
            Effect.try({
              try: () => session.process.kill("SIGKILL"),
              catch: (cause) =>
                new EngineOperationError({
                  operation: "engine.process.kill",
                  description: messageFromUnknownError(
                    cause,
                    "Failed to force-kill engine process cleanly.",
                  ),
                }),
            }).pipe(
              Effect.catchAll((error) =>
                this.logScopeWarningEffect("Failed to force-kill engine process cleanly", error),
              ),
            ),
          ),
          Effect.zipRight(
            Effect.raceFirst(
              Effect.tryPromise(() => session.process.exited).pipe(
                Effect.asVoid,
                Effect.catchAll(() => Effect.void),
              ),
              Effect.sleep(`${forcedShutdownDrainMs} millis`),
            ),
          ),
        );
      }),
    );
  }

  private waitForProcessExitEffect(
    session: EngineSession,
    waitMs: number,
  ): Effect.Effect<boolean, never> {
    return Effect.raceFirst(
      Effect.tryPromise(() => session.process.exited).pipe(
        Effect.as(true),
        Effect.catchAll(() => Effect.succeed(true)),
      ),
      Effect.sleep(`${Math.max(1, Math.round(waitMs))} millis`).pipe(Effect.as(false)),
    );
  }

  private closeSessionScopeEffect(
    scope: Scope.CloseableScope | null,
    exit: Exit.Exit<unknown, unknown>,
  ): Effect.Effect<void, never> {
    if (!scope) {
      return Effect.void;
    }
    return Scope.close(scope, exit).pipe(
      Effect.catchAll((error) =>
        this.logScopeWarningEffect("Failed to close engine session scope cleanly", error),
      ),
    );
  }

  private releaseSessionEffect(session: EngineSession): Effect.Effect<void, never> {
    return Effect.gen(this, function* () {
      yield* Effect.sync(() => {
        if (this.session === session) {
          this.session = null;
        }
      });

      yield* Effect.try({
        try: () => session.stdin.end(),
        catch: (cause) =>
          new EngineOperationError({
            operation: "engine.stdin.end",
            description: messageFromUnknownError(cause, "Failed to close engine stdin cleanly."),
          }),
      }).pipe(
        Effect.catchAll((error) =>
          this.logScopeWarningEffect("Failed to close engine stdin cleanly", error),
        ),
      );

      yield* Effect.try({
        try: () => session.process.kill(),
        catch: (cause) =>
          new EngineOperationError({
            operation: "engine.process.kill",
            description: messageFromUnknownError(cause, "Failed to kill engine process cleanly."),
          }),
      }).pipe(
        Effect.catchAll((error) =>
          this.logScopeWarningEffect("Failed to kill engine process cleanly", error),
        ),
      );
    });
  }

  private logEngineStderrLineEffect(
    session: EngineSession,
    line: string,
  ): Effect.Effect<void, never> {
    return Effect.suspend(() =>
      this.session === session && !this.isStopping
        ? Effect.logError(`[engine] ${line}`)
        : Effect.void,
    );
  }

  private logSessionWarningEffect(
    session: EngineSession,
    message: string,
    error: unknown,
  ): Effect.Effect<void, never> {
    return Effect.suspend(() =>
      this.session === session && !this.isStopping
        ? Effect.logWarning(message, error)
        : Effect.void,
    );
  }

  private logScopeWarningEffect(message: string, error?: unknown): Effect.Effect<void, never> {
    return Effect.suspend(() =>
      this.isStopping
        ? Effect.void
        : error === undefined
          ? Effect.logWarning(message)
          : Effect.logWarning(message, error),
    );
  }
}
