/**
 * Stable JSON-RPC contract between the desktop shell and native Guerillaglass engines.
 *
 * The file is organized in the order most consumers traverse the protocol:
 * shared value objects first, then capture/export payloads, Agent Mode payloads,
 * project persistence models, request envelopes, and finally response helpers.
 */
import { Schema, type Types } from "effect";
import { isoDateTimeSchema } from "@guerillaglass/schema-primitives";
import { engineMethods } from "./methods.js";

const NonEmptyString = Schema.NonEmptyString;
const IsoDateTime = isoDateTimeSchema;
const NonNegativeInt = Schema.Int.pipe(Schema.greaterThanOrEqualTo(0));
const PositiveInt = Schema.Int.pipe(Schema.greaterThanOrEqualTo(1));
const NonNegativeNumber = Schema.Number.pipe(Schema.greaterThanOrEqualTo(0));
const PositiveNumber = Schema.Number.pipe(Schema.greaterThan(0));
const RuntimeBudgetMinutesSchema = PositiveInt.pipe(Schema.lessThanOrEqualTo(60));
const ProjectRecentsLimitSchema = PositiveInt.pipe(Schema.lessThanOrEqualTo(100));
const decodeAllIssuesOptions = {
  errors: "all",
} as const;

type MutableSchemaType<S extends Schema.Schema.Any> = Types.DeepMutable<
  Schema.Schema.Type<Schema.mutable<S>>
>;
type MutableEncodedSchemaType<S extends Schema.Schema.Any> = Types.DeepMutable<
  Schema.Schema.Encoded<Schema.mutable<S>>
>;

function decodeSchemaSync<S extends Schema.Schema.AnyNoContext>(
  schema: S,
  raw: unknown,
): MutableSchemaType<S> {
  return Schema.decodeUnknownSync(schema, decodeAllIssuesOptions)(raw) as MutableSchemaType<S>;
}

/** Shared value objects reused across capture, project, and permission payloads. */
/** Input Monitoring permission states returned by the native engine. */
export const inputMonitoringStatusSchema = Schema.Literal("notDetermined", "denied", "authorized");

/** Auto-zoom project settings shared between renderer and native engine. */
export const autoZoomSettingsSchema = Schema.Struct({
  isEnabled: Schema.Boolean,
  intensity: Schema.Number.pipe(Schema.between(0, 1)),
  minimumKeyframeInterval: PositiveNumber,
});

const captureWindowSchema = Schema.Struct({
  id: NonNegativeInt,
  title: Schema.String,
  appName: Schema.String,
});

const captureContentRectSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: PositiveNumber,
  height: PositiveNumber,
});

/** Optional capture metadata embedded in capture status and project state. */
export const captureMetadataSchema = Schema.NullOr(
  Schema.Struct({
    window: Schema.optionalWith(Schema.NullOr(captureWindowSchema), { default: () => null }),
    source: Schema.Literal("display", "window"),
    contentRect: captureContentRectSchema,
    pixelScale: PositiveNumber,
    fps: Schema.optional(Schema.NullOr(PositiveNumber)),
  }),
);

/** Input event payload captured during recording. */
export const inputEventSchema = Schema.Struct({
  type: Schema.Literal("cursorMoved", "mouseDown", "mouseUp"),
  timestamp: NonNegativeNumber,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
  }),
  button: Schema.optional(Schema.Literal("left", "right", "other")),
});

/** Input event log written by engines that support input tracking. */
export const inputEventLogSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  events: Schema.Array(inputEventSchema),
});

/** Linked A/V segment persisted in project timeline state. */
export const timelineSegmentSchema = Schema.Struct({
  id: NonEmptyString,
  sourceAssetId: Schema.Literal("recording"),
  sourceStartSeconds: NonNegativeNumber,
  sourceEndSeconds: NonNegativeNumber,
});

/** Project timeline document persisted by the editor and engine. */
export const timelineDocumentSchema = Schema.Struct({
  version: Schema.Literal(1),
  segments: Schema.Array(timelineSegmentSchema),
});

/** Result payload for `system.ping`. */
export const pingResultSchema = Schema.Struct({
  app: NonEmptyString,
  engineVersion: NonEmptyString,
  protocolVersion: NonEmptyString,
  platform: NonEmptyString,
});

