import type {
  ActionResult,
  AutoZoomSettings,
  CaptureStatusResult,
  ExportInfoResult,
  ExportRunResult,
  PermissionsResult,
  PingResult,
  ProjectState,
  SourcesResult,
} from "@guerillaglass/engine-protocol";
import type { RPCSchema } from "electrobun/bun";

export const hostMenuCommandList = [
  "app.refresh",
  "capture.toggleRecording",
  "capture.startPreview",
  "capture.stopPreview",
  "timeline.playPause",
  "timeline.trimIn",
  "timeline.trimOut",
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
  ggPickDirectory: { params: { startingFolder?: string }; response: string | null };
};

export type DesktopBridgeRPC = {
  bun: RPCSchema<{ requests: BridgeRequests; messages: { hostMenuState: HostMenuState } }>;
  webview: RPCSchema<{ requests: {}; messages: { hostMenuCommand: { command: HostMenuCommand } } }>;
};
