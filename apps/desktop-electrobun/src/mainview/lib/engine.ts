import {
  agentPreflightResultSchema,
  agentRunResultSchema,
  agentStatusResultSchema,
  actionResultSchema,
  captureStatusResultSchema,
  defaultCaptureFrameRate,
  exportInfoResultSchema,
  exportRunCutPlanResultSchema,
  exportRunResultSchema,
  inputEventLogSchema,
  permissionsResultSchema,
  pingResultSchema,
  projectRecentsResultSchema,
  projectStateSchema,
  sourcesResultSchema,
  type AutoZoomSettings,
  type CaptureFrameRate,
  type CaptureStatusResult,
  type InputEvent,
  type PermissionsResult,
  type PingResult,
  type ProjectRecentsResult,
  type ProjectState,
  type SourcesResult,
} from "@guerillaglass/engine-protocol";
import type {
  HostMenuState,
  HostPathPickerMode,
  WindowBridgeBindings,
} from "../../shared/bridgeRpc";
import {
  BridgeInvocationError,
  BridgeUnavailableError,
  CaptureWindowPickerUnsupportedError,
  EngineResponseError,
  PathPickerError,
  decodeUnknownWithSchemaPromise,
  decodeUnknownWithSchemaSync,
  isKnownTaggedError,
  parseJsonStringSync,
  type MutableDeep,
} from "../../shared/errors";

function requireBridge<K extends keyof WindowBridgeBindings>(
  name: K,
): NonNullable<WindowBridgeBindings[K]> {
  const bridgeWindow = window as Window & WindowBridgeBindings;
  const bridge = bridgeWindow[name];
  if (!bridge) {
    throw new BridgeUnavailableError({ bridge: String(name) });
  }
  return bridge as NonNullable<WindowBridgeBindings[K]>;
}

async function invokeBridge<K extends keyof WindowBridgeBindings>(
  name: K,
  ...args: unknown[]
): Promise<unknown> {
  const bridge = requireBridge(name) as (...bridgeArgs: unknown[]) => Promise<unknown>;
  try {
    return await bridge(...args);
  } catch (error) {
    if (isKnownTaggedError(error)) {
      throw error;
    }
    throw new BridgeInvocationError({
      bridge: String(name),
      cause: error,
    });
  }
}

async function invokeBridgeDecoded<
  K extends keyof WindowBridgeBindings,
  S extends import("effect").Schema.Schema.AnyNoContext,
>(
  name: K,
  schema: S,
  contract: string,
  ...args: unknown[]
): Promise<MutableDeep<import("effect").Schema.Schema.Type<S>>> {
  const raw = await invokeBridge(name, ...args);
  return await decodeUnknownWithSchemaPromise(schema, raw, contract);
}

function isMacOS13WindowPickerUnsupported(error: unknown): boolean {
  if (error instanceof BridgeInvocationError) {
    return isMacOS13WindowPickerUnsupported(error.cause);
  }
  return (
    error instanceof EngineResponseError &&
    error.code === "invalid_params" &&
    /windowid must be greater than 0 on macos 13/i.test(error.description)
  );
}

