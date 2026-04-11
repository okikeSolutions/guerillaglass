import {
  actionResultSchema,
  agentPreflightResultSchema,
  agentRunResultSchema,
  agentStatusResultSchema,
  autoZoomSettingsSchema,
  captureFrameRateSchema,
  capturePreviewFrameResultSchema,
  captureStatusResultSchema,
  exportInfoResultSchema,
  exportRunCutPlanResultSchema,
  exportRunResultSchema,
  permissionsResultSchema,
  pingResultSchema,
  projectRecentsResultSchema,
  projectStateSchema,
  sourcesResultSchema,
  timelineDocumentSchema,
  type AgentPreflightResult,
  type AgentRunResult,
  type AgentStatusResult,
  type ActionResult,
  type AutoZoomSettings,
  type CaptureFrameRate,
  type CapturePreviewFrameResult,
  type CaptureStatusResult,
  type ExportInfoResult,
  type ExportRunCutPlanResult,
  type ExportRunResult,
  type PermissionsResult,
  type PingResult,
  type ProjectRecentsResult,
  type ProjectState,
  type SourcesResult,
} from "@guerillaglass/engine-protocol";
import {
  reviewBridgeEventSchema,
  reviewCommentSchema,
  reviewSessionSnapshotSchema,
  reviewSetWorkflowStatusResponseSchema,
  reviewWorkflowStatusSchema,
  type ReviewBridgeEvent,
  type ReviewComment,
  type ReviewCreateCommentRequest,
  type ReviewSessionSnapshot,
  type ReviewSessionSnapshotRequest,
  type ReviewSetWorkflowStatusRequest,
  type ReviewSetWorkflowStatusResponse,
} from "@guerillaglass/review-protocol";
import { Schema } from "effect";
import type { RPCSchema } from "electrobun/bun";
import type { SerializedBridgeError } from "../errors";
import type { StudioShortcutOverrides } from "../shortcuts";
import type { StudioDiagnosticsValue } from "../studioDiagnostics";

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
  runtimeFlags: "gg-host-runtime-flags",
} as const;

export type HostMenuCommand = (typeof hostMenuCommands)[keyof typeof hostMenuCommands];
export const hostMenuCommandList = Object.values(hostMenuCommands) as HostMenuCommand[];

export type HostMenuState = {
  canSave: boolean;
  canExport: boolean;
  canTrimTimeline: boolean;
  canToggleTimeline: boolean;
  isRecording: boolean;
  recordingURL?: string | null;
  locale?: string;
  densityMode?: "comfortable" | "compact";
  shortcutOverrides?: StudioShortcutOverrides;
};

export type HostRuntimeFlags = {
  captureBenchmarkEnabled: boolean;
  studioDiagnosticsEnabled: boolean;
};

/** Host path-picker modes used by renderer workflows. */
export type HostPathPickerMode = "openProject" | "saveProjectAs" | "export";

export type StudioDiagnosticsEntry = {
  source: "renderer";
  level: string;
  message: string;
  timestamp: string;
  annotations?: Record<string, StudioDiagnosticsValue>;
  spans?: Record<string, number>;
};

