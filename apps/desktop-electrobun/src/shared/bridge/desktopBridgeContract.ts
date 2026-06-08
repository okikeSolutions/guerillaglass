import type {
  AgentPreflightResult,
  AgentRunResult,
  AgentStatusResult,
} from "@guerillaglass/engine/protocol/domains/agent";
import type {
  CapturePreviewFrameResult,
  CaptureStatusResult,
} from "@guerillaglass/engine/protocol/domains/capture";
import type {
  ExportInfoResult,
  ExportRunCutPlanResult,
  ExportRunResult,
} from "@guerillaglass/engine/protocol/domains/export";
import type {
  ActionResult,
  PermissionsResult,
} from "@guerillaglass/engine/protocol/domains/permissions";
import type {
  ProjectRecentsResult,
  ProjectState,
} from "@guerillaglass/engine/protocol/domains/project";
import type {
  CaptureFrameRate,
  SourcesResult,
} from "@guerillaglass/engine/protocol/domains/sources";
import type { PingResult } from "@guerillaglass/engine/protocol/domains/system";
import type { AutoZoomSettings } from "@guerillaglass/engine/protocol/shared/valueObjects";
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
import {
  exportPresetIdSchema,
  filePathSchema,
  isoDateTimeSchema,
  outputUrlSchema,
  projectPathSchema,
  reviewAuthTokenSchema,
  reviewCommentIdSchema,
  captureSessionIdSchema,
  reviewIdSchema,
} from "@guerillaglass/engine/protocol/schema-primitives";
import { Schema } from "effect";
import { EngineRpcs } from "@guerillaglass/engine/protocol/rpc/group";
import type { RPCSchema } from "electrobun/bun";
import type { SerializedBridgeError } from "../errors/desktopErrors";
import { studioShortcutOverridesSchema, type StudioShortcutOverrides } from "../shortcuts";
import type { StudioDiagnosticsValue } from "../studioDiagnostics";

function greaterThanOrEqualTo(minimum: number) {
  return <S extends Schema.Top & { readonly Type: number }>(schema: S): S["Rebuild"] =>
    schema.check(Schema.isGreaterThanOrEqualTo(minimum));
}

const nonNegativeIntSchema = Schema.Int.pipe(greaterThanOrEqualTo(0));
const nonNegativeNumberSchema = Schema.Number.pipe(greaterThanOrEqualTo(0));

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
  desktopRuntimeFlags: "gg-desktop-runtime-flags",
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

export const hostMenuStateSchema = Schema.Struct({
  canSave: Schema.Boolean,
  canExport: Schema.Boolean,
  canTrimTimeline: Schema.Boolean,
  canToggleTimeline: Schema.Boolean,
  isRecording: Schema.Boolean,
  recordingURL: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isMaxLength(2048)))),
  locale: Schema.optional(Schema.String.check(Schema.isMaxLength(32))),
  densityMode: Schema.optional(Schema.Literals(["comfortable", "compact"])),
  shortcutOverrides: Schema.optional(studioShortcutOverridesSchema),
});

