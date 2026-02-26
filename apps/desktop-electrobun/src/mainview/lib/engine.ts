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

function requireBridge<K extends keyof WindowBridgeBindings>(
  name: K,
): NonNullable<WindowBridgeBindings[K]> {
  const bridgeWindow = window as Window & WindowBridgeBindings;
  const bridge = bridgeWindow[name];
  if (!bridge) {
    throw new Error(`Missing Electrobun bridge: ${String(name)}`);
  }
  return bridge as NonNullable<WindowBridgeBindings[K]>;
}

export const engineApi = {
  async ping(): Promise<PingResult> {
    return pingResultSchema.parse(await requireBridge("ggEnginePing")());
  },

  async getPermissions(): Promise<PermissionsResult> {
    return permissionsResultSchema.parse(await requireBridge("ggEngineGetPermissions")());
  },

  async agentPreflight(params?: {
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: "none" | "imported_transcript";
    importedTranscriptPath?: string;
  }) {
    return agentPreflightResultSchema.parse(await requireBridge("ggEngineAgentPreflight")(params));
  },

  async agentRun(params: {
    preflightToken: string;
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: "none" | "imported_transcript";
    importedTranscriptPath?: string;
    force?: boolean;
  }) {
    return agentRunResultSchema.parse(await requireBridge("ggEngineAgentRun")(params));
  },

  async agentStatus(jobId: string) {
    return agentStatusResultSchema.parse(await requireBridge("ggEngineAgentStatus")(jobId));
  },

  async agentApply(params: { jobId: string; destructiveIntent?: boolean }) {
    return actionResultSchema.parse(await requireBridge("ggEngineAgentApply")(params));
  },

  async requestScreenRecordingPermission() {
    return actionResultSchema.parse(
      await requireBridge("ggEngineRequestScreenRecordingPermission")(),
    );
  },

  async requestMicrophonePermission() {
    return actionResultSchema.parse(await requireBridge("ggEngineRequestMicrophonePermission")());
  },

  async requestInputMonitoringPermission() {
    return actionResultSchema.parse(
      await requireBridge("ggEngineRequestInputMonitoringPermission")(),
    );
  },

  async openInputMonitoringSettings() {
    return actionResultSchema.parse(await requireBridge("ggEngineOpenInputMonitoringSettings")());
  },

  async listSources(): Promise<SourcesResult> {
    return sourcesResultSchema.parse(await requireBridge("ggEngineListSources")());
  },

  async startDisplayCapture(
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ): Promise<CaptureStatusResult> {
    return captureStatusResultSchema.parse(
      await requireBridge("ggEngineStartDisplayCapture")(enableMic, captureFps),
    );
  },

  async startCurrentWindowCapture(
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ): Promise<CaptureStatusResult> {
    return captureStatusResultSchema.parse(
      await requireBridge("ggEngineStartCurrentWindowCapture")(enableMic, captureFps),
    );
  },

  async startWindowCapture(
    windowId: number,
    enableMic: boolean,
    captureFps: CaptureFrameRate = defaultCaptureFrameRate,
  ): Promise<CaptureStatusResult> {
    return captureStatusResultSchema.parse(
      await requireBridge("ggEngineStartWindowCapture")(windowId, enableMic, captureFps),
    );
  },

  async stopCapture(): Promise<CaptureStatusResult> {
    return captureStatusResultSchema.parse(await requireBridge("ggEngineStopCapture")());
  },

  async startRecording(trackInputEvents: boolean): Promise<CaptureStatusResult> {
    return captureStatusResultSchema.parse(
      await requireBridge("ggEngineStartRecording")(trackInputEvents),
    );
  },

  async stopRecording(): Promise<CaptureStatusResult> {
    return captureStatusResultSchema.parse(await requireBridge("ggEngineStopRecording")());
  },

  async captureStatus(): Promise<CaptureStatusResult> {
    return captureStatusResultSchema.parse(await requireBridge("ggEngineCaptureStatus")());
  },

  async exportInfo() {
    return exportInfoResultSchema.parse(await requireBridge("ggEngineExportInfo")());
  },

  async runExport(params: {
    outputURL: string;
    presetId: string;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
  }) {
    return exportRunResultSchema.parse(await requireBridge("ggEngineRunExport")(params));
  },

  async runCutPlanExport(params: { outputURL: string; presetId: string; jobId: string }) {
    return exportRunCutPlanResultSchema.parse(
      await requireBridge("ggEngineRunCutPlanExport")(params),
    );
  },

  async projectCurrent(): Promise<ProjectState> {
    return projectStateSchema.parse(await requireBridge("ggEngineProjectCurrent")());
  },

  async projectOpen(projectPath: string): Promise<ProjectState> {
    return projectStateSchema.parse(await requireBridge("ggEngineProjectOpen")(projectPath));
  },

  async projectSave(params: {
    projectPath?: string;
    autoZoom?: AutoZoomSettings;
  }): Promise<ProjectState> {
    return projectStateSchema.parse(await requireBridge("ggEngineProjectSave")(params));
  },

  async projectRecents(limit?: number): Promise<ProjectRecentsResult> {
    return projectRecentsResultSchema.parse(await requireBridge("ggEngineProjectRecents")(limit));
  },
};

export const desktopApi = {
  async pickPath(params: {
    mode: HostPathPickerMode;
    startingFolder?: string;
  }): Promise<string | null> {
    return await requireBridge("ggPickPath")(params);
  },

  async readTextFile(filePath: string): Promise<string> {
    return await requireBridge("ggReadTextFile")(filePath);
  },

  async resolveMediaSourceURL(filePath: string): Promise<string> {
    return await requireBridge("ggResolveMediaSourceURL")(filePath);
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
  const parsed = JSON.parse(raw) as unknown;
  const log = inputEventLogSchema.parse(parsed);
  return log.events;
}