const capabilitiesAgentSchema = Schema.Struct({
  preflight: Schema.Boolean,
  run: Schema.Boolean,
  status: Schema.Boolean,
  apply: Schema.Boolean,
  localOnly: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  runtimeBudgetMinutes: Schema.optionalWith(PositiveInt, { default: () => 10 }),
});

/** Result payload for `engine.capabilities`. */
export const capabilitiesResultSchema = Schema.Struct({
  protocolVersion: NonEmptyString,
  platform: NonEmptyString,
  phase: Schema.Literal("stub", "foundation", "native"),
  capture: Schema.Struct({
    display: Schema.Boolean,
    window: Schema.Boolean,
    systemAudio: Schema.Boolean,
    microphone: Schema.Boolean,
  }),
  recording: Schema.Struct({
    inputTracking: Schema.Boolean,
  }),
  export: Schema.Struct({
    presets: Schema.Boolean,
    cutPlan: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  }),
  project: Schema.Struct({
    openSave: Schema.Boolean,
  }),
  agent: Schema.optionalWith(capabilitiesAgentSchema, {
    default: () => ({
      preflight: false,
      run: false,
      status: false,
      apply: false,
      localOnly: true,
      runtimeBudgetMinutes: 10,
    }),
  }),
});

/** Result payload for `permissions.get`. */
export const permissionsResultSchema = Schema.Struct({
  screenRecordingGranted: Schema.Boolean,
  microphoneGranted: Schema.Boolean,
  inputMonitoring: inputMonitoringStatusSchema,
});

/** Generic success/failure payload for permission action requests. */
export const actionResultSchema = Schema.Struct({
  success: Schema.Boolean,
  message: Schema.optional(Schema.String),
});

/** Supported capture frame rates for all engines. */
export const captureFrameRates = [24, 30, 60, 120] as const;
/** Default capture frame rate used when request params omit `captureFps`. */
export const defaultCaptureFrameRate: (typeof captureFrameRates)[number] = 30;
/** Effect schema for engine-supported capture FPS values. */
export const captureFrameRateSchema = Schema.Literal(...captureFrameRates);

/** Display capture source descriptor. */
export const displaySourceSchema = Schema.Struct({
  id: NonNegativeInt,
  displayName: NonEmptyString,
  isPrimary: Schema.Boolean,
  width: PositiveInt,
  height: PositiveInt,
  pixelScale: Schema.optional(PositiveNumber),
  refreshHz: Schema.NullOr(PositiveNumber),
  supportedCaptureFrameRates: Schema.Array(captureFrameRateSchema),
});

/** Window capture source descriptor. */
export const windowSourceSchema = Schema.Struct({
  id: NonNegativeInt,
  title: Schema.String,
  appName: Schema.String,
  width: PositiveNumber,
  height: PositiveNumber,
  isOnScreen: Schema.Boolean,
  pixelScale: Schema.optional(PositiveNumber),
  refreshHz: Schema.NullOr(PositiveNumber),
  supportedCaptureFrameRates: Schema.Array(captureFrameRateSchema),
});

/** Result payload for `sources.list`. */
export const sourcesResultSchema = Schema.Struct({
  displays: Schema.Array(displaySourceSchema),
  windows: Schema.Array(windowSourceSchema),
});

const createDefaultCaptureTelemetry = () => ({
  sourceDroppedFrames: 0,
  writerDroppedFrames: 0,
  writerBackpressureDrops: 0,
  achievedFps: 0,
  cpuPercent: null,
  memoryBytes: null,
  recordingBitrateMbps: null,
  captureCallbackMs: 0,
  recordQueueLagMs: 0,
  writerAppendMs: 0,
  previewEncodeMs: 0,
});

/** Capture and export lifecycle payloads returned directly from the engine. */
/** Capture telemetry payload returned by `capture.status`. */
export const captureTelemetrySchema = Schema.Struct({
  sourceDroppedFrames: Schema.optionalWith(NonNegativeInt, { default: () => 0 }),
  writerDroppedFrames: Schema.optionalWith(NonNegativeInt, { default: () => 0 }),
  writerBackpressureDrops: Schema.optionalWith(NonNegativeInt, { default: () => 0 }),
  achievedFps: Schema.optionalWith(NonNegativeNumber, { default: () => 0 }),
  cpuPercent: Schema.optionalWith(Schema.NullOr(NonNegativeNumber), { default: () => null }),
  memoryBytes: Schema.optionalWith(Schema.NullOr(NonNegativeNumber), { default: () => null }),
  recordingBitrateMbps: Schema.optionalWith(Schema.NullOr(NonNegativeNumber), {
    default: () => null,
  }),
  captureCallbackMs: Schema.optionalWith(NonNegativeNumber, { default: () => 0 }),
  recordQueueLagMs: Schema.optionalWith(NonNegativeNumber, { default: () => 0 }),
  writerAppendMs: Schema.optionalWith(NonNegativeNumber, { default: () => 0 }),
  previewEncodeMs: Schema.optional(NonNegativeNumber),
});

