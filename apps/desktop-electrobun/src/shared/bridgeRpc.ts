import type {
  AgentPreflightResult,
  AgentRunResult,
  AgentStatusResult,
  ActionResult,
  AutoZoomSettings,
  CaptureFrameRate,
  CaptureStatusResult,
  ExportInfoResult,
  ExportRunCutPlanResult,
  ExportRunResult,
  PermissionsResult,
  PingResult,
  ProjectRecentsResult,
  ProjectState,
  SourcesResult,
} from "@guerillaglass/engine-protocol";
import type {
  ReviewBridgeEvent,
  ReviewComment,
  ReviewCreateCommentRequest,
  ReviewSessionSnapshot,
  ReviewSessionSnapshotRequest,
  ReviewSetWorkflowStatusRequest,
  ReviewSetWorkflowStatusResponse,
} from "@guerillaglass/review-protocol";
import type { RPCSchema } from "electrobun/bun";
import type { SerializedBridgeError } from "./errors";
import type { StudioShortcutOverrides } from "./shortcuts";

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

export const hostBridgeEventNames = {
  menuCommand: "gg-host-menu-command",
  captureStatus: "gg-host-capture-status",
  reviewEvent: "gg-host-review-event",
} as const;

export type HostMenuCommand = (typeof hostMenuCommands)[keyof typeof hostMenuCommands];
export const hostMenuCommandList = Object.values(hostMenuCommands) as HostMenuCommand[];

export type HostMenuState = {
  canSave: boolean;
  canExport: boolean;
  isRecording: boolean;
  recordingURL?: string | null;
  locale?: string;
  densityMode?: "comfortable" | "compact";
  shortcutOverrides?: StudioShortcutOverrides;
};

/** Host path-picker modes used by renderer workflows. */
export type HostPathPickerMode = "openProject" | "saveProjectAs" | "export";

type BridgeRequestDefinition<Params, Response, Args extends readonly unknown[]> = {
  toParams: (...args: Args) => Params;
  responseType: Response;
};

type ReviewBridgeRequestWithAuth<TRequest> = TRequest & {
  authToken: string;
};

function defineBridgeRequest<Params, Response, Args extends readonly unknown[]>(
  toParams: (...args: Args) => Params,
): BridgeRequestDefinition<Params, Response, Args> {
  return { toParams, responseType: undefined as Response };
}

export const bridgeRequestDefinitions = {
  ggEnginePing: defineBridgeRequest<undefined, PingResult, []>(() => undefined),
  ggEngineGetPermissions: defineBridgeRequest<undefined, PermissionsResult, []>(() => undefined),
  ggEngineAgentPreflight: defineBridgeRequest<
    {
      runtimeBudgetMinutes?: number;
      transcriptionProvider?: "none" | "imported_transcript";
      importedTranscriptPath?: string;
    },
    AgentPreflightResult,
    [
      params?: {
        runtimeBudgetMinutes?: number;
        transcriptionProvider?: "none" | "imported_transcript";
        importedTranscriptPath?: string;
      },
    ]
  >((params) => params ?? {}),
  ggEngineAgentRun: defineBridgeRequest<
    {
      preflightToken: string;
      runtimeBudgetMinutes?: number;
      transcriptionProvider?: "none" | "imported_transcript";
      importedTranscriptPath?: string;
      force?: boolean;
    },
    AgentRunResult,
    [
      params: {
        preflightToken: string;
        runtimeBudgetMinutes?: number;
        transcriptionProvider?: "none" | "imported_transcript";
        importedTranscriptPath?: string;
        force?: boolean;
      },
    ]
  >((params) => params),
  ggEngineAgentStatus: defineBridgeRequest<{ jobId: string }, AgentStatusResult, [jobId: string]>(
    (jobId) => ({ jobId }),
  ),
  ggEngineAgentApply: defineBridgeRequest<
    { jobId: string; destructiveIntent?: boolean },
    ActionResult,
    [params: { jobId: string; destructiveIntent?: boolean }]
  >((params) => params),
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
  ggEngineStartCurrentWindowCapture: defineBridgeRequest<
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
  ggEngineRunCutPlanExport: defineBridgeRequest<
    {
      outputURL: string;
      presetId: string;
      jobId: string;
    },
    ExportRunCutPlanResult,
    [params: { outputURL: string; presetId: string; jobId: string }]
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
  ggReviewSessionSnapshot: defineBridgeRequest<
    ReviewBridgeRequestWithAuth<ReviewSessionSnapshotRequest>,
    ReviewSessionSnapshot,
    [params: ReviewBridgeRequestWithAuth<ReviewSessionSnapshotRequest>]
  >((params) => params),
  ggReviewCreateComment: defineBridgeRequest<
    ReviewBridgeRequestWithAuth<ReviewCreateCommentRequest>,
    ReviewComment,
    [params: ReviewBridgeRequestWithAuth<ReviewCreateCommentRequest>]
  >((params) => params),
  ggReviewSetWorkflowStatus: defineBridgeRequest<
    ReviewBridgeRequestWithAuth<ReviewSetWorkflowStatusRequest>,
    ReviewSetWorkflowStatusResponse,
    [params: ReviewBridgeRequestWithAuth<ReviewSetWorkflowStatusRequest>]
  >((params) => params),
  ggPickPath: defineBridgeRequest<
    { mode: HostPathPickerMode; startingFolder?: string },
    string | null,
    [params: { mode: HostPathPickerMode; startingFolder?: string }]
  >((params) => params),
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

/** Internal Electrobun request envelope used to carry Bun-side failures across process boundaries. */
export type BridgeResponseEnvelope<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: SerializedBridgeError;
    };

type BridgeTransportRequests = {
  [K in BridgeRequestName]: {
    params: BridgeRequests[K]["params"];
    response: BridgeResponseEnvelope<BridgeRequests[K]["response"]>;
  };
};

export type BridgeRequestInvoker = <K extends BridgeRequestName>(
  name: K,
  params: BridgeRequests[K]["params"],
) => Promise<BridgeTransportRequests[K]["response"]>;

/** Logical Bun handlers that return raw responses before bridge envelope wrapping. */
export type BridgeRequestHandlerMap = {
  [K in BridgeRequestName]: (
    params: BridgeRequests[K]["params"],
  ) => Promise<BridgeRequests[K]["response"]>;
};

/** Electrobun request handlers after success/failure envelopes are applied. */
export type BunBridgeRequestHandlerMap = {
  [K in BridgeRequestName]: (
    params: BridgeRequests[K]["params"],
  ) => Promise<BridgeTransportRequests[K]["response"]>;
};

export type WindowBridgeBindings = {
  [K in BridgeRequestName]?: (
    ...args: BridgeRequestArgs<BridgeRequestDefinitions[K]>
  ) => Promise<BridgeRequestResponse<BridgeRequestDefinitions[K]>>;
} & {
  ggHostSendMenuState?: (state: HostMenuState) => void;
};

export type DesktopBridgeRPC = {
  bun: RPCSchema<{ requests: BridgeTransportRequests; messages: { hostMenuState: HostMenuState } }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      hostMenuCommand: { command: HostMenuCommand };
      hostCaptureStatus: { captureStatus: CaptureStatusResult };
      hostReviewEvent: { event: ReviewBridgeEvent };
    };
  }>;
};
