import {
  actionResultSchema,
  captureStatusResultSchema,
  exportInfoResultSchema,
  exportRunResultSchema,
  inputEventLogSchema,
  permissionsResultSchema,
  pingResultSchema,
  projectRecentsResultSchema,
  projectStateSchema,
  sourcesResultSchema,
  type AutoZoomSettings,
  type CaptureStatusResult,
  type InputEvent,
  type PermissionsResult,
  type PingResult,
  type ProjectRecentsResult,
  type ProjectState,
  type SourcesResult,
} from "@guerillaglass/engine-protocol";
import type { HostMenuState } from "../../shared/bridgeRpc";

declare global {
  interface Window {
    ggEnginePing?: () => Promise<unknown>;
    ggEngineGetPermissions?: () => Promise<unknown>;
    ggEngineRequestScreenRecordingPermission?: () => Promise<unknown>;
    ggEngineRequestMicrophonePermission?: () => Promise<unknown>;
    ggEngineRequestInputMonitoringPermission?: () => Promise<unknown>;
    ggEngineOpenInputMonitoringSettings?: () => Promise<unknown>;
    ggEngineListSources?: () => Promise<unknown>;
    ggEngineStartDisplayCapture?: (enableMic: boolean) => Promise<unknown>;
    ggEngineStartWindowCapture?: (windowId: number, enableMic: boolean) => Promise<unknown>;
    ggEngineStopCapture?: () => Promise<unknown>;
    ggEngineStartRecording?: (trackInputEvents: boolean) => Promise<unknown>;
    ggEngineStopRecording?: () => Promise<unknown>;
    ggEngineCaptureStatus?: () => Promise<unknown>;
    ggEngineExportInfo?: () => Promise<unknown>;
    ggEngineRunExport?: (params: {
      outputURL: string;
      presetId: string;
      trimStartSeconds?: number;
      trimEndSeconds?: number;
    }) => Promise<unknown>;
    ggEngineProjectCurrent?: () => Promise<unknown>;
    ggEngineProjectOpen?: (projectPath: string) => Promise<unknown>;
    ggEngineProjectSave?: (params: {
      projectPath?: string;
      autoZoom?: AutoZoomSettings;
    }) => Promise<unknown>;
    ggEngineProjectRecents?: (limit?: number) => Promise<unknown>;
    ggPickDirectory?: (startingFolder?: string) => Promise<string | null>;
    ggReadTextFile?: (filePath: string) => Promise<string>;
    ggHostSendMenuState?: (state: HostMenuState) => void;
  }
}

function requireBridge<TArgs extends unknown[], TResult>(
  bridge: ((...args: TArgs) => Promise<TResult>) | undefined,
  name: string,
): (...args: TArgs) => Promise<TResult> {
  if (!bridge) {
    throw new Error(`Missing Electrobun bridge: ${name}`);
  }
  return bridge;
}

