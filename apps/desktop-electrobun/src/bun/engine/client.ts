import { existsSync } from "node:fs";
import path from "node:path";
import { Effect, Exit, Scope, Schema } from "effect";
import {
  agentPreflightResultSchema,
  agentRunResultSchema,
  agentStatusResultSchema,
  actionResultSchema,
  capabilitiesResultSchema,
  buildRequest,
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
  type CaptureStatusResult,
  type CaptureFrameRate,
  type EngineRequest,
  type EngineRequestEncoded,
  type TranscriptionProvider,
} from "@guerillaglass/engine-protocol";
import {
  EngineClientError,
  EngineOperationError,
  EngineRequestValidationError,
  EngineResponseError,
  decodeUnknownWithSchemaPromise,
  decodeUnknownWithSchemaSync,
  parseJsonStringSync,
  runEffectSync,
  runEffectPromise,
  type EngineClientErrorCode,
  type MutableDeep,
  extractValidationIssues,
} from "../../shared/errors";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

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

function responseIdFromUnknown(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const responseId = (raw as { id?: unknown }).id;
  return typeof responseId === "string" && responseId.length > 0 ? responseId : null;
}

function toInvalidParamsError(method: string, error: unknown): Error {
  const issues = extractValidationIssues(error);
  if (issues.length === 0) {
    return error instanceof Error
      ? error
      : new EngineOperationError({
          operation: method,
          description: String(error),
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
  private sessionPromise: Promise<EngineSession> | null = null;
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

  async start(): Promise<void> {
    await this.ensureSession();
  }

  async stop(): Promise<void> {
    this.isStopping = true;
    this.rejectAllPending(
      new EngineClientError({
        code: "ENGINE_CLIENT_STOPPED",
        description: "Engine client stopped",
      }),
    );
    const session = this.session;
    try {
      const closePromise = this.closeSessionScope(
        this.detachSessionScope(),
        Exit.succeed(undefined),
      );
      await this.waitForSessionClose(closePromise, session, {
        maxWaitMs: stopShutdownGraceMs,
        reason: "client stop",
      });
    } finally {
      this.isStopping = false;
    }
  }

  async ping() {
    const definition = engineMethodDefinitions.ping;
    return this.callAndParse(definition.method, definition.toParams(), definition.schema);
  }

  async capabilities() {
    const definition = engineMethodDefinitions.capabilities;
    return this.callAndParse(definition.method, definition.toParams(), definition.schema);
  }

  async agentPreflight(params?: {
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: TranscriptionProvider;
    importedTranscriptPath?: string;
  }) {
    const definition = engineMethodDefinitions.agentPreflight;
    return this.callAndParse(definition.method, definition.toParams(params), definition.schema);
  }

  async agentRun(params: {
    preflightToken: string;
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: TranscriptionProvider;
    importedTranscriptPath?: string;
    force?: boolean;
  }): Promise<AgentRunResult> {
    const definition = engineMethodDefinitions.agentRun;
    return this.callAndParse(definition.method, definition.toParams(params), definition.schema);
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
    return this.requestRaw(trimmedMethod, params, timeoutMs);
  }

  async agentStatus(jobId: string) {
    const definition = engineMethodDefinitions.agentStatus;
    return this.callAndParse(definition.method, definition.toParams(jobId), definition.schema);
  }

  async agentApply(params: { jobId: string; destructiveIntent?: boolean }) {
    const definition = engineMethodDefinitions.agentApply;
    return this.callAndParse(definition.method, definition.toParams(params), definition.schema);
  }

  async getPermissions() {
    const definition = engineMethodDefinitions.getPermissions;
    return this.callAndParse(definition.method, definition.toParams(), definition.schema);
  }

  async requestScreenRecordingPermission() {
    const definition = engineMethodDefinitions.requestScreenRecordingPermission;
    return this.callAndParse(definition.method, definition.toParams(), definition.schema);
  }

  async requestMicrophonePermission() {
    const definition = engineMethodDefinitions.requestMicrophonePermission;
    return this.callAndParse(definition.method, definition.toParams(), definition.schema);
  }

  async requestInputMonitoringPermission() {
    const definition = engineMethodDefinitions.requestInputMonitoringPermission;
    return this.callAndParse(definition.method, definition.toParams(), definition.schema);
  }

  async openInputMonitoringSettings() {
    const definition = engineMethodDefinitions.openInputMonitoringSettings;
    return this.callAndParse(definition.method, definition.toParams(), definition.schema);
  }

  async listSources() {
    const definition = engineMethodDefinitions.listSources;
    return this.callAndParse(definition.method, definition.toParams(), definition.schema);
  }

  async startDisplayCapture(
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ) {
    const definition = engineMethodDefinitions.startDisplayCapture;
    const status = await this.callAndParse(
      definition.method,
      definition.toParams(enableMic, captureFps),
      definition.schema,
    );
    this.rememberCaptureStatus(status);
    return status;
  }

  async startCurrentWindowCapture(
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ) {
    const definition = engineMethodDefinitions.startCurrentWindowCapture;
    const status = await this.callAndParse(
      definition.method,
      definition.toParams(enableMic, captureFps),
      definition.schema,
    );
    this.rememberCaptureStatus(status);
    return status;
  }

  async startWindowCapture(
    windowId: number,
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ) {
    const definition = engineMethodDefinitions.startWindowCapture;
    const status = await this.callAndParse(
      definition.method,
      definition.toParams(windowId, enableMic, captureFps),
      definition.schema,
    );
    this.rememberCaptureStatus(status);
    return status;
  }

  async stopCapture() {
    const definition = engineMethodDefinitions.stopCapture;
    try {
      const status = await this.callAndParse(
        definition.method,
        definition.toParams(),
        definition.schema,
      );
      this.rememberCaptureStatus(status);
      return status;
    } catch (error) {
      if (!(error instanceof EngineClientError) || error.code !== "ENGINE_REQUEST_TIMEOUT") {
        throw error;
      }
      const liveStatus = await this.tryCaptureStatusProbe(750);
      if (liveStatus?.isRecording) {
        throw new EngineResponseError({
          code: "recording_abandoned",
          description:
            "capture.stop timed out while recording was active. " +
            "The engine was not force-restarted to avoid discarding the in-progress recording. " +
            "Retry recording.stop or capture.stop.",
        });
      }
      if (liveStatus && !liveStatus.isRunning) {
        this.rememberCaptureStatus(liveStatus);
        return liveStatus;
      }
      if (!liveStatus) {
        if (this.lastKnownCaptureStatus?.isRecording) {
          throw new EngineResponseError({
            code: "recording_abandoned",
            description:
              "capture.stop timed out and capture.status could not confirm stop. " +
              "The engine was not force-restarted to avoid discarding a potentially active recording. " +
              "Retry recording.stop or capture.stop.",
          });
        }
        throw new EngineOperationError({
          operation: "capture.stop",
          description:
            "capture.stop recovery aborted: capture.status probe timed out and recording state is unknown. " +
            "The engine was not force-restarted to avoid abandoning a potentially in-progress recording. " +
            "Retry capture.status or capture.stop.",
        });
      }
      // Recover from stop-request transport loss by restarting and probing status quickly.
      await this.resetForRetry();
      await this.start();
      const recoveredStatus = await this.tryCaptureStatusProbe(5000);
      if (!recoveredStatus) {
        throw new EngineOperationError({
          operation: "capture.stop",
          description:
            "capture.stop recovery failed after engine restart: capture.status probe timed out. " +
            "Retry capture.status once the engine is responsive.",
        });
      }
      this.rememberCaptureStatus(recoveredStatus);
      return recoveredStatus;
    }
  }

  async startRecording(trackInputEvents: boolean) {
    const definition = engineMethodDefinitions.startRecording;
    const status = await this.callAndParse(
      definition.method,
      definition.toParams(trackInputEvents),
      definition.schema,
    );
    this.rememberCaptureStatus(status);
    return status;
  }

  async stopRecording() {
    const definition = engineMethodDefinitions.stopRecording;
    const status = await this.callAndParse(
      definition.method,
      definition.toParams(),
      definition.schema,
    );
    this.rememberCaptureStatus(status);
    return status;
  }

  async captureStatus() {
    const definition = engineMethodDefinitions.captureStatus;
    const status = await this.callAndParse(
      definition.method,
      definition.toParams(),
      definition.schema,
    );
    this.rememberCaptureStatus(status);
    return status;
  }

  async exportInfo() {
    const definition = engineMethodDefinitions.exportInfo;
    return this.callAndParse(definition.method, definition.toParams(), definition.schema);
  }

  async runExport(params: {
    outputURL: string;
    presetId: string;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
  }) {
    const definition = engineMethodDefinitions.runExport;
    return this.callAndParse(definition.method, definition.toParams(params), definition.schema);
  }

  async runCutPlanExport(params: { outputURL: string; presetId: string; jobId: string }) {
    const definition = engineMethodDefinitions.runCutPlanExport;
    return this.callAndParse(definition.method, definition.toParams(params), definition.schema);
  }

  async projectCurrent() {
    const definition = engineMethodDefinitions.projectCurrent;
    return this.callAndParse(definition.method, definition.toParams(), definition.schema);
  }

  async projectOpen(projectPath: string) {
    const definition = engineMethodDefinitions.projectOpen;
    return this.callAndParse(
      definition.method,
      definition.toParams(projectPath),
      definition.schema,
    );
  }

  async projectSave(params: { projectPath?: string; autoZoom?: AutoZoomSettings }) {
    const definition = engineMethodDefinitions.projectSave;
    return this.callAndParse(definition.method, definition.toParams(params), definition.schema);
  }

  async projectRecents(limit?: number) {
    const definition = engineMethodDefinitions.projectRecents;
    return this.callAndParse(definition.method, definition.toParams(limit), definition.schema);
  }

  private async callAndParse<TSchema extends Schema.Schema.AnyNoContext>(
    method: EngineRequest["method"],
    params: unknown,
    schema: TSchema,
  ): Promise<MutableDeep<Schema.Schema.Type<TSchema>>> {
    return await decodeUnknownWithSchemaPromise(
      schema,
      await this.request(method, params),
      `${method} result`,
    );
  }

  private async request(method: EngineRequest["method"], params: unknown): Promise<unknown> {
    return await runEffectPromise(this.requestEffect(method, params, 0));
  }

  private async requestRaw(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    const session = await this.ensureSession();
    return await runEffectPromise(
      this.dispatchRawRequestEffect(session, method, params, timeoutMs),
    );
  }

  private requestEffect(
    method: EngineRequest["method"],
    params: unknown,
    attempt: number,
  ): Effect.Effect<unknown, unknown> {
    return Effect.tryPromise({
      try: () => this.ensureSession(),
      catch: (cause) => cause,
    }).pipe(
      Effect.flatMap((session) =>
        this.dispatchRequestEffect(session, method, params, this.resolveRequestTimeoutMs(method)),
      ),
      Effect.catchAll((error) => {
        if (!this.shouldRetryRequest(method, error, attempt)) {
          return Effect.fail(error);
        }
        return Effect.promise(() => this.resetForRetry()).pipe(
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
  ): Effect.Effect<unknown, Error> {
    const pendingEffect = Effect.async<unknown, Error>((resume, signal) => {
      let settled = false;
      const pending: PendingRequest = {
        resolve: (value) => {
          if (settled || signal.aborted) {
            return;
          }
          settled = true;
          this.pending.delete(requestId);
          resume(Effect.succeed(value));
        },
        reject: (error) => {
          if (settled || signal.aborted) {
            return;
          }
          settled = true;
          this.pending.delete(requestId);
          resume(Effect.fail(error));
        },
      };

      this.pending.set(requestId, pending);

      try {
        session.stdin.write(textEncoder.encode(payload));
      } catch (error) {
        settled = true;
        this.pending.delete(requestId);
        resume(
          Effect.fail(
            new EngineClientError({
              code: "ENGINE_STDIO_WRITE_FAILED",
              description: "Failed to write request to engine stdin",
              cause: error,
            }),
          ),
        );
        return;
      }

      return Effect.sync(() => {
        if (!settled) {
          settled = true;
          this.pending.delete(requestId);
        }
      });
    });

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return pendingEffect;
    }
    return pendingEffect.pipe(
      Effect.timeoutFail({
        duration: `${Math.max(1, Math.round(timeoutMs))} millis`,
        onTimeout: () =>
          new EngineClientError({
            code: "ENGINE_REQUEST_TIMEOUT",
            description: `Engine request timed out: ${method}`,
          }),
      }),
    );
  }

  private rememberCaptureStatus(status: CaptureStatusResult): void {
    this.lastKnownCaptureStatus = status;
  }

  private async tryCaptureStatusProbe(timeoutMs: number): Promise<CaptureStatusResult | null> {
    const definition = engineMethodDefinitions.captureStatus;
    try {
      const session = await this.ensureSession();
      return await decodeUnknownWithSchemaPromise(
        definition.schema,
        await runEffectPromise(
          this.dispatchRequestEffect(session, definition.method, definition.toParams(), timeoutMs),
        ),
        `${definition.method} result`,
      );
    } catch {
      return null;
    }
  }

  private dispatchRequestEffect(
    session: EngineSession,
    method: EngineRequest["method"],
    params: unknown,
    timeoutMs: number,
  ): Effect.Effect<unknown, Error> {
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
  ): Effect.Effect<unknown, Error> {
    const requestId = crypto.randomUUID();
    const payload = `${JSON.stringify({ id: requestId, method, params: params ?? {} })}\n`;
    return this.dispatchPendingPayloadEffect(session, requestId, method, payload, timeoutMs);
  }

  private async readStdout(session: EngineSession): Promise<void> {
    if (!session.process.stdout) {
      return;
    }

    const reader = session.process.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line.length > 0) {
            this.handleResponseLine(line);
          }
          newlineIndex = buffer.indexOf("\n");
        }
      }
      const trailing = buffer.trim();
      if (trailing.length > 0) {
        this.handleResponseLine(trailing);
      }
    } catch (error) {
      if (this.session === session && !this.isStopping) {
        console.error("Engine stdout stream failed", error);
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async readStderr(session: EngineSession): Promise<void> {
    if (!session.process.stderr) {
      return;
    }

    const reader = session.process.stderr.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line.length > 0) {
            console.error("[engine]", line);
          }
          newlineIndex = buffer.indexOf("\n");
        }
      }

      const trailing = buffer.trim();
      if (trailing.length > 0) {
        console.error("[engine]", trailing);
      }
    } catch (error) {
      if (this.session === session && !this.isStopping) {
        console.error("Engine stderr stream failed", error);
      }
    } finally {
      reader.releaseLock();
    }
  }

  private handleResponseLine(line: string): void {
    try {
      const rawResponse = parseJsonStringSync(line, "engine response");
      const response = decodeUnknownWithSchemaSync(
        engineResponseSchema,
        rawResponse,
        "engine response",
      );
      const pending = this.takePendingRequest(response.id);
      if (!pending) {
        return;
      }

      if (response.ok) {
        pending.resolve(response.result);
        return;
      }
      pending.reject(
        new EngineResponseError({
          code: response.error.code,
          description: response.error.message,
        }),
      );
    } catch (error) {
      this.rejectPendingForInvalidResponseLine(line, error);
      console.error("Failed to parse engine response", error);
    }
  }

  private async watchProcessExit(session: EngineSession): Promise<void> {
    try {
      const exitCode = await session.process.exited;
      if (this.session !== session) {
        return;
      }

      const scope = this.detachSessionScope(session);
      if (this.isStopping) {
        this.closeDetachedSessionScope(scope, Exit.succeed(undefined));
        return;
      }

      this.registerUnexpectedRestart();
      this.rejectAllPending(
        new EngineClientError({
          code: "ENGINE_PROCESS_EXITED",
          description: `Engine process exited unexpectedly (code ${exitCode})`,
        }),
      );
      this.closeDetachedSessionScope(scope, Exit.succeed(undefined));
    } catch (error) {
      if (this.session !== session) {
        return;
      }

      const scope = this.detachSessionScope(session);
      if (this.isStopping) {
        this.closeDetachedSessionScope(scope, Exit.succeed(undefined));
        return;
      }

      this.registerUnexpectedRestart();
      this.rejectAllPending(
        new EngineClientError({
          code: "ENGINE_PROCESS_FAILED",
          description: `Engine process failed: ${String(error)}`,
          cause: error,
        }),
      );
      this.closeDetachedSessionScope(scope, Exit.succeed(undefined));
    }
  }

  private rejectPendingForInvalidResponseLine(line: string, error: unknown): void {
    const normalizedError =
      error instanceof Error
        ? error
        : new EngineOperationError({
            operation: "engine.response",
            description: String(error),
          });
    const responseId = this.tryReadResponseId(line);
    if (responseId) {
      this.rejectPendingRequest(responseId, normalizedError);
      return;
    }
    this.rejectAllPending(normalizedError);
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

  private rejectPendingRequest(requestId: string, error: Error): void {
    const pending = this.takePendingRequest(requestId);
    pending?.reject(error);
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
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

  private async resetForRetry(): Promise<void> {
    this.registerUnexpectedRestart();
    const session = this.session;
    const closePromise = this.closeSessionScope(this.detachSessionScope(), Exit.succeed(undefined));
    await this.waitForSessionClose(closePromise, session, {
      maxWaitMs: retryShutdownGraceMs,
      reason: "request retry",
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

  private async ensureSession(): Promise<EngineSession> {
    if (this.session) {
      return this.session;
    }
    if (this.sessionPromise) {
      return this.sessionPromise;
    }

    const pendingSession = (async () => {
      const scope = runEffectSync(Scope.make());
      try {
        const session = await runEffectPromise(Scope.extend(this.acquireSessionEffect(), scope));
        if (this.isStopping) {
          this.closeDetachedSessionScope(scope, Exit.succeed(undefined));
          throw new EngineClientError({
            code: "ENGINE_CLIENT_STOPPED",
            description: "Engine client stopped",
          });
        }
        this.sessionScope = scope;
        this.session = session;
        this.isStopping = false;
        return session;
      } catch (error) {
        this.closeDetachedSessionScope(scope, Exit.fail(error));
        throw error;
      }
    })();

    this.sessionPromise = pendingSession;
    try {
      return await pendingSession;
    } finally {
      if (this.sessionPromise === pendingSession) {
        this.sessionPromise = null;
      }
    }
  }

  private acquireSessionEffect(): Effect.Effect<EngineSession, Error, Scope.Scope> {
    return Effect.gen(this, function* () {
      yield* Effect.sync(() => {
        this.throwIfRestartCircuitOpen();
      });

      const waitMs = Math.max(0, this.restartAllowedAtMs - Date.now());
      if (waitMs > 0) {
        yield* Effect.sleep(`${waitMs} millis`);
      }

      const command = yield* Effect.sync(() => this.resolveEngineCommand());
      const session = yield* Effect.acquireRelease(
        Effect.sync(() => {
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
        }),
        (session) =>
          Effect.sync(() => {
            if (this.session === session) {
              this.session = null;
            }
            try {
              session.stdin.end();
            } catch (error) {
              if (!this.isStopping) {
                console.warn("Failed to close engine stdin cleanly", error);
              }
            }
            session.process.kill();
          }),
      );

      yield* Effect.promise(() => this.watchProcessExit(session)).pipe(Effect.forkScoped);
      yield* Effect.promise(() => this.readStdout(session)).pipe(Effect.forkScoped);
      yield* Effect.promise(() => this.readStderr(session)).pipe(Effect.forkScoped);

      return session;
    });
  }

  private resolveEngineCommand(): string[] {
    if (!existsSync(this.enginePath)) {
      throw new Error(
        `Engine executable not found at ${this.enginePath}. Run bun run swift:build or set GG_ENGINE_PATH.`,
      );
    }

    return this.enginePath.endsWith(".ts") ? ["bun", this.enginePath] : [this.enginePath];
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

  private closeDetachedSessionScope(
    scope: Scope.CloseableScope | null,
    exit: Exit.Exit<unknown, unknown>,
  ): void {
    void this.closeSessionScope(scope, exit);
  }

  private async waitForSessionClose(
    closePromise: Promise<void>,
    session: EngineSession | null,
    options: SessionCloseOptions,
  ): Promise<void> {
    if (
      !session ||
      options.maxWaitMs === undefined ||
      !Number.isFinite(options.maxWaitMs) ||
      options.maxWaitMs <= 0
    ) {
      await closePromise;
      return;
    }

    const exitedCleanly = await this.waitForProcessExit(session, closePromise, options.maxWaitMs);
    if (exitedCleanly) {
      return;
    }

    if (!this.isStopping) {
      console.warn(
        `Engine session shutdown exceeded ${options.maxWaitMs}ms during ${options.reason}; sending SIGKILL.`,
      );
    }
    try {
      session.process.kill("SIGKILL");
    } catch (error) {
      if (!this.isStopping) {
        console.warn("Failed to force-kill engine process cleanly", error);
      }
    }

    await Promise.race([
      session.process.exited.then(() => closePromise),
      new Promise<void>((resolve) => {
        setTimeout(resolve, forcedShutdownDrainMs);
      }),
    ]);
  }

  private async waitForProcessExit(
    session: EngineSession,
    closePromise: Promise<void>,
    waitMs: number,
  ): Promise<boolean> {
    const exitPromise = session.process.exited.then(async () => {
      await closePromise;
      return true as const;
    });
    const timeoutPromise = new Promise<false>((resolve) => {
      setTimeout(() => {
        resolve(false);
      }, waitMs);
    });
    return await Promise.race([exitPromise, timeoutPromise]);
  }

  private async closeSessionScope(
    scope: Scope.CloseableScope | null,
    exit: Exit.Exit<unknown, unknown>,
  ): Promise<void> {
    if (!scope) {
      return;
    }
    await runEffectPromise(Scope.close(scope, exit)).catch((error) => {
      if (!this.isStopping) {
        console.warn("Failed to close engine session scope cleanly", error);
      }
    });
  }
}
