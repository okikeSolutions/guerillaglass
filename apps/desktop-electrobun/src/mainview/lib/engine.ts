import type {
  CapturePreviewFrameResult,
  CaptureStatusResult,
} from "@guerillaglass/engine-contract/domains/capture";
import type { PermissionsResult } from "@guerillaglass/engine-contract/domains/permissions";
import type {
  ProjectRecentsResult,
  ProjectState,
} from "@guerillaglass/engine-contract/domains/project";
import {
  defaultCaptureFrameRate,
  type CaptureFrameRate,
  type SourcesResult,
} from "@guerillaglass/engine-contract/domains/sources";
import type { CapabilitiesResult, PingResult } from "@guerillaglass/engine-contract/domains/system";
import {
  inputEventLogSchema,
  type AutoZoomSettings,
  type BackgroundFramingSettings,
  type InputEvent,
  type TimelineDocument,
} from "@guerillaglass/engine-contract/shared/valueObjects";
import type {
  HostMenuState,
  HostPathPickerMode,
  StudioDiagnosticsEntry,
  WindowBridgeBindings,
  BridgeRequestName,
  BridgeRequests,
} from "@shared/bridge/desktopBridgeContract";
import { bridgeRequestDefinitions } from "@shared/bridge/desktopBridgeContract";
import {
  BridgeInvocationError,
  BridgeUnavailableError,
  CaptureWindowPickerUnsupportedError,
  PathPickerError,
  isKnownTaggedError,
} from "@shared/errors/desktopErrors";
import { EngineResponseError } from "@guerillaglass/engine-client/errors";
import {
  decodeUnknownWithSchemaSync,
  parseJsonStringSync,
  validateEncodedUnknownWithSchemaSync,
  type MutableDeep,
} from "@guerillaglass/engine-client/schemaContracts";

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

async function invokeBridgeContract<K extends BridgeRequestName>(
  name: K,
  contract: string,
  ...args: unknown[]
): Promise<MutableDeep<BridgeRequests[K]["response"]>> {
  const raw = await invokeBridge(name, ...args);
  const schema = bridgeRequestDefinitions[name].responseSchema;
  if (!schema) {
    return raw as never;
  }
  return validateEncodedUnknownWithSchemaSync(schema, raw, contract) as never;
}

async function invokeCaptureStatus<K extends BridgeRequestName>(
  name: K,
  contract: string,
  ...args: unknown[]
): Promise<CaptureStatusResult> {
  return (await invokeBridgeContract(name, contract, ...args)) as CaptureStatusResult;
}