export const hostPathPickerModeSchema = Schema.Literal("openProject", "saveProjectAs", "export");
export const pickPathRequestSchema = Schema.Struct({
  mode: hostPathPickerModeSchema,
  startingFolder: Schema.optional(Schema.String),
});
export const pickPathResponseSchema = Schema.NullOr(Schema.String);
export const readTextFileRequestSchema = Schema.Struct({
  filePath: Schema.NonEmptyString,
});
export const readTextFileResponseSchema = Schema.String;
export const resolveMediaSourceURLRequestSchema = Schema.Struct({
  filePath: Schema.NonEmptyString,
});
export const resolveMediaSourceURLResponseSchema = Schema.NonEmptyString;
/** Host bridge schema for resolving the loopback live-preview URL. */
export const resolveCapturePreviewURLRequestSchema = Schema.Undefined;
/** Tokenized loopback preview URL served by the Bun media server. */
export const resolveCapturePreviewURLResponseSchema = Schema.NonEmptyString;
export const hostReviewEventMessageSchema = Schema.Struct({
  event: reviewBridgeEventSchema,
});
const studioDiagnosticsValueSchema = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
);
export const studioDiagnosticsEntrySchema = Schema.Struct({
  source: Schema.Literal("renderer"),
  level: Schema.NonEmptyString,
  message: Schema.NonEmptyString,
  timestamp: Schema.NonEmptyString,
  annotations: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: studioDiagnosticsValueSchema,
    }),
  ),
  spans: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Number,
    }),
  ),
});
const nonNegativeIntSchema = Schema.Int.pipe(Schema.greaterThanOrEqualTo(0));
const nonNegativeNumberSchema = Schema.Number.pipe(Schema.greaterThanOrEqualTo(0));
const positiveIntSchema = Schema.Int.pipe(Schema.greaterThanOrEqualTo(1));
const runtimeBudgetMinutesSchema = Schema.optional(
  positiveIntSchema.pipe(Schema.lessThanOrEqualTo(60)),
);
const projectRecentsLimitSchema = Schema.optional(
  positiveIntSchema.pipe(Schema.lessThanOrEqualTo(100)),
);
const reviewAuthTokenSchema = Schema.String.pipe(
  Schema.filter((value) => value.trim().length > 0, {
    message: () => "Expected a non-empty review auth token.",
  }),
);
const undefinedBridgeParamsSchema = Schema.Undefined;
const engineAgentPreflightBridgeParamsSchema = Schema.Struct({
  runtimeBudgetMinutes: runtimeBudgetMinutesSchema,
  transcriptionProvider: Schema.optional(Schema.Literal("none", "imported_transcript")),
  importedTranscriptPath: Schema.optional(Schema.NonEmptyString),
});
const engineAgentRunBridgeParamsSchema = Schema.Struct({
  preflightToken: Schema.NonEmptyString,
  runtimeBudgetMinutes: runtimeBudgetMinutesSchema,
  transcriptionProvider: Schema.optional(Schema.Literal("none", "imported_transcript")),
  importedTranscriptPath: Schema.optional(Schema.NonEmptyString),
  force: Schema.optional(Schema.Boolean),
});
const engineAgentStatusBridgeParamsSchema = Schema.Struct({
  jobId: Schema.NonEmptyString,
});
const engineAgentApplyBridgeParamsSchema = Schema.Struct({
  jobId: Schema.NonEmptyString,
  destructiveIntent: Schema.optional(Schema.Boolean),
});
const engineCaptureStartBridgeParamsSchema = Schema.Struct({
  enableMic: Schema.optional(Schema.Boolean),
  enablePreview: Schema.optional(Schema.Boolean),
  captureFps: Schema.optional(captureFrameRateSchema),
});
const engineCaptureStartDisplayBridgeParamsSchema = Schema.Struct({
  displayId: Schema.optional(nonNegativeIntSchema),
  enableMic: Schema.optional(Schema.Boolean),
  enablePreview: Schema.optional(Schema.Boolean),
  captureFps: Schema.optional(captureFrameRateSchema),
});
const engineCaptureStartWindowBridgeParamsSchema = Schema.Struct({
  windowId: nonNegativeIntSchema,
  enableMic: Schema.optional(Schema.Boolean),
  enablePreview: Schema.optional(Schema.Boolean),
  captureFps: Schema.optional(captureFrameRateSchema),
});
const engineStartRecordingBridgeParamsSchema = Schema.Struct({
  trackInputEvents: Schema.optional(Schema.Boolean),
});
const engineRunExportBridgeParamsSchema = Schema.Struct({
  outputURL: Schema.NonEmptyString,
  presetId: Schema.NonEmptyString,
  trimStartSeconds: Schema.optional(nonNegativeNumberSchema),
  trimEndSeconds: Schema.optional(nonNegativeNumberSchema),
  timeline: Schema.optional(timelineDocumentSchema),
});
const engineRunCutPlanExportBridgeParamsSchema = Schema.Struct({
  outputURL: Schema.NonEmptyString,
  presetId: Schema.NonEmptyString,
  jobId: Schema.NonEmptyString,
});
const engineProjectOpenBridgeParamsSchema = Schema.Struct({
  projectPath: Schema.NonEmptyString,
});
const engineProjectSaveBridgeParamsSchema = Schema.Struct({
  projectPath: Schema.optional(Schema.NonEmptyString),
  autoZoom: Schema.optional(autoZoomSettingsSchema),
  timeline: Schema.optional(timelineDocumentSchema),
});
const engineProjectRecentsBridgeParamsSchema = Schema.Struct({
  limit: projectRecentsLimitSchema,
});
const reviewSessionSnapshotBridgeParamsSchema = Schema.Struct({
  authToken: reviewAuthTokenSchema,
  reviewId: Schema.NonEmptyString,
});
const reviewCreateCommentBridgeParamsSchema = Schema.Struct({
  authToken: reviewAuthTokenSchema,
  reviewId: Schema.NonEmptyString,
  body: Schema.NonEmptyString,
  frameNumber: Schema.optional(nonNegativeIntSchema),
  timestampSeconds: Schema.optional(nonNegativeNumberSchema),
  parentCommentId: Schema.optional(Schema.NonEmptyString),
});
const reviewSetWorkflowStatusBridgeParamsSchema = Schema.Struct({
  authToken: reviewAuthTokenSchema,
  reviewId: Schema.NonEmptyString,
  status: reviewWorkflowStatusSchema,
});

