import { z } from "zod";
import { engineMethods } from "./methods";

/** Input Monitoring permission states returned by the native engine. */
export const inputMonitoringStatusSchema = z.enum(["notDetermined", "denied", "authorized"]);

/** Auto-zoom project settings shared between renderer and native engine. */
export const autoZoomSettingsSchema = z.object({
  isEnabled: z.boolean(),
  intensity: z.number().min(0).max(1),
  minimumKeyframeInterval: z.number().positive(),
});

/** Optional capture metadata embedded in capture status and project state. */
export const captureMetadataSchema = z
  .object({
    window: z
      .object({
        id: z.number().int().nonnegative(),
        title: z.string(),
        appName: z.string(),
      })
      .nullable()
      .optional()
      .default(null),
    source: z.enum(["display", "window"]),
    contentRect: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
    }),
    pixelScale: z.number().positive(),
    fps: z.number().positive().nullable().optional(),
  })
  .nullable();

/** Input event payload captured during recording. */
export const inputEventSchema = z.object({
  type: z.enum(["cursorMoved", "mouseDown", "mouseUp"]),
  timestamp: z.number().nonnegative(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  button: z.enum(["left", "right", "other"]).optional(),
});

/** Input event log written by engines that support input tracking. */
export const inputEventLogSchema = z.object({
  schemaVersion: z.literal(1),
  events: z.array(inputEventSchema),
});

/** Result payload for `system.ping`. */
export const pingResultSchema = z.object({
  app: z.string().min(1),
  engineVersion: z.string().min(1),
  protocolVersion: z.string().min(1),
  platform: z.string().min(1),
});

/** Result payload for `engine.capabilities`. */
export const capabilitiesResultSchema = z.object({
  protocolVersion: z.string().min(1),
  platform: z.string().min(1),
  phase: z.enum(["stub", "foundation", "native"]),
  capture: z.object({
    display: z.boolean(),
    window: z.boolean(),
    systemAudio: z.boolean(),
    microphone: z.boolean(),
  }),
  recording: z.object({
    inputTracking: z.boolean(),
  }),
  export: z.object({
    presets: z.boolean(),
    cutPlan: z.boolean().optional().default(false),
  }),
  project: z.object({
    openSave: z.boolean(),
  }),
  agent: z
    .object({
      preflight: z.boolean(),
      run: z.boolean(),
      status: z.boolean(),
      apply: z.boolean(),
      localOnly: z.boolean().optional().default(true),
      runtimeBudgetMinutes: z.number().int().positive().optional().default(10),
    })
    .optional()
    .default({
      preflight: false,
      run: false,
      status: false,
      apply: false,
      localOnly: true,
      runtimeBudgetMinutes: 10,
    }),
});

/** Result payload for `permissions.get`. */
export const permissionsResultSchema = z.object({
  screenRecordingGranted: z.boolean(),
  microphoneGranted: z.boolean(),
  inputMonitoring: inputMonitoringStatusSchema,
});

/** Generic success/failure payload for permission action requests. */
export const actionResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

/** Display capture source descriptor. */
export const displaySourceSchema = z.object({
  id: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

/** Window capture source descriptor. */
export const windowSourceSchema = z.object({
  id: z.number().int().nonnegative(),
  title: z.string(),
  appName: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
  isOnScreen: z.boolean(),
});

/** Result payload for `sources.list`. */
export const sourcesResultSchema = z.object({
  displays: z.array(displaySourceSchema),
  windows: z.array(windowSourceSchema),
});

/** Health severity for capture telemetry. */
export const captureHealthSchema = z.enum(["good", "warning", "critical"]);
/** Optional reason code associated with non-good telemetry health. */
export const captureHealthReasonSchema = z.enum([
  "engine_error",
  "high_dropped_frame_rate",
  "elevated_dropped_frame_rate",
  "low_microphone_level",
]);
/** Supported capture frame rates for all engines. */
export const captureFrameRates = [24, 30, 60] as const;
/** Default capture frame rate used when request params omit `captureFps`. */
export const defaultCaptureFrameRate: (typeof captureFrameRates)[number] = 30;
const [captureFrameRate24, captureFrameRate30, captureFrameRate60] = captureFrameRates;
/** Zod schema for engine-supported capture FPS values. */
export const captureFrameRateSchema = z.union([
  z.literal(captureFrameRate24),
  z.literal(captureFrameRate30),
  z.literal(captureFrameRate60),
]);

/** Default telemetry object used by older engine responses. */
export const defaultCaptureTelemetry = {
  totalFrames: 0,
  droppedFrames: 0,
  droppedFramePercent: 0,
  sourceDroppedFrames: 0,
  sourceDroppedFramePercent: 0,
  writerDroppedFrames: 0,
  writerBackpressureDrops: 0,
  writerDroppedFramePercent: 0,
  achievedFps: 0,
  cpuPercent: null,
  memoryBytes: null,
  recordingBitrateMbps: null,
  audioLevelDbfs: null,
  health: "good",
  healthReason: null,
} satisfies {
  totalFrames: number;
  droppedFrames: number;
  droppedFramePercent: number;
  sourceDroppedFrames: number;
  sourceDroppedFramePercent: number;
  writerDroppedFrames: number;
  writerBackpressureDrops: number;
  writerDroppedFramePercent: number;
  achievedFps: number;
  cpuPercent: number | null;
  memoryBytes: number | null;
  recordingBitrateMbps: number | null;
  audioLevelDbfs: number | null;
  health: "good" | "warning" | "critical";
  healthReason:
    | "engine_error"
    | "high_dropped_frame_rate"
    | "elevated_dropped_frame_rate"
    | "low_microphone_level"
    | null;
};

/** Capture telemetry payload returned by `capture.status`. */
export const captureTelemetrySchema = z.object({
  totalFrames: z.number().int().nonnegative(),
  droppedFrames: z.number().int().nonnegative(),
  droppedFramePercent: z.number().nonnegative(),
  sourceDroppedFrames: z.number().int().nonnegative().optional().default(0),
  sourceDroppedFramePercent: z.number().nonnegative().optional().default(0),
  writerDroppedFrames: z.number().int().nonnegative().optional().default(0),
  writerBackpressureDrops: z.number().int().nonnegative().optional().default(0),
  writerDroppedFramePercent: z.number().nonnegative().optional().default(0),
  achievedFps: z.number().nonnegative().optional().default(0),
  cpuPercent: z.number().nonnegative().nullable().optional().default(null),
  memoryBytes: z.number().nonnegative().nullable().optional().default(null),
  recordingBitrateMbps: z.number().nonnegative().nullable().optional().default(null),
  audioLevelDbfs: z.number().nullable(),
  health: captureHealthSchema,
  healthReason: captureHealthReasonSchema.nullable(),
});

/** Result payload for capture and recording lifecycle methods. */
export const captureStatusResultSchema = z.object({
  isRunning: z.boolean(),
  isRecording: z.boolean(),
  recordingDurationSeconds: z.number().nonnegative(),
  recordingURL: z.string().nullable(),
  captureMetadata: captureMetadataSchema.optional().default(null),
  lastError: z.string().nullable(),
  eventsURL: z.string().nullable(),
  telemetry: captureTelemetrySchema.optional().default(defaultCaptureTelemetry),
});

/** Export preset descriptor returned by `export.info`. */
export const exportPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  fileType: z.enum(["mp4", "mov"]),
});

/** Result payload for `export.info`. */
export const exportInfoResultSchema = z.object({
  presets: z.array(exportPresetSchema),
});

/** Result payload for `export.run`. */
export const exportRunResultSchema = z.object({
  outputURL: z.string().min(1),
});

/** Agent job lifecycle statuses. */
export const agentJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "blocked",
]);

