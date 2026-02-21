import type {
  ActionResult,
  AutoZoomSettings,
  CaptureFrameRate,
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

export const hostMenuCommands = {
  appRefresh: "app.refresh",
  appLocaleEnUS: "app.locale.enUS",
  appLocaleDeDE: "app.locale.deDE",
  captureToggleRecording: "capture.toggleRecording",
  captureStartPreview: "capture.startPreview",
  captureStopPreview: "capture.stopPreview",
  timelinePlayPause: "timeline.playPause",
  timelineTrimIn: "timeline.trimIn",
  timelineTrimOut: "timeline.trimOut",
  timelineTogglePanel: "timeline.togglePanel",
  viewDensityComfortable: "view.density.comfortable",
  viewDensityCompact: "view.density.compact",
  fileOpenProject: "file.openProject",
  fileSaveProject: "file.saveProject",
  fileSaveProjectAs: "file.saveProjectAs",
  fileExport: "file.export",
} as const;

export type HostMenuCommand = (typeof hostMenuCommands)[keyof typeof hostMenuCommands];
export const hostMenuCommandList = Object.values(hostMenuCommands) as HostMenuCommand[];

export type HostMenuState = {
  canSave: boolean;
  canExport: boolean;
  isRecording: boolean;
  locale?: string;
  densityMode?: "comfortable" | "compact";
};

type BridgeRequestDefinition<Params, Response, Args extends readonly unknown[]> = {
  toParams: (...args: Args) => Params;
  responseType: Response;
};

function defineBridgeRequest<Params, Response, Args extends readonly unknown[]>(
  toParams: (...args: Args) => Params,
): BridgeRequestDefinition<Params, Response, Args> {
  return { toParams, responseType: undefined as Response };
}

export const bridgeRequestDefinitions = {
  ggEnginePing: defineBridgeRequest<undefined, PingResult, []>(() => undefined),
  ggEngineGetPermissions: defineBridgeRequest<undefined, PermissionsResult, []>(() => undefined),
  ggEngineRequestScreenRecordingPermission: defineBridgeRequest<undefined, ActionResult, []>(
    () => undefined,
  ),
  ggEngineRequestMicrophonePermission: defineBridgeRequest<undefined, ActionResult, []>(
    () => undefined,
  ),
  ggEngineRequestInputMonitoringPermission: defineBridgeRequest<undefined, ActionResult, []>(
    () => undefined,
  ),
  ggEngineOpenInputMonitoringSettings: defineBridgeRequest<undefined, ActionResult, []>(
    () => undefined,
  ),
  ggEngineListSources: defineBridgeRequest<undefined, SourcesResult, []>(() => undefined),
  ggEngineStartDisplayCapture: defineBridgeRequest<
    { enableMic: boolean; captureFps: CaptureFrameRate },
    CaptureStatusResult,
    [enableMic: boolean, captureFps: CaptureFrameRate]
  >((enableMic, captureFps) => ({ enableMic, captureFps })),
  ggEngineStartWindowCapture: defineBridgeRequest<
    { windowId: number; enableMic: boolean; captureFps: CaptureFrameRate },
    CaptureStatusResult,
    [windowId: number, enableMic: boolean, captureFps: CaptureFrameRate]
  >((windowId, enableMic, captureFps) => ({ windowId, enableMic, captureFps })),
  ggEngineStopCapture: defineBridgeRequest<undefined, CaptureStatusResult, []>(() => undefined),
  ggEngineStartRecording: defineBridgeRequest<
    { trackInputEvents: boolean },
    CaptureStatusResult,
    [trackInputEvents: boolean]
  >((trackInputEvents) => ({ trackInputEvents })),
  ggEngineStopRecording: defineBridgeRequest<undefined, CaptureStatusResult, []>(() => undefined),
  ggEngineCaptureStatus: defineBridgeRequest<undefined, CaptureStatusResult, []>(() => undefined),
  ggEngineExportInfo: defineBridgeRequest<undefined, ExportInfoResult, []>(() => undefined),
  ggEngineRunExport: defineBridgeRequest<
    {
      outputURL: string;
      presetId: string;
      trimStartSeconds?: number;
      trimEndSeconds?: number;
    },
    ExportRunResult,
    [
      params: {
        outputURL: string;
        presetId: string;
        trimStartSeconds?: number;
        trimEndSeconds?: number;
      },
    ]
  >((params) => params),
  ggEngineProjectCurrent: defineBridgeRequest<undefined, ProjectState, []>(() => undefined),
  ggEngineProjectOpen: defineBridgeRequest<
    { projectPath: string },
    ProjectState,
    [projectPath: string]
  >((projectPath) => ({ projectPath })),
  ggEngineProjectSave: defineBridgeRequest<
    { projectPath?: string; autoZoom?: AutoZoomSettings },
    ProjectState,
    [params: { projectPath?: string; autoZoom?: AutoZoomSettings }]
  >((params) => params),
  ggEngineProjectRecents: defineBridgeRequest<
    { limit?: number },
    ProjectRecentsResult,
    [limit?: number]
  >((limit) => ({ limit })),
  ggPickDirectory: defineBridgeRequest<
    { startingFolder?: string },
    string | null,
    [startingFolder?: string]
  >((startingFolder) => ({ startingFolder })),
  ggReadTextFile: defineBridgeRequest<{ filePath: string }, string, [filePath: string]>(
    (filePath) => ({ filePath }),
  ),
  ggResolveMediaSourceURL: defineBridgeRequest<{ filePath: string }, string, [filePath: string]>(
    (filePath) => ({ filePath }),
  ),
} as const;

type BridgeRequestDefinitions = typeof bridgeRequestDefinitions;
type BridgeRequestParams<TDefinition> =
  TDefinition extends BridgeRequestDefinition<infer TParams, infer _TResponse, infer _TArgs>
    ? TParams
    : never;
type BridgeRequestResponse<TDefinition> =
  TDefinition extends BridgeRequestDefinition<infer _TParams, infer TResponse, infer _TArgs>
    ? TResponse
    : never;
type BridgeRequestArgs<TDefinition> =
  TDefinition extends BridgeRequestDefinition<infer _TParams, infer _TResponse, infer TArgs>
    ? TArgs
    : never;

export type BridgeRequestName = keyof BridgeRequestDefinitions;
export const bridgeRequestNameList = Object.keys(bridgeRequestDefinitions) as BridgeRequestName[];

export type BridgeRequests = {
  [K in BridgeRequestName]: {
    params: BridgeRequestParams<BridgeRequestDefinitions[K]>;
    response: BridgeRequestResponse<BridgeRequestDefinitions[K]>;
  };
};

export type BridgeRequestInvoker = <K extends BridgeRequestName>(
  name: K,
  params: BridgeRequests[K]["params"],
) => Promise<BridgeRequests[K]["response"]>;

export type BridgeRequestHandlerMap = {
  [K in BridgeRequestName]: (
    params: BridgeRequests[K]["params"],
  ) => Promise<BridgeRequests[K]["response"]>;
};

export type WindowBridgeBindings = {
  [K in BridgeRequestName]?: (
    ...args: BridgeRequestArgs<BridgeRequestDefinitions[K]>
  ) => Promise<BridgeRequestResponse<BridgeRequestDefinitions[K]>>;
} & {
  ggHostSendMenuState?: (state: HostMenuState) => void;
};

export type DesktopBridgeRPC = {
  bun: RPCSchema<{ requests: BridgeRequests; messages: { hostMenuState: HostMenuState } }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: { hostMenuCommand: { command: HostMenuCommand } };
  }>;
};