export const engineApi = {
  async ping(): Promise<PingResult> {
    return pingResultSchema.parse(await requireBridge(window.ggEnginePing, "ggEnginePing")());
  },

  async getPermissions(): Promise<PermissionsResult> {
    return permissionsResultSchema.parse(
      await requireBridge(window.ggEngineGetPermissions, "ggEngineGetPermissions")(),
    );
  },

  async requestScreenRecordingPermission() {
    return actionResultSchema.parse(
      await requireBridge(
        window.ggEngineRequestScreenRecordingPermission,
        "ggEngineRequestScreenRecordingPermission",
      )(),
    );
  },

  async requestMicrophonePermission() {
    return actionResultSchema.parse(
      await requireBridge(
        window.ggEngineRequestMicrophonePermission,
        "ggEngineRequestMicrophonePermission",
      )(),
    );
  },

  async requestInputMonitoringPermission() {
    return actionResultSchema.parse(
      await requireBridge(
        window.ggEngineRequestInputMonitoringPermission,
        "ggEngineRequestInputMonitoringPermission",
      )(),
    );
  },

  async openInputMonitoringSettings() {
    return actionResultSchema.parse(
      await requireBridge(
        window.ggEngineOpenInputMonitoringSettings,
        "ggEngineOpenInputMonitoringSettings",
      )(),
    );
  },

  async listSources(): Promise<SourcesResult> {
    return sourcesResultSchema.parse(
      await requireBridge(window.ggEngineListSources, "ggEngineListSources")(),
    );
  },

  async startDisplayCapture(enableMic: boolean): Promise<CaptureStatusResult> {
    return captureStatusResultSchema.parse(
      await requireBridge(
        window.ggEngineStartDisplayCapture,
        "ggEngineStartDisplayCapture",
      )(enableMic),
    );
  },

  async startWindowCapture(windowId: number, enableMic: boolean): Promise<CaptureStatusResult> {
    return captureStatusResultSchema.parse(
      await requireBridge(window.ggEngineStartWindowCapture, "ggEngineStartWindowCapture")(
        windowId,
        enableMic,
      ),
    );
  },

  async stopCapture(): Promise<CaptureStatusResult> {
    return captureStatusResultSchema.parse(
      await requireBridge(window.ggEngineStopCapture, "ggEngineStopCapture")(),
    );
  },

  async startRecording(trackInputEvents: boolean): Promise<CaptureStatusResult> {
    return captureStatusResultSchema.parse(
      await requireBridge(
        window.ggEngineStartRecording,
        "ggEngineStartRecording",
      )(trackInputEvents),
    );
  },

  async stopRecording(): Promise<CaptureStatusResult> {
    return captureStatusResultSchema.parse(
      await requireBridge(window.ggEngineStopRecording, "ggEngineStopRecording")(),
    );
  },

  async captureStatus(): Promise<CaptureStatusResult> {
    return captureStatusResultSchema.parse(
      await requireBridge(window.ggEngineCaptureStatus, "ggEngineCaptureStatus")(),
    );
  },

  async exportInfo() {
    return exportInfoResultSchema.parse(
      await requireBridge(window.ggEngineExportInfo, "ggEngineExportInfo")(),
    );
  },

  async runExport(params: {
    outputURL: string;
    presetId: string;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
  }) {
    return exportRunResultSchema.parse(
      await requireBridge(window.ggEngineRunExport, "ggEngineRunExport")(params),
    );
  },

  async projectCurrent(): Promise<ProjectState> {
    return projectStateSchema.parse(
      await requireBridge(window.ggEngineProjectCurrent, "ggEngineProjectCurrent")(),
    );
  },

  async projectOpen(projectPath: string): Promise<ProjectState> {
    return projectStateSchema.parse(
      await requireBridge(window.ggEngineProjectOpen, "ggEngineProjectOpen")(projectPath),
    );
  },

  async projectSave(params: {
    projectPath?: string;
    autoZoom?: AutoZoomSettings;
  }): Promise<ProjectState> {
    return projectStateSchema.parse(
      await requireBridge(window.ggEngineProjectSave, "ggEngineProjectSave")(params),
    );
  },

  async projectRecents(limit?: number): Promise<ProjectRecentsResult> {
    return projectRecentsResultSchema.parse(
      await requireBridge(window.ggEngineProjectRecents, "ggEngineProjectRecents")(limit),
    );
  },
};

export const desktopApi = {
  async pickDirectory(startingFolder?: string): Promise<string | null> {
    return await requireBridge(window.ggPickDirectory, "ggPickDirectory")(startingFolder);
  },

  async readTextFile(filePath: string): Promise<string> {
    return await requireBridge(window.ggReadTextFile, "ggReadTextFile")(filePath);
  },
};

export function parseInputEventLog(raw: string): InputEvent[] {
  const parsed = JSON.parse(raw) as unknown;
  const log = inputEventLogSchema.parse(parsed);
  return log.events;
}