/** Artifact kinds emitted by `agent.run`. */
export const agentArtifactKindSchema = z.enum([
  "transcript.full.v1",
  "transcript.words.v1",
  "beat-map.v1",
  "qa-report.v1",
  "cut-plan.v1",
  "run-summary.v1",
]);

/** Single persisted agent artifact descriptor. */
export const agentArtifactSchema = z.object({
  kind: agentArtifactKindSchema,
  path: z.string().min(1),
});

/** Supported transcription providers for Agent Mode v1. */
export const transcriptionProviderSchema = z.enum(["none", "imported_transcript"]);

/** Single imported transcript segment entry with absolute timing in seconds. */
export const importedTranscriptSegmentSchema = z
  .object({
    text: z.string().min(1),
    startSeconds: z.number().min(0),
    endSeconds: z.number().min(0),
  })
  .refine((segment) => segment.endSeconds > segment.startSeconds, {
    message: "Imported transcript segment endSeconds must be greater than startSeconds.",
    path: ["endSeconds"],
  });

/** Single imported transcript word entry with absolute timing in seconds. */
export const importedTranscriptWordSchema = z
  .object({
    word: z.string().min(1),
    startSeconds: z.number().min(0),
    endSeconds: z.number().min(0),
  })
  .refine((word) => word.endSeconds > word.startSeconds, {
    message: "Imported transcript word endSeconds must be greater than startSeconds.",
    path: ["endSeconds"],
  });