/** Lightweight shell preview frame payload returned by `capture.previewFrame`. */
export const capturePreviewFrameSchema = Schema.Struct({
  frameId: NonNegativeInt,
  bytesBase64: NonEmptyString,
});

/** Result payload for capture and recording lifecycle methods. */
export const captureStatusResultSchema = Schema.Struct({
  isRunning: Schema.Boolean,
  isRecording: Schema.Boolean,
  captureSessionId: Schema.optionalWith(Schema.NullOr(NonEmptyString), { default: () => null }),
  recordingDurationSeconds: NonNegativeNumber,
  recordingURL: Schema.NullOr(Schema.String),
  captureMetadata: Schema.optionalWith(captureMetadataSchema, { default: () => null }),
  lastError: Schema.NullOr(Schema.String),
  eventsURL: Schema.NullOr(Schema.String),
  lastRecordingTelemetry: Schema.optionalWith(Schema.NullOr(captureTelemetrySchema), {
    default: () => null,
  }),
  telemetry: Schema.optionalWith(captureTelemetrySchema, {
    default: createDefaultCaptureTelemetry,
  }),
});

/** Result payload for the latest cached live preview frame. */
export const capturePreviewFrameResultSchema = Schema.NullOr(capturePreviewFrameSchema);

/** Export preset descriptor returned by `export.info`. */
export const exportPresetSchema = Schema.Struct({
  id: NonEmptyString,
  name: NonEmptyString,
  width: PositiveInt,
  height: PositiveInt,
  fps: PositiveInt,
  fileType: Schema.Literal("mp4", "mov"),
});

/** Result payload for `export.info`. */
export const exportInfoResultSchema = Schema.Struct({
  presets: Schema.Array(exportPresetSchema),
});

/** Result payload for `export.run`. */
export const exportRunResultSchema = Schema.Struct({
  outputURL: NonEmptyString,
});

/** Agent Mode payloads covering preflight, execution, and persisted artifacts. */
/** Agent job lifecycle statuses. */
export const agentJobStatusSchema = Schema.Literal(
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "blocked",
);

/** Artifact kinds emitted by `agent.run`. */
export const agentArtifactKindSchema = Schema.Literal(
  "transcript.full.v1",
  "transcript.words.v1",
  "beat-map.v1",
  "qa-report.v1",
  "cut-plan.v1",
  "run-summary.v1",
);

/** Single persisted agent artifact descriptor. */
export const agentArtifactSchema = Schema.Struct({
  kind: agentArtifactKindSchema,
  path: NonEmptyString,
});

/** Supported transcription providers for Agent Mode v1. */
export const transcriptionProviderSchema = Schema.Literal("none", "imported_transcript");

/** Single imported transcript segment entry with absolute timing in seconds. */
export const importedTranscriptSegmentSchema = Schema.Struct({
  text: NonEmptyString,
  startSeconds: NonNegativeNumber,
  endSeconds: NonNegativeNumber,
}).pipe(
  Schema.filter((segment) => segment.endSeconds > segment.startSeconds, {
    message: () => "Imported transcript segment endSeconds must be greater than startSeconds.",
  }),
);

/** Single imported transcript word entry with absolute timing in seconds. */
export const importedTranscriptWordSchema = Schema.Struct({
  word: NonEmptyString,
  startSeconds: NonNegativeNumber,
  endSeconds: NonNegativeNumber,
}).pipe(
  Schema.filter((word) => word.endSeconds > word.startSeconds, {
    message: () => "Imported transcript word endSeconds must be greater than startSeconds.",
  }),
);

