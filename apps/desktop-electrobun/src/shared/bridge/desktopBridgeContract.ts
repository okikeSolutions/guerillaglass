import {
  agentPreflightResultSchema,
  agentRunResultSchema,
  agentStatusResultSchema,
  type AgentPreflightResult,
  type AgentRunResult,
  type AgentStatusResult,
} from "@guerillaglass/engine-contract/domains/agent";
import {
  capturePreviewFrameResultSchema,
  captureStatusResultSchema,
  type CapturePreviewFrameResult,
  type CaptureStatusResult,
} from "@guerillaglass/engine-contract/domains/capture";
import {
  exportInfoResultSchema,
  exportRunCutPlanResultSchema,
  exportRunResultSchema,
  type ExportInfoResult,
  type ExportRunCutPlanResult,
  type ExportRunResult,
} from "@guerillaglass/engine-contract/domains/export";
import {
  actionResultSchema,
  permissionsResultSchema,
  type ActionResult,
  type PermissionsResult,
} from "@guerillaglass/engine-contract/domains/permissions";
import {
  projectRecentsResultSchema,
  projectStateSchema,
  type ProjectRecentsResult,
  type ProjectState,
} from "@guerillaglass/engine-contract/domains/project";
import {
  sourcesResultSchema,
  type CaptureFrameRate,
  type SourcesResult,
} from "@guerillaglass/engine-contract/domains/sources";
import { pingResultSchema, type PingResult } from "@guerillaglass/engine-contract/domains/system";
import type {
  AutoZoomSettings,
  TimelineDocument,
} from "@guerillaglass/engine-contract/shared/valueObjects";
import {
  reviewBridgeEventSchema,
  reviewCommentSchema,
  reviewSessionSnapshotSchema,
  reviewSetWorkflowStatusResponseSchema,
  reviewWorkflowStatusSchema,
  type ReviewBridgeEvent,
  type ReviewComment,
  type ReviewCommentId,
  type ReviewCreateCommentRequest,
  type ReviewId,
  type ReviewSessionSnapshot,
  type ReviewSessionSnapshotRequest,
  type ReviewSetWorkflowStatusRequest,
  type ReviewSetWorkflowStatusResponse,
} from "@guerillaglass/review-protocol";
import {
  agentJobIdSchema,
  agentPreflightTokenSchema,
  displayIdSchema,
  exportPresetIdSchema,
  filePathSchema,
  isoDateTimeSchema,
  outputUrlSchema,
  projectPathSchema,
  reviewAuthTokenSchema,
  reviewCommentIdSchema,
  captureSessionIdSchema,
  reviewIdSchema,
  windowIdSchema,
} from "@guerillaglass/engine-contract/schema-primitives";
import { Schema } from "effect";
import {
  agentPreflightPayloadSchema,
  agentRunPayloadSchema,
  captureStartCurrentWindowPayloadSchema,
  captureStartDisplayPayloadSchema,
  captureStartWindowPayloadSchema,
  exportRunCutPlanPayloadSchema,
  exportRunPayloadSchema,
  projectOpenPayloadSchema,
  projectSavePayloadSchema,
  recordingStartPayloadSchema,
} from "@guerillaglass/engine-contract/httpApi";
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
export const desktopCapabilityTokenSchema = Schema.NonEmptyString.check(
  Schema.isMaxLength(512),
).pipe(Schema.brand("DesktopCapabilityToken"));