/** Canonical imported transcript payload accepted by Agent Mode v1. */
export const importedTranscriptSchema = z
  .object({
    segments: z.array(importedTranscriptSegmentSchema).optional().default([]),
    words: z.array(importedTranscriptWordSchema).optional().default([]),
  })
  .refine((transcript) => transcript.segments.length > 0 || transcript.words.length > 0, {
    message: "Imported transcript must contain at least one segment or one word entry.",
    path: ["segments"],
  });

/** Machine-readable reasons emitted by Agent Mode preflight. */
export const agentPreflightBlockingReasonSchema = z.enum([
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
]);

/** Machine-readable reasons emitted by Agent Mode run/status payloads. */
export const agentRunBlockingReasonSchema = z.enum([
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
]);

/** Narrative QA gate report produced by `agent.run`. */
export const agentQAReportSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  coverage: z.object({
    hook: z.boolean(),
    action: z.boolean(),
    payoff: z.boolean(),
    takeaway: z.boolean(),
  }),
  missingBeats: z.array(z.enum(["hook", "action", "payoff", "takeaway"])).default([]),
});

/** Summary payload for agent pipeline execution. */
export const agentRunSummarySchema = z.object({
  jobId: z.string().min(1),
  status: agentJobStatusSchema,
  runtimeBudgetMinutes: z.number().int().positive(),
  qaReport: agentQAReportSchema.nullable(),
  blockingReason: agentRunBlockingReasonSchema.nullable(),
  updatedAt: z.string().datetime(),
});

/** Result payload for `agent.preflight`. */
export const agentPreflightResultSchema = z.object({
  ready: z.boolean(),
  blockingReasons: z.array(agentPreflightBlockingReasonSchema),
  canApplyDestructive: z.boolean(),
  transcriptionProvider: transcriptionProviderSchema,
  preflightToken: z.string().min(1).nullable(),
});

/** Result payload for `agent.run`. */
export const agentRunResultSchema = z.object({
  jobId: z.string().min(1),
  status: agentJobStatusSchema,
});

/** Result payload for `agent.status`. */
export const agentStatusResultSchema = agentRunSummarySchema;

/** Result payload for `export.runCutPlan`. */
export const exportRunCutPlanResultSchema = z.object({
  outputURL: z.string().min(1),
  appliedSegments: z.number().int().nonnegative(),
});

/** Project-level summary for the latest agent run metadata. */
export const projectAgentAnalysisSummarySchema = z.object({
  latestJobId: z.string().nullable(),
  latestStatus: agentJobStatusSchema.nullable(),
  qaPassed: z.boolean().nullable(),
  updatedAt: z.string().datetime().nullable(),
});

/** Engine protocol schema for projectStateSchema. */
export const projectStateSchema = z.object({
  projectPath: z.string().nullable(),
  recordingURL: z.string().nullable(),
  eventsURL: z.string().nullable(),
  autoZoom: autoZoomSettingsSchema,
  captureMetadata: captureMetadataSchema,
  agentAnalysis: projectAgentAnalysisSummarySchema.optional().default({
    latestJobId: null,
    latestStatus: null,
    qaPassed: null,
    updatedAt: null,
  }),
});

/** Engine protocol schema for projectRecentItemSchema. */
export const projectRecentItemSchema = z.object({
  projectPath: z.string().min(1),
  displayName: z.string().min(1),
  lastOpenedAt: z.string().datetime(),
});

/** Engine protocol schema for projectRecentsResultSchema. */
export const projectRecentsResultSchema = z.object({
  items: z.array(projectRecentItemSchema),
});