/** Canonical imported transcript payload accepted by Agent Mode v1. */
export const importedTranscriptSchema = Schema.Struct({
  segments: Schema.optionalWith(Schema.Array(importedTranscriptSegmentSchema), {
    default: () => [],
  }),
  words: Schema.optionalWith(Schema.Array(importedTranscriptWordSchema), {
    default: () => [],
  }),
}).pipe(
  Schema.filter((transcript) => transcript.segments.length > 0 || transcript.words.length > 0, {
    message: () => "Imported transcript must contain at least one segment or one word entry.",
  }),
);

/** Machine-readable reasons emitted by Agent Mode preflight. */
export const agentPreflightBlockingReasonSchema = Schema.Literal(
  "missing_project",
  "missing_recording",
  "invalid_runtime_budget",
  "source_too_long",
  "source_duration_invalid",
  "missing_local_model",
  "missing_imported_transcript",
  "invalid_imported_transcript",
  "no_audio_track",
  "silent_audio",
);

/** Machine-readable reasons emitted by Agent Mode run/status payloads. */
export const agentRunBlockingReasonSchema = Schema.Literal(
  "missing_project",
  "missing_recording",
  "invalid_runtime_budget",
  "source_too_long",
  "source_duration_invalid",
  "missing_local_model",
  "missing_imported_transcript",
  "invalid_imported_transcript",
  "no_audio_track",
  "silent_audio",
  "empty_transcript",
  "weak_narrative_structure",
);

const agentBeatSchema = Schema.Literal("hook", "action", "payoff", "takeaway");

/** Narrative QA gate report produced by `agent.run`. */
export const agentQAReportSchema = Schema.Struct({
  passed: Schema.Boolean,
  score: Schema.Number.pipe(Schema.between(0, 1)),
  coverage: Schema.Struct({
    hook: Schema.Boolean,
    action: Schema.Boolean,
    payoff: Schema.Boolean,
    takeaway: Schema.Boolean,
  }),
  missingBeats: Schema.optionalWith(Schema.Array(agentBeatSchema), { default: () => [] }),
});

/** Summary payload for agent pipeline execution. */
export const agentRunSummarySchema = Schema.Struct({
  jobId: NonEmptyString,
  status: agentJobStatusSchema,
  runtimeBudgetMinutes: PositiveInt,
  qaReport: Schema.NullOr(agentQAReportSchema),
  blockingReason: Schema.NullOr(agentRunBlockingReasonSchema),
  updatedAt: IsoDateTime,
});

/** Result payload for `agent.preflight`. */
export const agentPreflightResultSchema = Schema.Struct({
  ready: Schema.Boolean,
  blockingReasons: Schema.Array(agentPreflightBlockingReasonSchema),
  canApplyDestructive: Schema.Boolean,
  transcriptionProvider: transcriptionProviderSchema,
  preflightToken: Schema.NullOr(NonEmptyString),
});

/** Result payload for `agent.run`. */
export const agentRunResultSchema = Schema.Struct({
  jobId: NonEmptyString,
  status: agentJobStatusSchema,
});

/** Result payload for `agent.status`. */
export const agentStatusResultSchema = agentRunSummarySchema;

/** Result payload for `export.runCutPlan`. */
export const exportRunCutPlanResultSchema = Schema.Struct({
  outputURL: NonEmptyString,
  appliedSegments: NonNegativeInt,
});

/** Project-level summary for the latest agent run metadata. */
export const projectAgentAnalysisSummarySchema = Schema.Struct({
  latestJobId: Schema.NullOr(Schema.String),
  latestStatus: Schema.NullOr(agentJobStatusSchema),
  qaPassed: Schema.NullOr(Schema.Boolean),
  updatedAt: Schema.NullOr(IsoDateTime),
});

/** Engine protocol schema for projectStateSchema. */
export const projectStateSchema = Schema.Struct({
  projectPath: Schema.NullOr(Schema.String),
  recordingURL: Schema.NullOr(Schema.String),
  eventsURL: Schema.NullOr(Schema.String),
  lastRecordingTelemetry: Schema.optionalWith(Schema.NullOr(captureTelemetrySchema), {
    default: () => null,
  }),
  autoZoom: autoZoomSettingsSchema,
  timeline: Schema.optionalWith(timelineDocumentSchema, {
    default: () => ({
      version: 1 as const,
      segments: [],
    }),
  }),
  captureMetadata: captureMetadataSchema,
  agentAnalysis: Schema.optionalWith(projectAgentAnalysisSummarySchema, {
    default: () => ({
      latestJobId: null,
      latestStatus: null,
      qaPassed: null,
      updatedAt: null,
    }),
  }),
});

