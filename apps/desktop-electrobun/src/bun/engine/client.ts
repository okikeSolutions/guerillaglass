import { existsSync } from "node:fs";
import path from "node:path";
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
  type CaptureFrameRate,
  type EngineRequest,
  type TranscriptionProvider,
} from "@guerillaglass/engine-protocol";

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

type EngineClientErrorCode =
  | "ENGINE_CLIENT_STOPPED"
  | "ENGINE_PROCESS_UNAVAILABLE"
  | "ENGINE_REQUEST_TIMEOUT"
  | "ENGINE_STDIO_WRITE_FAILED"
  | "ENGINE_PROCESS_EXITED"
  | "ENGINE_PROCESS_FAILED"
  | "ENGINE_RESTART_CIRCUIT_OPEN";

class EngineClientError extends Error {
  readonly code: EngineClientErrorCode;
  override readonly cause: unknown;

  constructor(code: EngineClientErrorCode, message: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.cause = cause;
    this.name = "EngineClientError";
  }
}

type EngineMethodDefinition<TResult, TArgs extends unknown[]> = {
  method: EngineRequest["method"];
  toParams: (...args: TArgs) => unknown;
  schema: { parse: (value: unknown) => TResult };
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
  } satisfies EngineMethodDefinition<Awaited<ReturnType<typeof pingResultSchema.parse>>, []>,
  capabilities: {
    method: "engine.capabilities",
    toParams: emptyParams,
    schema: capabilitiesResultSchema,
    timeoutMs: 5000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<
    Awaited<ReturnType<typeof capabilitiesResultSchema.parse>>,
    []
  >,
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
    Awaited<ReturnType<typeof agentPreflightResultSchema.parse>>,
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
    Awaited<ReturnType<typeof agentRunResultSchema.parse>>,
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
  } satisfies EngineMethodDefinition<
    Awaited<ReturnType<typeof agentStatusResultSchema.parse>>,
    [jobId: string]
  >,
  agentApply: {
    method: "agent.apply",
    toParams: (params: { jobId: string; destructiveIntent?: boolean }) => params,
    schema: actionResultSchema,
    timeoutMs: 8000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    Awaited<ReturnType<typeof actionResultSchema.parse>>,
    [params: { jobId: string; destructiveIntent?: boolean }]
  >,
  getPermissions: {
    method: "permissions.get",
    toParams: emptyParams,
    schema: permissionsResultSchema,
    timeoutMs: 5000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<Awaited<ReturnType<typeof permissionsResultSchema.parse>>, []>,
  requestScreenRecordingPermission: {
    method: "permissions.requestScreenRecording",
    toParams: emptyParams,
    schema: actionResultSchema,
    timeoutMs: 10_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<Awaited<ReturnType<typeof actionResultSchema.parse>>, []>,
  requestMicrophonePermission: {
    method: "permissions.requestMicrophone",
    toParams: emptyParams,
    schema: actionResultSchema,
    timeoutMs: 10_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<Awaited<ReturnType<typeof actionResultSchema.parse>>, []>,
  requestInputMonitoringPermission: {
    method: "permissions.requestInputMonitoring",
    toParams: emptyParams,
    schema: actionResultSchema,
    timeoutMs: 10_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<Awaited<ReturnType<typeof actionResultSchema.parse>>, []>,
  openInputMonitoringSettings: {
    method: "permissions.openInputMonitoringSettings",
    toParams: emptyParams,
    schema: actionResultSchema,
    timeoutMs: 5000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<Awaited<ReturnType<typeof actionResultSchema.parse>>, []>,
  listSources: {
    method: "sources.list",
    toParams: emptyParams,
    schema: sourcesResultSchema,
    timeoutMs: 8000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<Awaited<ReturnType<typeof sourcesResultSchema.parse>>, []>,
  startDisplayCapture: {
    method: "capture.startDisplay",
    toParams: (enableMic: boolean, captureFps: CaptureFrameRate) => ({ enableMic, captureFps }),
    schema: captureStatusResultSchema,
    timeoutMs: 15_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    Awaited<ReturnType<typeof captureStatusResultSchema.parse>>,
    [enableMic: boolean, captureFps: CaptureFrameRate]
  >,
  startCurrentWindowCapture: {
    method: "capture.startCurrentWindow",
    toParams: (enableMic: boolean, captureFps: CaptureFrameRate) => ({ enableMic, captureFps }),
    schema: captureStatusResultSchema,
    timeoutMs: 15_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    Awaited<ReturnType<typeof captureStatusResultSchema.parse>>,
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
    Awaited<ReturnType<typeof captureStatusResultSchema.parse>>,
    [windowId: number, enableMic: boolean, captureFps: CaptureFrameRate]
  >,
  stopCapture: {
    method: "capture.stop",
    toParams: emptyParams,
    schema: captureStatusResultSchema,
    timeoutMs: 10_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    Awaited<ReturnType<typeof captureStatusResultSchema.parse>>,
    []
  >,
  startRecording: {
    method: "recording.start",
    toParams: (trackInputEvents: boolean) => ({ trackInputEvents }),
    schema: captureStatusResultSchema,
    timeoutMs: 15_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    Awaited<ReturnType<typeof captureStatusResultSchema.parse>>,
    [trackInputEvents: boolean]
  >,
  stopRecording: {
    method: "recording.stop",
    toParams: emptyParams,
    schema: captureStatusResultSchema,
    timeoutMs: 15_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    Awaited<ReturnType<typeof captureStatusResultSchema.parse>>,
    []
  >,
  captureStatus: {
    method: "capture.status",
    toParams: emptyParams,
    schema: captureStatusResultSchema,
    timeoutMs: 5000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<
    Awaited<ReturnType<typeof captureStatusResultSchema.parse>>,
    []
  >,
  exportInfo: {
    method: "export.info",
    toParams: emptyParams,
    schema: exportInfoResultSchema,
    timeoutMs: 10_000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<Awaited<ReturnType<typeof exportInfoResultSchema.parse>>, []>,
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
    Awaited<ReturnType<typeof exportRunResultSchema.parse>>,
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
    Awaited<ReturnType<typeof exportRunCutPlanResultSchema.parse>>,
    [params: { outputURL: string; presetId: string; jobId: string }]
  >,
  projectCurrent: {
    method: "project.current",
    toParams: emptyParams,
    schema: projectStateSchema,
    timeoutMs: 5000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<Awaited<ReturnType<typeof projectStateSchema.parse>>, []>,
  projectOpen: {
    method: "project.open",
    toParams: (projectPath: string) => ({ projectPath }),
    schema: projectStateSchema,
    timeoutMs: 20_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    Awaited<ReturnType<typeof projectStateSchema.parse>>,
    [projectPath: string]
  >,
  projectSave: {
    method: "project.save",
    toParams: (params: { projectPath?: string; autoZoom?: AutoZoomSettings }) => params,
    schema: projectStateSchema,
    timeoutMs: 20_000,
    retryableRead: false,
  } satisfies EngineMethodDefinition<
    Awaited<ReturnType<typeof projectStateSchema.parse>>,
    [params: { projectPath?: string; autoZoom?: AutoZoomSettings }]
  >,
  projectRecents: {
    method: "project.recents",
    toParams: (limit?: number) => ({ limit }),
    schema: projectRecentsResultSchema,
    timeoutMs: 5000,
    retryableRead: true,
  } satisfies EngineMethodDefinition<
    Awaited<ReturnType<typeof projectRecentsResultSchema.parse>>,
    [limit?: number]
  >,
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

type ValidationIssue = {
  path: Array<string | number>;
  message: string;
};

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isValidationIssue(value: unknown): value is ValidationIssue {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as { path?: unknown; message?: unknown };
  return Array.isArray(candidate.path) && typeof candidate.message === "string";
}

function extractValidationIssues(error: unknown): ValidationIssue[] {
  if (Array.isArray(error) && error.every((issue) => isValidationIssue(issue))) {
    return error;
  }
  if (!error || typeof error !== "object") {
    return [];
  }
  const issues = (error as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) {
    return [];
  }
  return issues.filter((issue): issue is ValidationIssue => isValidationIssue(issue));
}

function formatValidationIssue(issue: ValidationIssue): string {
  const path = issue.path.length > 0 ? issue.path.join(".") : "params";
  return `${path}: ${issue.message}`;
}

function toInvalidParamsError(method: string, error: unknown): Error {
  const issues = extractValidationIssues(error);
  if (issues.length === 0) {
    return error instanceof Error ? error : new Error(String(error));
  }
  const details = issues
    .slice(0, 3)
    .map((issue) => formatValidationIssue(issue))
    .join("; ");
  const hint =
    method === "agent.run"
      ? "Call agent.preflight first and pass the returned preflightToken to agent.run."
      : "Check request fields against the engine protocol schema.";
  return new Error(`invalid_params: ${method} request validation failed (${details}). ${hint}`);
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
    this.rejectAllPending(new EngineClientError("ENGINE_CLIENT_STOPPED", "Engine client stopped"));

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
      throw new Error(
        "permission_denied: sendRaw is disabled in production. Set GG_ENGINE_ALLOW_RAW_RPC=1 for diagnostics.",
      );
    }
    const trimmedMethod = method.trim();
    if (!trimmedMethod) {
      throw new Error("invalid_params: method is required");
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
    return this.callAndParse(
      definition.method,
      definition.toParams(enableMic, captureFps),
      definition.schema,
    );
  }

  async startCurrentWindowCapture(
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ) {
    const definition = engineMethodDefinitions.startCurrentWindowCapture;
    return this.callAndParse(
      definition.method,
      definition.toParams(enableMic, captureFps),
      definition.schema,
    );
  }

  async startWindowCapture(
    windowId: number,
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ) {
    const definition = engineMethodDefinitions.startWindowCapture;
    return this.callAndParse(
      definition.method,
      definition.toParams(windowId, enableMic, captureFps),
      definition.schema,
    );
  }

  async stopCapture() {
    const definition = engineMethodDefinitions.stopCapture;
    return this.callAndParse(definition.method, definition.toParams(), definition.schema);
  }

  async startRecording(trackInputEvents: boolean) {
    const definition = engineMethodDefinitions.startRecording;
    return this.callAndParse(
      definition.method,
      definition.toParams(trackInputEvents),
      definition.schema,
    );
  }

  async stopRecording() {
    const definition = engineMethodDefinitions.stopRecording;
    return this.callAndParse(definition.method, definition.toParams(), definition.schema);
  }

  async captureStatus() {
    const definition = engineMethodDefinitions.captureStatus;
    return this.callAndParse(definition.method, definition.toParams(), definition.schema);
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

  private async callAndParse<TResult>(
    method: EngineRequest["method"],
    params: unknown,
    schema: { parse: (value: unknown) => TResult },
  ): Promise<TResult> {
    return schema.parse(await this.request(method, params));
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

  private async dispatchRequest(
    method: EngineRequest["method"],
    params: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    if (!this.stdin) {
      throw new EngineClientError("ENGINE_PROCESS_UNAVAILABLE", "Engine process unavailable");
    }
    let request: EngineRequest;
    try {
      request = buildRequest(method as EngineRequest["method"], params as never) as EngineRequest;
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
                new EngineClientError(
                  "ENGINE_REQUEST_TIMEOUT",
                  `Engine request timed out: ${method}`,
                ),
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
        reject(new EngineClientError("ENGINE_PROCESS_UNAVAILABLE", "Engine process unavailable"));
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
          new EngineClientError(
            "ENGINE_STDIO_WRITE_FAILED",
            "Failed to write request to engine stdin",
            error,
          ),
        );
      }
    });
  }

  private dispatchRawRequest(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    if (!this.stdin) {
      throw new EngineClientError("ENGINE_PROCESS_UNAVAILABLE", "Engine process unavailable");
    }
    const requestId = crypto.randomUUID();
    const payload = `${JSON.stringify({ id: requestId, method, params: params ?? {} })}\n`;

    return new Promise<unknown>((resolve, reject) => {
      const timeout =
        Number.isFinite(timeoutMs) && timeoutMs > 0
          ? setTimeout(() => {
              this.pending.delete(requestId);
              reject(
                new EngineClientError(
                  "ENGINE_REQUEST_TIMEOUT",
                  `Engine request timed out: ${method}`,
                ),
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
        reject(new EngineClientError("ENGINE_PROCESS_UNAVAILABLE", "Engine process unavailable"));
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
          new EngineClientError(
            "ENGINE_STDIO_WRITE_FAILED",
            "Failed to write request to engine stdin",
            error,
          ),
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
      pending.reject(new Error(`${response.error.code}: ${response.error.message}`));
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
        new EngineClientError(
          "ENGINE_PROCESS_EXITED",
          `Engine process exited unexpectedly (code ${exitCode})`,
        ),
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
        new EngineClientError(
          "ENGINE_PROCESS_FAILED",
          `Engine process failed: ${String(error)}`,
          error,
        ),
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

    throw new EngineClientError(
      "ENGINE_RESTART_CIRCUIT_OPEN",
      `Engine restart circuit open until ${new Date(this.restartCircuitOpenUntilMs).toISOString()}`,
    );
  }
}