const requestBaseSchema = z.object({
  id: z.string().min(1),
});

const emptyParamsSchema = z.looseObject({}).optional().default({});

/** Engine protocol schema for systemPingRequestSchema. */
export const systemPingRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.SystemPing),
  params: emptyParamsSchema,
});

/** Engine protocol schema for engineCapabilitiesRequestSchema. */
export const engineCapabilitiesRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.EngineCapabilities),
  params: emptyParamsSchema,
});

/** Engine protocol schema for agentPreflightRequestSchema. */
export const agentPreflightRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.AgentPreflight),
  params: z.object({
    runtimeBudgetMinutes: z.number().int().positive().max(60).optional().default(10),
    transcriptionProvider: transcriptionProviderSchema.optional().default("none"),
    importedTranscriptPath: z.string().min(1).optional(),
  }),
});

/** Engine protocol schema for agentRunRequestSchema. */
export const agentRunRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.AgentRun),
  params: z.object({
    preflightToken: z.string().min(1),
    runtimeBudgetMinutes: z.number().int().positive().max(60).optional().default(10),
    transcriptionProvider: transcriptionProviderSchema.optional().default("none"),
    importedTranscriptPath: z.string().min(1).optional(),
    force: z.boolean().optional().default(false),
  }),
});

/** Engine protocol schema for agentStatusRequestSchema. */
export const agentStatusRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.AgentStatus),
  params: z.object({
    jobId: z.string().min(1),
  }),
});

/** Engine protocol schema for agentApplyRequestSchema. */
export const agentApplyRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.AgentApply),
  params: z.object({
    jobId: z.string().min(1),
    destructiveIntent: z.boolean().optional().default(false),
  }),
});

/** Engine protocol schema for permissionsGetRequestSchema. */
export const permissionsGetRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.PermissionsGet),
  params: emptyParamsSchema,
});

/** Engine protocol schema for permissionsRequestScreenRequestSchema. */
export const permissionsRequestScreenRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.PermissionsRequestScreenRecording),
  params: emptyParamsSchema,
});

/** Engine protocol schema for permissionsRequestMicrophoneRequestSchema. */
export const permissionsRequestMicrophoneRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.PermissionsRequestMicrophone),
  params: emptyParamsSchema,
});

/** Engine protocol schema for permissionsRequestInputMonitoringRequestSchema. */
export const permissionsRequestInputMonitoringRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.PermissionsRequestInputMonitoring),
  params: emptyParamsSchema,
});

/** Engine protocol schema for permissionsOpenInputSettingsRequestSchema. */
export const permissionsOpenInputSettingsRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.PermissionsOpenInputMonitoringSettings),
  params: emptyParamsSchema,
});

/** Engine protocol schema for sourcesListRequestSchema. */
export const sourcesListRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.SourcesList),
  params: emptyParamsSchema,
});

/** Engine protocol schema for captureStartDisplayRequestSchema. */
export const captureStartDisplayRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.CaptureStartDisplay),
  params: z.object({
    enableMic: z.boolean().optional().default(false),
    captureFps: captureFrameRateSchema.optional().default(defaultCaptureFrameRate),
  }),
});

/** Engine protocol schema for captureStartCurrentWindowRequestSchema. */
export const captureStartCurrentWindowRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.CaptureStartCurrentWindow),
  params: z.object({
    enableMic: z.boolean().optional().default(false),
    captureFps: captureFrameRateSchema.optional().default(defaultCaptureFrameRate),
  }),
});

/** Engine protocol schema for captureStartWindowRequestSchema. */
export const captureStartWindowRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.CaptureStartWindow),
  params: z.object({
    windowId: z.number().int().nonnegative(),
    enableMic: z.boolean().optional().default(false),
    captureFps: captureFrameRateSchema.optional().default(defaultCaptureFrameRate),
  }),
});

/** Engine protocol schema for captureStopRequestSchema. */
export const captureStopRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.CaptureStop),
  params: emptyParamsSchema,
});

/** Engine protocol schema for recordingStartRequestSchema. */
export const recordingStartRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.RecordingStart),
  params: z.object({
    trackInputEvents: z.boolean().optional().default(false),
  }),
});

/** Engine protocol schema for recordingStopRequestSchema. */
export const recordingStopRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.RecordingStop),
  params: emptyParamsSchema,
});