/** Engine protocol schema for projectRecentItemSchema. */
export const projectRecentItemSchema = Schema.Struct({
  projectPath: NonEmptyString,
  displayName: NonEmptyString,
  lastOpenedAt: IsoDateTime,
});

/** Engine protocol schema for projectRecentsResultSchema. */
export const projectRecentsResultSchema = Schema.Struct({
  items: Schema.Array(projectRecentItemSchema),
});

/** Base request envelope fragments reused by all engine JSON-RPC methods. */
const requestBaseFields = {
  id: NonEmptyString,
} as const;

const emptyParamsSchema = Schema.Struct({});
const emptyParamsProperty = Schema.optionalWith(emptyParamsSchema, { default: () => ({}) });
const runtimeBudgetMinutesProperty = Schema.optionalWith(RuntimeBudgetMinutesSchema, {
  default: () => 10,
});
const transcriptionProviderProperty = Schema.optionalWith(transcriptionProviderSchema, {
  default: () => "none" as const,
});
const destructiveIntentProperty = Schema.optionalWith(Schema.Boolean, { default: () => false });
const enableMicProperty = Schema.optionalWith(Schema.Boolean, { default: () => false });
const enablePreviewProperty = Schema.optionalWith(Schema.Boolean, { default: () => true });
const captureFrameRateProperty = Schema.optionalWith(captureFrameRateSchema, {
  default: () => defaultCaptureFrameRate,
});
const trackInputEventsProperty = Schema.optionalWith(Schema.Boolean, { default: () => false });

/** Request envelopes ordered by the shell lifecycle they participate in. */
/** Engine protocol schema for systemPingRequestSchema. */
export const systemPingRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.SystemPing),
  params: emptyParamsProperty,
});

/** Engine protocol schema for engineCapabilitiesRequestSchema. */
export const engineCapabilitiesRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.EngineCapabilities),
  params: emptyParamsProperty,
});

/** Engine protocol schema for agentPreflightRequestSchema. */
export const agentPreflightRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.AgentPreflight),
  params: Schema.Struct({
    runtimeBudgetMinutes: runtimeBudgetMinutesProperty,
    transcriptionProvider: transcriptionProviderProperty,
    importedTranscriptPath: Schema.optional(NonEmptyString),
  }),
});

/** Engine protocol schema for agentRunRequestSchema. */
export const agentRunRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.AgentRun),
  params: Schema.Struct({
    preflightToken: NonEmptyString,
    runtimeBudgetMinutes: runtimeBudgetMinutesProperty,
    transcriptionProvider: transcriptionProviderProperty,
    importedTranscriptPath: Schema.optional(NonEmptyString),
    force: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  }),
});

/** Engine protocol schema for agentStatusRequestSchema. */
export const agentStatusRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.AgentStatus),
  params: Schema.Struct({
    jobId: NonEmptyString,
  }),
});

/** Engine protocol schema for agentApplyRequestSchema. */
export const agentApplyRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.AgentApply),
  params: Schema.Struct({
    jobId: NonEmptyString,
    destructiveIntent: destructiveIntentProperty,
  }),
});

/** Engine protocol schema for permissionsGetRequestSchema. */
export const permissionsGetRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.PermissionsGet),
  params: emptyParamsProperty,
});

/** Engine protocol schema for permissionsRequestScreenRequestSchema. */
export const permissionsRequestScreenRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.PermissionsRequestScreenRecording),
  params: emptyParamsProperty,
});

/** Engine protocol schema for permissionsRequestMicrophoneRequestSchema. */
export const permissionsRequestMicrophoneRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.PermissionsRequestMicrophone),
  params: emptyParamsProperty,
});

/** Engine protocol schema for permissionsRequestInputMonitoringRequestSchema. */
export const permissionsRequestInputMonitoringRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.PermissionsRequestInputMonitoring),
  params: emptyParamsProperty,
});

/** Engine protocol schema for permissionsOpenInputSettingsRequestSchema. */
export const permissionsOpenInputSettingsRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.PermissionsOpenInputMonitoringSettings),
  params: emptyParamsProperty,
});