type BridgeRequestDefinition<Params, Response, Args extends readonly unknown[]> = {
  toParams: (...args: Args) => Params;
  responseType: Response;
  paramsSchema?: Schema.Schema.AnyNoContext;
  responseSchema?: Schema.Schema.AnyNoContext;
};

type ReviewBridgeRequestWithAuth<TRequest> = TRequest & {
  authToken: string;
};

function defineBridgeRequest<Params, Response, Args extends readonly unknown[]>(
  toParams: (...args: Args) => Params,
  options?: {
    paramsSchema?: Schema.Schema.AnyNoContext;
    responseSchema?: Schema.Schema.AnyNoContext;
  },
): BridgeRequestDefinition<Params, Response, Args> {
  return {
    toParams,
    responseType: undefined as Response,
    paramsSchema: options?.paramsSchema,
    responseSchema: options?.responseSchema,
  };
}

function defineValidatedBridgeRequest<Params, Response, Args extends readonly unknown[]>(
  toParams: (...args: Args) => Params,
  paramsSchema: Schema.Schema.AnyNoContext,
  responseSchema: Schema.Schema.AnyNoContext,
): BridgeRequestDefinition<Params, Response, Args> {
  return defineBridgeRequest(toParams, {
    paramsSchema,
    responseSchema,
  });
}

/**
 * Canonical request definitions for every Bun bridge call.
 *
 * Each entry defines the request name, argument-to-params mapping, and optional
 * runtime schemas used to validate transport inputs and outputs at the bridge boundary.
 */