/** Nominal token authorizing one desktop capability operation. */
export type DesktopCapabilityToken = typeof desktopCapabilityTokenSchema.Type;
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
const undefinedBridgeParamsSchema = Schema.Void;
const engineAgentPreflightBridgeParamsSchema = agentPreflightPayloadSchema;
const engineAgentRunBridgeParamsSchema = agentRunPayloadSchema;
const engineAgentStatusBridgeParamsSchema = Schema.Struct({ jobId: agentJobIdSchema });
const engineAgentApplyBridgeParamsSchema = Schema.Struct({
  jobId: agentJobIdSchema,
  destructiveIntent: Schema.optionalKey(Schema.Boolean),
});
const engineCaptureStartBridgeParamsSchema = captureStartCurrentWindowPayloadSchema;
const engineCaptureStartDisplayBridgeParamsSchema = captureStartDisplayPayloadSchema;
const engineCaptureStartWindowBridgeParamsSchema = captureStartWindowPayloadSchema;
const engineStartRecordingBridgeParamsSchema = recordingStartPayloadSchema;
const engineRunExportBridgeParamsSchema = exportRunPayloadSchema;
const engineRunCutPlanExportBridgeParamsSchema = exportRunCutPlanPayloadSchema;
const engineProjectOpenBridgeParamsSchema = projectOpenPayloadSchema;
const engineProjectSaveBridgeParamsSchema = projectSavePayloadSchema;
const engineProjectRecentsBridgeParamsSchema = Schema.Struct({
  limit: Schema.optionalKey(nonNegativeIntSchema),
});
const engineSuccessSchemas = {
  "system.ping": pingResultSchema,
  "permissions.get": permissionsResultSchema,
  "agent.preflight": agentPreflightResultSchema,
  "agent.run": agentRunResultSchema,
  "agent.status": agentStatusResultSchema,
  "agent.apply": actionResultSchema,
  "permissions.requestScreenRecording": actionResultSchema,
  "permissions.requestMicrophone": actionResultSchema,
  "permissions.requestInputMonitoring": actionResultSchema,
  "permissions.openInputMonitoringSettings": actionResultSchema,
  "sources.list": sourcesResultSchema,
  "capture.startDisplay": captureStatusResultSchema,
  "capture.startCurrentWindow": captureStatusResultSchema,
  "capture.startWindow": captureStatusResultSchema,
  "capture.stop": captureStatusResultSchema,
  "recording.start": captureStatusResultSchema,
  "recording.stop": captureStatusResultSchema,
  "capture.status": captureStatusResultSchema,
  "capture.previewFrame": capturePreviewFrameResultSchema,
  "export.info": exportInfoResultSchema,
  "export.run": exportRunResultSchema,
  "export.runCutPlan": exportRunCutPlanResultSchema,
  "project.current": projectStateSchema,
  "project.open": projectStateSchema,
  "project.save": projectStateSchema,
  "project.recents": projectRecentsResultSchema,
} as const satisfies Record<string, Schema.Top>;

function engineSuccessSchema(method: keyof typeof engineSuccessSchemas): Schema.Top {
  return engineSuccessSchemas[method];
}
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

type CaptureSessionId = typeof captureSessionIdSchema.Type;
type FilePath = typeof filePathSchema.Type;
type ReviewAuthToken = typeof reviewAuthTokenSchema.Type;
type AgentJobId = typeof agentJobIdSchema.Type;
type AgentPreflightToken = typeof agentPreflightTokenSchema.Type;
type DisplayId = typeof displayIdSchema.Type;
type ProjectPath = typeof projectPathSchema.Type;
type OutputUrl = typeof outputUrlSchema.Type;
type ExportPresetId = typeof exportPresetIdSchema.Type;
type WindowId = typeof windowIdSchema.Type;

function makeCaptureSessionId(value: string): CaptureSessionId {
  return captureSessionIdSchema.make(value);
}

function makeDesktopCapabilityToken(value: string): DesktopCapabilityToken {
  return desktopCapabilityTokenSchema.make(value);
}

function makeFilePath(value: string): FilePath {
  return filePathSchema.make(value);
}

function makeReviewAuthToken(value: string): ReviewAuthToken {
  return reviewAuthTokenSchema.make(value);
}

function makeReviewCommentId(value: string): ReviewCommentId {
  return reviewCommentIdSchema.make(value);
}

function makeOptionalReviewCommentId(value: string | undefined): ReviewCommentId | undefined {
  return value === undefined ? undefined : makeReviewCommentId(value);
}

function makeReviewId(value: string): ReviewId {
  return reviewIdSchema.make(value);
}

function makeAgentJobId(value: string): AgentJobId {
  return agentJobIdSchema.make(value);
}

function makeAgentPreflightToken(value: string): AgentPreflightToken {
  return agentPreflightTokenSchema.make(value);
}

function makeOptionalDisplayId(value: number | undefined): DisplayId | undefined {
  return value === undefined ? undefined : displayIdSchema.make(value);
}

function makeOptionalProjectPath(value: string | undefined): ProjectPath | undefined {
  return value === undefined ? undefined : projectPathSchema.make(value);
}

