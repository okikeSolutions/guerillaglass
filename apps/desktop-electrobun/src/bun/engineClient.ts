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
  timeout: ReturnType<typeof setTimeout>;
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

function resolveByTarget(engineTarget: EngineTarget, baseDir: string): string {
  switch (engineTarget) {
    case "macos-swift":
      return path.resolve(baseDir, "../../../.build/debug/guerillaglass-engine");
    case "windows-native":
      return path.resolve(baseDir, "../../../../engines/windows-native/bin", WINDOWS_NATIVE_BINARY);
    case "linux-native":
      return path.resolve(baseDir, "../../../../engines/linux-native/bin", LINUX_NATIVE_BINARY);
    case "windows-stub":
      return path.resolve(
        baseDir,
        "../../../../engines/windows-stub/guerillaglass-engine-windows-stub.ts",
      );
    case "linux-stub":
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

  constructor(enginePath = resolveEnginePath(), requestTimeoutMs = 15_000) {
    this.enginePath = enginePath;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  async start(): Promise<void> {
    if (this.process) {
      return;
    }
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = (async () => {
      const command = this.enginePath.endsWith(".ts")
        ? ["bun", this.enginePath]
        : [this.enginePath];
      this.process = Bun.spawn({
        cmd: command,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });

      this.stdin = this.process.stdin as unknown as EngineStdin;
      void this.readStdout();
      void this.readStderr();
    })();

    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async stop(): Promise<void> {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Engine client stopped"));
    }
    this.pending.clear();

    if (this.stdin) {
      this.stdin.end();
      this.stdin = null;
    }
    this.process?.kill();
    this.process = null;
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
    await this.start();
    if (!this.stdin) {
      throw new Error("Engine process unavailable");
    }

    const request = buildRequest(
      method as EngineRequest["method"],
      params as never,
    ) as EngineRequest;
    const payload = `${JSON.stringify(request)}\n`;

    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(request.id);
        reject(new Error(`Engine request timed out: ${method}`));
      }, this.requestTimeoutMs);

      this.pending.set(request.id, { resolve, reject, timeout });
      const stdin = this.stdin;
      if (!stdin) {
        clearTimeout(timeout);
        this.pending.delete(request.id);
        reject(new Error("Engine process unavailable"));
        return;
      }
      try {
        stdin.write(new TextEncoder().encode(payload));
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(request.id);
        reject(error as Error);
      }
    });
  }

  private async readStdout(): Promise<void> {
    if (!this.process?.stdout) {
      return;
    }

    const reader = this.process.stdout.getReader();
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
    } finally {
      reader.releaseLock();
    }
  }

  private async readStderr(): Promise<void> {
    if (!this.process?.stderr) {
      return;
    }

    const stderrText = await new Response(this.process.stderr).text();
    if (stderrText.trim().length > 0) {
      console.error("[engine]", stderrText);
    }
  }

  private handleResponseLine(line: string): void {
    try {
      const response = parseResponse(JSON.parse(line));
      const pending = this.pending.get(response.id);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timeout);
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
}