/** Engine protocol schema for sourcesListRequestSchema. */
export const sourcesListRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.SourcesList),
  params: emptyParamsProperty,
});

/** Engine protocol schema for captureStartDisplayRequestSchema. */
export const captureStartDisplayRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.CaptureStartDisplay),
  params: Schema.Struct({
    displayId: Schema.optional(NonNegativeInt),
    enableMic: enableMicProperty,
    enablePreview: enablePreviewProperty,
    captureFps: captureFrameRateProperty,
  }),
});

/** Engine protocol schema for captureStartCurrentWindowRequestSchema. */
export const captureStartCurrentWindowRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.CaptureStartCurrentWindow),
  params: Schema.Struct({
    enableMic: enableMicProperty,
    enablePreview: enablePreviewProperty,
    captureFps: captureFrameRateProperty,
  }),
});

/** Engine protocol schema for captureStartWindowRequestSchema. */
export const captureStartWindowRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.CaptureStartWindow),
  params: Schema.Struct({
    windowId: NonNegativeInt,
    enableMic: enableMicProperty,
    enablePreview: enablePreviewProperty,
    captureFps: captureFrameRateProperty,
  }),
});

/** Engine protocol schema for captureStopRequestSchema. */
export const captureStopRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.CaptureStop),
  params: emptyParamsProperty,
});

/** Engine protocol schema for recordingStartRequestSchema. */
export const recordingStartRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.RecordingStart),
  params: Schema.Struct({
    trackInputEvents: trackInputEventsProperty,
  }),
});

/** Engine protocol schema for recordingStopRequestSchema. */
export const recordingStopRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.RecordingStop),
  params: emptyParamsProperty,
});

/** Engine protocol schema for captureStatusRequestSchema. */
export const captureStatusRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.CaptureStatus),
  params: emptyParamsProperty,
});

/** Engine protocol schema for capturePreviewFrameRequestSchema. */
export const capturePreviewFrameRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.CapturePreviewFrame),
  params: emptyParamsProperty,
});

/** Engine protocol schema for exportInfoRequestSchema. */
export const exportInfoRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.ExportInfo),
  params: emptyParamsProperty,
});

/** Engine protocol schema for exportRunRequestSchema. */
export const exportRunRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.ExportRun),
  params: Schema.Struct({
    outputURL: NonEmptyString,
    presetId: NonEmptyString,
    trimStartSeconds: Schema.optional(NonNegativeNumber),
    trimEndSeconds: Schema.optional(NonNegativeNumber),
    timeline: Schema.optional(timelineDocumentSchema),
  }),
});

/** Engine protocol schema for exportRunCutPlanRequestSchema. */
export const exportRunCutPlanRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.ExportRunCutPlan),
  params: Schema.Struct({
    outputURL: NonEmptyString,
    presetId: NonEmptyString,
    jobId: NonEmptyString,
  }),
});

/** Engine protocol schema for projectCurrentRequestSchema. */
export const projectCurrentRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.ProjectCurrent),
  params: emptyParamsProperty,
});

/** Engine protocol schema for projectOpenRequestSchema. */
export const projectOpenRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.ProjectOpen),
  params: Schema.Struct({
    projectPath: NonEmptyString,
  }),
});

/** Engine protocol schema for projectSaveRequestSchema. */
export const projectSaveRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.ProjectSave),
  params: Schema.Struct({
    projectPath: Schema.optional(NonEmptyString),
    autoZoom: Schema.optional(autoZoomSettingsSchema),
    timeline: Schema.optional(timelineDocumentSchema),
  }),
});

/** Engine protocol schema for projectRecentsRequestSchema. */
export const projectRecentsRequestSchema = Schema.Struct({
  ...requestBaseFields,
  method: Schema.Literal(engineMethods.ProjectRecents),
  params: Schema.optionalWith(
    Schema.Struct({
      limit: Schema.optional(ProjectRecentsLimitSchema),
    }),
    { default: () => ({}) },
  ),
});

