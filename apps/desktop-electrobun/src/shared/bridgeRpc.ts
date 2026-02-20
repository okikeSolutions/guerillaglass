import type {
  ActionResult,
  AutoZoomSettings,
  CaptureStatusResult,
  ExportInfoResult,
  ExportRunResult,
  PermissionsResult,
  PingResult,
  ProjectRecentsResult,
  ProjectState,
  SourcesResult,
} from "@guerillaglass/engine-protocol";
import type { RPCSchema } from "electrobun/bun";

export const hostMenuCommandList = [
  "app.refresh",
  "app.locale.enUS",
  "app.locale.deDE",
  "capture.toggleRecording",
  "capture.startPreview",
  "capture.stopPreview",
  "timeline.playPause",
  "timeline.trimIn",
  "timeline.trimOut",
  "timeline.togglePanel",
  "view.density.comfortable",
  "view.density.compact",
  "file.openProject",
  "file.saveProject",
  "file.saveProjectAs",
  "file.export",
] as const;
export type HostMenuCommand = (typeof hostMenuCommandList)[number];

export type HostMenuState = {
  canSave: boolean;
  canExport: boolean;
  isRecording: boolean;
  locale?: string;
  densityMode?: "comfortable" | "compact";
};

type BridgeRequests = {
  ggEnginePing: { params: undefined; response: PingResult };
  ggEngineGetPermissions: { params: undefined; response: PermissionsResult };
  ggEngineRequestScreenRecordingPermission: { params: undefined; response: ActionResult };
  ggEngineRequestMicrophonePermission: { params: undefined; response: ActionResult };
  ggEngineRequestInputMonitoringPermission: { params: undefined; response: ActionResult };
  ggEngineOpenInputMonitoringSettings: { params: undefined; response: ActionResult };
  ggEngineListSources: { params: undefined; response: SourcesResult };
  ggEngineStartDisplayCapture: {
    params: { enableMic: boolean };
    response: CaptureStatusResult;
  };
  ggEngineStartWindowCapture: {
    params: { windowId: number; enableMic: boolean };
    response: CaptureStatusResult;
  };
  ggEngineStopCapture: { params: undefined; response: CaptureStatusResult };
  ggEngineStartRecording: {
    params: { trackInputEvents: boolean };
    response: CaptureStatusResult;
  };
  ggEngineStopRecording: { params: undefined; response: CaptureStatusResult };
  ggEngineCaptureStatus: { params: undefined; response: CaptureStatusResult };
  ggEngineExportInfo: { params: undefined; response: ExportInfoResult };
  ggEngineRunExport: {
    params: {
      outputURL: string;
      presetId: string;
      trimStartSeconds?: number;
      trimEndSeconds?: number;
    };
    response: ExportRunResult;
  };
  ggEngineProjectCurrent: { params: undefined; response: ProjectState };
  ggEngineProjectOpen: { params: { projectPath: string }; response: ProjectState };
  ggEngineProjectSave: {
    params: { projectPath?: string; autoZoom?: AutoZoomSettings };
    response: ProjectState;
  };
  ggEngineProjectRecents: {
    params: { limit?: number };
    response: ProjectRecentsResult;
  };
  ggPickDirectory: { params: { startingFolder?: string }; response: string | null };
  ggReadTextFile: { params: { filePath: string }; response: string };
};

export type DesktopBridgeRPC = {
  bun: RPCSchema<{ requests: BridgeRequests; messages: { hostMenuState: HostMenuState } }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: { hostMenuCommand: { command: HostMenuCommand } };
  }>;
};