export const engineApi = {
  async ping(): Promise<PingResult> {
    return await invokeBridgeDecoded("ggEnginePing", pingResultSchema, "engine ping result");
  },

  async getPermissions(): Promise<PermissionsResult> {
    return await invokeBridgeDecoded(
      "ggEngineGetPermissions",
      permissionsResultSchema,
      "permissions result",
    );
  },

  async agentPreflight(params?: {
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: "none" | "imported_transcript";
    importedTranscriptPath?: string;
  }) {
    return await invokeBridgeDecoded(
      "ggEngineAgentPreflight",
      agentPreflightResultSchema,
      "agent preflight result",
      params,
    );
  },

  async agentRun(params: {
    preflightToken: string;
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: "none" | "imported_transcript";
    importedTranscriptPath?: string;
    force?: boolean;
  }) {
    return await invokeBridgeDecoded(
      "ggEngineAgentRun",
      agentRunResultSchema,
      "agent run result",
      params,
    );
  },

  async agentStatus(jobId: string) {
    return await invokeBridgeDecoded(
      "ggEngineAgentStatus",
      agentStatusResultSchema,
      "agent status result",
      jobId,
    );
  },

  async agentApply(params: { jobId: string; destructiveIntent?: boolean }) {
    return await invokeBridgeDecoded(
      "ggEngineAgentApply",
      actionResultSchema,
      "agent apply result",
      params,
    );
  },

  async requestScreenRecordingPermission() {
    return await invokeBridgeDecoded(
      "ggEngineRequestScreenRecordingPermission",
      actionResultSchema,
      "screen recording permission request result",
    );
  },

  async requestMicrophonePermission() {
    return await invokeBridgeDecoded(
      "ggEngineRequestMicrophonePermission",
      actionResultSchema,
      "microphone permission request result",
    );
  },

  async requestInputMonitoringPermission() {
    return await invokeBridgeDecoded(
      "ggEngineRequestInputMonitoringPermission",
      actionResultSchema,
      "input monitoring permission request result",
    );
  },

  async openInputMonitoringSettings() {
    return await invokeBridgeDecoded(
      "ggEngineOpenInputMonitoringSettings",
      actionResultSchema,
      "open input monitoring settings result",
    );
  },

  async listSources(): Promise<SourcesResult> {
    return await invokeBridgeDecoded("ggEngineListSources", sourcesResultSchema, "sources result");
  },

  async startDisplayCapture(
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ): Promise<CaptureStatusResult> {
    return await invokeBridgeDecoded(
      "ggEngineStartDisplayCapture",
      captureStatusResultSchema,
      "capture status result",
      enableMic,
      captureFps,
    );
  },

  async startCurrentWindowCapture(
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ): Promise<CaptureStatusResult> {
    return await invokeBridgeDecoded(
      "ggEngineStartCurrentWindowCapture",
      captureStatusResultSchema,
      "capture status result",
      enableMic,
      captureFps,
    );
  },

  async startWindowCapture(
    windowId: number,
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ): Promise<CaptureStatusResult> {
    try {
      return await invokeBridgeDecoded(
        "ggEngineStartWindowCapture",
        captureStatusResultSchema,
        "capture status result",
        windowId,
        enableMic,
        captureFps,
      );
    } catch (error) {
      if (windowId === 0 && isMacOS13WindowPickerUnsupported(error)) {
        throw new CaptureWindowPickerUnsupportedError({ cause: error });
      }
      throw error;
    }
  },

  async stopCapture(): Promise<CaptureStatusResult> {
    return await invokeBridgeDecoded(
      "ggEngineStopCapture",
      captureStatusResultSchema,
      "capture status result",
    );
  },

  async startRecording(trackInputEvents: boolean): Promise<CaptureStatusResult> {
    return await invokeBridgeDecoded(
      "ggEngineStartRecording",
      captureStatusResultSchema,
      "capture status result",
      trackInputEvents,
    );
  },

  async stopRecording(): Promise<CaptureStatusResult> {
    return await invokeBridgeDecoded(
      "ggEngineStopRecording",
      captureStatusResultSchema,
      "capture status result",
    );
  },

  async captureStatus(): Promise<CaptureStatusResult> {
    return await invokeBridgeDecoded(
      "ggEngineCaptureStatus",
      captureStatusResultSchema,
      "capture status result",
    );
  },

  async exportInfo() {
    return await invokeBridgeDecoded(
      "ggEngineExportInfo",
      exportInfoResultSchema,
      "export info result",
    );
  },

  async runExport(params: {
    outputURL: string;
    presetId: string;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
  }) {
    return await invokeBridgeDecoded(
      "ggEngineRunExport",
      exportRunResultSchema,
      "export run result",
      params,
    );
  },

  async runCutPlanExport(params: { outputURL: string; presetId: string; jobId: string }) {
    return await invokeBridgeDecoded(
      "ggEngineRunCutPlanExport",
      exportRunCutPlanResultSchema,
      "cut plan export result",
      params,
    );
  },

  async projectCurrent(): Promise<ProjectState> {
    return await invokeBridgeDecoded("ggEngineProjectCurrent", projectStateSchema, "project state");
  },

  async projectOpen(projectPath: string): Promise<ProjectState> {
    return await invokeBridgeDecoded(
      "ggEngineProjectOpen",
      projectStateSchema,
      "project state",
      projectPath,
    );
  },

  async projectSave(params: {
    projectPath?: string;
    autoZoom?: AutoZoomSettings;
  }): Promise<ProjectState> {
    return await invokeBridgeDecoded(
      "ggEngineProjectSave",
      projectStateSchema,
      "project state",
      params,
    );
  },

  async projectRecents(limit?: number): Promise<ProjectRecentsResult> {
    return await invokeBridgeDecoded(
      "ggEngineProjectRecents",
      projectRecentsResultSchema,
      "project recents result",
      limit,
    );
  },
};

export const desktopApi = {
  async pickPath(params: {
    mode: HostPathPickerMode;
    startingFolder?: string;
  }): Promise<string | null> {
    try {
      return (await invokeBridge("ggPickPath", params)) as string | null;
    } catch (error) {
      if (error instanceof BridgeUnavailableError || error instanceof BridgeInvocationError) {
        throw new PathPickerError({
          code: "PATH_PICKER_REQUEST_FAILED",
          description: error.message,
          cause: error,
        });
      }
      throw error;
    }
  },

  async readTextFile(filePath: string): Promise<string> {
    return (await invokeBridge("ggReadTextFile", filePath)) as string;
  },

  async resolveMediaSourceURL(filePath: string): Promise<string> {
    return (await invokeBridge("ggResolveMediaSourceURL", filePath)) as string;
  },
};

export function sendHostMenuState(state: HostMenuState): void {
  const sender = (window as Window & WindowBridgeBindings).ggHostSendMenuState;
  if (!sender) {
    return;
  }
  sender(state);
}

export function parseInputEventLog(raw: string): InputEvent[] {
  const parsed = parseJsonStringSync(raw, "input event log");
  const log = decodeUnknownWithSchemaSync(inputEventLogSchema, parsed, "input event log");
  return [...log.events];
}