/** Discriminated union of all request payloads supported by the engine. */
export const engineRequestSchema = Schema.Union(
  systemPingRequestSchema,
  engineCapabilitiesRequestSchema,
  agentPreflightRequestSchema,
  agentRunRequestSchema,
  agentStatusRequestSchema,
  agentApplyRequestSchema,
  permissionsGetRequestSchema,
  permissionsRequestScreenRequestSchema,
  permissionsRequestMicrophoneRequestSchema,
  permissionsRequestInputMonitoringRequestSchema,
  permissionsOpenInputSettingsRequestSchema,
  sourcesListRequestSchema,
  captureStartDisplayRequestSchema,
  captureStartCurrentWindowRequestSchema,
  captureStartWindowRequestSchema,
  captureStopRequestSchema,
  recordingStartRequestSchema,
  recordingStopRequestSchema,
  captureStatusRequestSchema,
  capturePreviewFrameRequestSchema,
  exportInfoRequestSchema,
  exportRunRequestSchema,
  exportRunCutPlanRequestSchema,
  projectCurrentRequestSchema,
  projectOpenRequestSchema,
  projectSaveRequestSchema,
  projectRecentsRequestSchema,
);

/** Error code values returned on failed engine responses. */
export const engineErrorCodeSchema = Schema.Literal(
  "invalid_request",
  "invalid_params",
  "unsupported_method",
  "permission_denied",
  "needs_confirmation",
  "qa_failed",
  "missing_local_model",
  "invalid_cut_plan",
  "runtime_error",
);

/** Error object shape returned by failed engine responses. */
export const engineErrorSchema = Schema.Struct({
  code: engineErrorCodeSchema,
  message: NonEmptyString,
});

/** Success response envelope. */
export const engineSuccessResponseSchema = Schema.Struct({
  id: NonEmptyString,
  ok: Schema.Literal(true),
  result: Schema.Unknown,
});

/** Error response envelope. */
export const engineErrorResponseSchema = Schema.Struct({
  id: NonEmptyString,
  ok: Schema.Literal(false),
  error: engineErrorSchema,
});

/** Union of success and error engine response envelopes. */
export const engineResponseSchema = Schema.Union(
  engineSuccessResponseSchema,
  engineErrorResponseSchema,
);

/** Inferred TypeScript aliases for consumers that only need static typing. */
/** Type alias for EngineRequest. */
export type EngineRequest = MutableSchemaType<typeof engineRequestSchema>;
/** Type alias for EngineRequestEncoded. */
export type EngineRequestEncoded = MutableEncodedSchemaType<typeof engineRequestSchema>;
/** Type alias for EngineResponse. */
export type EngineResponse = MutableSchemaType<typeof engineResponseSchema>;
/** Type alias for EngineErrorCode. */
export type EngineErrorCode = MutableSchemaType<typeof engineErrorCodeSchema>;
/** Type alias for PingResult. */
export type PingResult = MutableSchemaType<typeof pingResultSchema>;
/** Type alias for CapabilitiesResult. */
export type CapabilitiesResult = MutableSchemaType<typeof capabilitiesResultSchema>;
/** Type alias for PermissionsResult. */
export type PermissionsResult = MutableSchemaType<typeof permissionsResultSchema>;
/** Type alias for ActionResult. */
export type ActionResult = MutableSchemaType<typeof actionResultSchema>;
/** Type alias for SourcesResult. */
export type SourcesResult = MutableSchemaType<typeof sourcesResultSchema>;
/** Type alias for CaptureFrameRate. */
export type CaptureFrameRate = MutableSchemaType<typeof captureFrameRateSchema>;
/** Type alias for CaptureTelemetry. */
export type CaptureTelemetry = MutableSchemaType<typeof captureTelemetrySchema>;
/** Type alias for CapturePreviewFrame. */
export type CapturePreviewFrame = MutableSchemaType<typeof capturePreviewFrameSchema>;
/** Type alias for CaptureStatusResult. */
export type CaptureStatusResult = MutableSchemaType<typeof captureStatusResultSchema>;
/** Type alias for CapturePreviewFrameResult. */
export type CapturePreviewFrameResult = MutableSchemaType<typeof capturePreviewFrameResultSchema>;
/** Type alias for TimelineSegment. */
export type TimelineSegment = MutableSchemaType<typeof timelineSegmentSchema>;
/** Type alias for TimelineDocument. */
export type TimelineDocument = MutableSchemaType<typeof timelineDocumentSchema>;
/** Type alias for ExportPreset. */
export type ExportPreset = MutableSchemaType<typeof exportPresetSchema>;
/** Type alias for ExportInfoResult. */
export type ExportInfoResult = MutableSchemaType<typeof exportInfoResultSchema>;
/** Type alias for ExportRunResult. */
export type ExportRunResult = MutableSchemaType<typeof exportRunResultSchema>;
/** Type alias for AgentJobStatus. */
export type AgentJobStatus = MutableSchemaType<typeof agentJobStatusSchema>;
/** Type alias for AgentArtifactKind. */
export type AgentArtifactKind = MutableSchemaType<typeof agentArtifactKindSchema>;
/** Type alias for AgentArtifact. */
export type AgentArtifact = MutableSchemaType<typeof agentArtifactSchema>;
/** Type alias for TranscriptionProvider. */
export type TranscriptionProvider = MutableSchemaType<typeof transcriptionProviderSchema>;
/** Type alias for ImportedTranscriptSegment. */
export type ImportedTranscriptSegment = MutableSchemaType<typeof importedTranscriptSegmentSchema>;
/** Type alias for ImportedTranscriptWord. */
export type ImportedTranscriptWord = MutableSchemaType<typeof importedTranscriptWordSchema>;
/** Type alias for ImportedTranscript. */
export type ImportedTranscript = MutableSchemaType<typeof importedTranscriptSchema>;
/** Type alias for AgentPreflightBlockingReason. */
export type AgentPreflightBlockingReason = MutableSchemaType<
  typeof agentPreflightBlockingReasonSchema