export type DesktopRuntimeFlags = {
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

export const hostPathPickerModeSchema = Schema.Literals(["openProject", "saveProjectAs", "export"]);
export const pickPathRequestSchema = Schema.Struct({
  mode: hostPathPickerModeSchema,
  startingFolder: Schema.optional(Schema.String),
});
export const pickPathResponseSchema = Schema.NullOr(Schema.String);
export const readTextFileRequestSchema = Schema.Struct({
  filePath: filePathSchema,
});
export const readTextFileResponseSchema = Schema.String;
export const desktopCapabilityTokenSchema = Schema.NonEmptyString.check(Schema.isMaxLength(512));
export const resolveMediaSourceURLRequestSchema = Schema.Struct({
  filePath: filePathSchema,
  capabilityToken: desktopCapabilityTokenSchema,
});
export const resolveMediaSourceURLResponseSchema = outputUrlSchema;
/** Host bridge schema for resolving the loopback live-preview URL. */
export const resolveCapturePreviewURLRequestSchema = Schema.Struct({
  captureSessionId: captureSessionIdSchema,
  capabilityToken: desktopCapabilityTokenSchema,
});
/** Tokenized loopback preview URL served by the Bun media server. */
export const resolveCapturePreviewURLResponseSchema = outputUrlSchema;
export const hostReviewEventMessageSchema = Schema.Struct({
  event: reviewBridgeEventSchema,
});
const studioDiagnosticsValueSchema = Schema.Union([
  Schema.String.check(Schema.isMaxLength(2048)),
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
]);
export const studioDiagnosticsEntrySchema = Schema.Struct({
  source: Schema.Literal("renderer"),
  level: Schema.NonEmptyString.check(Schema.isMaxLength(32)),
  message: Schema.NonEmptyString.check(Schema.isMaxLength(4096)),
  timestamp: isoDateTimeSchema,
  annotations: Schema.optional(
    Schema.Record(Schema.String.check(Schema.isMaxLength(128)), studioDiagnosticsValueSchema).check(
      Schema.isMaxProperties(64),
    ),
  ),
  spans: Schema.optional(
    Schema.Record(Schema.String.check(Schema.isMaxLength(128)), Schema.Number).check(
      Schema.isMaxProperties(64),
    ),
  ),
});
function engineRpc(method: string): {
  readonly payloadSchema: Schema.Top;
  readonly successSchema: Schema.Top;
} {
  const rpc = EngineRpcs.requests.get(method);
  if (!rpc) {
    throw new Error(`Unknown engine RPC method: ${method}`);
  }
  return rpc as { readonly payloadSchema: Schema.Top; readonly successSchema: Schema.Top };
}

function enginePayloadSchema(method: string): Schema.Top {
  return engineRpc(method).payloadSchema;
}

function engineSuccessSchema(method: string): Schema.Top {
  return engineRpc(method).successSchema;
}

const undefinedBridgeParamsSchema = enginePayloadSchema("system.ping");
const engineAgentPreflightBridgeParamsSchema = enginePayloadSchema("agent.preflight");
const engineAgentRunBridgeParamsSchema = enginePayloadSchema("agent.run");
const engineAgentStatusBridgeParamsSchema = enginePayloadSchema("agent.status");
const engineAgentApplyBridgeParamsSchema = enginePayloadSchema("agent.apply");
const engineCaptureStartBridgeParamsSchema = enginePayloadSchema("capture.startCurrentWindow");
const engineCaptureStartDisplayBridgeParamsSchema = enginePayloadSchema("capture.startDisplay");
const engineCaptureStartWindowBridgeParamsSchema = enginePayloadSchema("capture.startWindow");
const engineStartRecordingBridgeParamsSchema = enginePayloadSchema("recording.start");
const engineRunExportBridgeParamsSchema = enginePayloadSchema("export.run");
const engineRunCutPlanExportBridgeParamsSchema = enginePayloadSchema("export.runCutPlan");
const engineProjectOpenBridgeParamsSchema = enginePayloadSchema("project.open");
const engineProjectSaveBridgeParamsSchema = enginePayloadSchema("project.save");
const engineProjectRecentsBridgeParamsSchema = enginePayloadSchema("project.recents");
const reviewSessionSnapshotBridgeParamsSchema = Schema.Struct({
  authToken: reviewAuthTokenSchema,
  reviewId: reviewIdSchema,
});
const reviewMutationCapabilityBridgeParamsSchema = Schema.Struct({
  authToken: reviewAuthTokenSchema,
  reviewId: reviewIdSchema,
});
const mediaSourceCapabilityBridgeParamsSchema = Schema.Struct({
  filePath: filePathSchema,
});
const capturePreviewCapabilityBridgeParamsSchema = Schema.Struct({
  captureSessionId: captureSessionIdSchema,
});
const reviewCreateCommentBridgeParamsSchema = Schema.Struct({
  authToken: reviewAuthTokenSchema,
  reviewId: reviewIdSchema,
  capabilityToken: desktopCapabilityTokenSchema,
  body: Schema.NonEmptyString,
  frameNumber: Schema.optional(nonNegativeIntSchema),
  timestampSeconds: Schema.optional(nonNegativeNumberSchema),
  parentCommentId: Schema.optional(reviewCommentIdSchema),
});
const reviewSetWorkflowStatusBridgeParamsSchema = Schema.Struct({
  authToken: reviewAuthTokenSchema,
  reviewId: reviewIdSchema,
  capabilityToken: desktopCapabilityTokenSchema,
  status: reviewWorkflowStatusSchema,
});

type ProjectPath = Schema.Schema.Type<typeof projectPathSchema>;
type OutputUrl = Schema.Schema.Type<typeof outputUrlSchema>;
type ExportPresetId = Schema.Schema.Type<typeof exportPresetIdSchema>;

function makeOptionalProjectPath(value: string | undefined): ProjectPath | undefined {
  return value === undefined ? undefined : projectPathSchema.make(value);
}

function makeOutputUrl(value: string): OutputUrl {
  return outputUrlSchema.make(value);
}

function makeExportPresetId(value: string): ExportPresetId {
  return exportPresetIdSchema.make(value);
}

type BridgeRequestDefinition<Params, Response, Args extends readonly unknown[]> = {
  toParams: (...args: Args) => Params;
  responseType: Response;
  paramsSchema?: Schema.Top;
  responseSchema?: Schema.Top;
};

type ReviewBridgeRequestWithAuth<TRequest> = TRequest & {
  authToken: string;
};

type ReviewBridgeMutationRequestWithAuth<TRequest> = ReviewBridgeRequestWithAuth<TRequest> & {
  capabilityToken: string;
};

function defineBridgeRequest<Params, Response, Args extends readonly unknown[]>(
  toParams: (...args: Args) => Params,
  options?: {
    paramsSchema?: Schema.Top;
    responseSchema?: Schema.Top;
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
  paramsSchema: Schema.Top,
  responseSchema: Schema.Top,
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
    engineSuccessSchema("system.ping"),
  ),
  ggEngineGetPermissions: defineValidatedBridgeRequest<undefined, PermissionsResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    engineSuccessSchema("permissions.get"),
  ),
  ggEngineAgentPreflight: defineValidatedBridgeRequest<
    {
      runtimeBudgetMinutes?: number;
      transcriptionProvider?: "none" | "imported_transcript";
      importedTranscriptPath?: ProjectPath;
    },
    AgentPreflightResult,
    [
      params?: {
        runtimeBudgetMinutes?: number;
        transcriptionProvider?: "none" | "imported_transcript";
        importedTranscriptPath?: string;
      },
    ]
  >(
    (params) => ({
      ...params,
      importedTranscriptPath: makeOptionalProjectPath(params?.importedTranscriptPath),
    }),
    engineAgentPreflightBridgeParamsSchema,
    engineSuccessSchema("agent.preflight"),
  ),
  ggEngineAgentRun: defineValidatedBridgeRequest<
    {
      preflightToken: string;
      runtimeBudgetMinutes?: number;
      transcriptionProvider?: "none" | "imported_transcript";
      importedTranscriptPath?: ProjectPath;
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
  >(
    (params) => ({
      ...params,
      importedTranscriptPath: makeOptionalProjectPath(params.importedTranscriptPath),
    }),
    engineAgentRunBridgeParamsSchema,
    engineSuccessSchema("agent.run"),
  ),
  ggEngineAgentStatus: defineValidatedBridgeRequest<
    { jobId: string },
    AgentStatusResult,
    [jobId: string]
  >(
    (jobId) => ({ jobId }),
    engineAgentStatusBridgeParamsSchema,
    engineSuccessSchema("agent.status"),
  ),
  ggEngineAgentApply: defineValidatedBridgeRequest<
    { jobId: string; destructiveIntent?: boolean },
    ActionResult,
    [params: { jobId: string; destructiveIntent?: boolean }]
  >((params) => params, engineAgentApplyBridgeParamsSchema, engineSuccessSchema("agent.apply")),
  ggEngineRequestScreenRecordingPermission: defineValidatedBridgeRequest<
    undefined,
    ActionResult,
    []
  >(
    () => undefined,
    undefinedBridgeParamsSchema,
    engineSuccessSchema("permissions.requestScreenRecording"),
  ),
  ggEngineRequestMicrophonePermission: defineValidatedBridgeRequest<undefined, ActionResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    engineSuccessSchema("permissions.requestMicrophone"),
  ),
  ggEngineRequestInputMonitoringPermission: defineValidatedBridgeRequest<
    undefined,
    ActionResult,
    []
  >(
    () => undefined,
    undefinedBridgeParamsSchema,
    engineSuccessSchema("permissions.requestInputMonitoring"),
  ),
  ggEngineOpenInputMonitoringSettings: defineValidatedBridgeRequest<undefined, ActionResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    engineSuccessSchema("permissions.openInputMonitoringSettings"),
  ),
  ggEngineListSources: defineValidatedBridgeRequest<undefined, SourcesResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    engineSuccessSchema("sources.list"),
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
    engineSuccessSchema("capture.startDisplay"),
  ),
  ggEngineStartCurrentWindowCapture: defineValidatedBridgeRequest<
    { enableMic: boolean; enablePreview?: boolean; captureFps: CaptureFrameRate },
    CaptureStatusResult,
    [enableMic: boolean, captureFps: CaptureFrameRate, enablePreview?: boolean]
  >(
    (enableMic, captureFps, enablePreview) => ({ enableMic, enablePreview, captureFps }),
    engineCaptureStartBridgeParamsSchema,
    engineSuccessSchema("capture.startCurrentWindow"),
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
    engineSuccessSchema("capture.startWindow"),
  ),
  ggEngineStopCapture: defineValidatedBridgeRequest<undefined, CaptureStatusResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    engineSuccessSchema("capture.stop"),
  ),
  ggEngineStartRecording: defineValidatedBridgeRequest<
    { trackInputEvents: boolean },
    CaptureStatusResult,
    [trackInputEvents: boolean]
  >(
    (trackInputEvents) => ({ trackInputEvents }),
    engineStartRecordingBridgeParamsSchema,
    engineSuccessSchema("recording.start"),
  ),
  ggEngineStopRecording: defineValidatedBridgeRequest<undefined, CaptureStatusResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    engineSuccessSchema("recording.stop"),
  ),
  ggEngineCaptureStatus: defineValidatedBridgeRequest<undefined, CaptureStatusResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    engineSuccessSchema("capture.status"),
  ),
  ggEngineCapturePreviewFrame: defineValidatedBridgeRequest<
    undefined,
    CapturePreviewFrameResult,
    []
  >(() => undefined, undefinedBridgeParamsSchema, engineSuccessSchema("capture.previewFrame")),
  ggEngineExportInfo: defineValidatedBridgeRequest<undefined, ExportInfoResult, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    engineSuccessSchema("export.info"),
  ),
  ggEngineRunExport: defineValidatedBridgeRequest<
    {
      outputURL: OutputUrl;
      presetId: ExportPresetId;
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
  >(
    (params) => ({
      ...params,
      outputURL: makeOutputUrl(params.outputURL),
      presetId: makeExportPresetId(params.presetId),
    }),
    engineRunExportBridgeParamsSchema,
    engineSuccessSchema("export.run"),
  ),
  ggEngineRunCutPlanExport: defineValidatedBridgeRequest<
    {
      outputURL: OutputUrl;
      presetId: ExportPresetId;
      jobId: string;
    },
    ExportRunCutPlanResult,
    [params: { outputURL: string; presetId: string; jobId: string }]
  >(
    (params) => ({
      ...params,
      outputURL: makeOutputUrl(params.outputURL),
      presetId: makeExportPresetId(params.presetId),
    }),
    engineRunCutPlanExportBridgeParamsSchema,
    engineSuccessSchema("export.runCutPlan"),
  ),
  ggEngineProjectCurrent: defineValidatedBridgeRequest<undefined, ProjectState, []>(
    () => undefined,
    undefinedBridgeParamsSchema,
    engineSuccessSchema("project.current"),
  ),
  ggEngineProjectOpen: defineValidatedBridgeRequest<
    { projectPath: ProjectPath },
    ProjectState,
    [projectPath: string]
  >(
    (projectPath) => ({ projectPath: projectPathSchema.make(projectPath) }),
    engineProjectOpenBridgeParamsSchema,
    engineSuccessSchema("project.open"),
  ),
  ggEngineProjectSave: defineValidatedBridgeRequest<
    { projectPath?: ProjectPath; autoZoom?: AutoZoomSettings },
    ProjectState,
    [params: { projectPath?: string; autoZoom?: AutoZoomSettings }]
  >(
    (params) => ({
      ...params,
      projectPath: makeOptionalProjectPath(params.projectPath),
    }),
    engineProjectSaveBridgeParamsSchema,
    engineSuccessSchema("project.save"),
  ),
  ggEngineProjectRecents: defineValidatedBridgeRequest<
    { limit?: number },
    ProjectRecentsResult,
    [limit?: number]
  >(
    (limit) => ({ limit }),
    engineProjectRecentsBridgeParamsSchema,
    engineSuccessSchema("project.recents"),
  ),
  ggReviewSessionSnapshot: defineValidatedBridgeRequest<
    ReviewBridgeRequestWithAuth<ReviewSessionSnapshotRequest>,
    ReviewSessionSnapshot,
    [params: ReviewBridgeRequestWithAuth<ReviewSessionSnapshotRequest>]
  >((params) => params, reviewSessionSnapshotBridgeParamsSchema, reviewSessionSnapshotSchema),
  ggGrantReviewMutationCapability: defineValidatedBridgeRequest<
    { authToken: string; reviewId: string },
    string,
    [params: { authToken: string; reviewId: string }]
  >((params) => params, reviewMutationCapabilityBridgeParamsSchema, desktopCapabilityTokenSchema),
  ggReviewCreateComment: defineValidatedBridgeRequest<
    ReviewBridgeMutationRequestWithAuth<ReviewCreateCommentRequest>,
    ReviewComment,
    [params: ReviewBridgeMutationRequestWithAuth<ReviewCreateCommentRequest>]
  >((params) => params, reviewCreateCommentBridgeParamsSchema, reviewCommentSchema),
  ggReviewSetWorkflowStatus: defineValidatedBridgeRequest<
    ReviewBridgeMutationRequestWithAuth<ReviewSetWorkflowStatusRequest>,
    ReviewSetWorkflowStatusResponse,
    [params: ReviewBridgeMutationRequestWithAuth<ReviewSetWorkflowStatusRequest>]
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
  ggGrantMediaSourceCapability: defineValidatedBridgeRequest<
    { filePath: string },
    string,
    [filePath: string]
  >(
    (filePath) => ({ filePath }),
    mediaSourceCapabilityBridgeParamsSchema,
    desktopCapabilityTokenSchema,
  ),
  ggResolveMediaSourceURL: defineValidatedBridgeRequest<
    { filePath: string; capabilityToken: string },
    string,
    [filePath: string, capabilityToken: string]
  >(
    (filePath, capabilityToken) => ({
      filePath,
      capabilityToken,
    }),
    resolveMediaSourceURLRequestSchema,
    resolveMediaSourceURLResponseSchema,
  ),
  ggGrantCapturePreviewCapability: defineValidatedBridgeRequest<
    { captureSessionId: string },
    string,
    [captureSessionId: string]
  >(
    (captureSessionId) => ({ captureSessionId }),
    capturePreviewCapabilityBridgeParamsSchema,
    desktopCapabilityTokenSchema,
  ),
  ggResolveCapturePreviewURL: defineValidatedBridgeRequest<
    { captureSessionId: string; capabilityToken: string },
    string,
    [captureSessionId: string, capabilityToken: string]
  >(
    (captureSessionId, capabilityToken) => ({ captureSessionId, capabilityToken }),
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
      desktopRuntimeFlags: DesktopRuntimeFlags;
    };
  }>;
};