function makeOutputUrl(value: string): OutputUrl {
  return outputUrlSchema.make(value);
}

function makeExportPresetId(value: string): ExportPresetId {
  return exportPresetIdSchema.make(value);
}

function makeWindowId(value: number): WindowId {
  return windowIdSchema.make(value);
}

type BridgeRequestDefinition<Params, Response, Args extends readonly unknown[]> = {
  toParams: (...args: Args) => Params;
  responseType: Response;
  paramsSchema?: Schema.Top;
  responseSchema?: Schema.Top;
};

type ReviewBridgeRequestWithAuth<TRequest> = TRequest & {
  authToken: ReviewAuthToken;
};

type ReviewBridgeMutationRequestWithAuth<TRequest> = ReviewBridgeRequestWithAuth<TRequest> & {
  capabilityToken: DesktopCapabilityToken;
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
      preflightToken: AgentPreflightToken;
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
      preflightToken: makeAgentPreflightToken(params.preflightToken),
      importedTranscriptPath: makeOptionalProjectPath(params.importedTranscriptPath),
    }),
    engineAgentRunBridgeParamsSchema,
    engineSuccessSchema("agent.run"),
  ),
  ggEngineAgentStatus: defineValidatedBridgeRequest<
    { jobId: AgentJobId },
    AgentStatusResult,
    [jobId: string]
  >(
    (jobId) => ({ jobId: makeAgentJobId(jobId) }),
    engineAgentStatusBridgeParamsSchema,
    engineSuccessSchema("agent.status"),
  ),
  ggEngineAgentApply: defineValidatedBridgeRequest<
    { jobId: AgentJobId; destructiveIntent?: boolean },
    ActionResult,
    [params: { jobId: string; destructiveIntent?: boolean }]
  >(
    (params) => ({ ...params, jobId: makeAgentJobId(params.jobId) }),
    engineAgentApplyBridgeParamsSchema,
    engineSuccessSchema("agent.apply"),
  ),
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
      displayId?: DisplayId;
      enableMic: boolean;
      enablePreview?: boolean;
      captureFps: CaptureFrameRate;
    },
    CaptureStatusResult,
    [enableMic: boolean, captureFps: CaptureFrameRate, displayId?: number, enablePreview?: boolean]
  >(
    (enableMic, captureFps, displayId, enablePreview) => ({
      displayId: makeOptionalDisplayId(displayId),
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
    {
      windowId: WindowId;
      enableMic: boolean;
      enablePreview?: boolean;
      captureFps: CaptureFrameRate;
    },
    CaptureStatusResult,
    [windowId: number, enableMic: boolean, captureFps: CaptureFrameRate, enablePreview?: boolean]
  >(
    (windowId, enableMic, captureFps, enablePreview) => ({
      windowId: makeWindowId(windowId),
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
      timeline?: TimelineDocument;
    },
    ExportRunResult,
    [
      params: {
        outputURL: string;
        presetId: string;
        trimStartSeconds?: number;
        trimEndSeconds?: number;
        timeline?: TimelineDocument;
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
      jobId: AgentJobId;
    },
    ExportRunCutPlanResult,
    [params: { outputURL: string; presetId: string; jobId: string }]
  >(
    (params) => ({
      ...params,
      outputURL: makeOutputUrl(params.outputURL),
      presetId: makeExportPresetId(params.presetId),
      jobId: makeAgentJobId(params.jobId),
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
    { projectPath?: ProjectPath; autoZoom?: AutoZoomSettings; timeline?: TimelineDocument },
    ProjectState,
    [params: { projectPath?: string; autoZoom?: AutoZoomSettings; timeline?: TimelineDocument }]
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
    [params: { authToken: string; reviewId: string }]
  >(
    (params) => ({
      authToken: makeReviewAuthToken(params.authToken),
      reviewId: makeReviewId(params.reviewId),
    }),
    reviewSessionSnapshotBridgeParamsSchema,
    reviewSessionSnapshotSchema,
  ),
  ggGrantReviewMutationCapability: defineValidatedBridgeRequest<
    { authToken: ReviewAuthToken; reviewId: ReviewId },
    DesktopCapabilityToken,
    [params: { authToken: string; reviewId: string }]
  >(
    (params) => ({
      authToken: makeReviewAuthToken(params.authToken),
      reviewId: makeReviewId(params.reviewId),
    }),
    reviewMutationCapabilityBridgeParamsSchema,
    desktopCapabilityTokenSchema,
  ),
  ggReviewCreateComment: defineValidatedBridgeRequest<
    ReviewBridgeMutationRequestWithAuth<ReviewCreateCommentRequest>,
    ReviewComment,
    [
      params: {
        authToken: string;
        reviewId: string;
        capabilityToken: string;
        body: string;
        frameNumber?: number;
        timestampSeconds?: number;
        parentCommentId?: string;
      },
    ]
  >(
    (params) => ({
      ...params,
      authToken: makeReviewAuthToken(params.authToken),
      reviewId: makeReviewId(params.reviewId),
      capabilityToken: makeDesktopCapabilityToken(params.capabilityToken),
      parentCommentId: makeOptionalReviewCommentId(params.parentCommentId),
    }),
    reviewCreateCommentBridgeParamsSchema,
    reviewCommentSchema,
  ),
  ggReviewSetWorkflowStatus: defineValidatedBridgeRequest<
    ReviewBridgeMutationRequestWithAuth<ReviewSetWorkflowStatusRequest>,
    ReviewSetWorkflowStatusResponse,
    [
      params: {
        authToken: string;
        reviewId: string;
        capabilityToken: string;
        status: ReviewSetWorkflowStatusRequest["status"];
      },
    ]
  >(
    (params) => ({
      ...params,
      authToken: makeReviewAuthToken(params.authToken),
      reviewId: makeReviewId(params.reviewId),
      capabilityToken: makeDesktopCapabilityToken(params.capabilityToken),
    }),
    reviewSetWorkflowStatusBridgeParamsSchema,
    reviewSetWorkflowStatusResponseSchema,
  ),
  ggPickPath: defineValidatedBridgeRequest<
    { mode: HostPathPickerMode; startingFolder?: string },
    string | null,
    [params: { mode: HostPathPickerMode; startingFolder?: string }]
  >((params) => params, pickPathRequestSchema, pickPathResponseSchema),
  ggReadTextFile: defineValidatedBridgeRequest<{ filePath: FilePath }, string, [filePath: string]>(
    (filePath) => ({
      filePath: makeFilePath(filePath),
    }),
    readTextFileRequestSchema,
    readTextFileResponseSchema,
  ),
  ggGrantMediaSourceCapability: defineValidatedBridgeRequest<
    { filePath: FilePath },
    DesktopCapabilityToken,
    [filePath: string]
  >(
    (filePath) => ({ filePath: makeFilePath(filePath) }),
    mediaSourceCapabilityBridgeParamsSchema,
    desktopCapabilityTokenSchema,
  ),
  ggResolveMediaSourceURL: defineValidatedBridgeRequest<
    { filePath: FilePath; capabilityToken: DesktopCapabilityToken },
    OutputUrl,
    [filePath: string, capabilityToken: string]
  >(
    (filePath, capabilityToken) => ({
      filePath: makeFilePath(filePath),
      capabilityToken: makeDesktopCapabilityToken(capabilityToken),
    }),
    resolveMediaSourceURLRequestSchema,
    resolveMediaSourceURLResponseSchema,
  ),
  ggGrantCapturePreviewCapability: defineValidatedBridgeRequest<
    { captureSessionId: CaptureSessionId },
    DesktopCapabilityToken,
    [captureSessionId: string]
  >(
    (captureSessionId) => ({ captureSessionId: makeCaptureSessionId(captureSessionId) }),
    capturePreviewCapabilityBridgeParamsSchema,
    desktopCapabilityTokenSchema,
  ),
  ggResolveCapturePreviewURL: defineValidatedBridgeRequest<
    { captureSessionId: CaptureSessionId; capabilityToken: DesktopCapabilityToken },
    OutputUrl,
    [captureSessionId: string, capabilityToken: string]
  >(
    (captureSessionId, capabilityToken) => ({
      captureSessionId: makeCaptureSessionId(captureSessionId),
      capabilityToken: makeDesktopCapabilityToken(capabilityToken),
    }),
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