/** Engine protocol schema for captureStatusRequestSchema. */
export const captureStatusRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.CaptureStatus),
  params: emptyParamsSchema,
});

/** Engine protocol schema for exportInfoRequestSchema. */
export const exportInfoRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.ExportInfo),
  params: emptyParamsSchema,
});

/** Engine protocol schema for exportRunRequestSchema. */
export const exportRunRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.ExportRun),
  params: z.object({
    outputURL: z.string().min(1),
    presetId: z.string().min(1),
    trimStartSeconds: z.number().min(0).optional(),
    trimEndSeconds: z.number().min(0).optional(),
  }),
});

/** Engine protocol schema for exportRunCutPlanRequestSchema. */
export const exportRunCutPlanRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.ExportRunCutPlan),
  params: z.object({
    outputURL: z.string().min(1),
    presetId: z.string().min(1),
    jobId: z.string().min(1),
  }),
});

/** Engine protocol schema for projectCurrentRequestSchema. */
export const projectCurrentRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.ProjectCurrent),
  params: emptyParamsSchema,
});

/** Engine protocol schema for projectOpenRequestSchema. */
export const projectOpenRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.ProjectOpen),
  params: z.object({
    projectPath: z.string().min(1),
  }),
});

/** Engine protocol schema for projectSaveRequestSchema. */
export const projectSaveRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.ProjectSave),
  params: z.object({
    projectPath: z.string().min(1).optional(),
    autoZoom: autoZoomSettingsSchema.optional(),
  }),
});

/** Engine protocol schema for projectRecentsRequestSchema. */
export const projectRecentsRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.ProjectRecents),
  params: z
    .object({
      limit: z.number().int().positive().max(100).optional(),
    })
    .optional()
    .default({}),
});

/** Discriminated union of all request payloads supported by the engine. */
export const engineRequestSchema = z.discriminatedUnion("method", [
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
  exportInfoRequestSchema,
  exportRunRequestSchema,
  exportRunCutPlanRequestSchema,
  projectCurrentRequestSchema,
  projectOpenRequestSchema,
  projectSaveRequestSchema,
  projectRecentsRequestSchema,
]);

/** Error code values returned on failed engine responses. */
export const engineErrorCodeSchema = z.enum([
  "invalid_request",
  "invalid_params",
  "unsupported_method",
  "permission_denied",
  "needs_confirmation",
  "qa_failed",
  "missing_local_model",
  "invalid_cut_plan",
  "runtime_error",
]);

/** Error object shape returned by failed engine responses. */
export const engineErrorSchema = z.object({
  code: engineErrorCodeSchema,
  message: z.string().min(1),
});

/** Success response envelope. */
export const engineSuccessResponseSchema = z.object({
  id: z.string().min(1),
  ok: z.literal(true),
  result: z.unknown(),
});

/** Error response envelope. */
export const engineErrorResponseSchema = z.object({
  id: z.string().min(1),
  ok: z.literal(false),
  error: engineErrorSchema,
});

/** Union of success and error engine response envelopes. */
export const engineResponseSchema = z.union([
  engineSuccessResponseSchema,
  engineErrorResponseSchema,
]);

