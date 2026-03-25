import { existsSync } from "node:fs";
import path from "node:path";
import { Schema } from "effect";
import {
  agentPreflightResultSchema,
  agentRunResultSchema,
  agentStatusResultSchema,
  actionResultSchema,
  capabilitiesResultSchema,
  buildRequest,
  captureStatusResultSchema,
  defaultCaptureFrameRate,
  exportInfoResultSchema,
  exportRunCutPlanResultSchema,
  exportRunResultSchema,
  parseResponse,
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
  type EngineClientErrorCode,
  type MutableDeep,
  extractValidationIssues,
} from "../../shared/errors";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout?: ReturnType<typeof setTimeout>;
};

type EngineStdin = {
  write: (chunk: Uint8Array) => unknown;
  end: () => unknown;
};

type EngineProcess = Bun.PipedSubprocess;

/** Supported native and stub engine targets. */
export type EngineTarget =
  | "macos-swift"
  | "windows-native"
  | "linux-native"
  | "windows-stub"
  | "linux-stub";

const WINDOWS_NATIVE_BINARY = "guerillaglass-engine-windows.exe";
const LINUX_NATIVE_BINARY = "guerillaglass-engine-linux";
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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
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
  private process: EngineProcess | null = null;
  private stdin: EngineStdin | null = null;
  private pending = new Map<string, PendingRequest>();
  private startPromise: Promise<void> | null = null;
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
    if (this.process) {
      return;
    }
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = (async () => {
      this.throwIfRestartCircuitOpen();
      const now = Date.now();
      if (this.restartAllowedAtMs > now) {
        await delay(this.restartAllowedAtMs - now);
      }
      if (!existsSync(this.enginePath)) {
        throw new Error(
          `Engine executable not found at ${this.enginePath}. Run bun run swift:build or set GG_ENGINE_PATH.`,
        );
      }

      const command = this.enginePath.endsWith(".ts")
        ? ["bun", this.enginePath]
        : [this.enginePath];
      const process: EngineProcess = Bun.spawn({
        cmd: command,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
      this.process = process;
      this.stdin = process.stdin as unknown as EngineStdin;

      this.isStopping = false;
      void this.watchProcessExit(process);
      void this.readStdout(process);
      void this.readStderr(process);
    })();

    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async stop(): Promise<void> {
    this.isStopping = true;
    this.rejectAllPending(
      new EngineClientError({
        code: "ENGINE_CLIENT_STOPPED",
        description: "Engine client stopped",
      }),
    );

    const stdin = this.stdin;
    const process = this.process;
    this.stdin = null;
    this.process = null;

    if (stdin) {
      try {
        stdin.end();
      } catch (error) {
        console.warn("Failed to close engine stdin cleanly", error);
      }
    }

    process?.kill();
    this.isStopping = false;
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
      this.resetForRetry();
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
    let attempt = 0;
    while (true) {
      try {
        await this.start();
        return await this.dispatchRequest(method, params, this.resolveRequestTimeoutMs(method));
      } catch (error) {
        if (!this.shouldRetryRequest(method, error, attempt)) {
          throw error;
        }
        attempt += 1;
        this.resetForRetry();
      }
    }
  }

  private async requestRaw(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    await this.start();
    return this.dispatchRawRequest(method, params, timeoutMs);
  }

  private rememberCaptureStatus(status: CaptureStatusResult): void {
    this.lastKnownCaptureStatus = status;
  }

  private async tryCaptureStatusProbe(timeoutMs: number): Promise<CaptureStatusResult | null> {
    const definition = engineMethodDefinitions.captureStatus;
    try {
      return await decodeUnknownWithSchemaPromise(
        definition.schema,
        await this.dispatchRequest(definition.method, definition.toParams(), timeoutMs),
        `${definition.method} result`,
      );
    } catch {
      return null;
    }
  }

  private async dispatchRequest(
    method: EngineRequest["method"],
    params: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    if (!this.stdin) {
      throw new EngineClientError({
        code: "ENGINE_PROCESS_UNAVAILABLE",
        description: "Engine process unavailable",
      });
    }
    let request: EngineRequest;
    try {
      request = buildRequest(method as EngineRequestEncoded["method"], params as never);
    } catch (error) {
      throw toInvalidParamsError(method, error);
    }
    const payload = `${JSON.stringify(request)}\n`;

    return new Promise<unknown>((resolve, reject) => {
      const timeout =
        Number.isFinite(timeoutMs) && timeoutMs > 0
          ? setTimeout(() => {
              this.pending.delete(request.id);
              reject(
                new EngineClientError({
                  code: "ENGINE_REQUEST_TIMEOUT",
                  description: `Engine request timed out: ${method}`,
                }),
              );
            }, timeoutMs)
          : undefined;

      this.pending.set(request.id, { resolve, reject, timeout });
      const stdin = this.stdin;
      if (!stdin) {
        if (timeout) {
          clearTimeout(timeout);
        }
        this.pending.delete(request.id);
        reject(
          new EngineClientError({
            code: "ENGINE_PROCESS_UNAVAILABLE",
            description: "Engine process unavailable",
          }),
        );
        return;
      }
      try {
        stdin.write(textEncoder.encode(payload));
      } catch (error) {
        if (timeout) {
          clearTimeout(timeout);
        }
        this.pending.delete(request.id);
        reject(
          new EngineClientError({
            code: "ENGINE_STDIO_WRITE_FAILED",
            description: "Failed to write request to engine stdin",
            cause: error,
          }),
        );
      }
    });
  }

  private dispatchRawRequest(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    if (!this.stdin) {
      throw new EngineClientError({
        code: "ENGINE_PROCESS_UNAVAILABLE",
        description: "Engine process unavailable",
      });
    }
    const requestId = crypto.randomUUID();
    const payload = `${JSON.stringify({ id: requestId, method, params: params ?? {} })}\n`;

    return new Promise<unknown>((resolve, reject) => {
      const timeout =
        Number.isFinite(timeoutMs) && timeoutMs > 0
          ? setTimeout(() => {
              this.pending.delete(requestId);
              reject(
                new EngineClientError({
                  code: "ENGINE_REQUEST_TIMEOUT",
                  description: `Engine request timed out: ${method}`,
                }),
              );
            }, timeoutMs)
          : undefined;

      this.pending.set(requestId, { resolve, reject, timeout });
      const stdin = this.stdin;
      if (!stdin) {
        if (timeout) {
          clearTimeout(timeout);
        }
        this.pending.delete(requestId);
        reject(
          new EngineClientError({
            code: "ENGINE_PROCESS_UNAVAILABLE",
            description: "Engine process unavailable",
          }),
        );
        return;
      }
      try {
        stdin.write(textEncoder.encode(payload));
      } catch (error) {
        if (timeout) {
          clearTimeout(timeout);
        }
        this.pending.delete(requestId);
        reject(
          new EngineClientError({
            code: "ENGINE_STDIO_WRITE_FAILED",
            description: "Failed to write request to engine stdin",
            cause: error,
          }),
        );
      }
    });
  }

  private async readStdout(process: EngineProcess): Promise<void> {
    if (!process.stdout) {
      return;
    }

    const reader = process.stdout.getReader();
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
      if (this.process === process && !this.isStopping) {
        console.error("Engine stdout stream failed", error);
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async readStderr(process: EngineProcess): Promise<void> {
    if (!process.stderr) {
      return;
    }

    const reader = process.stderr.getReader();
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
      if (this.process === process && !this.isStopping) {
        console.error("Engine stderr stream failed", error);
      }
    } finally {
      reader.releaseLock();
    }
  }

  private handleResponseLine(line: string): void {
    try {
      const response = parseResponse(JSON.parse(line));
      const pending = this.pending.get(response.id);
      if (!pending) {
        return;
      }
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      this.pending.delete(response.id);

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
      console.error("Failed to parse engine response", error);
    }
  }

  private async watchProcessExit(process: EngineProcess): Promise<void> {
    try {
      const exitCode = await process.exited;
      if (this.process !== process) {
        return;
      }

      this.process = null;
      this.stdin = null;
      if (this.isStopping) {
        return;
      }

      this.registerUnexpectedRestart();
      this.rejectAllPending(
        new EngineClientError({
          code: "ENGINE_PROCESS_EXITED",
          description: `Engine process exited unexpectedly (code ${exitCode})`,
        }),
      );
    } catch (error) {
      if (this.process !== process) {
        return;
      }

      this.process = null;
      this.stdin = null;
      if (this.isStopping) {
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
    }
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pending.values()) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
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

  private resetForRetry(): void {
    this.registerUnexpectedRestart();

    const stdin = this.stdin;
    const process = this.process;
    this.stdin = null;
    this.process = null;

    if (stdin) {
      try {
        stdin.end();
      } catch {
        // Best effort close before respawn.
      }
    }
    process?.kill();
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
}
