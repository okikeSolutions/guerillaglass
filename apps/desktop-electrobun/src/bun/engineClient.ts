import { existsSync } from "node:fs";
import path from "node:path";
import {
  actionResultSchema,
  capabilitiesResultSchema,
  buildRequest,
  captureStatusResultSchema,
  exportInfoResultSchema,
  exportRunResultSchema,
  parseResponse,
  permissionsResultSchema,
  pingResultSchema,
  projectStateSchema,
  sourcesResultSchema,
  type AutoZoomSettings,
  type EngineRequest,
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

const defaultRequestTimeoutByMethod: Readonly<Record<EngineRequest["method"], number>> = {
  "system.ping": 3_000,
  "engine.capabilities": 5_000,
  "permissions.get": 5_000,
  "permissions.requestScreenRecording": 10_000,
  "permissions.requestMicrophone": 10_000,
  "permissions.requestInputMonitoring": 10_000,
  "permissions.openInputMonitoringSettings": 5_000,
  "sources.list": 8_000,
  "capture.startDisplay": 15_000,
  "capture.startWindow": 15_000,
  "capture.stop": 10_000,
  "recording.start": 15_000,
  "recording.stop": 15_000,
  "capture.status": 5_000,
  "export.info": 10_000,
  // 0 disables timeout: exports can legitimately run for long recordings.
  "export.run": 0,
  "project.current": 5_000,
  "project.open": 20_000,
  "project.save": 20_000,
};

const retryableReadMethods = new Set<EngineRequest["method"]>([
  "system.ping",
  "engine.capabilities",
  "permissions.get",
  "sources.list",
  "capture.status",
  "export.info",
  "project.current",
]);

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

export class EngineClient {
  private process: ReturnType<typeof Bun.spawn> | null = null;
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
    this.restartWindowMs = Math.max(1_000, options.restartWindowMs ?? 30_000);
    this.restartCircuitOpenMs = Math.max(1_000, options.restartCircuitOpenMs ?? 30_000);
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
      const process = Bun.spawn({
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
    return pingResultSchema.parse(await this.request("system.ping", {}));
  }

  async capabilities() {
    return capabilitiesResultSchema.parse(await this.request("engine.capabilities", {}));
  }

  async getPermissions() {
    return permissionsResultSchema.parse(await this.request("permissions.get", {}));
  }

  async requestScreenRecordingPermission() {
    return actionResultSchema.parse(await this.request("permissions.requestScreenRecording", {}));
  }

  async requestMicrophonePermission() {
    return actionResultSchema.parse(await this.request("permissions.requestMicrophone", {}));
  }

  async requestInputMonitoringPermission() {
    return actionResultSchema.parse(await this.request("permissions.requestInputMonitoring", {}));
  }

  async openInputMonitoringSettings() {
    return actionResultSchema.parse(
      await this.request("permissions.openInputMonitoringSettings", {}),
    );
  }

  async listSources() {
    return sourcesResultSchema.parse(await this.request("sources.list", {}));
  }

  async startDisplayCapture(enableMic: boolean) {
    return captureStatusResultSchema.parse(
      await this.request("capture.startDisplay", {
        enableMic,
      }),
    );
  }

  async startWindowCapture(windowId: number, enableMic: boolean) {
    return captureStatusResultSchema.parse(
      await this.request("capture.startWindow", {
        windowId,
        enableMic,
      }),
    );
  }

  async stopCapture() {
    return captureStatusResultSchema.parse(await this.request("capture.stop", {}));
  }

  async startRecording(trackInputEvents: boolean) {
    return captureStatusResultSchema.parse(
      await this.request("recording.start", {
        trackInputEvents,
      }),
    );
  }

  async stopRecording() {
    return captureStatusResultSchema.parse(await this.request("recording.stop", {}));
  }

  async captureStatus() {
    return captureStatusResultSchema.parse(await this.request("capture.status", {}));
  }

  async exportInfo() {
    return exportInfoResultSchema.parse(await this.request("export.info", {}));
  }

  async runExport(params: {
    outputURL: string;
    presetId: string;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
  }) {
    return exportRunResultSchema.parse(await this.request("export.run", params));
  }

  async projectCurrent() {
    return projectStateSchema.parse(await this.request("project.current", {}));
  }

  async projectOpen(projectPath: string) {
    return projectStateSchema.parse(await this.request("project.open", { projectPath }));
  }

  async projectSave(params: { projectPath?: string; autoZoom?: AutoZoomSettings }) {
    return projectStateSchema.parse(await this.request("project.save", params));
  }

  private async request<TMethod extends EngineRequest["method"]>(
    method: TMethod,
    params: Extract<EngineRequest, { method: TMethod }>["params"],
  ): Promise<unknown> {
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

  private async dispatchRequest(
    method: EngineRequest["method"],
    params: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    if (!this.stdin) {
      throw new EngineClientError("ENGINE_PROCESS_UNAVAILABLE", "Engine process unavailable");
    }
    const request = buildRequest(
      method as EngineRequest["method"],
      params as never,
    ) as EngineRequest;
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

  private async readStdout(process: ReturnType<typeof Bun.spawn>): Promise<void> {
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

  private async readStderr(process: ReturnType<typeof Bun.spawn>): Promise<void> {
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

  private async watchProcessExit(process: ReturnType<typeof Bun.spawn>): Promise<void> {
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