>;
/** Type alias for AgentRunBlockingReason. */
export type AgentRunBlockingReason = MutableSchemaType<typeof agentRunBlockingReasonSchema>;
/** Type alias for AgentQAReport. */
export type AgentQAReport = MutableSchemaType<typeof agentQAReportSchema>;
/** Type alias for AgentRunSummary. */
export type AgentRunSummary = MutableSchemaType<typeof agentRunSummarySchema>;
/** Type alias for AgentPreflightResult. */
export type AgentPreflightResult = MutableSchemaType<typeof agentPreflightResultSchema>;
/** Type alias for AgentRunResult. */
export type AgentRunResult = MutableSchemaType<typeof agentRunResultSchema>;
/** Type alias for AgentStatusResult. */
export type AgentStatusResult = MutableSchemaType<typeof agentStatusResultSchema>;
/** Type alias for ExportRunCutPlanResult. */
export type ExportRunCutPlanResult = MutableSchemaType<typeof exportRunCutPlanResultSchema>;
/** Type alias for ProjectAgentAnalysisSummary. */
export type ProjectAgentAnalysisSummary = MutableSchemaType<
  typeof projectAgentAnalysisSummarySchema
>;
/** Type alias for ProjectState. */
export type ProjectState = MutableSchemaType<typeof projectStateSchema>;
/** Type alias for ProjectRecentItem. */
export type ProjectRecentItem = MutableSchemaType<typeof projectRecentItemSchema>;
/** Type alias for ProjectRecentsResult. */
export type ProjectRecentsResult = MutableSchemaType<typeof projectRecentsResultSchema>;
/** Type alias for AutoZoomSettings. */
export type AutoZoomSettings = MutableSchemaType<typeof autoZoomSettingsSchema>;
/** Type alias for InputEvent. */
export type InputEvent = MutableSchemaType<typeof inputEventSchema>;
/** Type alias for InputEventLog. */
export type InputEventLog = MutableSchemaType<typeof inputEventLogSchema>;

/**
 * Builds and validates a method-specific engine request envelope.
 *
 * Consumers should prefer this helper over hand-rolled objects so defaulted params,
 * discriminated unions, and request ids remain aligned with the wire contract.
 */
export function buildRequest<TMethod extends EngineRequestEncoded["method"]>(
  method: TMethod,
  params: Extract<EngineRequestEncoded, { method: TMethod }>["params"],
  id = crypto.randomUUID(),
): Extract<EngineRequest, { method: TMethod }> {
  return decodeSchemaSync(engineRequestSchema, { id, method, params }) as Extract<
    EngineRequest,
    { method: TMethod }
  >;
}

/**
 * Parses an unknown engine response and narrows it to the validated response envelope union.
 *
 * This is the last contract boundary before renderer code branches on `ok` or reads
 * engine-specific payloads, so all untrusted bridge data should pass through here first.
 */
export function parseResponse(raw: unknown): EngineResponse {
  return decodeSchemaSync(engineResponseSchema, raw);
}