/** Type alias for EngineRequest. */
export type EngineRequest = z.infer<typeof engineRequestSchema>;
/** Type alias for EngineResponse. */
export type EngineResponse = z.infer<typeof engineResponseSchema>;
/** Type alias for EngineErrorCode. */
export type EngineErrorCode = z.infer<typeof engineErrorCodeSchema>;
/** Type alias for PingResult. */
export type PingResult = z.infer<typeof pingResultSchema>;
/** Type alias for CapabilitiesResult. */
export type CapabilitiesResult = z.infer<typeof capabilitiesResultSchema>;
/** Type alias for PermissionsResult. */
export type PermissionsResult = z.infer<typeof permissionsResultSchema>;
/** Type alias for ActionResult. */
export type ActionResult = z.infer<typeof actionResultSchema>;
/** Type alias for SourcesResult. */
export type SourcesResult = z.infer<typeof sourcesResultSchema>;
/** Type alias for CaptureHealth. */
export type CaptureHealth = z.infer<typeof captureHealthSchema>;
/** Type alias for CaptureHealthReason. */
export type CaptureHealthReason = z.infer<typeof captureHealthReasonSchema>;
/** Type alias for CaptureFrameRate. */
export type CaptureFrameRate = z.infer<typeof captureFrameRateSchema>;
/** Type alias for CaptureTelemetry. */
export type CaptureTelemetry = z.infer<typeof captureTelemetrySchema>;
/** Type alias for CaptureStatusResult. */
export type CaptureStatusResult = z.infer<typeof captureStatusResultSchema>;
/** Type alias for ExportPreset. */
export type ExportPreset = z.infer<typeof exportPresetSchema>;
/** Type alias for ExportInfoResult. */
export type ExportInfoResult = z.infer<typeof exportInfoResultSchema>;
/** Type alias for ExportRunResult. */
export type ExportRunResult = z.infer<typeof exportRunResultSchema>;
/** Type alias for AgentJobStatus. */
export type AgentJobStatus = z.infer<typeof agentJobStatusSchema>;
/** Type alias for AgentArtifactKind. */
export type AgentArtifactKind = z.infer<typeof agentArtifactKindSchema>;
/** Type alias for AgentArtifact. */
export type AgentArtifact = z.infer<typeof agentArtifactSchema>;
/** Type alias for TranscriptionProvider. */
export type TranscriptionProvider = z.infer<typeof transcriptionProviderSchema>;
/** Type alias for ImportedTranscriptSegment. */
export type ImportedTranscriptSegment = z.infer<typeof importedTranscriptSegmentSchema>;
/** Type alias for ImportedTranscriptWord. */
export type ImportedTranscriptWord = z.infer<typeof importedTranscriptWordSchema>;
/** Type alias for ImportedTranscript. */
export type ImportedTranscript = z.infer<typeof importedTranscriptSchema>;
/** Type alias for AgentPreflightBlockingReason. */
export type AgentPreflightBlockingReason = z.infer<typeof agentPreflightBlockingReasonSchema>;
/** Type alias for AgentRunBlockingReason. */
export type AgentRunBlockingReason = z.infer<typeof agentRunBlockingReasonSchema>;
/** Type alias for AgentQAReport. */
export type AgentQAReport = z.infer<typeof agentQAReportSchema>;
/** Type alias for AgentRunSummary. */
export type AgentRunSummary = z.infer<typeof agentRunSummarySchema>;
/** Type alias for AgentPreflightResult. */
export type AgentPreflightResult = z.infer<typeof agentPreflightResultSchema>;
/** Type alias for AgentRunResult. */
export type AgentRunResult = z.infer<typeof agentRunResultSchema>;
/** Type alias for AgentStatusResult. */
export type AgentStatusResult = z.infer<typeof agentStatusResultSchema>;
/** Type alias for ExportRunCutPlanResult. */
export type ExportRunCutPlanResult = z.infer<typeof exportRunCutPlanResultSchema>;
/** Type alias for ProjectAgentAnalysisSummary. */
export type ProjectAgentAnalysisSummary = z.infer<typeof projectAgentAnalysisSummarySchema>;
/** Type alias for ProjectState. */
export type ProjectState = z.infer<typeof projectStateSchema>;
/** Type alias for ProjectRecentItem. */
export type ProjectRecentItem = z.infer<typeof projectRecentItemSchema>;
/** Type alias for ProjectRecentsResult. */
export type ProjectRecentsResult = z.infer<typeof projectRecentsResultSchema>;
/** Type alias for AutoZoomSettings. */
export type AutoZoomSettings = z.infer<typeof autoZoomSettingsSchema>;
/** Type alias for InputEvent. */
export type InputEvent = z.infer<typeof inputEventSchema>;
/** Type alias for InputEventLog. */
export type InputEventLog = z.infer<typeof inputEventLogSchema>;

/** Builds and validates a typed engine request payload. */
export function buildRequest<TMethod extends EngineRequest["method"]>(
  method: TMethod,
  params: Extract<EngineRequest, { method: TMethod }>["params"],
  id = crypto.randomUUID(),
): Extract<EngineRequest, { method: TMethod }> {
  return engineRequestSchema.parse({ id, method, params }) as Extract<
    EngineRequest,
    { method: TMethod }
  >;
}

/** Parses and validates an engine response payload. */
export function parseResponse(raw: unknown): EngineResponse {
  return engineResponseSchema.parse(raw);
}