export const bridgeRequestDefinitions = {
  ggEnginePing: defineValidatedBridgeRequest<undefined, PingResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    pingResultSchema,
  ),
  ggEngineGetPermissions: defineValidatedBridgeRequest<undefined, PermissionsResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    permissionsResultSchema,
  ),
  ggEngineAgentPreflight: defineValidatedBridgeRequest<
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
  >((params) => params ?? {}, engineAgentPreflightBridgeParamsSchema, agentPreflightResultSchema),
  ggEngineAgentRun: defineValidatedBridgeRequest<
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
  >((params) => params, engineAgentRunBridgeParamsSchema, agentRunResultSchema),
  ggEngineAgentStatus: defineValidatedBridgeRequest<
    { jobId: string },
    AgentStatusResult,
    [jobId: string]
  >((jobId) => ({ jobId }), engineAgentStatusBridgeParamsSchema, agentStatusResultSchema),
  ggEngineAgentApply: defineValidatedBridgeRequest<
    { jobId: string; destructiveIntent?: boolean },
    ActionResult,
    [params: { jobId: string; destructiveIntent?: boolean }]
  >((params) => params, engineAgentApplyBridgeParamsSchema, actionResultSchema),
  ggEngineRequestScreenRecordingPermission: defineValidatedBridgeRequest<
    undefined,
    ActionResult,
    []
  >(() => undefined, undefinedBridgeParamsSchema, actionResultSchema),
  ggEngineRequestMicrophonePermission: defineValidatedBridgeRequest<undefined, ActionResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    actionResultSchema,
  ),
  ggEngineRequestInputMonitoringPermission: defineValidatedBridgeRequest<
    undefined,
    ActionResult,
    []
  >(() => undefined, undefinedBridgeParamsSchema, actionResultSchema),
  ggEngineOpenInputMonitoringSettings: defineValidatedBridgeRequest<undefined, ActionResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    actionResultSchema,
  ),
  ggEngineListSources: defineValidatedBridgeRequest<undefined, SourcesResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    sourcesResultSchema,
  ),
  ggEngineStartDisplayCapture: defineValidatedBridgeRequest<
    {
      displayId?: number;
      enableMic: boolean;
      enablePreview?: boolean;
      captureFps: CaptureFrameRate;
    },
    CaptureStatusResult,
    [enableMic: boolean, captureFps: CaptureFrameRate, displayId?: number, enablePreview?: boolean]
  >(
    (enableMic, captureFps, displayId, enablePreview) => ({
      displayId,
      enableMic,
      enablePreview,
      captureFps,
    }),
    engineCaptureStartDisplayBridgeParamsSchema,
    captureStatusResultSchema,
  ),
  ggEngineStartCurrentWindowCapture: defineValidatedBridgeRequest<
    { enableMic: boolean; enablePreview?: boolean; captureFps: CaptureFrameRate },
    CaptureStatusResult,
    [enableMic: boolean, captureFps: CaptureFrameRate, enablePreview?: boolean]
  >(
    (enableMic, captureFps, enablePreview) => ({ enableMic, enablePreview, captureFps }),
    engineCaptureStartBridgeParamsSchema,
    captureStatusResultSchema,
  ),
  ggEngineStartWindowCapture: defineValidatedBridgeRequest<
    { windowId: number; enableMic: boolean; enablePreview?: boolean; captureFps: CaptureFrameRate },
    CaptureStatusResult,
    [windowId: number, enableMic: boolean, captureFps: CaptureFrameRate, enablePreview?: boolean]
  >(
    (windowId, enableMic, captureFps, enablePreview) => ({
      windowId,
      enableMic,
      enablePreview,
      captureFps,
    }),
    engineCaptureStartWindowBridgeParamsSchema,
    captureStatusResultSchema,
  ),
  ggEngineStopCapture: defineValidatedBridgeRequest<undefined, CaptureStatusResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    captureStatusResultSchema,
  ),
  ggEngineStartRecording: defineValidatedBridgeRequest<
    { trackInputEvents: boolean },
    CaptureStatusResult,
    [trackInputEvents: boolean]
  >(
    (trackInputEvents) => ({ trackInputEvents }),
    engineStartRecordingBridgeParamsSchema,
    captureStatusResultSchema,
  ),
  ggEngineStopRecording: defineValidatedBridgeRequest<undefined, CaptureStatusResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    captureStatusResultSchema,
  ),
  ggEngineCaptureStatus: defineValidatedBridgeRequest<undefined, CaptureStatusResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    captureStatusResultSchema,
  ),
  ggEngineCapturePreviewFrame: defineValidatedBridgeRequest<
    undefined,
    CapturePreviewFrameResult,
    []
  >(() => undefined, undefinedBridgeParamsSchema, capturePreviewFrameResultSchema),
  ggEngineExportInfo: defineValidatedBridgeRequest<undefined, ExportInfoResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    exportInfoResultSchema,
  ),
  ggEngineRunExport: defineValidatedBridgeRequest<
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
  >((params) => params, engineRunExportBridgeParamsSchema, exportRunResultSchema),
  ggEngineRunCutPlanExport: defineValidatedBridgeRequest<
    {
      outputURL: string;
      presetId: string;
      jobId: string;
    },
    ExportRunCutPlanResult,
    [params: { outputURL: string; presetId: string; jobId: string }]
  >((params) => params, engineRunCutPlanExportBridgeParamsSchema, exportRunCutPlanResultSchema),
  ggEngineProjectCurrent: defineValidatedBridgeRequest<undefined, ProjectState, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    projectStateSchema,
  ),
  ggEngineProjectOpen: defineValidatedBridgeRequest<
    { projectPath: string },
    ProjectState,
    [projectPath: string]
  >((projectPath) => ({ projectPath }), engineProjectOpenBridgeParamsSchema, projectStateSchema),
  ggEngineProjectSave: defineValidatedBridgeRequest<
    { projectPath?: string; autoZoom?: AutoZoomSettings },
    ProjectState,
    [params: { projectPath?: string; autoZoom?: AutoZoomSettings }]
  >((params) => params, engineProjectSaveBridgeParamsSchema, projectStateSchema),
  ggEngineProjectRecents: defineValidatedBridgeRequest<
    { limit?: number },
    ProjectRecentsResult,
    [limit?: number]
  >((limit) => ({ limit }), engineProjectRecentsBridgeParamsSchema, projectRecentsResultSchema),
  ggReviewSessionSnapshot: defineValidatedBridgeRequest<
    ReviewBridgeRequestWithAuth<ReviewSessionSnapshotRequest>,
    ReviewSessionSnapshot,
    [params: ReviewBridgeRequestWithAuth<ReviewSessionSnapshotRequest>]
  >((params) => params, reviewSessionSnapshotBridgeParamsSchema, reviewSessionSnapshotSchema),
  ggReviewCreateComment: defineValidatedBridgeRequest<
    ReviewBridgeRequestWithAuth<ReviewCreateCommentRequest>,
    ReviewComment,
    [params: ReviewBridgeRequestWithAuth<ReviewCreateCommentRequest>]
  >((params) => params, reviewCreateCommentBridgeParamsSchema, reviewCommentSchema),
  ggReviewSetWorkflowStatus: defineValidatedBridgeRequest<
    ReviewBridgeRequestWithAuth<ReviewSetWorkflowStatusRequest>,
    ReviewSetWorkflowStatusResponse,
    [params: ReviewBridgeRequestWithAuth<ReviewSetWorkflowStatusRequest>]
  >(
    (params) => params,
    reviewSetWorkflowStatusBridgeParamsSchema,
    reviewSetWorkflowStatusResponseSchema,
  ),
  ggPickPath: defineValidatedBridgeRequest<
    { mode: HostPathPickerMode; startingFolder?: string },
    string | null,
    [params: { mode: HostPathPickerMode; startingFolder?: string }]
  >((params) => params, pickPathRequestSchema, pickPathResponseSchema),
  ggReadTextFile: defineValidatedBridgeRequest<{ filePath: string }, string, [filePath: string]>(
    (filePath) => ({
      filePath,
    }),
    readTextFileRequestSchema,
    readTextFileResponseSchema,
  ),
  ggResolveMediaSourceURL: defineValidatedBridgeRequest<
    { filePath: string },
    string,
    [filePath: string]
  >(
    (filePath) => ({
      filePath,
    }),
    resolveMediaSourceURLRequestSchema,
    resolveMediaSourceURLResponseSchema,
  ),
  ggResolveCapturePreviewURL: defineValidatedBridgeRequest<undefined, string, []>(
    () => undefined,
    resolveCapturePreviewURLRequestSchema,
    resolveCapturePreviewURLResponseSchema,
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

export type BridgeRequestHandlerMap = {
  [K in BridgeRequestName]: (
    params: BridgeRequests[K]["params"],
  ) => Promise<BridgeRequests[K]["response"]>;
};

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
  ggHostSendStudioDiagnostics?: (entry: StudioDiagnosticsEntry) => void;
};

export type DesktopBridgeRPC = {
  bun: RPCSchema<{
    requests: BridgeTransportRequests;
    messages: {
      hostMenuState: HostMenuState;
      studioDiagnostics: StudioDiagnosticsEntry;
    };
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      hostMenuCommand: { command: HostMenuCommand };
      hostCaptureStatus: { captureStatus: CaptureStatusResult };
      hostReviewEvent: { event: ReviewBridgeEvent };
      hostRuntimeFlags: HostRuntimeFlags;
    };
  }>;
};