async function invokeProjectState<K extends BridgeRequestName>(
  name: K,
  contract: string,
  ...args: unknown[]
): Promise<ProjectState> {
  return (await invokeBridgeContract(name, contract, ...args)) as ProjectState;
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
    return await invokeBridgeContract("ggEnginePing", "engine ping result");
  },

  async capabilities(): Promise<CapabilitiesResult> {
    return await invokeBridgeContract("ggEngineCapabilities", "engine capabilities result");
  },

  async getPermissions(): Promise<PermissionsResult> {
    return await invokeBridgeContract("ggEngineGetPermissions", "permissions result");
  },

  async agentPreflight(params?: {
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: "none" | "imported_transcript";
    importedTranscriptPath?: string;
  }) {
    return await invokeBridgeContract("ggEngineAgentPreflight", "agent preflight result", params);
  },

  async agentRun(params: {
    preflightToken: string;
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: "none" | "imported_transcript";
    importedTranscriptPath?: string;
    force?: boolean;
  }) {
    return await invokeBridgeContract("ggEngineAgentRun", "agent run result", params);
  },

  async agentStatus(jobId: string) {
    return await invokeBridgeContract("ggEngineAgentStatus", "agent status result", jobId);
  },

  async agentApply(params: { jobId: string; destructiveIntent?: boolean }) {
    return await invokeBridgeContract("ggEngineAgentApply", "agent apply result", params);
  },

  async requestScreenRecordingPermission() {
    return await invokeBridgeContract(
      "ggEngineRequestScreenRecordingPermission",
      "screen recording permission request result",
    );
  },

  async requestMicrophonePermission() {
    return await invokeBridgeContract(
      "ggEngineRequestMicrophonePermission",
      "microphone permission request result",
    );
  },

  async requestInputMonitoringPermission() {
    return await invokeBridgeContract(
      "ggEngineRequestInputMonitoringPermission",
      "input monitoring permission request result",
    );
  },

  async openInputMonitoringSettings() {
    return await invokeBridgeContract(
      "ggEngineOpenInputMonitoringSettings",
      "open input monitoring settings result",
    );
  },

  async listSources(): Promise<SourcesResult> {
    return await invokeBridgeContract("ggEngineListSources", "sources result");
  },

  async startDisplayCapture(
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
    displayId?: number,
    enablePreview = true,
  ): Promise<CaptureStatusResult> {
    return await invokeCaptureStatus(
      "ggEngineStartDisplayCapture",
      "capture status result",
      enableMic,
      captureFps,
      displayId,
      enablePreview,
    );
  },

  async startCurrentWindowCapture(
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
    enablePreview = true,
  ): Promise<CaptureStatusResult> {
    return await invokeCaptureStatus(
      "ggEngineStartCurrentWindowCapture",
      "capture status result",
      enableMic,
      captureFps,
      enablePreview,
    );
  },

  async startWindowCapture(
    windowId: number,
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
    enablePreview = true,
  ): Promise<CaptureStatusResult> {
    try {
      return await invokeCaptureStatus(
        "ggEngineStartWindowCapture",
        "capture status result",
        windowId,
        enableMic,
        captureFps,
        enablePreview,
      );
    } catch (error) {
      if (windowId === 0 && isMacOS13WindowPickerUnsupported(error)) {
        throw new CaptureWindowPickerUnsupportedError({ cause: error });
      }
      throw error;
    }
  },

  async stopCapture(): Promise<CaptureStatusResult> {
    return await invokeCaptureStatus("ggEngineStopCapture", "capture status result");
  },

  async startRecording(trackInputEvents: boolean): Promise<CaptureStatusResult> {
    return await invokeCaptureStatus(
      "ggEngineStartRecording",
      "capture status result",
      trackInputEvents,
    );
  },

  async stopRecording(): Promise<CaptureStatusResult> {
    return await invokeCaptureStatus("ggEngineStopRecording", "capture status result");
  },

  async captureStatus(): Promise<CaptureStatusResult> {
    return await invokeCaptureStatus("ggEngineCaptureStatus", "capture status result");
  },

  async capturePreviewFrame(): Promise<CapturePreviewFrameResult> {
    return await invokeBridgeContract(
      "ggEngineCapturePreviewFrame",
      "capture preview frame result",
    );
  },

  async exportInfo() {
    return await invokeBridgeContract("ggEngineExportInfo", "export info result");
  },

  async runExport(params: {
    outputURL: string;
    presetId: string;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
    timeline?: TimelineDocument;
    backgroundFraming?: BackgroundFramingSettings;
  }) {
    return await invokeBridgeContract("ggEngineRunExport", "export run result", params);
  },

  async runCutPlanExport(params: { outputURL: string; presetId: string; jobId: string }) {
    return await invokeBridgeContract("ggEngineRunCutPlanExport", "cut plan export result", params);
  },

  async projectCurrent(): Promise<ProjectState> {
    return await invokeProjectState("ggEngineProjectCurrent", "project state");
  },

  async projectOpen(projectPath: string): Promise<ProjectState> {
    return await invokeProjectState("ggEngineProjectOpen", "project state", projectPath);
  },

  async projectSave(params: {
    projectPath?: string;
    autoZoom?: AutoZoomSettings;
    backgroundFraming?: BackgroundFramingSettings;
    timeline?: TimelineDocument;
  }): Promise<ProjectState> {
    return await invokeProjectState("ggEngineProjectSave", "project state", params);
  },

  async projectRecents(limit?: number): Promise<ProjectRecentsResult> {
    return await invokeBridgeContract("ggEngineProjectRecents", "project recents result", limit);
  },
};

export const desktopApi = {
  async pickPath(params: {
    mode: HostPathPickerMode;
    startingFolder?: string;
  }): Promise<string | null> {
    try {
      return await invokeBridgeContract("ggPickPath", "host path picker result", params);
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
    return await invokeBridgeContract("ggReadTextFile", "read text file result", filePath);
  },

  async resolveMediaSourceURL(filePath: string): Promise<string> {
    const capabilityToken = await invokeBridgeContract(
      "ggGrantMediaSourceCapability",
      "media source capability result",
      filePath,
    );
    return await invokeBridgeContract(
      "ggResolveMediaSourceURL",
      "media source URL result",
      filePath,
      capabilityToken,
    );
  },

  async resolveCapturePreviewURL(captureSessionId: string): Promise<string> {
    const capabilityToken = await invokeBridgeContract(
      "ggGrantCapturePreviewCapability",
      "capture preview capability result",
      captureSessionId,
    );
    return await invokeBridgeContract(
      "ggResolveCapturePreviewURL",
      "capture preview URL result",
      captureSessionId,
      capabilityToken,
    );
  },
};

export function sendHostMenuState(state: HostMenuState): void {
  const sender = (window as Window & WindowBridgeBindings).ggHostSendMenuState;
  if (!sender) {
    return;
  }
  sender(state);
}

export function sendHostStudioDiagnostics(entry: StudioDiagnosticsEntry): void {
  const sender = (window as Window & WindowBridgeBindings).ggHostSendStudioDiagnostics;
  if (!sender) {
    return;
  }
  sender(entry);
}

export function parseInputEventLog(raw: string): InputEvent[] {
  const parsed = parseJsonStringSync(raw, "input event log");
  const log = decodeUnknownWithSchemaSync(inputEventLogSchema, parsed, "input event log");
  return [...log.events];
}
